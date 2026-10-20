"use client";

import { useEffect, useRef, useState } from "react";

import { APP, PRO, SITE } from "@/content/site";

import { SplitHeading } from "./split-heading";

export const PREFILL_EVENT = "ayudhas:prefill-contact";
export type Prefill = { topic: "question"; message: string };

function TasksScreen() {
  return (
    <div className="screen">
      <div className="screen-head">
        <div><b>Today</b><small>4 tasks · keep the streak going</small></div>
        <div className="score" aria-hidden><span>86</span><small>score</small></div>
      </div>
      <div className="screen-stats"><span><b>4</b>Today</span><span><b>1</b>Pending</span><span><b>3</b>Done</span></div>
      <ul className="screen-list">
        <li className="done" style={{ ["--c" as string]: "var(--emerald)" }}>Morning walk<small>6:30 AM · Daily</small></li>
        <li className="done" style={{ ["--c" as string]: "var(--blue)" }}>Team stand-up<small>10:00 AM · Weekdays</small></li>
        <li style={{ ["--c" as string]: "var(--amber)" }}>Pay electricity bill<small>Due today · reminder set</small></li>
        <li className="done" style={{ ["--c" as string]: "var(--violet)" }}>Call parents<small>Weekly · Sunday</small></li>
      </ul>
    </div>
  );
}

function TimeScreen() {
  const acts = [
    { n: "Work", c: "var(--blue)", w: 82 },
    { n: "Learning", c: "var(--cyan)", w: 46 },
    { n: "Exercise", c: "var(--emerald)", w: 28 },
    { n: "Travel", c: "var(--amber)", w: 34 },
  ];
  return (
    <div className="screen">
      <div className="screen-head"><div><b>Time Tracker</b><small>Running now</small></div></div>
      <div className="timer" aria-hidden>
        <span className="timer-ring" />
        <span className="timer-text">01:24:36</span>
        <span className="timer-act">Work</span>
      </div>
      <p className="screen-sub">Today&apos;s split</p>
      <ul className="bars">
        {acts.map((a) => (
          <li key={a.n}><span>{a.n}</span><i style={{ width: `${a.w}%`, background: a.c }} /></li>
        ))}
      </ul>
    </div>
  );
}

function PanchangScreen() {
  return (
    <div className="screen">
      <div className="screen-head"><div><b>Panchang</b><small>Sample day</small></div><span className="moon" aria-hidden /></div>
      <dl className="panchang">
        <div><dt>Tithi</dt><dd>Shukla Dashami</dd></div>
        <div><dt>Nakshatra</dt><dd>Shravana</dd></div>
        <div><dt>Sunrise</dt><dd>06:04</dd></div>
        <div><dt>Sunset</dt><dd>18:01</dd></div>
        <div><dt>Moonrise</dt><dd>14:12</dd></div>
        <div><dt>Moonset</dt><dd>01:38</dd></div>
      </dl>
      <p className="screen-sub">Offline · any date in the included data</p>
    </div>
  );
}

function ClockScreen() {
  return (
    <div className="screen">
      <div className="screen-head"><div><b>Alarms</b><small>Next alarm in 7 h 12 min</small></div></div>
      <ul className="screen-list">
        <li style={{ ["--c" as string]: "var(--amber)" }}>5:58 AM<small>Sunrise · Hyderabad · Daily</small></li>
        <li style={{ ["--c" as string]: "var(--blue)" }}>6:30 AM<small>Weekdays · Mission: scan QR code</small></li>
        <li style={{ ["--c" as string]: "var(--violet)" }}>8:00 AM<small>Weekends · Mission: maths</small></li>
        <li className="done" style={{ ["--c" as string]: "var(--cyan)" }}>2:00 PM<small>Off · Nap</small></li>
      </ul>
      <p className="screen-sub">Stopwatch · Timer · World clock</p>
    </div>
  );
}

const SCREENS = { tasks: TasksScreen, time: TimeScreen, clock: ClockScreen, panchang: PanchangScreen } as const;

/**
 * Scene 4: the Ayudhas app on Google Play (formerly Life Tracker), and Ayudhas Pro, its early-access edition in
 * closed testing. Screens are illustrations based on the app's design, with sample data.
 */
