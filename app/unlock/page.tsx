"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const CODE_LENGTH = 6;

function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Only relative paths. An absolute URL here would let someone craft a link
  // that sends Lucy somewhere else the moment she unlocks.
  const raw = params.get("next") ?? "/add";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/add";

  async function submit(code: string) {
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: code }),
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

  function onChange(value: string) {
    // Digits only, so a stray character can't sit invisibly in the field.
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setPasscode(digits);
    setError(null);
    // Submits itself on the sixth digit — there's nothing left to decide.
    if (digits.length === CODE_LENGTH) void submit(digits);
  }

  return (
    <div className="gate-inner">
      <div>
        <span className="eyebrow">Lucy&rsquo;s birds</span>
        <h1
          className="display"
          style={{ fontSize: "clamp(20px, 2.2vw, 28px)" }}
        >
          ENTER THE CODE
        </h1>
      </div>

      <input
        className="code-input"
        // A numeric keypad on a phone, and no autocorrect or spellcheck noise.
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        placeholder="······"
        aria-label={`${CODE_LENGTH} digit passcode`}
        value={passcode}
        onChange={(e) => onChange(e.target.value)}
        disabled={checking}
        autoFocus
      />

      <p className="hint">
        {checking
          ? "Checking…"
          : "Six digits. You only need this once on each device."}
      </p>

      {error && <p className="notice notice-error">{error}</p>}
    </div>
  );
}

export default function UnlockPage() {
  return (
    <main className="gate">
      <Suspense fallback={null}>
        <UnlockForm />
      </Suspense>
    </main>
  );
}
