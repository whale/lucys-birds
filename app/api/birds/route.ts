import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

// Read side. This is the port of AvianVisitors' birdnet-api.php — same job,
// same JSON shape where the collage frontend already depends on it, but reading
// Postgres instead of the Pi's SQLite file.
//
//   ?action=lifelist   every species ever heard          (the collage's main feed)
//   ?action=stats      counts for the header
//   ?action=recent     &hours=N — species heard lately
//   ?action=recordings Lucy's uploads and how they're doing

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "lifelist";
  const supabase = serviceClient();

  try {
    switch (action) {
      case "lifelist": {
        const { data, error } = await supabase
          .from("life_list")
          .select("*")
          .order("first_heard", { ascending: true });
        if (error) throw error;
        return NextResponse.json({ species: data ?? [], as_of: new Date().toISOString() });
      }

      case "recent": {
        const hours = Math.max(1, Math.min(24 * 365 * 20, Number(url.searchParams.get("hours") ?? 24)));
        const since = new Date(Date.now() - hours * 3600_000).toISOString();
        const { data, error } = await supabase
          .from("detections")
          .select("sci_name, com_name, confidence, detected_at, recording_id")
          .gte("detected_at", since)
          .not("confirmed", "is", false)
          .order("detected_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({ detections: data ?? [], as_of: new Date().toISOString() });
      }

      case "stats": {
        const [{ count: totalDetections }, { data: species }, { count: totalRecordings }] =
          await Promise.all([
            supabase.from("detections").select("*", { count: "exact", head: true }),
            supabase.from("life_list").select("sci_name"),
            supabase.from("recordings").select("*", { count: "exact", head: true }),
          ]);
        return NextResponse.json({
          detections: totalDetections ?? 0,
          species: species?.length ?? 0,
          recordings: totalRecordings ?? 0,
          as_of: new Date().toISOString(),
        });
      }

      case "recordings": {
        const { data, error } = await supabase
          .from("recordings")
          .select("id, original_name, recorded_at, duration_seconds, note, status, error")
          .order("recorded_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return NextResponse.json({ recordings: data ?? [] });
      }

      default:
        return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`birds?action=${action} failed`, cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
