"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const CODE_LENGTH = 6;

function UnlockForm() {
  const params = useSearchParams();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const fields = useRef<Array<HTMLInputElement | null>>([]);

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
      // A full navigation guarantees the newly issued httpOnly cookie is sent
      // through middleware before the protected page renders. Calling
      // router.refresh() immediately after replace could refresh this unlock
      // route before the route change completed.
      window.location.assign(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPasscode("");
    } finally {
      setChecking(false);
    }
  }

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = passcode.padEnd(CODE_LENGTH, " ").split("");
    next[index] = digit || " ";
    const digits = next.join("").trimEnd();
    setPasscode(digits);
    setError(null);
    if (digit && index < CODE_LENGTH - 1) fields.current[index + 1]?.focus();
    if (digits.length === CODE_LENGTH) void submit(digits);
  }

  function pasteDigits(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!digits) return;
    setPasscode(digits);
    setError(null);
    fields.current[Math.min(digits.length, CODE_LENGTH) - 1]?.focus();
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

      <div className="code-fields" aria-label={`${CODE_LENGTH} digit passcode`}>
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <input
            key={index}
            ref={(element) => { fields.current[index] = element; }}
            className="code-digit"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${index + 1}`}
            value={passcode[index] ?? ""}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !passcode[index] && index > 0)
                fields.current[index - 1]?.focus();
            }}
            onPaste={(event) => {
              event.preventDefault();
              pasteDigits(event.clipboardData.getData("text"));
            }}
            disabled={checking}
            autoFocus={index === 0}
          />
        ))}
      </div>

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
