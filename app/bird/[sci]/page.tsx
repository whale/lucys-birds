import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RECORDINGS_BUCKET, serviceClient } from "@/lib/supabase";
import { ebirdUrl, hasArt, hasFlight, wikipediaUrl } from "@/lib/species";
import { BirdFigure } from "./figure";
import { Recordings } from "./recordings";

export const dynamic = "force-dynamic";

type Bird = {
  id: number;
  sci_name: string;
  com_name: string;
  added_at: string;
};

/** The URL carries the slug, so find the bird by matching it back. */
async function findBird(sciSlug: string): Promise<Bird | null> {
  const { data, error } = await serviceClient()
    .from("birds")
    .select("id, sci_name, com_name, added_at");
  if (error) {
    console.error("bird lookup failed", error);
    return null;
  }
  return (
    (data ?? []).find(
      (b) =>
        b.sci_name.toLowerCase().replace(/\s+/g, "-") === sciSlug.toLowerCase(),
    ) ?? null
  );
}

/**
 * A short summary from Wikipedia, as the original's detail card had. Cached for
 * a day — species descriptions don't change, and it shouldn't cost a round trip
 * on every visit.
 */
async function lookup(title: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        title.replace(/\s+/g, "_"),
      )}`,
      {
        // Wikipedia's API policy requires a descriptive User-Agent. Without one
        // it throttles, which from a shared serverless IP means it mostly just
        // stops answering.
        headers: {
          "User-Agent": "LucysBirds/1.0 (https://lucys-birds.vercel.app)",
        },
        next: { revalidate: 86400 },
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.extract === "string" && data.extract.length > 0
      ? data.extract
      : null;
  } catch {
    return null; // a missing description is not worth failing the page over
  }
}

async function summary(
  sciName: string,
  comName: string,
): Promise<string | null> {
  // Scientific name first — it redirects to the right article and is never
  // ambiguous. The common name is the fallback for species Wikipedia files
  // under a vernacular title only.
  return (await lookup(sciName)) ?? (await lookup(comName));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sci: string }>;
}): Promise<Metadata> {
  const bird = await findBird((await params).sci);
  if (!bird) return { title: "Not found — Lucy's Birds" };
  return {
    title: `${bird.com_name} — Lucy's Birds`,
    description: `${bird.com_name} (${bird.sci_name}) in Lucy's bird collection.`,
  };
}

export default async function BirdPage({
  params,
}: {
  params: Promise<{ sci: string }>;
}) {
  const bird = await findBird((await params).sci);
  if (!bird) notFound();

  const { data: recordings } = await serviceClient()
    .from("bird_recordings")
    .select("id, storage_path, duration_seconds, created_at, is_primary")
    .eq("bird_id", bird.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  const description = await summary(bird.sci_name, bird.com_name);
  const audioBase = `${process.env.SUPABASE_URL}/storage/v1/object/public/${RECORDINGS_BUCKET}`;

  const added = new Date(bird.added_at).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <span className="eyebrow">Lucy&rsquo;s birds</span>
          <h1
            className="display"
            style={{ fontSize: "clamp(22px, 2.4vw, 32px)" }}
          >
            {bird.com_name.toUpperCase()}
          </h1>
        </div>
        <div className="actions">
          <Link className="chip" href="/">
            all birds
          </Link>
        </div>
      </header>

      <div className="detail">
        <BirdFigure
          sciName={bird.sci_name}
          comName={bird.com_name}
          art={hasArt(bird.sci_name)}
          flight={hasFlight(bird.sci_name)}
        />

        <div>
          <h1>{bird.com_name}</h1>
          <p className="sci-name">{bird.sci_name}</p>

          <div className="stat-row">
            <div className="stat">
              <span className="n">{recordings?.length ?? 0}</span>
              <span className="lbl">
                {recordings?.length === 1 ? "recording" : "recordings"}
              </span>
            </div>
            <div className="stat">
              <span className="n">{added}</span>
              <span className="lbl">added</span>
            </div>
            <div className="stat">
              <span className="n">{bird.sci_name.split(" ")[0]}</span>
              <span className="lbl">genus</span>
            </div>
          </div>

          {description ? (
            <>
              <p className="desc">{description}</p>
              <p className="desc-source">from wikipedia</p>
            </>
          ) : (
            <p className="desc">No description available for this one.</p>
          )}

          <div className="actions" style={{ marginTop: "22px" }}>
            <a
              className="chip ext"
              href={wikipediaUrl(bird.sci_name)}
              target="_blank"
              rel="noopener"
            >
              wikipedia
            </a>
            <a
              className="chip ext"
              href={ebirdUrl(bird.com_name)}
              target="_blank"
              rel="noopener"
            >
              ebird
            </a>
          </div>
        </div>
      </div>

      <Recordings
        recordings={recordings ?? []}
        audioBase={audioBase}
        comName={bird.com_name}
      />
    </main>
  );
}
