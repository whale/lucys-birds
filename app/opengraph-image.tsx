import { ImageResponse } from "next/og";
import { serviceClient } from "@/lib/supabase";
import speciesData from "@/data/species.json";

// The card people see when Lucy texts the link. Sharing is the entire point of
// this project, so this is the first impression — it shows her actual birds and
// her actual count, not a generic logo.

export const runtime = "nodejs";
// Rendered per request, not at build time — otherwise the card shows whatever
// the count happened to be when the site was last deployed.
export const dynamic = "force-dynamic";
export const alt = "Lucy's Birds — a collection of birds, with their songs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ILLUSTRATED = new Set(
  (speciesData as Array<{ sci: string; art: boolean }>)
    .filter((s) => s.art)
    .map((s) => s.sci),
);

const slug = (sciName: string) =>
  sciName.toLowerCase().trim().replace(/\s+/g, "-");

/**
 * Illustrations have to be inlined as data URIs — the image renderer can't
 * resolve relative URLs.
 *
 * Fetched over HTTP rather than read from disk: `public/` is served by the CDN
 * and is not part of a serverless function's file bundle, so reading it here
 * silently finds nothing and the card comes out empty.
 */
async function inline(origin: string, sciName: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${origin}/illustrations/${slug(sciName)}.png`,
    );
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lucys-birds.vercel.app";

export default async function Image() {
  let birds: Array<{ sci_name: string; art_url: string | null }> = [];
  let total = 0;
  let withSongs = 0;

  try {
    const { data } = await serviceClient()
      .from("collection")
      .select("sci_name, audio_path, art_url");
    const rows = data ?? [];
    total = rows.length;
    withSongs = rows.filter((r) => r.audio_path).length;
    birds = rows.filter((r) => ILLUSTRATED.has(r.sci_name) || r.art_url).slice(0, 5);
  } catch (cause) {
    // A share card is not worth failing over — fall back to the plain version.
    console.error("opengraph-image query failed", cause);
  }

  const portraits = (
    await Promise.all(
      birds.map(async (b) => {
        if (!b.art_url) return inline(SITE, b.sci_name);
        try {
          const response = await fetch(b.art_url);
          if (!response.ok) return null;
          const mime = response.headers.get("content-type") ?? "image/png";
          const buffer = Buffer.from(await response.arrayBuffer());
          return `data:${mime};base64,${buffer.toString("base64")}`;
        } catch {
          return null;
        }
      }),
    )
  ).filter((src): src is string => Boolean(src));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f4efe4",
        padding: "72px 80px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{ fontSize: 88, color: "#2a2622", letterSpacing: "-0.02em" }}
        >
          Lucy&rsquo;s Birds
        </div>
        <div style={{ fontSize: 34, color: "#6b6357", marginTop: 16 }}>
          {total > 0
            ? `${total} ${total === 1 ? "bird" : "birds"} collected${
                withSongs > 0 ? ` · ${withSongs} you can listen to` : ""
              }`
            : "A collection of birds, and their songs"}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 28,
          height: 300,
        }}
      >
        {portraits.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            width={200}
            height={300}
            style={{ objectFit: "contain" }}
            alt=""
          />
        ))}
      </div>
    </div>,
    size,
  );
}
