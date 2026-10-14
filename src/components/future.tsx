"use client";

import { useEffect, useState } from "react";

import { DESTINATIONS } from "@/content/site";
import { emit } from "@/lib/world-events";

import { SplitHeading } from "./split-heading";

const LIVE = DESTINATIONS.filter((d) => d.status !== "planned");
const ANCHORS = [{ x: 18, y: 58 }, { x: 34, y: 34 }, { x: 50, y: 62 }, { x: 66, y: 40 }];
const OPEN_SLOTS = [{ x: 80, y: 22 }, { x: 84, y: 70 }, { x: 94, y: 46 }, { x: 72, y: 84 }];

/** Scene 6: the map keeps growing. Open slots are unnamed on purpose: nothing is announced until it exists. */
export function Future() {
  const [grown, setGrown] = useState(1);
  // The 3D world shows the same number of empty orbits.
  useEffect(() => emit("ayudhas:world-growth", { count: grown }), [grown]);
  return (
    <section id="future" className="scene future" aria-labelledby="future-title" data-chapter>
      <div className="wrap">
        <div className="scene-head reveal">
          <span className="label">What comes next</span>
          <SplitHeading id="future-title" parts={["A map with room to grow."]} />
          <p className="lede">
            New tools join the same constellation: same name, same design, one place to find them. There are no dates or
            features to announce yet, so the open places on the map stay unnamed.
          </p>
        </div>
        <div className="glass constellation reveal">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" data-growth={grown}
            aria-label={`${LIVE.length} tools on the map today and ${grown} open places for future tools`}>
            <defs>
              <radialGradient id="star-glow"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
            </defs>
            {ANCHORS.slice(1).map((p, i) => (
              <line key={i} x1={ANCHORS[i].x} y1={ANCHORS[i].y} x2={p.x} y2={p.y} className="c-line" pathLength={1} style={{ ["--i" as string]: i }} />
            ))}
            {OPEN_SLOTS.slice(0, grown).map((p, i) => (
              <g key={`slot-${i}`} className="c-slot">
                <line x1={ANCHORS[3].x} y1={ANCHORS[3].y} x2={p.x} y2={p.y} className="c-line dashed" />
                <circle cx={p.x} cy={p.y} r="2.6" className="c-open" />
                <text x={p.x} y={p.y + 7} textAnchor="middle" className="c-label faint">next</text>
              </g>
            ))}
            {LIVE.map((d, i) => (
              <g key={d.id} style={{ color: `var(${d.hue})` }}>
                <circle cx={ANCHORS[i].x} cy={ANCHORS[i].y} r="6" fill="url(#star-glow)" opacity=".35" />
                <circle cx={ANCHORS[i].x} cy={ANCHORS[i].y} r="2.2" fill="currentColor" className="c-star" />
                <text x={ANCHORS[i].x} y={ANCHORS[i].y + 7} textAnchor="middle" className="c-label">{d.name}</text>
              </g>
            ))}
          </svg>
          <div className="constellation-foot">
            <p><b>{LIVE.length}</b> tools today · <b>{grown}</b> open {grown === 1 ? "place" : "places"} on the map</p>
            <button type="button" className="btn btn-ghost" onClick={() => setGrown((g) => (g % OPEN_SLOTS.length) + 1)}>
              Show room to grow
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
