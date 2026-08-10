"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { Gallery, type GalleryBird } from "../gallery";
import { BirdArt } from "../bird-art";
import { flightSrc, perchedSrc, slug } from "@/lib/species-paths";
import "./motion-lab.css";

const studies = {
  load: {
    label: "Bird load-in",
    options: [
      { id: "assembly", label: "01 Field assembly", note: "Grid position stays fixed while specimens settle outward from the first bird" },
      { id: "scan", label: "02 Field scan", note: "A linear measuring rule reveals each row without spring movement" },
      { id: "ink", label: "03 Ink develop", note: "Pigment resolves gently before labels become fully present" },
      { id: "index", label: "04 Index first", note: "Taxonomy establishes the page before each illustration appears" },
    ],
  },
  drawer: {
    label: "Drawer contents",
    options: [
      { id: "specimen", label: "01 Specimen first", note: "Selected · the illustration establishes focus before facts and prose arrive" },
      { id: "reading", label: "02 Reading order", note: "Illustration, title, facts, prose, map, and recordings assemble in sequence" },
      { id: "grouped", label: "03 Two groups", note: "Image and title arrive together, followed by all supporting information" },
      { id: "whole", label: "04 Whole page", note: "The complete record fades as one quiet, stable composition" },
    ],
  },
  frame: {
    label: "Drawer frame",
    options: [
      { id: "spring", label: "01 Sheet spring", note: "Recommended · a low-bounce interruptible spring with a faster close" },
      { id: "glide", label: "02 Editorial glide", note: "No overshoot; the sheet decelerates firmly into its border" },
      { id: "rule", label: "03 Leading rule", note: "A constant-speed vertical rule draws the clipped frame into view" },
      { id: "compress", label: "04 Spatial focus", note: "The frame resolves from a compressed right edge rather than travelling across the page" },
    ],
  },
  pose: {
    label: "Pose switch",
    options: [
      { id: "register", label: "01 Register", note: "Recommended · the new pose keeps its center and settles by two percent" },
      { id: "dissolve", label: "02 Dissolve", note: "A restrained cross-dissolve with no spatial movement" },
      { id: "wipe", label: "03 Plate reveal", note: "A linear vertical reveal, like replacing an illustration plate" },
      { id: "focus", label: "04 Focus exchange", note: "A small focus pull bridges differently proportioned silhouettes" },
    ],
  },
  map: {
    label: "Map markers",
    options: [
      { id: "plot", label: "01 Plot sequence", note: "Recommended · markers settle in geographic reading order" },
      { id: "radiate", label: "02 Radiate", note: "Markers appear outward from the collection’s center" },
      { id: "stamp", label: "03 Field stamp", note: "A quick scale-and-opacity registration with no overshoot" },
      { id: "quiet", label: "04 Quiet", note: "Map arrives first; pins fade together after it is stable" },
    ],
  },
} as const;

type Scope = keyof typeof studies;

