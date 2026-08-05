import Link from "next/link";
import { RECORDINGS_BUCKET, serviceClient } from "@/lib/supabase";
import { Collection, type Bird } from "./collection";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  let birds: Bird[] = [];
  let loadError: string | null = null;

  try {
    const { data, error } = await serviceClient()
      .from("collection")
      .select("id, sci_name, com_name, added_at, audio_path, audio_seconds");
    if (error) throw error;
    birds = (data ?? []) as Bird[];
  } catch (cause) {
    // Detail to the log, a sentence to the visitor. A blank page that looks
    // like "no birds yet" when the database is unreachable is the worst of both.
    console.error("collection query failed", cause);
    loadError = "Couldn't load the birds right now. Try again in a moment.";
  }

  const withSongs = birds.filter((b) => b.audio_path).length;

  // The bucket is public, so visitors stream straight from storage rather than
  // waiting on a signed URL round trip before anything can play.
  const audioBase = `${process.env.SUPABASE_URL}/storage/v1/object/public/${RECORDINGS_BUCKET}`;

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Lucy&rsquo;s Birds</h1>
          {birds.length > 0 && (
            <p className="meta">
              {birds.length} {birds.length === 1 ? "bird" : "birds"}
              {withSongs > 0 && <> &middot; {withSongs} with songs you can hear</>}
            </p>
          )}
        </div>
        <Link className="button" href="/add">
          Add a bird
        </Link>
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

      {birds.length > 0 && <Collection birds={birds} audioBase={audioBase} />}
    </main>
  );
}
