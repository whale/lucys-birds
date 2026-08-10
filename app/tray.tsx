"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flightSrc, perchedSrc, slug } from "@/lib/species-paths";
import artCenters from "@/data/art-centers.json";
import type { GalleryBird } from "./gallery";
import { BirdArt } from "./bird-art";
import { BirdSpotMap } from "./map";
import { ArrowLeft, ArrowRight, ExternalLink, Feather, Pause, Play, Trash2, X } from "lucide-react";

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
  onRemoved,
}: {
  birds: GalleryBird[];
  index: number | null;
  onClose: () => void;
  onStep: (delta: number) => void;
  onRemoved: (id: number) => void;
}) {
  const open = index !== null;
  const bird = open ? birds[index] : null;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flying, setFlying] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeCode, setRemoveCode] = useState(["", "", "", "", "", ""]);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

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
    setPreviewPlaying(false);
    setRemoveOpen(false);
    setRemoveCode(["", "", "", "", "", ""]);
    setRemoveError(null);
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
      if (event.key === "Escape") {
        if (removeOpen) setRemoveOpen(false);
        else onClose();
      }
      if (removeOpen) return;
      if (event.key === "ArrowRight") onStep(1);
      if (event.key === "ArrowLeft") onStep(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onStep, removeOpen]);

  useEffect(() => {
    if (removeOpen) window.setTimeout(() => codeInputs.current[0]?.focus(), 0);
  }, [removeOpen]);

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

  function changeCode(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setRemoveError(null);
    setRemoveCode((current) => current.map((item, i) => i === index ? digit : item));
    if (digit && index < 5) codeInputs.current[index + 1]?.focus();
  }

  async function removeBird() {
    if (!bird || removing) return;
    const passcode = removeCode.join("");
    if (passcode.length !== 6) {
      setRemoveError("Enter all six digits.");
      return;
    }
    setRemoving(true);
    setRemoveError(null);
    try {
      const response = await fetch(`/api/bird/${slug(bird.sciName)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Couldn't remove that bird.");
      onRemoved(bird.id);
    } catch (cause) {
      setRemoveError(cause instanceof Error ? cause.message : "Couldn't remove that bird.");
      setRemoveCode(["", "", "", "", "", ""]);
      codeInputs.current[0]?.focus();
    } finally {
      setRemoving(false);
    }
  }

  const showFlight = flying && bird?.flight;
  const artFile = bird
    ? `${slug(bird.sciName)}${showFlight ? "-2" : ""}.png`
    : "";
  const [artShiftX, artShiftY] =
    (artCenters as Record<string, number[]>)[artFile] ?? [0, -2];

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
              <div className="tray-step tray-step-left">
                <button
                  type="button"
                  className="chip"
                  onClick={() => onStep(-1)}
                  aria-label="Previous bird"
                >
                  <ArrowLeft aria-hidden="true" size={12} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => onStep(1)}
                  aria-label="Next bird"
                >
                  <ArrowRight aria-hidden="true" size={12} strokeWidth={1.5} />
                </button>
              </div>
              <span className="tray-count">
                {(index ?? 0) + 1}/{birds.length}
              </span>
              <button
                type="button"
                className="chip"
                onClick={onClose}
                aria-label="Close"
              >
                <X aria-hidden="true" size={8} strokeWidth={1.5} />
                close
              </button>
            </header>

            <div className="tray-body">
              <div className="tray-figure">
                <button
                  type="button"
                  className={`tray-art${bird.flight ? " is-toggleable" : ""}`}
                  onClick={() => bird.flight && setFlying((value) => !value)}
                  aria-label={bird.flight ? `Show ${flying ? "perched" : "in-flight"} illustration of ${bird.comName}` : undefined}
                  disabled={!bird.flight}
                >
                  {bird.art ? (
                    <span className="tray-pose-layer" key={showFlight ? "flight" : "perched"}>
                      <BirdArt
                        src={showFlight
                          ? bird.flightArtUrl ?? flightSrc(bird.sciName)
                          : bird.artUrl ?? perchedSrc(bird.sciName)}
                        label={`${bird.comName}, ${showFlight ? "in flight" : "perched"}`}
                        style={{
                          width: "88%",
                          height: "88%",
                          display: "block",
                          backgroundPosition: "center center",
                          transform: `translate(${artShiftX}%, ${artShiftY}%)`,
                        }}
                      />
                    </span>
                  ) : (
                    <span className="portrait-empty" style={{ fontSize: "3rem", maxWidth: "8rem" }}><Feather aria-hidden="true" size={36} strokeWidth={1.25} /></span>
                  )}
                </button>
                <div className="tray-figure-meta">
                  {bird.flight ? <div className="pose-toggle" role="group" aria-label="Pose">
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
                  </div> : <span />}
                  <span className="tray-figure-sci">{bird.sciName}</span>
                </div>
              </div>

              <h2 className="tray-name">{bird.comName}</h2>

              {loadError && <p className="notice notice-error">{loadError}</p>}

              {detail ? (
                <>
                  <div className="stat-row">
                    <div className="stat">
                      <span className="lbl">
                        {detail.recordings.length === 1
                          ? "recording"
                          : "recordings"}
                      </span>
                      <span className="n">{detail.recordings.length}</span>
                    </div>
                    <div className="stat">
                      <span className="lbl">added</span>
                      <span className="n">
                        {new Date(detail.addedAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="lbl">genus</span>
                      <span className="n">{bird.sciName.split(" ")[0]}</span>
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

                  <BirdSpotMap bird={bird} birds={birds} />

                  <section className="recordings" style={{ marginTop: 28 }}>
                    <h3>Recordings</h3>
                    {detail.recordings.length === 0 ? (
                      <div className="recording-example">
                        <button
                          type="button"
                          className="rec-play"
                          aria-pressed={previewPlaying}
                          aria-label={previewPlaying ? "Pause example recording" : "Play example recording"}
                          onClick={() => setPreviewPlaying((value) => !value)}
                        >
                          {previewPlaying ? (
                            <Pause aria-hidden="true" size={13} fill="currentColor" />
                          ) : (
                            <Play aria-hidden="true" size={13} fill="currentColor" />
                          )}
                        </button>
                        <span className={`recording-wave${previewPlaying ? " is-playing" : ""}`} aria-hidden="true">
                          {Array.from({ length: 18 }, (_, i) => <i key={i} />)}
                        </span>
                        <span className="recording-copy">
                          <strong>Example recording</strong>
                          <small>FIELD RECORDING · 0:18</small>
                        </span>
                      </div>
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
                              {playing === recording.id ? <Pause aria-hidden="true" size={13} fill="currentColor" /> : <Play aria-hidden="true" size={13} fill="currentColor" />}
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
                      <ExternalLink aria-hidden="true" size={10} strokeWidth={1.5} />
                    </a>
                    <a
                      className="chip ext"
                      href={detail.links.ebird}
                      target="_blank"
                      rel="noopener"
                    >
                      ebird
                      <ExternalLink aria-hidden="true" size={10} strokeWidth={1.5} />
                    </a>
                  </div>

                  <section className="catalogue-actions">
                    <span>Catalogue</span>
                    <button type="button" className="chip remove-trigger" onClick={() => setRemoveOpen(true)}>
                      <Trash2 aria-hidden="true" size={11} strokeWidth={1.5} />
                      remove bird
                    </button>
                  </section>
                </>
              ) : (
                !loadError && <p className="hint">Loading…</p>
              )}
            </div>
          </>
        )}
      </aside>

      {bird && removeOpen && (
        <div className="remove-modal-scrim" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setRemoveOpen(false);
        }}>
          <section className="remove-modal" role="alertdialog" aria-modal="true" aria-labelledby="remove-title">
            <button type="button" className="remove-modal-close" aria-label="Close" onClick={() => setRemoveOpen(false)}>
              <X aria-hidden="true" size={14} strokeWidth={1.5} />
            </button>
            <span className="remove-modal-label">Edit catalogue</span>
            <h2 id="remove-title">Remove {bird.comName}?</h2>
            <p>This removes the bird, its location, and its recordings from Lucy&rsquo;s collection.</p>
            <label className="remove-code-label">Enter the six-digit code</label>
            <div className="code-fields remove-code-fields" onPaste={(event) => {
              const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              if (!digits) return;
              event.preventDefault();
              setRemoveCode(Array.from({ length: 6 }, (_, i) => digits[i] ?? ""));
              codeInputs.current[Math.min(digits.length, 6) - 1]?.focus();
            }}>
              {removeCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { codeInputs.current[index] = element; }}
                  className="code-digit"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={digit}
                  aria-label={`Code digit ${index + 1}`}
                  onChange={(event) => changeCode(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !removeCode[index] && index > 0) codeInputs.current[index - 1]?.focus();
                  }}
                />
              ))}
            </div>
            {removeError && <p className="remove-error" role="alert">{removeError}</p>}
            <div className="remove-modal-actions">
              <button type="button" className="chip" onClick={() => setRemoveOpen(false)}>cancel</button>
              <button type="button" className="chip remove-confirm" disabled={removing} onClick={removeBird}>
                {removing ? "removing…" : "remove bird"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
