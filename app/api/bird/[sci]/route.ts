import { NextResponse } from "next/server";
import { RECORDINGS_BUCKET, serviceClient } from "@/lib/supabase";
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
