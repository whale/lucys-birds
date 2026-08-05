"use client";

import { useEffect, useRef, useState } from "react";
import { perchedSrc } from "@/lib/species-paths";
import type { GalleryBird } from "./gallery";
import { NOPIN } from "@/lib/nopin";

/**
 * The overlapping, size-varied arrangement the original project is built
 * around. A grid is a list; this is a flock.
 *
 * Positions are computed rather than authored: measure the container, lay birds
 * out left to right at varying scale, and let rows overlap vertically so the
 * silhouettes interlock instead of sitting in lanes.
 */

/** Stable pseudo-random in [0,1) from a string — same bird, same size, every render. */
function hashUnit(text: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

type Placed = GalleryBird & {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

function layout(
  birds: GalleryBird[],
  width: number,
): { placed: Placed[]; height: number } {
  if (width <= 0) return { placed: [], height: 0 };

  // Row height scales with the viewport so the flock reads the same on a phone
  // as on a desktop, just with fewer birds per row.
  const base = Math.max(90, Math.min(210, width / 7));
  const placed: Placed[] = [];

  let x = 0;
  let rowTop = 0;
  let rowMax = 0;

  birds.forEach((bird, i) => {
    // Scale varies per species but never wildly — a collage, not a joke.
    const scale = 0.68 + hashUnit(bird.sciName, 1) * 0.62;
    const h = base * scale;
    const w = h * (bird.ar ?? 0.9);

    if (x > 0 && x + w > width) {
      // New row, pulled up so the rows interlock rather than stack.
      rowTop += rowMax * 0.74;
      x = 0;
      rowMax = 0;
    }

    // Vertical jitter within the row, and a horizontal pull-back so
    // neighbours overlap slightly.
    const jitter = (hashUnit(bird.sciName, 2) - 0.5) * base * 0.42;

    placed.push({
      ...bird,
      x,
      y: rowTop + jitter,
      w,
      h,
      // Smaller birds in front, so a heron can't bury a wren.
      z: Math.round(1000 - h),
    });

    x += w * (0.82 + hashUnit(bird.sciName, 3) * 0.14);
    rowMax = Math.max(rowMax, h);
  });

  const lowest = placed.reduce((max, p) => Math.max(max, p.y + p.h), 0);
  return { placed, height: lowest + base * 0.3 };
}

export function Collage({
  birds,
  onOpen,
}: {
  birds: GalleryBird[];
  onOpen: (index: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Re-layout on resize. ResizeObserver rather than a window listener so it
  // also reacts to the tray opening and squeezing the grid.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { placed, height } = layout(birds, width);

  return (
    <div className="collage" ref={container} style={{ height }}>
      {placed.map((bird, i) => (
        <button
          type="button"
          key={bird.id}
          className="collage-bird"
          style={{
            left: bird.x,
            top: bird.y,
            width: bird.w,
            height: bird.h,
            zIndex: bird.z,
          }}
          onClick={() => onOpen(i)}
          title={`${bird.comName} · ${bird.sciName}`}
        >
          {bird.art ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              {...NOPIN}
              src={perchedSrc(bird.sciName)}
              alt={bird.comName}
              loading="lazy"
            />
          ) : (
            <span className="portrait-empty" aria-hidden="true">
              🪶
            </span>
          )}
          <span className="sr-only">{bird.comName}</span>
        </button>
      ))}
    </div>
  );
}
