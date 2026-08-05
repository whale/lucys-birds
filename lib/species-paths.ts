/**
 * Pure path and link helpers, with no data import.
 *
 * Kept separate from `lib/species.ts` on purpose: that module imports
 * data/species.json (480 KB), and any client component importing from it drags
 * the whole file into the browser bundle. Client code imports this instead.
 */

/** "Cyanocitta cristata" -> "cyanocitta-cristata", which is how illustrations are named. */
export function slug(sciName: string): string {
  return sciName.toLowerCase().trim().replace(/\s+/g, "-");
}

/** Perched pose. */
export function perchedSrc(sciName: string): string {
  return `/illustrations/${slug(sciName)}.png`;
}

/** In-flight pose — the second illustration every illustrated species ships with. */
export function flightSrc(sciName: string): string {
  return `/illustrations/${slug(sciName)}-2.png`;
}

export function wikipediaUrl(sciName: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(sciName.replace(/\s+/g, "_"))}`;
}

export function ebirdUrl(comName: string): string {
  return `https://ebird.org/search?q=${encodeURIComponent(comName)}`;
}
