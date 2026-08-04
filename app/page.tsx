import Link from "next/link";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Species = {
  sci_name: string;
  com_name: string;
  times_seen: number;
  times_spotted: number;
  times_heard: number;
  first_seen: string;
  last_seen: string;
  best_confidence: number | null;
  ever_spotted: boolean;
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
      .order("first_seen", { ascending: true });
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
              {species.length} species &middot;{" "}
              {species.reduce((sum, s) => sum + s.times_seen, 0)} sightings
            </span>
          )}
        </div>
        <div className="actions">
          <Link className="button button-primary" href="/spot">
            Add a bird you saw
          </Link>
          <Link className="button" href="/add">
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
          No birds yet. Add one you&rsquo;ve <Link href="/spot">seen</Link>, or upload a{" "}
          <Link href="/add">recording</Link> and let it work out what it was.
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
                {/* Say how she got it. "Spotted" is Lucy's own record and
                    deserves to read differently from a machine guess. */}
                {s.ever_spotted && s.times_heard === 0
                  ? `spotted ${s.times_spotted}×`
                  : s.ever_spotted
                    ? `seen ${s.times_seen}×`
                    : `heard ${s.times_heard}×`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
