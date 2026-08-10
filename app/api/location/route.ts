import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon))
    return NextResponse.json({ error: "Invalid location." }, { status: 400 });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
      { headers: { "User-Agent": "LucysBirds/1.0" }, next: { revalidate: 86400 } },
    );
    if (!response.ok) throw new Error("Reverse geocoding failed");
    const data = await response.json();
    const address = data.address ?? {};
    const label = [
      address.neighbourhood || address.suburb || address.city_district,
      address.city || address.town || address.village || address.county,
      address.state,
    ].filter(Boolean).filter((part, index, list) => list.indexOf(part) === index).join(", ");
    return NextResponse.json({ label: label || data.display_name || `${lat}, ${lon}` });
  } catch {
    return NextResponse.json({ label: `${lat}, ${lon}` });
  }
}
