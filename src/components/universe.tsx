"use client";

import { useEffect, useRef, useState } from "react";

import { DESTINATIONS, STATUS_LABEL } from "@/content/site";
import { emit, listen } from "@/lib/world-events";

import { layoutMap, type MapLayout } from "./map-layout";
import { SplitHeading } from "./split-heading";

/**
 * The map's orbits, matching the 3D world: Ayudhas Pro's tasks and time on the inner orbit, Panchang and Finance
 * further out, the unannounced tool on the edge. These percentages are only the first paint; once the map is measured,
 * map-layout.ts places every planet in pixels where its orb and name clear the core and each other.
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
/** The soft ring drawn around the core (px): planets keep clear of it too. */
const CORE_HALO = 16;

function position(id: string) {
  const p = PLACE[id] ?? { ring: 2, deg: 300 };
  const r = RINGS[p.ring];
  const a = (p.deg * Math.PI) / 180;
  return { x: CORE.x + r.rx * Math.cos(a), y: CORE.y + r.ry * Math.sin(a) };
}

/** Scene 3: each tool as a destination on one map. Buttons, so it works with keyboard and touch. */
export function Universe() {
  const [selected, setSelected] = useState("finance");
  const stageRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<(MapLayout & { width: number; height: number; anchor: number }) | null>(null);

  // Measure the map and its planets, and lay them out again whenever the map changes size.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const core = stage.querySelector<HTMLElement>(".map-core");
      const buttons = Array.from(stage.querySelectorAll<HTMLElement>("[data-destination]"));
      const orb = buttons[0]?.querySelector<HTMLElement>(".planet-orb");
      if (!width || !height || !core || !orb) return;
      const anchor = orb.offsetTop + orb.offsetHeight / 2;
      const specs = buttons.map((b) => {
        const id = b.dataset.destination ?? "";
        const p = PLACE[id] ?? { ring: 2, deg: 300 };
        return { id, ring: p.ring, deg: p.deg, width: b.offsetWidth, height: b.offsetHeight };
      });
      const next = layoutMap(specs, { width, height, coreRadius: core.offsetWidth / 2 + CORE_HALO, orbRadius: orb.offsetWidth / 2, anchor });
      setLayout({ ...next, width, height, anchor });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const ro = new ResizeObserver(schedule);
    // Names change width when the web fonts arrive, so the first layout waits for them: planets are placed once,
    // not placed and then moved under a visitor's finger.
    let alive = true;
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    fontsReady.then(() => { if (alive) ro.observe(stage); });
    return () => { alive = false; ro.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  // Pixel positions once measured, the percentage layout before that.
  const at = (id: string) => layout?.planets[id] ?? position(id);
  const unit = layout ? "px" : "%";
  const core = layout?.core ?? CORE;
  const rings = layout?.rings ?? RINGS;
  const viewBox = layout ? `0 0 ${layout.width} ${layout.height}` : "0 0 100 100";
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
            <div ref={stageRef} className={`map-stage ${layout ? "is-laid-out" : ""}`}>
              <svg className="map-rings" viewBox={viewBox} preserveAspectRatio="none" aria-hidden>
                {rings.map((r, i) => (
                  <ellipse key={i} cx={core.x} cy={core.y} rx={r.rx} ry={r.ry} className={i === rings.length - 1 ? "outer" : undefined} />
                ))}
              </svg>
              <svg className="map-lines" viewBox={viewBox} preserveAspectRatio="none" aria-hidden>
                {DESTINATIONS.map((dest) => {
                  const p = at(dest.id);
                  return (
                    <line
                      key={dest.id}
                      x1={core.x} y1={core.y} x2={p.x} y2={p.y}
                      className={dest.id === selected ? "on" : dest.status === "planned" ? "dashed" : ""}
                      style={{ stroke: `var(${dest.hue})` }}
                    />
                  );
                })}
              </svg>
              <div className="map-core" style={{ left: `${core.x}${unit}`, top: `${core.y}${unit}` }} aria-hidden><span>Ayudhas</span></div>
              {DESTINATIONS.map((dest, i) => {
                const p = at(dest.id);
                return (
                  <button
                    key={dest.id}
                    type="button"
                    className={`planet ${dest.status} ${dest.id === selected ? "is-on" : ""}`}
                    // The orb's centre sits on the orbit; the name hangs below it.
                    style={{ left: `${p.x}${unit}`, top: `calc(${p.y}${unit} - var(--anchor))`, ["--hue" as string]: `var(${dest.hue})`, ["--i" as string]: i }}
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
