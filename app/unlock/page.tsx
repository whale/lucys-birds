"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Only allow relative paths back. An absolute URL here would let someone
  // craft a link that sends Lucy to another site after she unlocks.
  const raw = params.get("next") ?? "/spot";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/spot";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "That didn't work.");
      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPasscode("");
    } finally {
      setChecking(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Passcode
        <input
          // numeric keypad on a phone, and the browser offers the saved code
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoFocus
          required
        />
        <span className="hint">You only need this once on each device.</span>
      </label>

      <div>
        <button className="button-primary" type="submit" disabled={checking || !passcode}>
          {checking ? "Checking…" : "Unlock"}
        </button>
      </div>

      {error && <p className="notice notice-error">{error}</p>}
    </form>
  );
}

export default function UnlockPage() {
  return (
    <main className="page">
      <header className="masthead">
        <h1>Enter the passcode</h1>
        <Link className="button" href="/">
          Back to the birds
        </Link>
      </header>
      <Suspense fallback={null}>
        <UnlockForm />
      </Suspense>
    </main>
  );
}
