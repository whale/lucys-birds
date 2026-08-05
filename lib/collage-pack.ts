/**
 * Silhouette-aware collage packing, ported from the original AvianVisitors
 * layout (`avian/frontend/apt.js`).
 *
 * What makes it read as balanced rather than as a row of stickers:
 *
 *  1. Every species ships a 1-bit alpha mask of its actual outline, so
 *     collision is tested against the bird's shape, not its bounding box.
 *     Birds nest into each other's concavities — a wing arc cradles a tail.
 *  2. Placement starts with the largest bird at the centre and spirals
 *     outward in elliptical rings, stopping at the first ring that has any
 *     free spot. That's the tightest possible distance from centre.
 *  3. Within that ring it picks the position closest to the centre of mass of
 *     everything already placed, so the cluster grows organically instead of
 *     drifting in one direction.
 *  4. Total area is normalised to a fraction of the viewport rather than each
 *     bird being clamped individually, so the cluster fills its space without
 *     overflowing it.
 */

export type MaskRecord = { w: number; h: number; bits: string };
export type MaskTable = Record<string, MaskRecord>;

type Mask = { w: number; h: number; cells: Array<[number, number]> };

export type PackInput = {
  key: string; // illustration slug
  mask: MaskRecord | undefined;
  ar: number; // width / height
  weight: number; // relative area before normalisation
};

export type PackedTile<T> = T & { x: number; y: number; w: number; h: number };

const GRID_STRIDE = 4; // viewport px per occupancy cell
const PAD_CELLS = 3; // breathing room stamped around each silhouette

/** Unpack the base64 1-bit mask into a sparse list of "on" cells. */
function decodeMask(record: MaskRecord): Mask {
  const bytes = atob(record.bits);
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < record.h; y++) {
    for (let x = 0; x < record.w; x++) {
      const i = y * record.w + x;
      if ((bytes.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1) cells.push([x, y]);
    }
  }
  return { w: record.w, h: record.h, cells };
}

/** Soft area budget as a fraction of the canvas — sparser as the flock grows. */
function budgetFraction(n: number): number {
  if (n <= 4) return 0.46;
  if (n <= 12) return 0.4;
  if (n <= 24) return 0.34;
  return 0.28;
}

export function packCollage<T extends PackInput>(
  items: T[],
  width: number,
  height: number,
  masks: MaskTable,
  random: () => number,
): PackedTile<T>[] {
  if (width <= 0 || height <= 0 || items.length === 0) return [];

  const canvasArea = width * height;
  const budget = canvasArea * budgetFraction(items.length);
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0) || 1;

  // Size every bird from its share of the budget, then shrink the whole
  // cluster until it actually packs. Scaling everything together keeps the
  // relative sizes intact.
  type Tile = PackedTile<T> & { maskCells: Mask | null };

  const build = (scale: number): Tile[] =>
    items.map((item) => {
      const area = (item.weight / totalWeight) * budget * scale;
      const h = Math.sqrt(area / Math.max(item.ar, 0.05));
      return {
        ...item,
        w: h * item.ar,
        h,
        x: 0,
        y: 0,
        maskCells: item.mask ? decodeMask(item.mask) : null,
      } as Tile;
    });

  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.pow(0.82, attempt);
    const tiles = build(scale);
    const result = attemptPack(tiles, width, height, random);
    // Accept once everything found a home; otherwise shrink and try again.
    if (result) return result;
  }

  // Last resort: pack at the smallest scale and keep whatever fits.
  return (
    attemptPack(build(Math.pow(0.82, 6)), width, height, random, true) ?? []
  );
}

