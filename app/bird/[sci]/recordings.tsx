"use client";

import { useEffect, useRef, useState } from "react";

type Recording = {
  id: number;
  storage_path: string;
  duration_seconds: number | null;
  created_at: string;
};

function clock(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function Recordings({
  recordings,
  audioBase,
  comName,
}: {
  recordings: Recording[];
  audioBase: string;
  comName: string;
}) {
  const [playing, setPlaying] = useState<number | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  // Stop the audio if she navigates away mid-song; otherwise it keeps playing
  // over whatever page she lands on next.
  useEffect(() => () => player.current?.pause(), []);

  function toggle(recording: Recording) {
    if (playing === recording.id) {
      player.current?.pause();
      setPlaying(null);
      return;
    }

    player.current?.pause();
    const audio = new Audio(`${audioBase}/${recording.storage_path}`);
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    player.current = audio;
    void audio.play().then(
      () => setPlaying(recording.id),
      () => setPlaying(null), // blocked or missing — fail quiet rather than stuck
    );
  }

  return (
    <section className="recordings">
      <h2>Recordings</h2>

      {recordings.length === 0 ? (
        <p className="empty" style={{ marginTop: 0, textAlign: "left" }}>
          No recording of this one yet.
        </p>
      ) : (
        <ol className="rec-list">
          {recordings.map((recording) => {
            const isPlaying = playing === recording.id;
            return (
              <li className="rec-row" key={recording.id}>
                <button
                  type="button"
                  className="rec-play"
                  aria-pressed={isPlaying}
                  aria-label={`${isPlaying ? "Pause" : "Play"} this ${comName} recording`}
                  onClick={() => toggle(recording)}
                >
                  {isPlaying ? "❚❚" : "▶"}
                </button>
                <span className="rec-when">
                  {new Date(recording.created_at).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {clock(recording.duration_seconds) && ` · ${clock(recording.duration_seconds)}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
