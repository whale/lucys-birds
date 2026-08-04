import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, isValidToken } from "@/lib/gate";

// Public: the collage and the read API. Showing off the birds is the point.
// Gated: everything that writes, plus the pages that do the writing.
//
// The matcher is an allow-nothing list rather than a deny list on purpose — a
// new write route is protected by default and has to be deliberately exempted,
// rather than being wide open until somebody notices.

export const config = {
  matcher: [
    "/add/:path*",
    "/spot/:path*",
    "/api/upload-url",
    "/api/spot",
    "/api/analyze",
    // Not sensitive — a static species list — but it exists only to serve the
    // gated /spot page, and leaving it out contradicts the rule above.
    "/api/species",
  ],
};

export async function middleware(request: NextRequest) {
  if (await isValidToken(request.cookies.get(GATE_COOKIE)?.value)) {
    return NextResponse.next();
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