function attemptPack<T extends PackInput>(
  tiles: Array<PackedTile<T> & { maskCells: Mask | null }>,
  width: number,
  height: number,
  random: () => number,
  force = false,
): PackedTile<T>[] | null {
  const gw = Math.ceil(width / GRID_STRIDE);
  const gh = Math.ceil(height / GRID_STRIDE);
  const grid = new Uint8Array(gw * gh);

  const cx = width / 2;
  const cy = height / 2;

  // Wider clusters on landscape canvases, as the original does.
  const bias = width / height;
  const xBias = bias >= 1 ? Math.min(2.1, bias) : 1;
  const yBias = bias >= 1 ? 1 : Math.min(2.1, 1 / bias);

  // Largest first, so the cluster grows around a solid anchor.
  const ordered = [...tiles].sort((a, b) => b.w * b.h - a.w * a.h);

  /** Grid-cell range covered by one mask cell of a tile placed at (tx, ty). */
  function cellRange(
    tile: (typeof ordered)[number],
    tx: number,
    ty: number,
    cell: [number, number],
  ): [number, number, number, number] {
    const mask = tile.maskCells!;
    const sx = tile.w / mask.w;
    const sy = tile.h / mask.h;
    const x0 = Math.floor((tx + cell[0] * sx) / GRID_STRIDE);
    const y0 = Math.floor((ty + cell[1] * sy) / GRID_STRIDE);
    const x1 = Math.floor((tx + (cell[0] + 1) * sx) / GRID_STRIDE);
    const y1 = Math.floor((ty + (cell[1] + 1) * sy) / GRID_STRIDE);
    return [
      Math.max(0, x0),
      Math.max(0, y0),
      Math.min(gw - 1, x1),
      Math.min(gh - 1, y1),
    ];
  }

  function collides(
    tile: (typeof ordered)[number],
    tx: number,
    ty: number,
  ): boolean {
    if (!tile.maskCells) {
      // No silhouette: fall back to the bounding box.
      const x0 = Math.max(0, Math.floor(tx / GRID_STRIDE));
      const y0 = Math.max(0, Math.floor(ty / GRID_STRIDE));
      const x1 = Math.min(gw - 1, Math.floor((tx + tile.w) / GRID_STRIDE));
      const y1 = Math.min(gh - 1, Math.floor((ty + tile.h) / GRID_STRIDE));
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) if (grid[gy * gw + gx]) return true;
      }
      return false;
    }
    for (const cell of tile.maskCells.cells) {
      const [x0, y0, x1, y1] = cellRange(tile, tx, ty, cell);
      for (let gy = y0; gy <= y1; gy++) {
        const off = gy * gw;
        for (let gx = x0; gx <= x1; gx++) if (grid[off + gx]) return true;
      }
    }
    return false;
  }

  function stamp(tile: (typeof ordered)[number], tx: number, ty: number) {
    const mark = (x0: number, y0: number, x1: number, y1: number) => {
      // Dilate by PAD_CELLS so the next bird can't pack flush against this
      // one. collides() stays unpadded, so the gap is only added once.
      const gy0 = Math.max(0, y0 - PAD_CELLS);
      const gy1 = Math.min(gh - 1, y1 + PAD_CELLS);
      const gx0 = Math.max(0, x0 - PAD_CELLS);
      const gx1 = Math.min(gw - 1, x1 + PAD_CELLS);
      for (let gy = gy0; gy <= gy1; gy++) {
        const off = gy * gw;
        for (let gx = gx0; gx <= gx1; gx++) grid[off + gx] = 1;
      }
    };

    if (!tile.maskCells) {
      mark(
        Math.floor(tx / GRID_STRIDE),
        Math.floor(ty / GRID_STRIDE),
        Math.floor((tx + tile.w) / GRID_STRIDE),
        Math.floor((ty + tile.h) / GRID_STRIDE),
      );
      return;
    }
    for (const cell of tile.maskCells.cells) {
      const [x0, y0, x1, y1] = cellRange(tile, tx, ty, cell);
      mark(x0, y0, x1, y1);
    }
  }

  const offCanvas = (tile: (typeof ordered)[number], tx: number, ty: number) =>
    tx < 0 || ty < 0 || tx + tile.w > width || ty + tile.h > height;

  const placed: typeof ordered = [];

  for (let i = 0; i < ordered.length; i++) {
    const tile = ordered[i];

    if (i === 0) {
      tile.x = cx - tile.w / 2;
      tile.y = cy - tile.h / 2;
      if (offCanvas(tile, tile.x, tile.y) && !force) return null;
      stamp(tile, tile.x, tile.y);
      placed.push(tile);
      continue;
    }

    // Centre of mass of what's already down, area-weighted.
    let comX = 0;
    let comY = 0;
    let comW = 0;
    for (const p of placed) {
      const area = p.w * p.h;
      comX += (p.x + p.w / 2) * area;
      comY += (p.y + p.h / 2) * area;
      comW += area;
    }
    comX /= comW;
    comY /= comW;

    let best: { x: number; y: number } | null = null;
    let bestCost = Infinity;
    const step = Math.max(GRID_STRIDE, Math.min(tile.w, tile.h) * 0.05);
    const maxR = Math.max(width, height);
    let foundRing = -1;
    const phase = random() * Math.PI * 2;

    for (let r = 0; r <= maxR; r += step) {
      // Once a ring yields anything, look one more ring out for a better
      // position, then stop — that's the tightest distance from centre.
      if (foundRing >= 0 && r > foundRing + step * 2) break;
      const samples = Math.max(36, Math.floor(r / 1.6));
      for (let k = 0; k < samples; k++) {
        const theta = phase + (k / samples) * Math.PI * 2;
        const px = cx + r * xBias * Math.cos(theta) - tile.w / 2;
        const py = cy + r * yBias * Math.sin(theta) - tile.h / 2;
        if (offCanvas(tile, px, py)) continue;
        if (collides(tile, px, py)) continue;
        const dx = px + tile.w / 2 - comX;
        const dy = py + tile.h / 2 - comY;
        const cost = Math.hypot(dx / xBias, dy / yBias) + random() * step * 0.5;
        if (cost < bestCost) {
          bestCost = cost;
          best = { x: px, y: py };
        }
      }
      if (best && foundRing < 0) foundRing = r;
    }

    if (!best) {
      // Something didn't fit: shrink everything and start over, rather than
      // dropping a bird or letting two overlap.
      if (!force) return null;
      continue;
    }

    tile.x = best.x;
    tile.y = best.y;
    stamp(tile, best.x, best.y);
    placed.push(tile);
  }

  return placed.map(({ maskCells, ...rest }) => rest as PackedTile<T>);
}
