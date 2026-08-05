"use client";

import { useCallback, useEffect, useState } from "react";
import { perchedSrc, slug } from "@/lib/species-paths";
import { Collage } from "./collage";
import { Tray } from "./tray";
import { NOPIN } from "@/lib/nopin";

export type GalleryBird = {
  id: number;
  sciName: string;
  comName: string;
  hasSong: boolean;
  art: boolean;
  flight: boolean;
  ar?: number;
};

const VIEWS = [
  { key: "grid", label: "grid" },
  { key: "collage", label: "collage" },
  { key: "map", label: "map" },
] as const;

type View = (typeof VIEWS)[number]["key"];

export function Gallery({ birds }: { birds: GalleryBird[] }) {
  const [view, setView] = useState<View>("grid");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Remember the chosen view. It's a preference, not navigation — she
  // shouldn't have to re-pick it every visit.
  useEffect(() => {
    const saved = window.localStorage.getItem("lb_view");
    if (saved === "grid" || saved === "collage" || saved === "map")
      setView(saved);
  }, []);

  function chooseView(next: View) {
    setView(next);
    window.localStorage.setItem("lb_view", next);
  }

  // Deep link: /?bird=slug opens the tray on that bird, so a specific bird can
  // still be shared even though the detail is a tray rather than a page.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("bird");
    if (!wanted) return;
    const found = birds.findIndex(
      (b) => slug(b.sciName) === wanted.toLowerCase(),
    );
    if (found >= 0) setOpenIndex(found);
  }, [birds]);

  const open = useCallback(
    (index: number) => {
      setOpenIndex(index);
      // pushState rather than a router push: the page data hasn't changed, and
      // a real navigation would re-fetch the whole collection to show a panel.
      window.history.pushState({}, "", `?bird=${slug(birds[index].sciName)}`);
    },
    [birds],
  );

  const close = useCallback(() => {
    setOpenIndex(null);
    window.history.pushState({}, "", window.location.pathname);
  }, []);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        // Wraps, so paging never dead-ends on the last bird.
        const next = (current + delta + birds.length) % birds.length;
        window.history.replaceState(
          {},
          "",
          `?bird=${slug(birds[next].sciName)}`,
        );
        return next;
      });
    },
    [birds],
  );

  // Keep the back button honest.
  useEffect(() => {
    function onPop() {
      const wanted = new URLSearchParams(window.location.search).get("bird");
      if (!wanted) {
        setOpenIndex(null);
        return;
      }
      const found = birds.findIndex(
        (b) => slug(b.sciName) === wanted.toLowerCase(),
      );
      setOpenIndex(found >= 0 ? found : null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [birds]);

  return (
    <>
      <nav className="viewpick" aria-label="View">
        {VIEWS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-current={view === option.key}
            onClick={() => chooseView(option.key)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {view === "grid" && (
        <ul className="flock">
          {birds.map((bird, i) => (
            <li className="bird" key={bird.id}>
              <button
                type="button"
                className="bird-link"
                onClick={() => open(i)}
              >
                <span className="portrait">
                  {bird.art ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      {...NOPIN}
                      src={perchedSrc(bird.sciName)}
                      alt={bird.comName}
                      loading="lazy"
                    />
                  ) : (
                    <span className="portrait-empty" aria-hidden="true">
                      🪶
                    </span>
                  )}
                </span>
                <span className="com">{bird.comName}</span>
                <span className="sci">{bird.sciName}</span>
                {bird.hasSong && <span className="song-flag">song</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {view === "collage" && <Collage birds={birds} onOpen={open} />}

      {view === "map" && (
        <div className="view-empty">
          <p className="display" style={{ fontSize: "clamp(18px, 2vw, 24px)" }}>
            NOTHING TO MAP YET
          </p>
          <p>
            No bird has a place attached. Once new birds are added with a
            location, they&rsquo;ll show up here.
          </p>
        </div>
      )}

      <Tray birds={birds} index={openIndex} onClose={close} onStep={step} />
    </>
  );
}
