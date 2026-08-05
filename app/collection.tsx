"use client";

import { useEffect, useRef, useState } from "react";
import speciesData from "@/data/species.json";

export type Bird = {
  id: number;
  sci_name: string;
  com_name: string;
  added_at: string;
  audio_path: string | null;
  audio_seconds: number | null;
};

// Only 329 of 7,058 species have artwork. Knowing which up front lets us draw a
// placeholder rather than letting the browser show a broken image, which reads
// as "this went wrong" instead of "this one's waiting for its portrait".
const ILLUSTRATED = new Set(
  (speciesData as Array<{ sci: string; art: boolean }>).filter((s) => s.art).map((s) => s.sci),
);

const slug = (sciName: string) => sciName.toLowerCase().trim().replace(/\s+/g, "-");

export function Collection({ birds, audioBase }: { birds: Bird[]; audioBase: string }) {
  const [playing, setPlaying] = useState<number | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  // One song at a time. Without this, tapping a second bird leaves the first
  // still singing and the page becomes a dawn chorus.
  useEffect(() => () => player.current?.pause(), []);

  function toggle(bird: Bird) {
    if (!bird.audio_path) return;

    if (playing === bird.id) {
      player.current?.pause();
      setPlaying(null);
      return;
    }

    player.current?.pause();
    const audio = new Audio(`${audioBase}/${bird.audio_path}`);
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    player.current = audio;
    void audio.play().then(
      () => setPlaying(bird.id),
      () => setPlaying(null), // autoplay blocked or file missing — fail quiet, not stuck
    );
  }

  return (
    <ul className="flock">
      {birds.map((bird) => {
        const hasSong = Boolean(bird.audio_path);
        const isPlaying = playing === bird.id;

        return (
          <li className={`bird${hasSong ? " bird-has-song" : ""}`} key={bird.id}>
            {/* Only birds with a song are interactive. A button that does
                nothing is worse than no button. */}
            {hasSong ? (
              <button
                type="button"
                className="bird-play"
                onClick={() => toggle(bird)}
                aria-label={`Play the ${bird.com_name}'s song`}
                aria-pressed={isPlaying}
              >
                <Portrait bird={bird} />
                <span className={`song-badge${isPlaying ? " song-badge-on" : ""}`} aria-hidden="true">
                  {isPlaying ? "❚❚" : "▶"}
                </span>
              </button>
            ) : (
              <Portrait bird={bird} />
            )}

            <span className="com">{bird.com_name}</span>
            <span className="sci">{bird.sci_name}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Portrait({ bird }: { bird: Bird }) {
  if (!ILLUSTRATED.has(bird.sci_name)) {
    return (
      <div className="bird-noart" aria-hidden="true">
        🪶
      </div>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={`/illustrations/${slug(bird.sci_name)}.png`} alt={bird.com_name} loading="lazy" />
  );
}
