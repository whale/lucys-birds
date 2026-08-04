import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

// Lucy adds a bird she saw or heard herself. No audio, no model, no score —
// just her word for it, which for a life list is the oldest and most reliable
// source there is.

export const runtime = "nodejs";

type Body = {
  sciName?: string;
  comName?: string;
  seenAt?: string;
  note?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!body.sciName || !body.comName) {
    return NextResponse.json({ error: "Pick a bird from the list first." }, { status: 400 });
  }

  const seenAt = body.seenAt ? new Date(body.seenAt) : new Date();
  if (Number.isNaN(seenAt.getTime())) {
    return NextResponse.json({ error: "That date doesn't look right." }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("sightings")
    .insert({
      source: "spotted",
      sci_name: body.sciName,
      com_name: body.comName,
      seen_at: seenAt.toISOString(),
      note: body.note?.trim() || null,
      // recording_id, confidence and start/end stay null — the schema's check
      // constraint enforces that a spotted sighting carries none of them.
    })
    .select("id")
    .single();

  if (error) {
    // Postgres error text belongs in the log, not in front of a child.
    console.error("spot insert failed", error);
    return NextResponse.json(
      { error: "That didn't save. Check your signal and try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ id: data.id });
}
