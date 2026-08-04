import { NextResponse } from "next/server";
import species from "@/data/species.json";

// Type-ahead for the "I saw a bird" picker.
//
// The full list is 7,058 species and about 480 KB. Searching it here rather
// than shipping it to the phone keeps the page light — Lucy is likely on a
// phone outdoors, which is exactly where a half-megabyte download hurts most.

export const runtime = "nodejs";

type Species = { sci: string; com: string; art: boolean };

const ALL = species as Species[];
const LIMIT = 25;

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();

  // No query: the illustrated species, which is the useful default — those are
  // the ones that look like something in the collage.
  if (query.length < 2) {
    return NextResponse.json({ species: ALL.filter((s) => s.art).slice(0, LIMIT) });
  }

  const scored: Array<{ species: Species; score: number }> = [];

  for (const candidate of ALL) {
    const com = candidate.com.toLowerCase();
    const sci = candidate.sci.toLowerCase();

    let score: number;
    if (com === query) score = 0;
    else if (com.startsWith(query)) score = 1;
    // Word-start match: "jay" should find "Blue Jay", not just "Jay Thrush".
    else if (com.includes(` ${query}`)) score = 2;
    else if (com.includes(query)) score = 3;
    else if (sci.startsWith(query) || sci.includes(` ${query}`)) score = 4;
    else continue;

    // Having a picture is worth about half a tier — enough to break ties in
    // favour of a bird that will actually show up in the collage, not enough
    // to bury an exact name match that happens to lack art.
    scored.push({ species: candidate, score: score * 2 + (candidate.art ? 0 : 1) });
  }

  scored.sort((a, b) => a.score - b.score || a.species.com.localeCompare(b.species.com));

  return NextResponse.json({ species: scored.slice(0, LIMIT).map((s) => s.species) });
}
