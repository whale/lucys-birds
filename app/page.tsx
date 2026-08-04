import Link from "next/link";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Species = {
  sci_name: string;
  com_name: string;
  times_heard: number;
  first_heard: string;
  last_heard: string;
  best_confidence: number;
};

/** "Cyanocitta cristata" -> "cyanocitta-cristata", which is how the illustrations are named. */
function slug(sciName: string): string {
  return sciName.toLowerCase().trim().replace(/\s+/g, "-");
}

export default async function CollagePage() {
  let species: Species[] = [];
  let loadError: string | null = null;

  try {
    const { data, error } = await serviceClient()
      .from("life_list")
      .select("*")
      .order("first_heard", { ascending: true });
    if (error) throw error;
    species = (data ?? []) as Species[];
  } catch (cause) {
    // Say what actually broke. A blank page that looks like "no birds yet" when
    // the database is unreachable is the worst possible failure here.
    loadError = cause instanceof Error ? cause.message : String(cause);
  }

  return (
    <main className="page">
      <header className="masthead">
        <h1>Lucy&rsquo;s Birds</h1>
        <div className="meta">
          {species.length > 0 && (
            <span>
              {species.length} {species.length === 1 ? "species" : "species"} &middot;{" "}
              {species.reduce((sum, s) => sum + s.times_heard, 0)} calls
            </span>
          )}{" "}
          <Link className="button button-primary" href="/add">
            Add a recording
          </Link>
        </div>
      </header>

      {loadError && (
        <p className="notice notice-error" style={{ marginTop: "2rem" }}>
          Couldn&rsquo;t load the birds: {loadError}
        </p>
      )}

      {!loadError && species.length === 0 && (
        <p className="empty">
          Nothing here yet. Record a bird on your phone, then tap{" "}
          <Link href="/add">Add a recording</Link>.
        </p>
      )}

      {species.length > 0 && (
        <ul className="flock">
          {species.map((s) => (
            <li className="bird" key={s.sci_name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/illustrations/${slug(s.sci_name)}.png`}
                alt={s.com_name}
                loading="lazy"
              />
              <span className="com">{s.com_name}</span>
              <span className="sci">{s.sci_name}</span>
              <span className="count">
                heard {s.times_heard}&times;
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
