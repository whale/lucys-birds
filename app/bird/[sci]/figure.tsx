"use client";

import { useState } from "react";
import { flightSrc, perchedSrc } from "@/lib/species-paths";
import { BirdArt } from "../../bird-art";

/**
 * The illustration, with the perched / in-flight toggle the original had.
 *
 * Every illustrated species ships two poses and the old detail card let you
 * switch between them. Showing only one was quietly throwing away half the
 * artwork this project exists to display.
 *
 * Which poses exist is passed in rather than looked up here — the lookup table
 * is 480 KB and has no business in a browser bundle.
 */
export function BirdFigure({
  sciName,
  comName,
  art,
  flight,
}: {
  sciName: string;
  comName: string;
  art: boolean;
  flight: boolean;
}) {
  const [flying, setFlying] = useState(false);

  if (!art) {
    return (
      <div className="detail-figure">
        <div
          className="portrait-empty"
          style={{ maxWidth: "8rem", aspectRatio: "1", fontSize: "3rem" }}
        >
          🪶
        </div>
      </div>
    );
  }

  return (
    <div className="detail-figure">
      <BirdArt
        src={flying ? flightSrc(sciName) : perchedSrc(sciName)}
        label={`${comName}, ${flying ? "in flight" : "perched"}`}
        style={{ width: "100%", height: "100%", display: "block" }}
      />

      {flight && (
        <div className="pose-toggle" role="group" aria-label="Pose">
          <button
            type="button"
            aria-pressed={!flying}
            onClick={() => setFlying(false)}
          >
            perched
          </button>
          <button
            type="button"
            aria-pressed={flying}
            onClick={() => setFlying(true)}
          >
            in flight
          </button>
        </div>
      )}
    </div>
  );
}
