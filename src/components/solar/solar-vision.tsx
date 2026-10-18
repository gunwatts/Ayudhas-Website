"use client";

import Link from "next/link";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Logo } from "@/components/logo";
import { useReducedMotion } from "@/lib/motion";

import { compassPoint, dayEvents, type DayEvents, type MoonEvent, snapshot, type Snapshot, startOfLocalDay } from "./astro";
import type { SolarEngine, Target, ViewMode } from "./engine";
import {
  DEFAULT_LOCATION, locateDevice, type Location, placeName, type PlaceResult, satelliteImageUrl,
  fromWallTime, searchPlaces, timeZoneAt, toWallTime, zoneOffsetSeconds,
} from "./live";
import { PhaseIcon } from "./phase-icon";

/** How fast ◀◀ and ▶▶ run time, in simulated seconds per real second. */
const RATES = [
  { value: 600, label: "10 min/s", title: "Ten minutes every second" },
  { value: 3600, label: "1 h/s", title: "One hour every second" },
  { value: 86_400, label: "1 day/s", title: "One day every second" },
];
/** The timeline slider spans this many hours either side of where you are in time. */
const SCRUB_HOURS = 24;
const SCRUB_MS = SCRUB_HOURS * 3_600_000;
/** The date picker's range: Astronomy Engine is accurate well beyond it. */
const PICK_MIN = "1900-01-01T00:00";
const PICK_MAX = "2100-12-31T23:59";
const LIVE_TOLERANCE_MS = 45_000;
const QUARTER_NAMES: Record<MoonEvent["kind"], string> = { new: "New Moon", first: "First Quarter", full: "Full Moon", last: "Last Quarter" };

type SimClock = { real: number; at: number; speed: number };

/** Re-anchor the simulated clock at `at` (ms) running at `speed`. Called from event handlers only. */
function retime(sim: RefObject<SimClock>, at: number | "now", speed: number) {
  const real = Date.now();
  sim.current = { real, at: at === "now" ? real : at, speed };
}


