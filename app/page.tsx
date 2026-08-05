import Link from "next/link";
import { serviceClient } from "@/lib/supabase";
import { hasArt, perchedSrc, slug } from "@/lib/species";

export const dynamic = "force-dynamic";

type Bird = {
  id: number;
  sci_name: string;
  com_name: string;
  audio_path: string | null;
};

export default async function CollectionPage() {
  let birds: Bird[] = [];
  let loadError: string | null = null;

  try {
    const { data, error } = await serviceClient()
      .from("collection")
      .select("id, sci_name, com_name, audio_path");
    if (error) throw error;
    birds = (data ?? []) as Bird[];
  } catch (cause) {
    // Detail to the log, a sentence to the visitor. A blank page that looks
    // like "no birds yet" when the database is unreachable is the worst of both.
    console.error("collection query failed", cause);
    loadError = "Couldn't load the birds right now. Try again in a moment.";
  }

  const withSongs = birds.filter((b) => b.audio_path).length;

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <span className="eyebrow">Lucy&rsquo;s</span>
          <h1 className="display">BIRD COLLECTION</h1>
          {birds.length > 0 && (
            <p className="meta">
              {birds.length} {birds.length === 1 ? "species" : "species"}
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

      {birds.length > 0 && (
        <ul className="flock">
          {birds.map((bird) => (
            <li className="bird" key={bird.id}>
              {/* Every bird now leads somewhere, like the original — the
                  collage was never just a picture wall. */}
              <Link className="bird-link" href={`/bird/${slug(bird.sci_name)}`}>
                <span className="portrait">
                  {hasArt(bird.sci_name) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={perchedSrc(bird.sci_name)}
                      alt={bird.com_name}
                      loading="lazy"
                    />
                  ) : (
                    <span className="portrait-empty" aria-hidden="true">
                      🪶
                    </span>
                  )}
                </span>
                <span className="com">{bird.com_name}</span>
                <span className="sci">{bird.sci_name}</span>
                {bird.audio_path && <span className="song-flag">song</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
