import { NextResponse } from "next/server";
import { GATE_COOKIE, isCorrectPasscode, issueToken } from "@/lib/gate";

export const runtime = "nodejs";

// Crude in-memory rate limit. A six-digit code is 1,000,000 guesses, which a
// script gets through quickly if nothing slows it down. This won't survive a
// deploy or work across instances — it's a speed bump, not a lock — but it
// turns a trivial brute force into an impractical one.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many tries. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  let passcode = "";
  try {
    passcode = String((await request.json()).passcode ?? "");
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!isCorrectPasscode(passcode)) {
    return NextResponse.json({ error: "That's not the right code." }, { status: 401 });
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
