// Build web-sized illustrations from the bundled AvianVisitors artwork.
//
// avian/assets/illustrations holds 666 PNGs averaging ~750 KB — around 490 MB
// total. That's print-resolution art; shipping it as-is would make every deploy
// enormous and every page load slow. This resizes to a sane display size and
// writes the result to public/illustrations, which is gitignored and rebuilt.
//
//   node scripts/build-illustrations.mjs
//
// Output stays PNG rather than WebP: these are cutouts composited with
// mix-blend-mode: multiply, and WebP's chroma subsampling leaves visible fringes
// on the fine feather edges.

import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = "avian/assets/illustrations";
const DEST = "public/illustrations";
const MAX_EDGE = 600; // displayed at ~9rem tall; 600px covers 2x screens

const files = (await readdir(SOURCE)).filter((name) => name.endsWith(".png"));
if (files.length === 0) {
  console.error(`No PNGs found in ${SOURCE}. Is the repo complete?`);
  process.exit(1);
}

await mkdir(DEST, { recursive: true });

let done = 0;
let bytesIn = 0;
let bytesOut = 0;

for (const name of files) {
  const from = path.join(SOURCE, name);
  const to = path.join(DEST, name);

  bytesIn += (await stat(from)).size;
  await sharp(from)
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(to);
  bytesOut += (await stat(to)).size;

  done += 1;
  if (done % 50 === 0) console.log(`  ${done}/${files.length}`);
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`\n${done} illustrations: ${mb(bytesIn)} MB -> ${mb(bytesOut)} MB in ${DEST}`);