function PoseReview({ bird, option }: { bird: GalleryBird; option: string }) {
  const [flying, setFlying] = useState(false);
  const src = flying ? bird.flightArtUrl ?? flightSrc(bird.sciName) : bird.artUrl ?? perchedSrc(bird.sciName);
  const variants = {
    register: { initial: { opacity: 0, scale: .98, y: 5 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 1.01, y: -2 }, transition: { type: "spring" as const, visualDuration: .38, bounce: .08 } },
    dissolve: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: .18, ease: "linear" as const } },
    wipe: { initial: { opacity: 1, clipPath: "inset(100% 0 0 0)" }, animate: { opacity: 1, clipPath: "inset(0% 0 0 0)" }, exit: { opacity: 0 }, transition: { duration: .3, ease: "linear" as const } },
    focus: { initial: { opacity: 0, filter: "blur(4px)", scale: .99 }, animate: { opacity: 1, filter: "blur(0px)", scale: 1 }, exit: { opacity: 0, filter: "blur(2px)" }, transition: { duration: .24, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  }[option] ?? { initial: {}, animate: {}, exit: {}, transition: {} };

  return (
    <section className="pose-review" aria-label="Pose transition example">
      <div className="tray-figure">
        <button type="button" className="tray-art is-toggleable" onClick={() => setFlying((value) => !value)}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div className="pose-review-layer" key={flying ? "flight" : "perched"} {...variants}>
              <BirdArt src={src} label={`${bird.comName}, ${flying ? "in flight" : "perched"}`} />
            </motion.div>
          </AnimatePresence>
        </button>
        <div className="tray-figure-meta">
          <div className="pose-toggle" role="group" aria-label="Pose">
            <button type="button" aria-pressed={!flying} onClick={() => setFlying(false)}>perched</button>
            <button type="button" aria-pressed={flying} onClick={() => setFlying(true)}>in flight</button>
          </div>
          <span className="tray-figure-sci">{bird.sciName}</span>
        </div>
      </div>
      <h2 className="tray-name">{bird.comName}</h2>
      <p className="motion-instruction">Click the bird repeatedly—the transition should reverse cleanly without snapping.</p>
    </section>
  );
}

export function MotionLab({ birds }: { birds: GalleryBird[] }) {
  const [scope, setScope] = useState<Scope>("drawer");
  const [choices, setChoices] = useState<Record<Scope, string>>({ load: "assembly", drawer: "specimen", frame: "spring", pose: "register", map: "plot" });
  const [replay, setReplay] = useState(0);
  const active = studies[scope].options.find((item) => item.id === choices[scope]) ?? studies[scope].options[0];
  const poseBird = useMemo(() => birds.find((bird) => bird.flight && bird.art) ?? birds[0], [birds]);

  function changeScope(next: Scope) {
    setScope(next);
    setReplay((value) => value + 1);
    window.history.replaceState({}, "", next === "drawer" || next === "frame" ? `?bird=${slug(poseBird.sciName)}` : window.location.pathname);
  }

  function choose(id: string) {
    setChoices((current) => ({ ...current, [scope]: id }));
    window.history.replaceState({}, "", scope === "drawer" || scope === "frame" ? `?bird=${slug(poseBird.sciName)}` : window.location.pathname);
    setReplay((value) => value + 1);
  }

  function replayStudy() {
    window.history.replaceState({}, "", scope === "drawer" || scope === "frame" ? `?bird=${slug(poseBird.sciName)}` : window.location.pathname);
    setReplay((value) => value + 1);
  }

  return (
    <div className={`motion-study study-${scope} load-${choices.load} drawer-${choices.drawer} frame-${choices.frame} map-${choices.map}`}>
      <div className="motion-review-bar">
        <div className="motion-scope" role="tablist" aria-label="Animation part">
          {(Object.keys(studies) as Scope[]).map((key) => (
            <button key={key} type="button" role="tab" aria-selected={scope === key} onClick={() => changeScope(key)}>{studies[key].label}</button>
          ))}
        </div>
        <div className="motion-review-detail">
          <nav aria-label={`${scope} options`}>
            {studies[scope].options.map((item) => (
              <button key={item.id} type="button" aria-current={item.id === active.id} onClick={() => choose(item.id)}>{item.label}</button>
            ))}
          </nav>
          <span>{active.note}</span>
        </div>
        <button className="motion-replay" type="button" onClick={replayStudy}>
          {scope === "drawer" || scope === "frame" ? <ExternalLink aria-hidden="true" size={13} strokeWidth={1.5} /> : <RotateCcw aria-hidden="true" size={13} strokeWidth={1.5} />}
          {scope === "drawer" || scope === "frame" ? "Open example" : "Replay"}
        </button>
      </div>

      <main className="page" key={`${scope}-${active.id}-${replay}`}>
        {scope === "pose" ? (
          <PoseReview bird={poseBird} option={active.id} />
        ) : (
          <Gallery birds={birds} initialView={scope === "map" ? "map" : "grid"} rememberView={false} />
        )}
      </main>
    </div>
  );
}
