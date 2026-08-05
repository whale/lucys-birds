import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import speciesData from "@/data/species.json";

// TEMPORARY diagnostic for the empty share card. Delete once resolved.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ILLUSTRATED = new Set(
  (speciesData as Array<{ sci: string; art: boolean }>).filter((s) => s.art).map((s) => s.sci),
);
const slug = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "-");
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lucys-birds.vercel.app";

export async function GET() {
  const out: Record<string, unknown> = { site: SITE, illustratedCount: ILLUSTRATED.size };

  const { data, error } = await serviceClient().from("collection").select("sci_name, audio_path");
  out.dbError = error?.message ?? null;
  out.rowCount = data?.length ?? 0;

  const matched = (data ?? []).filter((r) => ILLUSTRATED.has(r.sci_name)).slice(0, 5);
  out.matched = matched.map((r) => r.sci_name);

  const attempts = [];
  for (const row of matched) {
    const url = `${SITE}/illustrations/${slug(row.sci_name)}.png`;
    try {
      const response = await fetch(url);
      attempts.push({ url, status: response.status, bytes: (await response.arrayBuffer()).byteLength });
    } catch (cause) {
      attempts.push({ url, threw: cause instanceof Error ? cause.message : String(cause) });
    }
  }
  out.attempts = attempts;

  return NextResponse.json(out);
}
