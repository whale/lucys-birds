// Makes the site installable to a homescreen, so Lucy taps an icon instead of
// remembering a URL. Served as a route rather than a static file so it stays
// next to the metadata that references it.

export const runtime = "nodejs";

export function GET() {
  return Response.json({
    name: "Lucy's Birds",
    short_name: "Lucy's Birds",
    description: "A collection of birds Lucy has found, with their songs.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcfb",
    theme_color: "#fcfcfb",
    icons: [
      { src: "/icon.png", sizes: "180x180", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  });
}
