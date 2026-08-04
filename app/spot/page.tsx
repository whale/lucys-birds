"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Species = { sci: string; com: string; art: boolean };

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function SpotPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Species[]>([]);
  const [chosen, setChosen] = useState<Species | null>(null);
  const [seenAt, setSeenAt] = useState(toLocalInputValue(new Date()));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search as she types. Debounced so a fast typist doesn't fire a request per
  // keystroke, and aborted on change so an early slow response can't overwrite
  // the results for what she's typed since.
  useEffect(() => {
    if (chosen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/species?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        setResults(payload.species ?? []);
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

  async function save() {
    if (!chosen) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/spot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sciName: chosen.sci,
          comName: chosen.com,
          seenAt: new Date(seenAt).toISOString(),
          note: note.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save it.");
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  function startOver() {
    setChosen(null);
    setQuery("");
    setNote("");
    setSaved(false);
    setSeenAt(toLocalInputValue(new Date()));
  }

  return (
    <main className="page">
      <header className="masthead">
        <h1>Add a bird you saw</h1>
        <Link className="button" href="/">
          Back to the birds
        </Link>
      </header>

      {saved && chosen ? (
        <div className="stack">
          <p className="notice">
            Added <strong>{chosen.com}</strong> to your birds.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button onClick={startOver}>Add another</button>
            <Link className="button button-primary" href="/">
              See the collage
            </Link>
          </div>
        </div>
      ) : (
        <div className="stack">
          {!chosen ? (
            <>
              <label>
                Which bird?
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Start typing — blue jay, robin, crow…"
                  autoFocus
                />
                <span className="hint">
                  Birds with a picture come first. If yours isn&rsquo;t here, keep typing.
                </span>
              </label>

              <ul className="picker">
                {results.map((s) => (
                  <li key={s.sci}>
                    <button type="button" onClick={() => setChosen(s)}>
                      <span className="picker-name">{s.com}</span>
                      <span className="picker-sci">{s.sci}</span>
                      {!s.art && <span className="picker-flag">no picture yet</span>}
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
              <p className="notice">
                <strong>{chosen.com}</strong> <em>{chosen.sci}</em>{" "}
                <button type="button" onClick={() => setChosen(null)} style={{ marginLeft: "0.5rem" }}>
                  Change
                </button>
              </p>

              <label>
                When did you see it?
                <input
                  type="datetime-local"
                  value={seenAt}
                  onChange={(e) => setSeenAt(e.target.value)}
                  required
                />
              </label>

              <label>
                Note <span className="hint">(optional)</span>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Where was it? What was it doing?"
                />
              </label>

              <div>
                <button className="button-primary" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Add it"}
                </button>
              </div>
            </>
          )}

          {error && <p className="notice notice-error">{error}</p>}
        </div>
      )}
    </main>
  );
}
