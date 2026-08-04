// The passcode gate.
//
// Looking at Lucy's birds is public — that's the point of a collage. Adding to
// them is not. This guards the write side only.
//
// The cookie is a signed expiry, not the passcode itself, so a stolen cookie
// can't be turned back into the code and can't outlive its window. Web Crypto
// rather than node:crypto because Next runs middleware on the Edge runtime,
// where node:crypto doesn't exist.

export const GATE_COOKIE = "lb_pass";
const TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days — she shouldn't retype this often

function secretKey(): Promise<CryptoKey> {
  const secret = process.env.GATE_SECRET;
  if (!secret) {
    throw new Error("Missing GATE_SECRET. Without it the gate can't sign anything.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(payload: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await secretKey(), new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string compare, so a wrong guess can't be narrowed down by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issueToken(): Promise<{ value: string; maxAge: number }> {
  const expiry = String(Date.now() + TTL_MS);
  return { value: `${expiry}.${await sign(expiry)}`, maxAge: Math.floor(TTL_MS / 1000) };
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expiry, signature] = token.split(".");
  if (!expiry || !signature) return false;
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now()) return false;
  return safeEqual(signature, await sign(expiry));
}

/** Check a submitted passcode against the configured one. */
export function isCorrectPasscode(submitted: string): boolean {
  const expected = process.env.GATE_PASSCODE;
  if (!expected) {
    throw new Error("Missing GATE_PASSCODE. Set it before anyone can unlock the app.");
  }
  return safeEqual(submitted.trim(), expected);
}
