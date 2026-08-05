import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { findSpecies, findByCommonName } from "@/lib/species";

/**
 * Add a bird from a shared Merlin link.
 *
 * Merlin's share sheet produces URLs like https://merlinbirds.org/species/arcter
 * where the last segment is eBird's species code. This turns one of those into a
 * bird on the list, so Lucy can share straight from Merlin instead of typing.
 *
 * Deliberately transport-agnostic: an iOS Shortcut posts here directly, and an
 * inbound-email handler would post here too after pulling the link out of the
 * message body. Whatever we choose to carry the link, this is the thing that
 * understands it.
 *
 *   POST { "url": "https://merlinbirds.org/species/arcter" }
 *   POST { "text": "...any text containing such a link..." }
 */

export const runtime = "nodejs";

const MERLIN_LINK = /https?:\/\/(?:www\.)?merlinbirds\.org\/species\/([a-z0-9]+)/i;

/**
 * Resolve an eBird species code by reading Merlin's own page for it.
 *
 * Deliberately not the eBird taxonomy API: that needs a key, and this needs no
 * credentials and is the exact page the link points at. Cached for a week —
 * a species code never changes meaning.
 */
async function speciesFromCode(code: string): Promise<{ sci: string; com: string } | null> {
  try {
    const response = await fetch(`https://merlinbirds.org/species/${encodeURIComponent(code)}`, {
      headers: { "User-Agent": "LucysBirds/1.0 (https://lucys-birds.vercel.app)" },
      next: { revalidate: 604800 },
    });
    if (!response.ok) return null;
    const html = await response.text();

    // The page titles itself with the common name and carries the scientific
    // name in an <em>/italic near it. Try the structured hints first.
    const sci =
      html.match(/<i[^>]*>\s*([A-Z][a-z]+ [a-z-]+)\s*<\/i>/)?.[1] ??
      html.match(/<em[^>]*>\s*([A-Z][a-z]+ [a-z-]+)\s*<\/em>/)?.[1] ??
      html.match(/"scientificName"\s*:\s*"([^"]+)"/)?.[1] ??
      null;

    const com =
      html.match(/<title>\s*([^<|]+?)\s*(?:\||<)/)?.[1]?.trim() ??
      html.match(/"name"\s*:\s*"([^"]+)"/)?.[1] ??
      null;

    if (sci) return { sci: sci.trim(), com: (com ?? sci).trim() };
    if (com) return { sci: "", com };
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: { url?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const haystack = `${body.url ?? ""} ${body.text ?? ""}`;
  const code = haystack.match(MERLIN_LINK)?.[1];
  if (!code) {
    return NextResponse.json(
      { error: "No Merlin link in that. Share a bird from Merlin and send the link." },
      { status: 400 },
    );
  }

  const resolved = await speciesFromCode(code);
  if (!resolved) {
    return NextResponse.json(
      { error: "Couldn't work out which bird that link is for." },
      { status: 502 },
    );
  }

  // Same rule as the add form: names come from our own list, never from
  // anything a caller sent or a page we scraped.
  const species =
    (resolved.sci ? findSpecies(resolved.sci) : null) ?? findByCommonName(resolved.com);

  if (!species) {
    return NextResponse.json(
      { error: `We don't have "${resolved.com || code}" in the bird list.` },
      { status: 404 },
    );
  }

  const { data, error } = await serviceClient()
    .from("birds")
    .upsert({ sci_name: species.sci, com_name: species.com }, { onConflict: "sci_name" })
    .select("id, com_name")
    .single();

  if (error || !data) {
    console.error("share upsert failed", error);
    return NextResponse.json({ error: "That didn't save." }, { status: 502 });
  }

  // Plain-text summary so an iOS Shortcut can show it as a notification
  // without any parsing.
  return NextResponse.json({
    ok: true,
    birdId: data.id,
    comName: data.com_name,
    message: `${data.com_name} added to Lucy's birds`,
  });
}
