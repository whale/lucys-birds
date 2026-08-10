"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Feather } from "lucide-react";
import { perchedSrc, slug } from "@/lib/species-paths";
import { Collage } from "./collage";
import { BirdMap } from "./map";
import { Tray } from "./tray";
import { BirdArt } from "./bird-art";

export type GalleryBird = {
  id: number;
  sciName: string;
  comName: string;
  hasSong: boolean;
  lat: number | null;
  lon: number | null;
  place: string | null;
  art: boolean;
  flight: boolean;
  artUrl?: string | null;
  flightArtUrl?: string | null;
  ar?: number;
};

const VIEWS = [
  { key: "grid", label: "grid" },
  { key: "collage", label: "collage" },
  { key: "map", label: "map" },
] as const;

type View = (typeof VIEWS)[number]["key"];

export function Gallery({
  birds,
  initialView = "grid",
  rememberView = true,
}: {
  birds: GalleryBird[];
  initialView?: View;
  rememberView?: boolean;
}) {
  const [visibleBirds, setVisibleBirds] = useState(birds);
  const [view, setView] = useState<View>(initialView);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Remember the chosen view. It's a preference, not navigation — she
  // shouldn't have to re-pick it every visit.
  useEffect(() => {
    if (!rememberView) return;
    const saved = window.localStorage.getItem("lb_view");
    if (saved === "grid" || saved === "collage" || saved === "map")
      setView(saved);
  }, [rememberView]);

  function chooseView(next: View) {
    setView(next);
    if (rememberView) window.localStorage.setItem("lb_view", next);
  }

  // Deep link: /?bird=slug opens the tray on that bird, so a specific bird can
  // still be shared even though the detail is a tray rather than a page.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("bird");
    if (!wanted) return;
    const found = visibleBirds.findIndex(
      (b) => slug(b.sciName) === wanted.toLowerCase(),
    );
    if (found >= 0) setOpenIndex(found);
  }, [visibleBirds]);

  const open = useCallback(
    (index: number) => {
      setOpenIndex(index);
      // pushState rather than a router push: the page data hasn't changed, and
      // a real navigation would re-fetch the whole collection to show a panel.
      window.history.pushState({}, "", `?bird=${slug(visibleBirds[index].sciName)}`);
    },
    [visibleBirds],
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
        const next = (current + delta + visibleBirds.length) % visibleBirds.length;
        window.history.replaceState(
          {},
          "",
          `?bird=${slug(visibleBirds[next].sciName)}`,
        );
        return next;
      });
    },
    [visibleBirds],
  );

  // Keep the back button honest.
  useEffect(() => {
    function onPop() {
      const wanted = new URLSearchParams(window.location.search).get("bird");
      if (!wanted) {
        setOpenIndex(null);
        return;
      }
      const found = visibleBirds.findIndex(
        (b) => slug(b.sciName) === wanted.toLowerCase(),
      );
      setOpenIndex(found >= 0 ? found : null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [visibleBirds]);

  const removeBird = useCallback((id: number) => {
    setOpenIndex(null);
    setVisibleBirds((current) => current.filter((bird) => bird.id !== id));
    window.history.pushState({}, "", window.location.pathname);
  }, []);

  return (
    <>
      <header className={`masthead masthead-${view}`}>
        <div>
          <a className="eyebrow collection-home" href="https://lesmith.me">
            <ArrowLeft aria-hidden="true" size={12} strokeWidth={1.5} />
            Lucy&rsquo;s
          </a>
          <h1 className="display">Bird Collection</h1>
        </div>
        <div className="header-controls">
          <p className="meta">{visibleBirds.length} species</p>
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
          <Link className="chip" href="/add">add a bird</Link>
        </div>
      </header>

      {view === "grid" && (
        <ul className="flock">
          {visibleBirds.map((bird, i) => (
            <li className="bird" key={bird.id}>
              <button
                type="button"
                className="bird-link"
                onClick={() => open(i)}
              >
                <span className="portrait">
                  {bird.art ? (
                    <BirdArt
                      src={bird.artUrl ?? perchedSrc(bird.sciName)}
                      label={bird.comName}
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                      }}
                    />
                  ) : (
                    <span className="portrait-empty" aria-hidden="true">
                      <Feather aria-hidden="true" size={28} strokeWidth={1.25} />
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

      {view === "collage" && <Collage birds={visibleBirds} onOpen={open} />}

      {view === "map" && <BirdMap birds={visibleBirds} onOpen={open} />}

      <Tray birds={visibleBirds} index={openIndex} onClose={close} onStep={step} onRemoved={removeBird} />
    </>
  );
}
