import { NextResponse } from "next/server";
import { RECORDINGS_BUCKET, serviceClient } from "@/lib/supabase";
import { findSpecies } from "@/lib/species";

// Add a bird to the collection, and if a song came with it, hand back a
// one-time link to upload it straight to storage.
//
// The audio row is NOT created here — it's created by /api/add/song once the
// upload has actually landed. Creating it up front would leave rows pointing at
// files that never arrived, and the collage would offer a play button that
// plays nothing.

export const runtime = "nodejs";

type Body = {
  sciName?: string;
  comName?: string;
  withAudio?: boolean;
  lat?: number;
  lon?: number;
  place?: string;
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

  if (!body.sciName || !body.comName) {
    return NextResponse.json(
      { error: "Pick a bird from the list first." },
      { status: 400 },
    );
  }

  // Names come from our own species list, never from the request. The client
  // only chooses WHICH species; it doesn't get to supply the text. Anything
  // stored here is rendered on a public page, so trusting the body would let a
  // caller put arbitrary content in front of every visitor.
  const species = findSpecies(body.sciName);
  if (!species) {
    return NextResponse.json(
      { error: "That isn't a bird we know. Pick one from the list." },
      { status: 400 },
    );
  }

  const supabase = serviceClient();

  // A bird is on the list once. Adding it again is not an error — she may just
  // be coming back to attach a song — so return the existing row either way.
  const { data: bird, error } = await supabase
    .from("birds")
    .upsert(
      {
        sci_name: species.sci,
        com_name: species.com,
        // Only overwrite a location when one was actually supplied, so
        // re-adding a bird to attach a song doesn't wipe where she found it.
        ...(Number.isFinite(body.lat) && Number.isFinite(body.lon)
          ? { lat: body.lat, lon: body.lon }
          : {}),
        ...(body.place?.trim()
          ? { place: body.place.trim().slice(0, 120) }
          : {}),
      },
      { onConflict: "sci_name" },
    )
    .select("id, com_name")
    .single();

  if (error || !bird) {
    console.error("bird upsert failed", error);
    return NextResponse.json(
      { error: "That didn't save. Check your signal and try again." },
      { status: 502 },
    );
  }

  if (!body.withAudio) {
    return NextResponse.json({ birdId: bird.id, comName: bird.com_name });
  }

  // Straight to storage: Vercel caps request bodies at 4.5 MB and a decent
  // recording goes past that.
  const storagePath = `${bird.id}/${crypto.randomUUID()}`;
  const { data: signed, error: signError } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    console.error("createSignedUploadUrl failed", signError);
    // The bird is saved; only the song failed. Say exactly that.
    return NextResponse.json(
      {
        birdId: bird.id,
        comName: bird.com_name,
        audioError: "The bird was added, but the song couldn't upload.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    birdId: bird.id,
    comName: bird.com_name,
    storagePath,
    signedUrl: signed.signedUrl,
  });
}