export function Pro() {
  const [tab, setTab] = useState<keyof typeof SCREENS>("tasks");
  const [dir, setDir] = useState(1);
  const tablistRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const Screen = SCREENS[tab];
  const tool = APP.tools.find((t) => t.id === tab)!;
  const ids = APP.tools.map((x) => x.id);

  /** Switch screens; the new one slides in from the side of the tab that was chosen. */
  const choose = (next: string) => {
    if (next === tab) return;
    setDir(ids.indexOf(next) > ids.indexOf(tab) ? 1 : -1);
    setTab(next as keyof typeof SCREENS);
  };

  // The selection pill slides to the chosen tab.
  useEffect(() => {
    const list = tablistRef.current;
    const place = () => {
      const button = list?.querySelector<HTMLElement>(`#tab-${tab}`);
      const pill = indicatorRef.current;
      if (!button || !pill) return;
      pill.style.width = `${button.offsetWidth}px`;
      pill.style.height = `${button.offsetHeight}px`;
      pill.style.transform = `translate(${button.offsetLeft}px, ${button.offsetTop}px)`;
      list?.classList.add("has-pill");
    };
    place();
    const ro = new ResizeObserver(place);
    if (list) ro.observe(list);
    return () => ro.disconnect();
  }, [tab]);

  const askToJoin = () => {
    window.dispatchEvent(new CustomEvent<Prefill>(PREFILL_EVENT, {
      detail: { topic: "question", message: "I'd like to join the Ayudhas Pro test on Android." },
    }));
  };

  return (
    <section id="pro" className="scene pro" aria-labelledby="pro-title" data-chapter>
      <div className="wrap">
        <div className="scene-head reveal" data-depth="0.22">
          <span className="label">Android app</span>
          <SplitHeading id="pro-title" parts={[{ text: "Ayudhas", className: "grad", after: ":" }, " tasks, time and Panchang in your pocket."]} />
          <p className="lede">
            {APP.promise} The first app in the Ayudhas collection, formerly called {APP.formerly}. Also inside: {APP.more.join(", ")}.
          </p>
          <div className="pro-badges">
            <span className="pill live-android">{APP.status}</span>
            {APP.traits.map((t) => <span key={t} className="trait">{t}</span>)}
          </div>
        </div>

        <div className="pro-grid">
          <div className="pro-device reveal">
            <div className="device" data-tilt role="img" aria-label={`Illustration of the ${tool.name} screen in Ayudhas, with sample data`}>
              <div className="device-notch" aria-hidden />
              <div key={tab} className="device-screen" data-dir={dir > 0 ? "next" : "prev"}><Screen /></div>
            </div>
            <p className="caption">Illustration based on the app&apos;s design. Sample data.</p>
          </div>

          <div className="pro-side">
            <div ref={tablistRef} className="tabs glass" role="tablist" aria-label="Ayudhas app tools">
              <span ref={indicatorRef} className="tab-pill" aria-hidden />
              {APP.tools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="pro-panel"
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => choose(t.id)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    const next = ids[(ids.indexOf(tab) + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length];
                    choose(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div id="pro-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="glass pro-panel">
              <h3>{tool.name}</h3>
              <ul key={tab}>{tool.lines.map((l, i) => <li key={l} style={{ ["--i" as string]: i }}>{l}</li>)}</ul>
            </div>
            <div className="pro-cta">
              <a className="btn btn-primary" href={SITE.playUrl} rel="noopener">Get it on Google Play ↗</a>
            </div>
            <div className="glass pro-panel pro-edition">
              <p>
                <b>{PRO.name}</b> <span className="pill android-testing">{PRO.status}</span>
              </p>
              <p>The early-access edition (formerly {PRO.formerly}), where new tools are tried before they reach Ayudhas.</p>
              <a className="btn btn-ghost" href="#contact" onClick={askToJoin}>Ask to join the Ayudhas Pro test →</a>
            </div>
          </div>
        </div>

        <figure className="pro-feature glass reveal">
          <div className="pro-feature-media">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export; image is pre-optimised WebP */}
            <img src="/images/ayudhas-pro-feature.webp" width={1024} height={500} loading="lazy" decoding="async"
              alt="Ayudhas feature graphic: Today's tasks with a Dedication Score of 86, the Time Tracker, and a reminder notification with Mark done and Postpone." />
          </div>
          <figcaption className="caption">From the Ayudhas Pro store listing.</figcaption>
        </figure>
      </div>
    </section>
  );
}
