import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, isValidToken, issueToken } from "@/lib/gate";

// Public: the collage and the read API. Showing off the birds is the point.
// Gated: everything that writes, plus the pages that do the writing.
//
// The matcher is an allow-nothing list rather than a deny list on purpose — a
// new write route is protected by default and has to be deliberately exempted,
// rather than being wide open until somebody notices.

export const config = {
  matcher: [
    "/add/:path*",
    "/api/add",
    "/api/add/:path*",
    // Not sensitive — a static species list — but it exists only to serve the
    // gated /add page, and leaving it out contradicts the rule above.
    "/api/species",
  ],
};

export async function middleware(request: NextRequest) {
  if (await isValidToken(request.cookies.get(GATE_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // Lucy's own link carries the passcode, so she never types anything: she
  // bookmarks /add?key=... once and it unlocks on arrival. Anyone else who
  // lands on /add cold still gets the gate.
  const key = request.nextUrl.searchParams.get("key");
  if (key && process.env.GATE_PASSCODE && key === process.env.GATE_PASSCODE) {
    const clean = request.nextUrl.clone();
    // Redirect rather than continue, so the passcode doesn't sit in the address
    // bar to be screenshotted, shoulder-surfed or shared by accident.
    clean.searchParams.delete("key");
    const response = NextResponse.redirect(clean);
    const token = await issueToken();
    response.cookies.set(GATE_COOKIE, token.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: token.maxAge,
    });
    return response;
  }

  // APIs get a status code; people get the unlock page with somewhere to
  // return to, so the gate doesn't lose what they were doing.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Locked. Enter the passcode first." }, { status: 401 });
  }

  const unlock = new URL("/unlock", request.url);
  unlock.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(unlock);
}
