"use client";

import { useEffect, useRef } from "react";
import { perchedSrc } from "@/lib/species-paths";
import type { GalleryBird } from "./gallery";

/**
 * Where each bird was found.
 *
 * Overlap strategy: birds cluster. Two birds spotted in the same garden are the
 * same pixel at country zoom, so nearby markers collapse into one circle
 * carrying a count; zoom in and they separate; click a cluster and the map
 * zooms to fit it. That's leaflet.markercluster doing the work — hand-rolled
 * pin-spreading looks clever and behaves badly at the edges.
 *
 * Pins are the illustrations themselves, not generic teardrops. The artwork is
 * the point of the site and a map is no reason to stop using it.
 */
export function BirdMap({
  birds,
  onOpen,
}: {
  birds: GalleryBird[];
  onOpen: (index: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  // Kept in a ref so the effect can read the latest handler without tearing
  // the whole map down and rebuilding it.
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  const located = birds.filter((b) => b.lat != null && b.lon != null);
  const locationKey = located
    .map((b) => `${b.id}:${b.lat}:${b.lon}`)
    .join(",");

  useEffect(() => {
    if (!host.current || located.length === 0) return;

    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    (async () => {
      // Imported here rather than at module scope: Leaflet touches `window` on
      // import and would break the server render.
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster");
      if (cancelled || !host.current) return;

      map = L.map(host.current, {
        // Touch screens use two-finger pinch; Mac trackpads report their pinch
        // gesture through the wheel-zoom path. Both need to be enabled.
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
        zoomControl: true,
        zoomAnimation: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 48,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iconCreateFunction: (group: any) =>
          L.divIcon({
            html: String(group.getChildCount()),
            className: "bird-cluster",
            iconSize: L.point(38, 38),
            iconAnchor: L.point(19, 19),
          }),
      });

      located.forEach((bird) => {
        // Built as a real element rather than an HTML string. Species names
        // come from the database, and interpolating them into markup would put
        // stored input into the DOM of a public page — a quote or an angle
        // bracket in a name is all it would take. Setting properties can't
        // inject anything.
        const art = document.createElement("span");
        art.className = "bird-pin-art";
        art.style.backgroundImage = `url("${encodeURI(bird.artUrl ?? perchedSrc(bird.sciName))}")`;
        art.setAttribute("role", "img");
        art.setAttribute("aria-label", bird.comName);

        const icon = L.divIcon({
          className: "bird-pin",
          // A CSS background, not an <img> — same reason as everywhere else on
          // this site, so browser extensions have nothing to attach to.
          html: art,
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        });

        L.marker([bird.lat as number, bird.lon as number], {
          icon,
          title: bird.comName,
        })
          .on("click", () => {
            const index = birds.findIndex((b) => b.id === bird.id);
            if (index >= 0) openRef.current(index);
          })
          .addTo(cluster);
      });

      map.addLayer(cluster);
      map.fitBounds(cluster.getBounds(), { padding: [48, 48], maxZoom: 13 });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Rebuild only when the located set actually changes.
  }, [locationKey]);

  if (located.length === 0) {
    return (
      <div className="view-empty">
        <p className="display" style={{ fontSize: "clamp(18px, 2vw, 24px)" }}>
          NOTHING TO MAP YET
        </p>
        <p>
          No bird has a place attached. Add one with a location and it&rsquo;ll
          show up here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="birdmap" ref={host} />
      <p className="meta" style={{ marginTop: 12 }}>
        {located.length} of {birds.length} birds have a place
      </p>
    </>
  );
}

/** Compact location map used inside the featured-bird panel. */
export function BirdSpotMap({
  bird,
  birds,
}: {
  bird: GalleryBird;
  birds: GalleryBird[];
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current || bird.lat == null || bird.lon == null) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !host.current) return;

      map = L.map(host.current, {
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
        zoomControl: false,
        attributionControl: true,
      }).setView([bird.lat as number, bird.lon as number], 8);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const nearbyCount = birds.filter(
        (item) =>
          item.lat != null &&
          item.lon != null &&
          Math.abs(item.lat - (bird.lat as number)) < 0.03 &&
          Math.abs(item.lon - (bird.lon as number)) < 0.03,
      ).length;

      const icon = L.divIcon({
        html: String(Math.max(1, nearbyCount)),
        className: "bird-cluster spot-cluster",
        iconSize: L.point(30, 30),
        iconAnchor: L.point(15, 15),
      });
      L.marker([bird.lat as number, bird.lon as number], { icon }).addTo(map);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [bird.id, bird.lat, bird.lon, birds]);

  if (bird.lat == null || bird.lon == null) return null;

  return (
    <section className="spot-map">
      <h3>
        Spotted{bird.place ? ` in ${bird.place}` : " here"}
      </h3>
      <div className="spot-map-frame">
        <div className="spot-map-canvas" ref={host} />
      </div>
    </section>
  );
}
