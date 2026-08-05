import speciesData from "@/data/species.json";

export type Species = { sci: string; com: string; art: boolean; flight: boolean };

/**
 * Server-side species lookups. This module imports the full 480 KB species
 * list — never import it from a "use client" file, or that file ships to the
 * browser. Client code wants `lib/species-paths.ts`.
 */
const ALL = speciesData as Species[];

const ILLUSTRATED = new Set(ALL.filter((s) => s.art).map((s) => s.sci));
const FLIGHT = new Set(ALL.filter((s) => s.flight).map((s) => s.sci));

/**
 * Only 329 of 7,058 species have artwork. Knowing before render lets us draw a
 * placeholder rather than letting the browser show a broken image, which reads
 * as an error rather than a gap.
 */
export function hasArt(sciName: string): boolean {
  return ILLUSTRATED.has(sciName);
}

/** Whether the second, in-flight illustration exists for this species. */
export function hasFlight(sciName: string): boolean {
  return FLIGHT.has(sciName);
}

export { slug, perchedSrc, flightSrc, wikipediaUrl, ebirdUrl } from "./species-paths";
