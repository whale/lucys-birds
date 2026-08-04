import { NextResponse } from "next/server";
import { RECORDINGS_BUCKET, serviceClient } from "@/lib/supabase";

// Hands the browser a one-time signed URL so the audio goes straight from the
// phone to storage. Vercel caps a function's request body at 4.5 MB, and a long
// recording blows past that — routing the bytes through here would break on
// exactly the recordings Lucy cares most about.

export const runtime = "nodejs";

type Body = {
  originalName?: string;
  recordedAt?: string;
  durationSeconds?: number;
  lat?: number;
  lon?: number;
  note?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const recordedAt = body.recordedAt ? new Date(body.recordedAt) : null;
  if (!recordedAt || Number.isNaN(recordedAt.getTime())) {
    return NextResponse.json(
      { error: "recordedAt must be a valid date — it's what puts the bird on the right day." },
      { status: 400 },
    );
  }

  const supabase = serviceClient();

  // Date-partitioned path keeps the bucket browsable by hand when something
  // looks wrong, and guarantees uniqueness without a lookup.
  const stamp = recordedAt.toISOString().replace(/[:.]/g, "-");
  const storagePath = `${recordedAt.toISOString().slice(0, 10)}/${stamp}-${crypto.randomUUID()}.wav`;

  const { data: signed, error: signError } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    console.error("createSignedUploadUrl failed", signError);
    return NextResponse.json(
      { error: `Could not prepare the upload: ${signError?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  const { data: recording, error: insertError } = await supabase
    .from("recordings")
    .insert({
      storage_path: storagePath,
      original_name: body.originalName ?? null,
      recorded_at: recordedAt.toISOString(),
      duration_seconds: body.durationSeconds ?? null,
      lat: body.lat ?? null,
      lon: body.lon ?? null,
      note: body.note ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !recording) {
    console.error("recordings insert failed", insertError);
    return NextResponse.json(
      { error: `Could not save the recording: ${insertError?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    recordingId: recording.id,
    storagePath,
    token: signed.token,
    signedUrl: signed.signedUrl,
  });
}
