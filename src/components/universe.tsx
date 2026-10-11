"use client";

import { useState } from "react";

import { DESTINATIONS, STATUS_LABEL } from "@/content/site";

/** Positions on the map (percent of the map box). The core sits in the middle. */
const POS: Record<string, { x: number; y: number }> = {
  tasks: { x: 20, y: 26 },
  time: { x: 22, y: 74 },
  panchang: { x: 50, y: 88 },
  finance: { x: 78, y: 28 },
  next: { x: 80, y: 76 },
};

/** Scene 3: each tool as a destination on one map. Buttons, so it works with keyboard and touch. */
export function Universe() {
  const [selected, setSelected] = useState("finance");
  const d = DESTINATIONS.find((x) => x.id === selected) ?? DESTINATIONS[0];

  return (
    <section id="universe" className="scene universe" aria-labelledby="universe-title">
      <div className="wrap">
        <div className="scene-head reveal">
          <span className="label">The Ayudhas universe</span>
          <h2 id="universe-title">Every tool is a place you can visit.</h2>
          <p className="lede">Choose a destination. Live tools can be used today; the rest are marked as what they are.</p>
        </div>

        <div className="universe-grid">
          <div className="map glass reveal" role="group" aria-label="Destinations">
            <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {DESTINATIONS.map((dest) => (
                <line
                  key={dest.id}
                  x1="50" y1="52" x2={POS[dest.id].x} y2={POS[dest.id].y}
                  className={dest.id === selected ? "on" : dest.status === "planned" ? "dashed" : ""}
                  style={{ stroke: `var(${dest.hue})` }}
                />
              ))}
            </svg>
            <div className="map-core" aria-hidden><span>Ayudhas</span></div>
            {DESTINATIONS.map((dest) => (
              <button
                key={dest.id}
                type="button"
                className={`planet ${dest.status} ${dest.id === selected ? "is-on" : ""}`}
                style={{ left: `${POS[dest.id].x}%`, top: `${POS[dest.id].y}%`, ["--hue" as string]: `var(${dest.hue})` }}
                aria-pressed={dest.id === selected}
                onClick={() => setSelected(dest.id)}
              >
                <span className="planet-orb" aria-hidden />
                <span className="planet-name">{dest.name}</span>
                <span className="sr-only">, {STATUS_LABEL[dest.status]}</span>
              </button>
            ))}
          </div>

          <article className="glass destination reveal" style={{ ["--hue" as string]: `var(${d.hue})` }} aria-live="polite">
            <div className="dest-top">
              <span className="label">{d.realm}</span>
              <span className={`pill ${d.status}`}>{STATUS_LABEL[d.status]}</span>
            </div>
            <h3 className="dest-name">{d.name}</h3>
            <p className="dest-summary">{d.summary}</p>
            <ul className="dest-points">
              {d.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <div className="dest-foot">
              <span className="dest-product">In {d.product}</span>
              {d.action && (
                <a className="btn btn-ghost" href={d.action.href} {...(d.action.href.startsWith("http") ? { rel: "noopener" } : {})}>
                  {d.action.label} {d.action.href.startsWith("http") ? "↗" : "→"}
                </a>
              )}
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