const fmtNumber = (n: number, digits = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const fmtDeg = (n: number) => `${n.toFixed(1)}°`;

/**
 * Solar Vision: the real Sun, Moon and Earth for the visitor's place and moment. Positions come from Astronomy
 * Engine in the browser (no server), the globe's clouds from NASA GIBS. Time runs live,
 * can be scrubbed two days either way, or fast-forwarded to watch the sky turn.
 */
export function SolarVision() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sunLabel = useRef<HTMLDivElement>(null);
  const moonLabel = useRef<HTMLDivElement>(null);
  const youLabel = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SolarEngine | null>(null);
  const reduce = useReducedMotion();

  // The simulated clock: an anchor in real time and in simulated time, and a speed. Unset (live) until the page runs
  // in the browser, so nothing time-dependent is baked into the pre-rendered HTML.
  const sim = useRef<SimClock>({ real: 0, at: 0, speed: 1 });
  const clock = useCallback(() => {
    const c = sim.current;
    const t = new Date();
    return c.real ? new Date(c.at + (t.getTime() - c.real) * c.speed) : t;
  }, []);

  const [mode, setMode] = useState<ViewMode>("sky");
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [location, setLocation] = useState<Location>(DEFAULT_LOCATION);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [tick, setTick] = useState<{ sim: Date; real: number } | null>(null);
  // Simulated seconds per real second: 1 real time, 0 paused, ±rate fast forward or rewind.
  const [speed, setSpeed] = useState(1);
  const [rate, setRate] = useState(RATES[0].value);
  // The middle of the timeline slider (ms); null follows the real present.
  const [center, setCenter] = useState<number | null>(null);
  // While the date box has focus it holds what is being typed, instead of ticking along with the clock.
  const [pickDraft, setPickDraft] = useState<string | null>(null);
  const [constellations, setConstellations] = useState(false);
  const [trueScale, setTrueScale] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [compassOn, setCompassOn] = useState(false);
  const [canCompass, setCanCompass] = useState(false);
  const [satellite, setSatellite] = useState<"loading" | "ok" | "off">("loading");

  const place = useMemo(() => ({ lat: location.lat, lon: location.lon, height: Math.max(0, location.height) }), [location]);
  const timeZone = location.timeZone;

  /* ----------------------------------------------------------- engine */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    import("./engine")
      .then(({ createSolarEngine }) => createSolarEngine({
        canvas,
        labels: { sun: sunLabel.current ?? undefined, moon: moonLabel.current ?? undefined, you: youLabel.current ?? undefined },
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        clock,
        fast: () => Math.abs(sim.current.speed) > 1,
        insets: () => (window.innerWidth > 860
          ? { top: 130, right: 390, bottom: 110, left: 16 }
          : { top: 170, right: 16, bottom: 210, left: 16 }),
        onReady: () => { if (!disposed) setStatus("ready"); },
        onHeading: (az, alt, fov) => {
          const el = headingRef.current;
          if (el) el.textContent = `${compassPoint(az)} ${az.toFixed(0)}° · ${alt >= 0 ? "+" : ""}${alt.toFixed(0)}° · ${fov < 10 ? fov.toFixed(1) : fov.toFixed(0)}° view`;
        },
      }))
      .then((engine) => {
        if (disposed) { engine.dispose(); return; }
        engineRef.current = engine;
        engine.setPlace(place);
        // Yesterday's satellite image arrives in the background; until then the globe shows the stock map.
        void engine.setSatelliteImage(satelliteImageUrl()).then((ok) => { if (!disposed) setSatellite(ok ? "ok" : "off"); });
      })
      .catch(() => { if (!disposed) setStatus("failed"); });
    setCanCompass(typeof window.DeviceOrientationEvent !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
    return () => {
      disposed = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // The engine is built once; the place and the toggles are pushed to it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  useEffect(() => { engineRef.current?.setPlace(place); }, [place, status]);
  useEffect(() => { engineRef.current?.setMode(mode); }, [mode, status]);
  useEffect(() => { engineRef.current?.setConstellations(constellations); }, [constellations, status]);
  useEffect(() => { engineRef.current?.setTrueScale(trueScale); }, [trueScale, status]);
  useEffect(() => { engineRef.current?.setReducedMotion(reduce); }, [reduce, status]);

  // Start by facing the Moon if it is up, otherwise the Sun if it is up, otherwise south.
  const aimed = useRef(false);
  useEffect(() => {
    if (status !== "ready" || aimed.current) return;
    aimed.current = true;
    const s = snapshot(clock(), place);
    engineRef.current?.lookAt(s.moon.altitude > 3 ? "moon" : s.sun.altitude > 3 ? "sun" : place.lat >= 0 ? "south" : "north");
  }, [status, clock, place]);

  // The data panel sits just above the time bar, whose height changes with the screen and its wrapping controls.
  const timeBarRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(() => rootRef.current?.style.setProperty("--sv-time-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ----------------------------------------------------------- location */

  const locateMe = useCallback(async () => {
    setLocating(true);
    setLocError(null);
    try {
      const loc = await locateDevice();
      setLocation(loc);
      setPlaceOpen(false);
      const name = await placeName(loc.lat, loc.lon);
      if (name) setLocation((l) => (l.lat === loc.lat && l.lon === loc.lon ? { ...l, name } : l));
    } catch (e) {
      setLocError(e instanceof Error ? e.message : "Your location could not be found.");
    } finally {
      setLocating(false);
    }
  }, []);

  // Ask once on arrival when the browser already has permission; otherwise wait for the button.
  useEffect(() => {
    let alive = true;
    navigator.permissions?.query({ name: "geolocation" as PermissionName })
      .then((p) => { if (alive && p.state === "granted") void locateMe(); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [locateMe]);

  // OpenStreetMap's search runs when the visitor submits (its policy rules out search-as-you-type).
  const search = async () => {
    if (query.trim().length < 2 || searching) return;
    setSearching(true);
    setLocError(null);
    try {
      setResults(await searchPlaces(query));
    } catch {
      setResults(null);
      setLocError("Place search is not reachable right now.");
    } finally {
      setSearching(false);
    }
  };

  const choosePlace = async (r: PlaceResult) => {
    setPlaceOpen(false);
    setQuery("");
    setResults(null);
    setLocation({ lat: r.lat, lon: r.lon, height: r.height, name: r.name, source: "search" });
    const tz = await timeZoneAt(r.lat, r.lon);
    setLocation((l) => (l.lat === r.lat && l.lon === r.lon ? { ...l, timeZone: tz } : l));
  };

  /* ----------------------------------------------------------- the clock and the numbers */

  const refresh = useCallback(() => {
    const t = clock();
    setTick({ sim: t, real: new Date().getTime() });
    // Running off either end of the timeline re-centres it, so the slider always has room both ways.
    setCenter((c) => (c !== null && Math.abs(t.getTime() - c) > SCRUB_MS ? t.getTime() : c));
  }, [clock]);
  useEffect(() => {
    const first = requestAnimationFrame(refresh);
    const id = window.setInterval(refresh, Math.abs(speed) > 1 ? 200 : 1000);
    return () => { cancelAnimationFrame(first); window.clearInterval(id); };
  }, [refresh, speed]);

  const now = tick?.sim ?? null;
  const offset = useMemo(() => (now ? zoneOffsetSeconds(timeZone, now) : 0), [timeZone, now]);
  const snap: Snapshot | null = useMemo(() => (now ? snapshot(now, place) : null), [now, place]);
  const dayKey = now ? startOfLocalDay(now, offset).getTime() : 0;
  const events: DayEvents | null = useMemo(
    () => (dayKey ? dayEvents(new Date(dayKey + 43_200_000), place, offset) : null),
    [dayKey, place, offset],
  );
  const offsetFromNow = tick ? tick.sim.getTime() - tick.real : 0;
  const live = speed === 1 && Math.abs(offsetFromNow) < LIVE_TOLERANCE_MS;
  const sliderMid = center ?? tick?.real ?? 0;
  const sliderMinutes = tick ? Math.round(Math.max(-SCRUB_MS, Math.min(SCRUB_MS, tick.sim.getTime() - sliderMid)) / 60_000) : 0;
  const rateLabel = RATES.find((r) => r.value === rate)?.label ?? "";

  /** Keep the current moment, change how time runs. */
  const run = (nextSpeed: number) => {
    const at = clock().getTime();
    retime(sim, at, nextSpeed);
    setSpeed(nextSpeed);
    setCenter((c) => c ?? at);
    refresh();
  };
  const togglePause = () => run(speed === 0 ? 1 : 0);
  const chooseRate = (value: number) => {
    setRate(value);
    // Already fast-forwarding or rewinding: switch to the new rate in the same direction.
    if (Math.abs(speed) > 1) run(Math.sign(speed) * value);
  };
  const backToNow = () => { retime(sim, "now", 1); setSpeed(1); setCenter(null); refresh(); };
  const scrubTo = (minutes: number) => {
    const mid = center ?? Date.now();
    retime(sim, mid + minutes * 60_000, sim.current.speed);
    setCenter(mid);
    refresh();
  };
  /** Jump to a date and time typed in the place's own time zone, and hold there. */
  const goTo = (value: string) => {
    const at = fromWallTime(value, timeZone);
    if (!at) return;
    retime(sim, at.getTime(), 0);
    setSpeed(0);
    setCenter(at.getTime());
    refresh();
  };

  const fmtTime = useCallback((d: Date | null, withDate = false) => {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit", minute: "2-digit", ...(withDate ? { day: "numeric", month: "short" } : {}), hour12: true,
      ...(timeZone ? { timeZone } : {}),
    }).format(d);
  }, [timeZone]);
  const fmtDateTime = useMemo(() => new Intl.DateTimeFormat("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    ...(timeZone ? { timeZone, timeZoneName: "short" } : { timeZoneName: "short" }),
  }), [timeZone]);

  const sunNow = snap ? snap.sun.clearSkyIrradiance : 0;
  const moonUp = (snap?.moon.altitude ?? -1) > 0;
  const sunUp = (snap?.sun.altitude ?? -1) > -0.83;
  const dayLength = events?.sunrise && events.sunset ? (events.sunset.getTime() - events.sunrise.getTime()) / 3_600_000 : null;
  const southern = location.lat < 0;

  const look = (t: Target, closeUp?: boolean) => engineRef.current?.lookAt(t, closeUp);

  const toggleCompass = async () => {
    const next = !compassOn;
    const ok = (await engineRef.current?.setDeviceOrientation(next)) ?? false;
    setCompassOn(next && ok);
    if (next && !ok) setLocError("This device did not allow motion and compass access.");
  };

  /* ----------------------------------------------------------- view */

  return (
    <div ref={rootRef} className={`sv sv-${mode}`} data-status={status}>
      <canvas ref={canvasRef} className="sv-canvas" aria-label={mode === "sky"
        ? `Live 3D sky over ${location.name}. Drag to look around, scroll or pinch to zoom.`
        : "Live 3D view of the Earth, the Moon and the Sun from space. Drag to orbit, scroll or pinch to zoom."} />

      <div ref={sunLabel} className="sv-tag sv-tag-sun" data-state="hidden" aria-hidden="true">
        <i className="sv-arrow" /><b>Sun</b><span>{snap && (mode === "space" ? `${fmtNumber(snap.sun.distanceKm / 1e6, 1)} million km` : sunUp ? `${fmtDeg(snap.sun.altitude)} up` : "below horizon")}</span>
      </div>
      <div ref={moonLabel} className="sv-tag sv-tag-moon" data-state="hidden" aria-hidden="true">
        <i className="sv-arrow" /><b>Moon{snap && ` · ${Math.round(snap.moon.illuminated * 100)}%`}</b><span>{snap && (mode === "space" ? `${fmtNumber(snap.moon.distanceKm)} km` : moonUp ? `${fmtDeg(snap.moon.altitude)} up` : "below horizon")}</span>
      </div>
      <div ref={youLabel} className="sv-tag sv-tag-you" data-state="hidden" aria-hidden="true">
        <i className="sv-arrow" /><b>You are here</b><span>{location.name}</span>
      </div>

      {status !== "ready" && (
        <div className="sv-loading" role="status">
          {status === "failed" ? (
            <p>This device could not start the 3D view. The numbers below are still live and exact.</p>
          ) : (
            <>
              <span className="sv-spinner" aria-hidden />
              <p>Loading the Sun, the Moon and the Earth…</p>
            </>
          )}
        </div>
      )}

      <header className="sv-top">
        <Link href="/" className="sv-brand" aria-label="Back to Ayudhas"><Logo size={26} /><span>Ayudhas</span></Link>
        <h1 className="sv-title">Solar Vision</h1>
        <div className="sv-modes" role="tablist" aria-label="View">
          <button role="tab" aria-selected={mode === "sky"} onClick={() => setMode("sky")}>Rooftop sky</button>
          <button role="tab" aria-selected={mode === "space"} onClick={() => setMode("space")}>From space</button>
        </div>
        <button className="sv-place" onClick={() => setPlaceOpen((v) => !v)} aria-expanded={placeOpen} aria-controls="sv-place-panel">
          <span className="sv-dot" data-source={location.source} aria-hidden />
          <span className="sv-place-name">{location.name}</span>
          <small>{Math.abs(location.lat).toFixed(2)}°{location.lat >= 0 ? "N" : "S"} {Math.abs(location.lon).toFixed(2)}°{location.lon >= 0 ? "E" : "W"}</small>
        </button>
      </header>

      {placeOpen && (
        <div id="sv-place-panel" className="sv-sheet sv-place-panel" role="dialog" aria-label="Choose a place">
          <button className="sv-btn sv-btn-primary" onClick={() => void locateMe()} disabled={locating}>
            {locating ? "Finding you…" : "Use my location"}
          </button>
          <p className="sv-note">Your location stays in this browser. Only rounded coordinates are sent to the place-name service.</p>
          <form className="sv-search" onSubmit={(e) => { e.preventDefault(); void search(); }}>
            <label className="sv-field">
              <span>Or search a city</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Varanasi, London, Sydney" autoComplete="off" enterKeyHint="search" />
            </label>
            <button type="submit" className="sv-chip" disabled={searching || query.trim().length < 2}>{searching ? "Searching…" : "Search"}</button>
          </form>
          {results && (results.length > 0 ? (
            <ul className="sv-results">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button onClick={() => void choosePlace(r)}>
                    <b>{r.name}</b><small>{r.detail}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="sv-note">No places found. Try a city name.</p>)}
          <p className="sv-note">Search © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></p>
          {locError && <p className="sv-error" role="alert">{locError}</p>}
        </div>
      )}

      {mode === "sky" ? (
        <div className="sv-tools" aria-label="Sky controls">
          <button className="sv-chip" onClick={() => look("moon")}>Find the Moon</button>
          <button className="sv-chip" onClick={() => look("moon", true)}>Moon close-up</button>
          <button className="sv-chip" onClick={() => look("sun")}>Find the Sun</button>
          <button className="sv-chip" aria-pressed={constellations} onClick={() => setConstellations((v) => !v)}>Constellations</button>
          {canCompass && <button className="sv-chip" aria-pressed={compassOn} onClick={() => void toggleCompass()}>Point my phone</button>}
          <span className="sv-zoom">
            <button className="sv-chip" onClick={() => engineRef.current?.zoom(0.7)} aria-label="Zoom in">+</button>
            <button className="sv-chip" onClick={() => engineRef.current?.zoom(1.4)} aria-label="Zoom out">−</button>
          </span>
          <span ref={headingRef} className="sv-heading" aria-hidden />
        </div>
      ) : (
        <div className="sv-tools" aria-label="Space controls">
          <button className="sv-chip" onClick={() => look("earth")}>Earth</button>
          <button className="sv-chip" onClick={() => look("you")}>My place</button>
          <button className="sv-chip" onClick={() => look("moon")}>The Moon</button>
          <button className="sv-chip" onClick={() => look("sun")}>Sun side</button>
          <button className="sv-chip" aria-pressed={trueScale} onClick={() => setTrueScale((v) => !v)}>True Moon distance</button>
          <span className="sv-heading">
            {trueScale ? "Moon at its true distance" : "Moon distance shortened to fit; every direction is exact"}
            {satellite === "ok" ? " · clouds: NASA satellite, yesterday" : satellite === "off" ? " · clouds: stock map" : ""}
          </span>
        </div>
      )}

      {snap && events && now && (<>
      <aside className={`sv-panel ${panelOpen ? "open" : ""}`} aria-label="Live data">
        <button className="sv-panel-toggle" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
          <PhaseIcon phaseAngle={snap.moon.phaseAngle} illuminated={snap.moon.illuminated} southern={southern} size={26} />
          <span>{snap.moon.phaseName} · {Math.round(snap.moon.illuminated * 100)}% · Moon {moonUp ? `${compassPoint(snap.moon.azimuth)} ${fmtDeg(snap.moon.altitude)}` : "down"}</span>
        </button>

        <section className="sv-card">
          <div className="sv-card-head">
            <PhaseIcon phaseAngle={snap.moon.phaseAngle} illuminated={snap.moon.illuminated} southern={southern} size={54} />
            <div>
              <h2>{snap.moon.phaseName}</h2>
              <p>{fmtNumber(snap.moon.illuminated * 100, 1)}% lit · {fmtNumber(snap.moon.ageDays, 1)} days old</p>
            </div>
          </div>
          <dl className="sv-stats">
            <div><dt>Direction</dt><dd>{compassPoint(snap.moon.azimuth)} · {fmtDeg(snap.moon.azimuth)}</dd></div>
            <div><dt>Height</dt><dd>{moonUp ? `${fmtDeg(snap.moon.altitude)} above horizon` : `${fmtDeg(-snap.moon.altitude)} below horizon`}</dd></div>
            <div><dt>Brightness</dt><dd>mag {snap.moon.magnitude.toFixed(1)}</dd></div>
            <div><dt>Moonlight here</dt><dd>{moonUp ? `${snap.moon.lux.toFixed(3)} lux` : "none (Moon down)"}</dd></div>
            <div><dt>Distance</dt><dd>{fmtNumber(snap.moon.distanceKm)} km</dd></div>
            <div><dt>Apparent size</dt><dd>{(snap.moon.diameterDeg * 60).toFixed(1)}′</dd></div>
            <div><dt>Moonrise</dt><dd>{fmtTime(events.moonrise)}</dd></div>
            <div><dt>Moonset</dt><dd>{fmtTime(events.moonset)}</dd></div>
          </dl>
        </section>

        <section className="sv-card">
          <div className="sv-card-head">
            <span className="sv-sun-icon" aria-hidden />
            <div>
              <h2>The Sun</h2>
              <p>{sunUp ? `${compassPoint(snap.sun.azimuth)}, ${fmtDeg(snap.sun.altitude)} up` : `Set · ${fmtDeg(-snap.sun.altitude)} below horizon`}</p>
            </div>
          </div>
          <dl className="sv-stats">
            <div><dt>Direction</dt><dd>{compassPoint(snap.sun.azimuth)} · {fmtDeg(snap.sun.azimuth)}</dd></div>
            <div><dt>Height</dt><dd>{fmtDeg(snap.sun.altitude)}</dd></div>
            <div><dt>Sunlight (clear sky)</dt><dd>{sunNow > 0 ? `≈ ${fmtNumber(sunNow)} W/m²` : "none"}</dd></div>
            <div><dt>Daylight (clear sky)</dt><dd>{sunNow > 0 ? `≈ ${fmtNumber(sunNow * 110, 0)} lux` : "—"}</dd></div>
            <div><dt>Brightness</dt><dd>mag {snap.sun.magnitude.toFixed(2)}</dd></div>
            <div><dt>Distance</dt><dd>{fmtNumber(snap.sun.distanceKm / 1e6, 2)} million km</dd></div>
            <div><dt>Sunrise</dt><dd>{fmtTime(events.sunrise)}</dd></div>
            <div><dt>Sunset</dt><dd>{fmtTime(events.sunset)}</dd></div>
            <div><dt>Solar noon</dt><dd>{fmtTime(events.solarNoon)}</dd></div>
            <div><dt>Day length</dt><dd>{dayLength ? `${Math.floor(dayLength)} h ${Math.round((dayLength % 1) * 60)} min` : "—"}</dd></div>
          </dl>
        </section>

        <section className="sv-card">
          <h2 className="sv-small-head">Your place</h2>
          <dl className="sv-stats">
            <div><dt>Time zone</dt><dd>{timeZone ?? "this device's"}</dd></div>
            <div><dt>Latitude, longitude</dt><dd>{location.lat.toFixed(3)}, {location.lon.toFixed(3)}</dd></div>
          </dl>
          <p className="sv-note">The sky is shown clear; sunlight figures are clear-sky estimates.</p>
          <h2 className="sv-small-head">Next Moon phases</h2>
          <ul className="sv-phases">
            {events.nextPhases.map((p) => <li key={p.time.toISOString()}><span>{QUARTER_NAMES[p.kind]}</span><b>{fmtTime(p.time, true)}</b></li>)}
          </ul>
          <p className="sv-note">
            Positions: Astronomy Engine (agrees with NASA JPL to about an arcminute), computed live in your browser. Earth: NASA GIBS (VIIRS) and textures by Solar System Scope (CC BY 4.0). Moon: NASA LRO
            colour and elevation. Stars: d3-celestial (Hipparcos). Place names: BigDataCloud, OpenStreetMap.
          </p>
        </section>
      </aside>

      <footer ref={timeBarRef} className="sv-time" aria-label="Time">
        <div className="sv-clock">
          <span className={`sv-live ${live ? "on" : ""}`} aria-live="polite">
            {live ? "Live" : speed === 0 ? "Paused" : speed < 0 ? `Rewind · ${rateLabel}` : speed > 1 ? `Fast · ${rateLabel}` : "Running · shifted"}
          </span>
          <time dateTime={now.toISOString()}>{fmtDateTime.format(now)}</time>
          <label className="sv-pick">
            <span>Go to date &amp; time</span>
            <input
              type="datetime-local"
              step={60}
              min={PICK_MIN}
              max={PICK_MAX}
              value={pickDraft ?? toWallTime(now, timeZone)}
              onFocus={() => setPickDraft(toWallTime(now, timeZone))}
              onBlur={() => setPickDraft(null)}
              onChange={(e) => { setPickDraft(e.target.value); goTo(e.target.value); }}
            />
          </label>
        </div>
        <input
          className="sv-scrub"
          type="range"
          min={-SCRUB_HOURS * 60}
          max={SCRUB_HOURS * 60}
          step={5}
          value={sliderMinutes}
          onChange={(e) => scrubTo(Number(e.target.value))}
          aria-label="Move through time, up to a day either way"
        />
        <div className="sv-speeds" role="group" aria-label="Time controls">
          <button className="sv-chip sv-transport" aria-pressed={speed < 0} onClick={() => run(-rate)} aria-label={`Rewind at ${rateLabel}`} title={`Rewind at ${rateLabel}`}>◀◀</button>
          <button className="sv-chip sv-transport sv-play" onClick={togglePause} aria-label={speed === 0 ? "Play in real time" : "Pause"} title={speed === 0 ? "Play in real time" : "Pause"}>
            {speed === 0 ? "▶" : "❚❚"}
          </button>
          <button className="sv-chip sv-transport" aria-pressed={speed > 1} onClick={() => run(rate)} aria-label={`Fast forward at ${rateLabel}`} title={`Fast forward at ${rateLabel}`}>▶▶</button>
          <span className="sv-rates" role="group" aria-label="Rewind and fast-forward speed">
            {RATES.map((r) => (
              <button key={r.value} className="sv-chip" aria-pressed={rate === r.value} title={r.title} onClick={() => chooseRate(r.value)}>{r.label}</button>
            ))}
          </span>
          <button className={`sv-chip ${live ? "" : "sv-now"}`} aria-pressed={live} onClick={backToNow}>{live ? "Live" : "Back to now"}</button>
        </div>
      </footer>
      </>)}
    </div>
  );
}
