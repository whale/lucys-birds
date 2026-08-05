import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

// Called once a song has actually landed in storage. Records it against the
// bird and, if it's the bird's first, makes it the one that plays.

export const runtime = "nodejs";

type Body = {
  birdId?: number;
  storagePath?: string;
  originalName?: string;
  durationSeconds?: number;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  if (!body.birdId || !body.storagePath) {
    return NextResponse.json(
      { error: "Missing birdId or storagePath." },
      { status: 400 },
    );
  }

  const supabase = serviceClient();

  const { count } = await supabase
    .from("bird_recordings")
    .select("*", { count: "exact", head: true })
    .eq("bird_id", body.birdId);

  const { error } = await supabase.from("bird_recordings").insert({
    bird_id: body.birdId,
    storage_path: body.storagePath,
    original_name: body.originalName ?? null,
    duration_seconds: body.durationSeconds ?? null,
    // First song for this bird becomes the one that plays. A partial unique
    // index in the schema guarantees there's never more than one.
    is_primary: (count ?? 0) === 0,
  });

  if (error) {
    console.error("bird_recordings insert failed", error);
    return NextResponse.json(
      { error: "The song uploaded but didn't attach. Try adding it again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
