import { readFile } from "node:fs/promises";
import path from "node:path";
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
  (speciesData as Array<{ sci: string; art: boolean }>).filter((s) => s.art).map((s) => s.sci),
);

const slug = (sciName: string) => sciName.toLowerCase().trim().replace(/\s+/g, "-");

/** Illustrations must be inlined — the renderer has no access to the live site. */
async function inline(sciName: string): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), "public", "illustrations", `${slug(sciName)}.png`);
    return `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image() {
  let birds: Array<{ sci_name: string }> = [];
  let total = 0;
  let withSongs = 0;

  try {
    const { data } = await serviceClient().from("collection").select("sci_name, audio_path");
    const rows = data ?? [];
    total = rows.length;
    withSongs = rows.filter((r) => r.audio_path).length;
    birds = rows.filter((r) => ILLUSTRATED.has(r.sci_name)).slice(0, 5);
  } catch (cause) {
    // A share card is not worth failing over — fall back to the plain version.
    console.error("opengraph-image query failed", cause);
  }

  const portraits = (await Promise.all(birds.map((b) => inline(b.sci_name)))).filter(
    (src): src is string => Boolean(src),
  );

  return new ImageResponse(
    (
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
          <div style={{ fontSize: 88, color: "#2a2622", letterSpacing: "-0.02em" }}>
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

        <div style={{ display: "flex", alignItems: "flex-end", gap: 28, height: 300 }}>
          {portraits.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} width={200} height={300} style={{ objectFit: "contain" }} alt="" />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
