"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flightSrc, perchedSrc, slug } from "@/lib/species-paths";
import type { GalleryBird } from "./gallery";
import { BirdArt } from "./bird-art";

type Detail = {
  comName: string;
  sciName: string;
  addedAt: string;
  description: string | null;
  recordings: Array<{
    id: number;
    storage_path: string;
    duration_seconds: number | null;
    created_at: string;
  }>;
  audioBase: string;
  links: { wikipedia: string; ebird: string };
};

function clock(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function Tray({
  birds,
  index,
  onClose,
  onStep,
}: {
  birds: GalleryBird[];
  index: number | null;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const open = index !== null;
  const bird = open ? birds[index] : null;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const stopAudio = useCallback(() => {
    player.current?.pause();
    player.current = null;
    setPlaying(null);
  }, []);

  // Load whenever the tray lands on a different bird. Aborted on change so
  // paging quickly can't have an earlier response overwrite a later one.
  useEffect(() => {
    if (!bird) return;
    const controller = new AbortController();
    setDetail(null);
    setLoadError(null);
    setFlying(false);
    stopAudio();

    (async () => {
      try {
        const response = await fetch(`/api/bird/${slug(bird.sciName)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Couldn't load this bird.");
        setDetail(await response.json());
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();

    return () => controller.abort();
  }, [bird, stopAudio]);

  // Keyboard: escape closes, arrows page. Cheap to add and it's how anyone who
  // uses a keyboard will expect a tray like this to behave.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onStep(1);
      if (event.key === "ArrowLeft") onStep(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onStep]);

  // Never leave a song playing over a closed tray.
  useEffect(() => {
    if (!open) stopAudio();
  }, [open, stopAudio]);
  useEffect(() => () => stopAudio(), [stopAudio]);

  // Move focus in when it opens so the keyboard shortcuts have somewhere to land.
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open, index]);

  function toggleSong(
    recording: Detail["recordings"][number],
    audioBase: string,
  ) {
    if (playing === recording.id) {
      stopAudio();
      return;
    }
    player.current?.pause();
    const audio = new Audio(`${audioBase}/${recording.storage_path}`);
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    player.current = audio;
    void audio.play().then(
      () => setPlaying(recording.id),
      () => setPlaying(null),
    );
  }

  const showFlight = flying && bird?.flight;

  return (
    <>
      <div
        className={`tray-scrim${open ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panel}
        className={`tray${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label={bird ? bird.comName : "Bird details"}
        aria-hidden={!open}
        tabIndex={-1}
      >
        {bird && (
          <>
            <header className="tray-bar">
              <div className="tray-step">
                <button
                  type="button"
                  className="chip"
                  onClick={() => onStep(-1)}
                  aria-label="Previous bird"
                >
                  ←
                </button>
                <span className="tray-count">
                  {(index ?? 0) + 1} / {birds.length}
                </span>
                <button
                  type="button"
                  className="chip"
                  onClick={() => onStep(1)}
                  aria-label="Next bird"
                >
                  →
                </button>
              </div>
              <button
                type="button"
                className="chip"
                onClick={onClose}
                aria-label="Close"
              >
                close
              </button>
            </header>

            <div className="tray-body">
              <div className="tray-figure">
                {bird.art ? (
                  <BirdArt
                    src={
                      showFlight
                        ? flightSrc(bird.sciName)
                        : perchedSrc(bird.sciName)
                    }
                    label={`${bird.comName}, ${showFlight ? "in flight" : "perched"}`}
                    style={{ width: "100%", height: "100%", display: "block" }}
                  />
                ) : (
                  <span
                    className="portrait-empty"
                    style={{ fontSize: "3rem", maxWidth: "8rem" }}
                  >
                    🪶
                  </span>
                )}

                {bird.flight && (
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

              <h2 className="tray-name">{bird.comName}</h2>
              <p className="sci-name">{bird.sciName}</p>

              {loadError && <p className="notice notice-error">{loadError}</p>}

              {detail ? (
                <>
                  <div className="stat-row">
                    <div className="stat">
                      <span className="n">{detail.recordings.length}</span>
                      <span className="lbl">
                        {detail.recordings.length === 1
                          ? "recording"
                          : "recordings"}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="n">
                        {new Date(detail.addedAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="lbl">added</span>
                    </div>
                    <div className="stat">
                      <span className="n">{bird.sciName.split(" ")[0]}</span>
                      <span className="lbl">genus</span>
                    </div>
                  </div>

                  {detail.description ? (
                    <>
                      <p className="desc">{detail.description}</p>
                      <p className="desc-source">from wikipedia</p>
                    </>
                  ) : (
                    <p className="desc">
                      No description available for this one.
                    </p>
                  )}

                  <section className="recordings" style={{ marginTop: 28 }}>
                    <h3>Recordings</h3>
                    {detail.recordings.length === 0 ? (
                      <p className="hint">No recording of this one yet.</p>
                    ) : (
                      <ol className="rec-list">
                        {detail.recordings.map((recording) => (
                          <li className="rec-row" key={recording.id}>
                            <button
                              type="button"
                              className="rec-play"
                              aria-pressed={playing === recording.id}
                              aria-label={`${playing === recording.id ? "Pause" : "Play"} recording`}
                              onClick={() =>
                                toggleSong(recording, detail.audioBase)
                              }
                            >
                              {playing === recording.id ? "❚❚" : "▶"}
                            </button>
                            <span className="rec-when">
                              {new Date(
                                recording.created_at,
                              ).toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                              {clock(recording.duration_seconds) &&
                                ` · ${clock(recording.duration_seconds)}`}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  <div className="actions" style={{ marginTop: 24 }}>
                    <a
                      className="chip ext"
                      href={detail.links.wikipedia}
                      target="_blank"
                      rel="noopener"
                    >
                      wikipedia
                    </a>
                    <a
                      className="chip ext"
                      href={detail.links.ebird}
                      target="_blank"
                      rel="noopener"
                    >
                      ebird
                    </a>
                  </div>
                </>
              ) : (
                !loadError && <p className="hint">Loading…</p>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
