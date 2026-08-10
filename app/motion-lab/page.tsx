import { MotionLab } from "./motion-lab";
import { serviceClient } from "@/lib/supabase";
import { aspectRatio, hasArt, hasFlight } from "@/lib/species";
import type { GalleryBird } from "../gallery";

export const metadata = { title: "Motion Study · Lucy’s Birds" };
export const dynamic = "force-dynamic";

export default async function MotionLabPage() {
  const { data, error } = await serviceClient().from("collection").select("*");
  if (error) throw error;

  const birds: GalleryBird[] = (data ?? []).map((bird) => ({
    id: bird.id,
    sciName: bird.sci_name,
    comName: bird.com_name,
    hasSong: Boolean(bird.audio_path),
    lat: (bird as { lat?: number | null }).lat ?? null,
    lon: (bird as { lon?: number | null }).lon ?? null,
    place: (bird as { place?: string | null }).place ?? null,
    art: hasArt(bird.sci_name) || Boolean((bird as { art_url?: string | null }).art_url),
    flight: hasFlight(bird.sci_name) || Boolean((bird as { flight_art_url?: string | null }).flight_art_url),
    artUrl: (bird as { art_url?: string | null }).art_url ?? null,
    flightArtUrl: (bird as { flight_art_url?: string | null }).flight_art_url ?? null,
    ar: aspectRatio(bird.sci_name),
  }));

  return <MotionLab birds={birds} />;
}
