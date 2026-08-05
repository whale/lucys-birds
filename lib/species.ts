import speciesData from "@/data/species.json";

export type Species = {
  sci: string;
  com: string;
  art: boolean;
  flight: boolean;
  /** Width / height of the illustration. Only present where artwork exists. */
  ar?: number;
};

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

const BY_SCI = new Map(ALL.map((s) => [s.sci, s]));

/**
 * Resolve a scientific name to the known species, or null.
 *
 * The add endpoint uses this so the database only ever holds real names taken
 * from our own list, never a string a client made up. Without it, whatever was
 * posted ended up rendered on a public page.
 */
export function findSpecies(sciName: string): Species | null {
  return BY_SCI.get(sciName.trim()) ?? null;
}

const BY_COM = new Map(ALL.map((s) => [s.com.toLowerCase(), s]));

/** Resolve a common name to a known species, or null. Case-insensitive. */
export function findByCommonName(comName: string): Species | null {
  return BY_COM.get(comName.trim().toLowerCase()) ?? null;
}

const ASPECT = new Map(
  ALL.filter((s) => s.ar).map((s) => [s.sci, s.ar as number]),
);

/**
 * Width / height of the illustration. The collage needs real proportions —
 * a heron and a wren are not the same shape, and forcing them into one box
 * squashes both.
 */
export function aspectRatio(sciName: string): number | undefined {
  return ASPECT.get(sciName);
}

export {
  slug,
  perchedSrc,
  flightSrc,
  wikipediaUrl,
  ebirdUrl,
} from "./species-paths";
