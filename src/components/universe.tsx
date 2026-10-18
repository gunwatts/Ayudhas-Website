"use client";

import { useEffect, useState } from "react";

import { DESTINATIONS, STATUS_LABEL } from "@/content/site";
import { emit, listen } from "@/lib/world-events";

import { SplitHeading } from "./split-heading";

/**
 * The map's orbits (percent of the map box; flattened like a tilted plane), matching the 3D world: Ayudhas Pro's
 * tasks and time on the inner orbit, Panchang and Finance further out, the unannounced tool on the edge.
 */
const RINGS = [{ rx: 22, ry: 15.5 }, { rx: 34, ry: 24 }, { rx: 45, ry: 32 }];
const PLACE: Record<string, { ring: number; deg: number }> = {
  tasks: { ring: 0, deg: 200 },
  time: { ring: 0, deg: 25 },
  panchang: { ring: 1, deg: 115 },
  finance: { ring: 1, deg: -38 },
  next: { ring: 2, deg: 232 },
};
const CORE = { x: 50, y: 52 };

function position(id: string) {
  const p = PLACE[id] ?? { ring: 2, deg: 300 };
  const r = RINGS[p.ring];
  const a = (p.deg * Math.PI) / 180;
  return { x: CORE.x + r.rx * Math.cos(a), y: CORE.y + r.ry * Math.sin(a) };
}

/** Scene 3: each tool as a destination on one map. Buttons, so it works with keyboard and touch. */
export function Universe() {
  const [selected, setSelected] = useState("finance");
  const d = DESTINATIONS.find((x) => x.id === selected) ?? DESTINATIONS[0];

  // The hero's floating labels and the 3D objects choose a destination here.
  useEffect(() => listen("ayudhas:select-destination", ({ id }) => {
    if (DESTINATIONS.some((x) => x.id === id)) setSelected(id);
  }), []);
  // The 3D world leans towards whatever is chosen.
  useEffect(() => emit("ayudhas:world-focus", { id: selected }), [selected]);
  const preview = (id: string | null) => emit("ayudhas:world-focus", { id: id ?? selected });

  return (
    <section id="universe" className="scene universe" aria-labelledby="universe-title" data-chapter>
      <div className="wrap">
        <div className="scene-head reveal" data-depth="0.22">
          <span className="label">The Ayudhas universe</span>
          <SplitHeading id="universe-title" parts={["Every tool is a place you can visit."]} />
          <p className="lede">Choose a destination. Live tools can be used today; the rest are marked as what they are.</p>
        </div>

        <div className="universe-grid">
          <div className="map glass reveal" role="group" aria-label="Destinations" data-tilt>
            <div className="map-stage">
              <svg className="map-rings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                {RINGS.map((r, i) => (
                  <ellipse key={i} cx={CORE.x} cy={CORE.y} rx={r.rx} ry={r.ry} className={i === RINGS.length - 1 ? "outer" : undefined} />
                ))}
              </svg>
              <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                {DESTINATIONS.map((dest) => {
                  const p = position(dest.id);
                  return (
                    <line
                      key={dest.id}
                      x1={CORE.x} y1={CORE.y} x2={p.x} y2={p.y}
                      className={dest.id === selected ? "on" : dest.status === "planned" ? "dashed" : ""}
                      style={{ stroke: `var(${dest.hue})` }}
                    />
                  );
                })}
              </svg>
              <div className="map-core" aria-hidden><span>Ayudhas</span></div>
              {DESTINATIONS.map((dest) => {
                const p = position(dest.id);
                return (
                  <button
                    key={dest.id}
                    type="button"
                    className={`planet ${dest.status} ${dest.id === selected ? "is-on" : ""}`}
                    style={{ left: `${p.x}%`, top: `${p.y}%`, ["--hue" as string]: `var(${dest.hue})` }}
                    aria-pressed={dest.id === selected}
                    data-destination={dest.id}
                    onClick={() => setSelected(dest.id)}
                    onPointerEnter={() => preview(dest.id)}
                    onPointerLeave={() => preview(null)}
                  >
                    <span className="planet-orb" aria-hidden />
                    <span className="planet-name">{dest.name}</span>
                    <span className="sr-only">, {STATUS_LABEL[dest.status]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <article className="glass destination reveal" style={{ ["--hue" as string]: `var(${d.hue})` }} aria-live="polite" data-tilt>
            <div key={d.id} className="dest-body">
              <div className="dest-top">
                <span className="label">{d.realm}</span>
                <span className={`pill ${d.status}`}>{STATUS_LABEL[d.status]}</span>
              </div>
              <h3 className="dest-name">{d.name}</h3>
              <p className="dest-summary">{d.summary}</p>
              <ul className="dest-points">
                {d.points.map((p, i) => <li key={p} style={{ ["--i" as string]: i }}>{p}</li>)}
              </ul>
              <div className="dest-foot">
                <span className="dest-product">In {d.product}</span>
                {d.action && (
                  <a className="btn btn-ghost" href={d.action.href} {...(d.action.href.startsWith("http") ? { rel: "noopener" } : {})}>
                    {d.action.label} {d.action.href.startsWith("http") ? "↗" : "→"}
                  </a>
                )}
              </div>
            </div>
          </article>
        </div>

        <ul className="dest-list" aria-label="All destinations">
          {DESTINATIONS.map((dest) => (
            <li key={dest.id} style={{ ["--hue" as string]: `var(${dest.hue})` }}>
              <b>{dest.name}</b> <span className={`pill ${dest.status}`}>{STATUS_LABEL[dest.status]}</span>
              <span className="dest-list-sum">{dest.summary}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
