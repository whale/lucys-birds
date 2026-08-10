import { NextResponse } from "next/server";
import { ILLUSTRATIONS_BUCKET, RECORDINGS_BUCKET, serviceClient } from "@/lib/supabase";
import { isCorrectPasscode } from "@/lib/gate";
import { ebirdUrl, wikipediaUrl } from "@/lib/species-paths";

// Detail for one bird, for the slide-in tray. Public — the whole site is.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function lookup(title: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title.replace(/\s+/g, "_"),
      )}`,
      {
        // Wikipedia's policy requires a descriptive User-Agent; without one it
        // throttles, and from a shared serverless IP that means silence.
        headers: {
          "User-Agent": "LucysBirds/1.0 (https://lucys-birds.vercel.app)",
        },
        next: { revalidate: 86400 },
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.extract === "string" && data.extract.length > 0
      ? data.extract
      : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sci: string }> },
) {
  const sciSlug = (await params).sci.toLowerCase();
  const supabase = serviceClient();

  const { data: birds, error } = await supabase
    .from("birds")
    .select("id, sci_name, com_name, added_at");
  if (error) {
    console.error("bird lookup failed", error);
    return NextResponse.json(
      { error: "Couldn't load that bird." },
      { status: 502 },
    );
  }

  const bird = (birds ?? []).find(
    (b) => b.sci_name.toLowerCase().replace(/\s+/g, "-") === sciSlug,
  );
  if (!bird)
    return NextResponse.json({ error: "No such bird." }, { status: 404 });

  const { data: recordings } = await supabase
    .from("bird_recordings")
    .select("id, storage_path, duration_seconds, created_at")
    .eq("bird_id", bird.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  return NextResponse.json({
    id: bird.id,
    sciName: bird.sci_name,
    comName: bird.com_name,
    addedAt: bird.added_at,
    description: await lookup(bird.sci_name),
    recordings: recordings ?? [],
    audioBase: `${process.env.SUPABASE_URL}/storage/v1/object/public/${RECORDINGS_BUCKET}`,
    links: {
      wikipedia: wikipediaUrl(bird.sci_name),
      ebird: ebirdUrl(bird.com_name),
    },
  });
}

function callerIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const hops = request.headers.get("x-forwarded-for")?.split(",").map((hop) => hop.trim()).filter(Boolean);
  return hops?.at(-1) ?? "unknown";
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sci: string }> },
) {
  const supabase = serviceClient();
  const ip = callerIp(request);
  const { data: blocked, error: blockError } = await supabase.rpc("unlock_is_blocked", { p_ip: ip });
  if (blockError) return NextResponse.json({ error: "Can't check that right now. Try again in a moment." }, { status: 503 });
  if (blocked) return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });

  let passcode = "";
  try {
    passcode = String((await request.json()).passcode ?? "");
  } catch {
    return NextResponse.json({ error: "Enter the six-digit code." }, { status: 400 });
  }
  const correct = /^\d{6}$/.test(passcode) && isCorrectPasscode(passcode);
  await supabase.from("unlock_attempts").insert({ ip, ok: correct });
  if (!correct) return NextResponse.json({ error: "That's not the right code." }, { status: 401 });

  const sciSlug = (await params).sci.toLowerCase();
  const { data: birds, error: lookupError } = await supabase
    .from("birds")
    .select("id, sci_name, art_url, flight_art_url");
  if (lookupError) return NextResponse.json({ error: "Couldn't remove that bird." }, { status: 502 });
  const bird = birds?.find((item) => item.sci_name.toLowerCase().replace(/\s+/g, "-") === sciSlug);
  if (!bird) return NextResponse.json({ error: "That bird is no longer in the collection." }, { status: 404 });

  const { data: recordings } = await supabase.from("bird_recordings").select("storage_path").eq("bird_id", bird.id);
  const recordingPaths = recordings?.map((item) => item.storage_path).filter(Boolean) ?? [];
  if (recordingPaths.length) await supabase.storage.from(RECORDINGS_BUCKET).remove(recordingPaths);

  const illustrationPaths = [bird.art_url, bird.flight_art_url]
    .filter((url): url is string => Boolean(url))
    .map((url) => url.split(`/object/public/${ILLUSTRATIONS_BUCKET}/`)[1])
    .filter((path): path is string => Boolean(path));
  if (illustrationPaths.length) await supabase.storage.from(ILLUSTRATIONS_BUCKET).remove(illustrationPaths);

  const { error: deleteError } = await supabase.from("birds").delete().eq("id", bird.id);
  if (deleteError) return NextResponse.json({ error: "Couldn't remove that bird." }, { status: 502 });
  return NextResponse.json({ ok: true, id: bird.id });
}
