// Build the species list that Lucy picks from when she adds a bird by hand.
//
//   node scripts/build-species.mjs
//
// BirdNET knows 6,522 species and the label files ship scientific names only.
// A child is not going to find "Cyanocitta cristata" — she needs to type
// "blue jay". This joins the English common names onto the list and flags
// which species we actually have artwork for, so the picker can float those
// to the top: a bird with a picture is a better result than one without.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const LABELS = "model/l18n/labels_en.json";
const ART = "avian/assets/illustrations";
const OUT = "data/species.json";

const labels = JSON.parse(await readFile(LABELS, "utf8"));

// Illustrations are named by scientific name in kebab-case, with a "-2" suffix
// for the in-flight pose. Both are tracked: the bird page lets you switch
// between poses, and not every species necessarily has the second file.
const files = (await readdir(ART)).filter((name) => name.endsWith(".png"));
const perched = new Set(files.filter((n) => !n.endsWith("-2.png")).map((n) => n.replace(/\.png$/, "")));
const flight = new Set(files.filter((n) => n.endsWith("-2.png")).map((n) => n.replace(/-2\.png$/, "")));

const slug = (sci) => sci.toLowerCase().trim().replace(/\s+/g, "-");

// Natural pixel dimensions of each illustration, from the original project's
// dims.json. The collage view needs the real aspect ratio to place birds
// without squashing them — a heron and a wren are not the same shape.
const dims = JSON.parse(await readFile("avian/frontend/dims.json", "utf8"));

const species = Object.entries(labels)
  .map(([sci, com]) => {
    const key = slug(sci);
    const [w, h] = dims[key] ?? [];
    return {
      sci,
      com,
      art: perched.has(key),
      flight: flight.has(key),
      // Aspect ratio only, rounded — the absolute pixel size isn't useful and
      // shipping two more numbers per species for 7,058 species adds up.
      ...(w && h ? { ar: Math.round((w / h) * 100) / 100 } : {}),
    };
  })
  .sort((a, b) => {
    // Illustrated first, then alphabetical by the name Lucy will actually read.
    if (a.art !== b.art) return a.art ? -1 : 1;
    return a.com.localeCompare(b.com);
  });

await mkdir("data", { recursive: true });
await writeFile(OUT, JSON.stringify(species));

const withArt = species.filter((s) => s.art).length;
const withFlight = species.filter((s) => s.flight).length;
console.log(`${species.length} species -> ${OUT} (${withArt} with artwork, ${withFlight} with a flight pose)`);
