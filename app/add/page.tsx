"use client";

import Link from "next/link";
import { useState } from "react";
import { toBirdnetWav } from "@/lib/audio";

type Stage = "idle" | "converting" | "uploading" | "analyzing" | "done" | "error";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  converting: "Reading the recording…",
  uploading: "Sending it up…",
  analyzing: "Listening for birds… this can take a minute. Keep this page open.",
  done: "Done.",
  error: "",
};

/** Format a Date for a datetime-local input, in the browser's own timezone. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function AddRecordingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [recordedAt, setRecordedAt] = useState<string>(toLocalInputValue(new Date()));
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<number | null>(null);

  const busy = stage === "converting" || stage === "uploading" || stage === "analyzing";

  function onPick(picked: File | null) {
    setFile(picked);
    setError(null);
    setStage("idle");
    setFound(null);
    // Voice Memos carries the recording time as the file's modified date, so
    // this is usually right — but it's an editable field because "usually" is
    // not "always", and a wrong date files the bird on the wrong day forever.
    if (picked?.lastModified) setRecordedAt(toLocalInputValue(new Date(picked.lastModified)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setError(null);
    setFound(null);

    try {
      setStage("converting");
      const { wav, durationSeconds } = await toBirdnetWav(file);

      setStage("uploading");
      const recordedAtIso = new Date(recordedAt).toISOString();
      const lat = process.env.NEXT_PUBLIC_DEFAULT_LAT;
      const lon = process.env.NEXT_PUBLIC_DEFAULT_LON;

      const prepared = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: file.name,
          recordedAt: recordedAtIso,
          durationSeconds,
          lat: lat ? Number(lat) : undefined,
          lon: lon ? Number(lon) : undefined,
          note: note.trim() || undefined,
        }),
      });
      const prep = await prepared.json();
      if (!prepared.ok) throw new Error(prep.error ?? "Could not prepare the upload.");

      // Straight to storage — the bytes never pass through a Vercel function,
      // so a long recording can't hit the 4.5 MB request body cap.
      const put = await fetch(prep.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        body: wav,
      });
      if (!put.ok) {
        // Status code goes to the console for us, not to the screen for her.
        console.error("storage PUT failed", put.status, await put.text().catch(() => ""));
        throw new Error("The upload didn't finish. Check your signal and try again.");
      }

      setStage("analyzing");
      const analyzed = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: prep.recordingId }),
      });
      const result = await analyzed.json();
      if (!analyzed.ok) throw new Error(result.error ?? "The analyzer failed.");

      setFound(result.detections ?? 0);
      setStage("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStage("error");
    }
  }

  return (
    <main className="page">
      <header className="masthead">
        <h1>Add a recording</h1>
        <Link className="button" href="/">
          Back to the birds
        </Link>
      </header>

      <form className="stack" onSubmit={submit}>
        <label>
          Recording
          <input
            type="file"
            accept="audio/*,.m4a,.wav,.mp3"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <span className="hint">
            Open Voice Memos, share the recording, and choose this page. Or pick a file here.
          </span>
        </label>

        <label>
          When was it recorded?
          <input
            type="datetime-local"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            disabled={busy}
            required
          />
          <span className="hint">Filled in from the file. Change it if it looks wrong.</span>
        </label>

        <label>
          Note <span className="hint">(optional)</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            placeholder="Where were you? What did it sound like?"
          />
        </label>

        <div>
          <button className="button-primary" type="submit" disabled={!file || busy}>
            {busy ? "Working…" : "Add it"}
          </button>
        </div>

        {busy && <p className="notice">{STAGE_LABEL[stage]}</p>}

        {stage === "done" && (
          <p className="notice">
            {found === 0
              ? "Saved — but BirdNET didn't recognise anything in it. Your recording is kept either way."
              : `Saved. Found ${found} ${found === 1 ? "bird" : "birds"}.`}{" "}
            <Link href="/">See the collage</Link>
          </p>
        )}

        {error && <p className="notice notice-error">{error}</p>}
      </form>
    </main>
  );
}
