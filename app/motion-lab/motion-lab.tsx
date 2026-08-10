"use client";

import { useState } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import { Gallery, type GalleryBird } from "../gallery";
import "./motion-lab.css";

const loadOptions = [
  { id: "scan", label: "01 Field scan", note: "Linear scan line uncovers the collection" },
  { id: "flock", label: "02 Flock settle", note: "Birds arrive directionally, labels follow" },
  { id: "ink", label: "03 Ink develop", note: "Illustrations resolve from soft pigment to detail" },
  { id: "index", label: "04 Indexing", note: "Names establish the grid before portraits appear" },
] as const;

const drawerOptions = [
  { id: "direct", label: "01 Direct", note: "Fast spatial slide with an asymmetric exit" },
  { id: "paper", label: "02 Paper edge", note: "Linear leading rule pulls open a clipped sheet" },
  { id: "focus", label: "03 Focus pull", note: "Blur bridges the background and drawer states" },
  { id: "specimen", label: "04 Specimen", note: "The bird arrives first, then its record assembles" },
] as const;

type Scope = "load" | "drawer";

export function MotionLab({ birds }: { birds: GalleryBird[] }) {
  const [scope, setScope] = useState<Scope>("load");
  const [loadOption, setLoadOption] = useState<(typeof loadOptions)[number]>(loadOptions[0]);
  const [drawerOption, setDrawerOption] = useState<(typeof drawerOptions)[number]>(drawerOptions[0]);
  const [replay, setReplay] = useState(0);

  const active = scope === "load" ? loadOption : drawerOption;
  const options = scope === "load" ? loadOptions : drawerOptions;

  function changeScope(next: Scope) {
    window.history.replaceState({}, "", window.location.pathname);
    setScope(next);
    setReplay((value) => value + 1);
  }

  function choose(id: string) {
    if (scope === "load") {
      const next = loadOptions.find((item) => item.id === id);
      if (next) setLoadOption(next);
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      const next = drawerOptions.find((item) => item.id === id);
      if (next) setDrawerOption(next);
      window.history.replaceState({}, "", "?bird=larus-smithsonianus");
    }
    setReplay((value) => value + 1);
  }

  function replayStudy() {
    window.history.replaceState(
      {},
      "",
      scope === "drawer" ? "?bird=larus-smithsonianus" : window.location.pathname,
    );
    setReplay((value) => value + 1);
  }

  return (
    <div className={`motion-study study-${scope} load-${loadOption.id} drawer-${drawerOption.id}`}>
      <div className="motion-review-bar">
        <div className="motion-scope" role="tablist" aria-label="Animation part">
          <button type="button" role="tab" aria-selected={scope === "load"} onClick={() => changeScope("load")}>Bird load-in</button>
          <button type="button" role="tab" aria-selected={scope === "drawer"} onClick={() => changeScope("drawer")}>Bird drawer</button>
        </div>

        <div className="motion-review-detail">
          <nav aria-label={`${scope} options`}>
            {options.map((item) => (
              <button key={item.id} type="button" aria-current={item.id === active.id} onClick={() => choose(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
          <span>{active.note}</span>
        </div>

        <button className="motion-replay" type="button" onClick={replayStudy}>
          {scope === "drawer" ? <ExternalLink aria-hidden="true" size={13} strokeWidth={1.5} /> : <RotateCcw aria-hidden="true" size={13} strokeWidth={1.5} />}
          {scope === "drawer" ? "Open example" : "Replay load"}
        </button>
      </div>

      <main className="page" key={`${scope}-${active.id}-${replay}`}>
        <Gallery birds={birds} initialView="grid" rememberView={false} />
      </main>
    </div>
  );
}
