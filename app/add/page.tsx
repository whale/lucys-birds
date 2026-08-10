"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { perchedSrc } from "@/lib/species-paths";
import { BirdArt } from "../bird-art";
import { ArrowLeft, Feather, X } from "lucide-react";

type Species = { sci: string; com: string; art: boolean };

export default function AddPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Species[]>([]);
  const [chosen, setChosen] = useState<Species | null>(null);
  const [song, setSong] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [place, setPlace] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const fileBox = useRef<HTMLInputElement>(null);

  // Debounced so a fast typist doesn't fire a request per keystroke, and
  // aborted on change so a slow early response can't overwrite newer results.
  useEffect(() => {
    if (chosen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/species?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          },
        );
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

  /** Ask the phone where it is. One tap, no typing — the fast path. */
  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser can't share a location.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCoords = {
          lat: Number(position.coords.latitude.toFixed(5)),
          lon: Number(position.coords.longitude.toFixed(5)),
        };
        setCoords(nextCoords);
        setPlace(`${nextCoords.lat}, ${nextCoords.lon}`);
        try {
          const response = await fetch(`/api/location?lat=${nextCoords.lat}&lon=${nextCoords.lon}`);
          if (response.ok) {
            const result = await response.json();
            if (result.label) {
              setPlace(result.label);
            }
          }
        } catch {
          // Coordinates are still useful when a nearby place name is unavailable.
        } finally {
          setLocating(false);
        }
      },
      (cause) => {
        // Denied is a choice, not a fault — say so plainly and move on.
        setError(
          cause.code === cause.PERMISSION_DENIED
            ? "Location is off for this site. You can still name the place instead."
            : "Couldn't work out where you are. You can name the place instead.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function save() {
    if (!chosen) return;
    setSaving(true);
    setError(null);

    try {
      const started = await fetch("/api/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sciName: chosen.sci,
          comName: chosen.com,
          withAudio: Boolean(song),
          lat: coords?.lat,
          lon: coords?.lon,
          place,
        }),
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
          throw new Error(
            `${chosen.com} was added, but the song didn't upload. Try the song again.`,
          );
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
        if (!attached.ok)
          throw new Error(
            (await attached.json()).error ?? "The song didn't attach.",
          );
      } else if (result.audioError) {
        throw new Error(result.audioError);
      }

      setSaved(chosen.com);
      setChosen(null);
      setQuery("");
      setSong(null);
      setCoords(null);
      setPlace("");
      searchBox.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page add-page">
      <header className="masthead">
        <div>
          <Link className="eyebrow add-back" href="/">
            <ArrowLeft aria-hidden="true" size={12} strokeWidth={1.5} />
            Lucy&rsquo;s Bird Collection
          </Link>
          <h1 className="display">Add a bird</h1>
        </div>
        <div className="actions">
          <Link className="chip" href="/">
            <X aria-hidden="true" size={8} strokeWidth={1.5} />
            close
          </Link>
        </div>
      </header>

      <div className="stack">
        {saved && (
          <p className="notice">
            Added <strong>{saved}</strong>.{" "}
            <Link href="/">See the collection</Link>
          </p>
        )}

        {!chosen ? (
          <>
            <label>
              Which bird did you see or hear?
              <input
                ref={searchBox}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Blue Jay, Robin, Wren..."
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
                        <BirdArt
                          src={perchedSrc(s.sci)}
                          label=""
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "block",
                          }}
                        />
                      ) : (
                        <span className="picker-thumb-empty" aria-hidden="true">
                          <Feather aria-hidden="true" size={18} strokeWidth={1.25} />
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
                <li className="hint">
                  No bird by that name. Try part of it, like &ldquo;wren&rdquo;.
                </li>
              )}
            </ul>
          </>
        ) : (
          <>
            <div className="selected-bird">
              <span className="picker-thumb">
                {chosen.art ? (
                  <BirdArt
                    src={perchedSrc(chosen.sci)}
                    label=""
                    style={{ width: "100%", height: "100%", display: "block" }}
                  />
                ) : (
                  <span className="picker-thumb-empty" aria-hidden="true">
                    <Feather aria-hidden="true" size={18} strokeWidth={1.25} />
                  </span>
                )}
              </span>
              <span className="selected-bird-text">
                <span className="picker-name">{chosen.com}</span>
                <span className="picker-sci">{chosen.sci}</span>
              </span>
              <button
                type="button"
                className="chip"
                onClick={() => setChosen(null)}
              >
                change
              </button>
            </div>

            <label>
              Where you saw it — optional
              <div className="form-control-row">
                <input
                  type="text"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="City, State"
                  disabled={saving}
                />
                <button
                  type="button"
                  className="chip"
                  onClick={useMyLocation}
                  disabled={locating || saving}
                >
                  {locating ? "finding your location…" : "use my current location"}
                </button>
              </div>
            </label>

            <label>
              Its song — optional
              <div className="form-control-row file-control-row">
                <span className={song ? "file-name has-file" : "file-name"}>
                  {song?.name ?? "No file yet"}
                </span>
                <button
                  type="button"
                  className="chip"
                  onClick={() => fileBox.current?.click()}
                  disabled={saving}
                >
                  choose an audio file
                </button>
              </div>
              <input
                ref={fileBox}
                className="sr-only"
                type="file"
                accept="audio/*"
                onChange={(e) => setSong(e.target.files?.[0] ?? null)}
                disabled={saving}
              />
            </label>

            <div className="actions">
              <button
                className="chip chip-solid"
                onClick={save}
                disabled={saving}
              >
                {saving
                  ? !chosen.art
                    ? "creating the illustration…"
                    : song
                    ? "uploading the song…"
                    : "adding…"
                  : "add to my collection"}
              </button>
            </div>
          </>
        )}

        {error && <p className="notice notice-error">{error}</p>}
      </div>
    </main>
  );
}
