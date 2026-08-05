"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { perchedSrc } from "@/lib/species-paths";

type Species = { sci: string; com: string; art: boolean };

export default function AddPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Species[]>([]);
  const [chosen, setChosen] = useState<Species | null>(null);
  const [song, setSong] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchBox = useRef<HTMLInputElement>(null);

  // Debounced so a fast typist doesn't fire a request per keystroke, and
  // aborted on change so a slow early response can't overwrite newer results.
  useEffect(() => {
    if (chosen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/species?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Couldn't load the bird list.");
        setResults((await response.json()).species ?? []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    }, 150);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, chosen]);

  /** Read the duration locally. Not worth failing an add over. */
  async function durationOf(file: File): Promise<number | undefined> {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.src = url;
      const seconds = await new Promise<number>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => reject(new Error("unreadable"));
      });
      URL.revokeObjectURL(url);
      return Number.isFinite(seconds) ? seconds : undefined;
    } catch {
      return undefined;
    }
  }

  async function save() {
    if (!chosen) return;
    setSaving(true);
    setError(null);

    try {
      const started = await fetch("/api/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sciName: chosen.sci, comName: chosen.com, withAudio: Boolean(song) }),
      });
      const result = await started.json();
      if (!started.ok) throw new Error(result.error ?? "That didn't save.");

      if (song && result.signedUrl) {
        const put = await fetch(result.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": song.type || "audio/mp4" },
          body: song,
        });
        if (!put.ok) {
          console.error("song upload failed", put.status);
          throw new Error(`${chosen.com} was added, but the song didn't upload. Try the song again.`);
        }

        const attached = await fetch("/api/add/song", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            birdId: result.birdId,
            storagePath: result.storagePath,
            originalName: song.name,
            durationSeconds: await durationOf(song),
          }),
        });
        if (!attached.ok) throw new Error((await attached.json()).error ?? "The song didn't attach.");
      } else if (result.audioError) {
        throw new Error(result.audioError);
      }

      setSaved(chosen.com);
      setChosen(null);
      setQuery("");
      setSong(null);
      searchBox.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <span className="eyebrow">Lucy&rsquo;s birds</span>
          <h1 className="display" style={{ fontSize: "clamp(22px, 2.4vw, 32px)" }}>
            ADD A BIRD
          </h1>
        </div>
        <div className="actions">
          <Link className="chip" href="/">
            all birds
          </Link>
        </div>
      </header>

      <div className="stack">
        {saved && (
          <p className="notice">
            Added <strong>{saved}</strong>. <Link href="/">See the collection</Link>
          </p>
        )}

        {!chosen ? (
          <>
            <label>
              Which bird
              <input
                ref={searchBox}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="blue jay, robin, wren…"
                autoFocus
              />
            </label>

            <ul className="picker">
              {results.map((s) => (
                <li key={s.sci}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(s);
                      setSaved(null);
                    }}
                  >
                    {/* The illustration sits with the name so she's picking a
                        bird she can recognise, not parsing Latin. */}
                    <span className="picker-thumb">
                      {s.art ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={perchedSrc(s.sci)} alt="" loading="lazy" />
                      ) : (
                        <span className="picker-thumb-empty" aria-hidden="true">
                          🪶
                        </span>
                      )}
                    </span>
                    <span>
                      <span className="picker-name">{s.com}</span>
                      <span className="picker-sci">{s.sci}</span>
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 && query.length >= 2 && (
                <li className="hint">No bird by that name. Try part of it, like &ldquo;wren&rdquo;.</li>
              )}
            </ul>
          </>
        ) : (
          <>
            <div className="rec-row" style={{ gap: 16 }}>
              <span className="picker-thumb">
                {chosen.art ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={perchedSrc(chosen.sci)} alt="" />
                ) : (
                  <span className="picker-thumb-empty" aria-hidden="true">
                    🪶
                  </span>
                )}
              </span>
              <span style={{ flex: 1 }}>
                <span className="picker-name">{chosen.com}</span>
                <span className="picker-sci">{chosen.sci}</span>
              </span>
              <button type="button" className="chip" onClick={() => setChosen(null)}>
                change
              </button>
            </div>

            <label>
              Its song — optional
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setSong(e.target.files?.[0] ?? null)}
                disabled={saving}
              />
              <span className="hint">
                {song
                  ? `${song.name} — ${(song.size / 1024 / 1024).toFixed(1)} MB`
                  : "A recording from your phone, so people can hear it too."}
              </span>
            </label>

            <div className="actions">
              <button className="chip chip-solid" onClick={save} disabled={saving}>
                {saving ? (song ? "uploading the song…" : "adding…") : "add to my collection"}
              </button>
            </div>
          </>
        )}

        {error && <p className="notice notice-error">{error}</p>}
      </div>
    </main>
  );
}
