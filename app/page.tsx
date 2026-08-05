import Link from "next/link";
import { serviceClient } from "@/lib/supabase";
import { aspectRatio, hasArt, hasFlight } from "@/lib/species";
import { Gallery, type GalleryBird } from "./gallery";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  let birds: GalleryBird[] = [];
  let loadError: string | null = null;

  try {
    const { data, error } = await serviceClient()
      .from("collection")
      .select("id, sci_name, com_name, audio_path, lat, lon, place");
    if (error) throw error;

    // Artwork facts are resolved here so the 588 KB species list never reaches
    // the browser — the gallery only needs three booleans and a number.
    birds = (data ?? []).map((bird) => ({
      id: bird.id,
      sciName: bird.sci_name,
      comName: bird.com_name,
      hasSong: Boolean(bird.audio_path),
      lat: bird.lat ?? null,
      lon: bird.lon ?? null,
      place: bird.place ?? null,
      art: hasArt(bird.sci_name),
      flight: hasFlight(bird.sci_name),
      ar: aspectRatio(bird.sci_name),
    }));
  } catch (cause) {
    // Detail to the log, a sentence to the visitor. A blank page that looks
    // like "no birds yet" when the database is unreachable is the worst of both.
    console.error("collection query failed", cause);
    loadError = "Couldn't load the birds right now. Try again in a moment.";
  }

  const withSongs = birds.filter((b) => b.hasSong).length;

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <span className="eyebrow">Lucy&rsquo;s</span>
          <h1 className="display">BIRD COLLECTION</h1>
          {birds.length > 0 && (
            <p className="meta">
              {birds.length} species
              {withSongs > 0 && ` · ${withSongs} with songs`}
            </p>
          )}
        </div>
        <div className="actions">
          <Link className="chip" href="/add">
            add a bird
          </Link>
        </div>
      </header>

      {loadError && (
        <p className="notice notice-error" style={{ marginTop: "2rem" }}>
          {loadError}
        </p>
      )}

      {!loadError && birds.length === 0 && (
        <p className="empty">
          No birds yet. <Link href="/add">Add the first one.</Link>
        </p>
      )}

      {birds.length > 0 && <Gallery birds={birds} />}
    </main>
  );
}
