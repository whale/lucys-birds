import { NextResponse } from "next/server";
import { GATE_COOKIE, isCorrectPasscode, issueToken } from "@/lib/gate";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * The caller's IP, taken from the header Vercel's proxy sets rather than the
 * one the client can write.
 *
 * `x-forwarded-for` is appended to by every hop, so its FIRST entry is whatever
 * the client claimed — trivially spoofed, and using it turns a rate limit into
 * decoration. `x-real-ip` is set by Vercel itself; the last x-forwarded-for
 * entry is the nearest trusted hop and is the fallback.
 */
function callerIp(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  const chain = request.headers.get("x-forwarded-for");
  if (chain) {
    const hops = chain
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return "unknown";
}

export async function POST(request: Request) {
  const ip = callerIp(request);
  const supabase = serviceClient();

  // Shared store, not an in-memory Map: serverless runs many instances and each
  // would otherwise hold its own counter, so spreading guesses across enough
  // concurrent requests would reset the limit every time.
  const { data: blocked, error: blockError } = await supabase.rpc(
    "unlock_is_blocked",
    {
      p_ip: ip,
    },
  );

  if (blockError) {
    // Fail closed. If we can't tell whether this is an attack, refusing is the
    // safe answer — the cost is Lucy retrying, not someone getting in.
    console.error("unlock_is_blocked failed", blockError);
    return NextResponse.json(
      { error: "Can't check that right now. Try again in a moment." },
      { status: 503 },
    );
  }

  if (blocked) {
    return NextResponse.json(
      { error: "Too many tries. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let passcode = "";
  try {
    passcode = String((await request.json()).passcode ?? "");
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const correct = isCorrectPasscode(passcode);
  // Record before responding, so a failure can't be retried faster than it's counted.
  await supabase.from("unlock_attempts").insert({ ip, ok: correct });

  if (!correct) {
    return NextResponse.json(
      { error: "That's not the right code." },
      { status: 401 },
    );
  }

  const token = await issueToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GATE_COOKIE, token.value, {
    httpOnly: true, // JavaScript can't read it, so a script injection can't steal it
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: token.maxAge,
  });
  return response;
}
