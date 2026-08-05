"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flightSrc, perchedSrc, slug } from "@/lib/species-paths";
import {
  packCollage,
  type MaskTable,
  type PackedTile,
} from "@/lib/collage-pack";
import { BirdArt } from "./bird-art";
import type { GalleryBird } from "./gallery";

/** 15% of birds show their flight pose, as in the original. Rare enough to be a find. */
const FLY_PROB = 0.15;

type Tile = PackedTile<{
  key: string;
  mask: MaskTable[string] | undefined;
  ar: number;
  weight: number;
  bird: GalleryBird;
  index: number;
  flying: boolean;
}>;

export function Collage({
  birds,
  onOpen,
}: {
  birds: GalleryBird[];
  onOpen: (index: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [masks, setMasks] = useState<MaskTable | null>(null);

  // Fetched rather than bundled: 777 KB of silhouettes (160 KB over the wire)
  // has no business in the JavaScript payload, and only the collage needs it.
  useEffect(() => {
    let live = true;
    fetch("/collage-masks.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => live && setMasks(data ?? {}))
      .catch(() => live && setMasks({})); // no silhouettes: falls back to box packing
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // A canvas roughly the shape of the space it sits in, tall enough that
      // the cluster has somewhere to grow.
      const w = entry.contentRect.width;
      setSize({ w, h: Math.max(420, Math.min(900, w * 0.62)) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A fresh seed per mount, so every refresh rearranges the flock.
  const seed = useMemo(() => Math.floor(Math.random() * 2147483646) + 1, []);

  const tiles = useMemo<Tile[]>(() => {
    if (!masks || size.w <= 0) return [];

    // Deterministic within one render pass so a resize doesn't reshuffle
    // mid-interaction, but reseeded on mount so a refresh does.
    let state = seed;
    const random = () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };

    const items = birds.map((bird, index) => {
      const key = slug(bird.sciName);
      const flying = bird.flight && random() < FLY_PROB;
      return {
        key,
        // The flight pose has its own silhouette and proportions.
        mask: masks[flying ? `${key}-2` : key],
        ar: bird.ar ?? 0.9,
        // Random for now — there's no "heard 400 times" here to scale by.
        weight: 0.55 + random() * 1.1,
        bird,
        index,
        flying,
      };
    });

    return packCollage(items, size.w, size.h, masks, random) as Tile[];
  }, [birds, masks, size.w, size.h, seed]);

  return (
    <div
      className="collage"
      ref={container}
      style={{ height: size.h || undefined }}
    >
      {tiles.map((tile) => (
        <button
          type="button"
          key={tile.bird.id}
          className="collage-bird"
          style={{ left: tile.x, top: tile.y, width: tile.w, height: tile.h }}
          onClick={() => onOpen(tile.index)}
          title={`${tile.bird.comName} · ${tile.bird.sciName}`}
        >
          {tile.bird.art ? (
            <BirdArt
              src={
                tile.flying
                  ? flightSrc(tile.bird.sciName)
                  : perchedSrc(tile.bird.sciName)
              }
              label={tile.bird.comName}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          ) : (
            <span
              className="portrait-empty"
              aria-label={tile.bird.comName}
              role="img"
            />
          )}
        </button>
      ))}
    </div>
  );
}
