/**
 * Ceiling mode: Solar Vision as a live sky projected onto a bedroom ceiling. Everything is set in the link, so a
 * Raspberry Pi (or any computer) can open it at boot with no clicks:
 *
 *   /solar-vision/?ceiling&lat=17.385&lon=78.487&name=Hyderabad&rotate=90&names=hi&red&bright=0.8
 *
 * - `ceiling`            turn ceiling mode on
 * - `lat`, `lon`         the place (decimal degrees); without them the browser's location, then Hyderabad
 * - `name`, `tz`         optional label and IANA time zone (the time zone is otherwise looked up offline)
 * - `rotate=0..359`      turn the picture so north points the right way in the room (degrees, clockwise)
 * - `flip`               mirror the picture, for projectors set to rear projection
 * - `fov=60..140`        how much sky the picture spans, top to bottom (default 100)
 * - `names=en|hi|off`    constellation and planet names in English (default) or Hindi, or no names
 * - `lines=off`          hide the constellation figures
 * - `bright=0.1..1`      overall brightness (default 1)
 * - `red`                deep-red night light, easy on sleepy eyes
 * - `day=dark|sky`       by day, show black (default; the projector shows nothing) or the daytime sky
 * - `info`               a small clock and Moon phase in a corner
 * - `lite`               lighter rendering for small computers
 */

export type CeilingConfig = {
  rotation: number;
  fov: number;
  flip: boolean;
  names: "en" | "hi" | "off";
  lines: boolean;
  bright: number;
  red: boolean;
  day: "dark" | "sky";
  info: boolean;
  lite: boolean;
  place: { lat: number; lon: number; name: string; tz?: string } | null;
};

const num = (v: string | null, lo: number, hi: number, fallback: number) => {
  const n = v === null || v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** Reads ceiling mode from a query string; null when it is not asked for. Bad values fall back to defaults. */
export function parseCeiling(search: string): CeilingConfig | null {
  const q = new URLSearchParams(search);
  if (!q.has("ceiling")) return null;
  const lat = num(q.get("lat"), -90, 90, NaN);
  const lon = num(q.get("lon"), -180, 180, NaN);
  const names = q.get("names");
  return {
    rotation: ((num(q.get("rotate"), -360, 360, 0) % 360) + 360) % 360,
    fov: num(q.get("fov"), 60, 140, 100),
    flip: q.has("flip") && q.get("flip") !== "0",
    names: names === "hi" || names === "off" ? names : "en",
    lines: q.get("lines") !== "off",
    bright: num(q.get("bright"), 0.1, 1, 1),
    red: q.has("red") && q.get("red") !== "0",
    day: q.get("day") === "sky" ? "sky" : "dark",
    info: q.has("info") && q.get("info") !== "0",
    lite: q.has("lite") && q.get("lite") !== "0",
    place: Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon, name: q.get("name")?.slice(0, 60) || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, tz: q.get("tz") || undefined }
      : null,
  };
}

/** Builds the ceiling link for a configuration (the inverse of parseCeiling, defaults left out). */
export function ceilingLink(base: string, c: Omit<CeilingConfig, "place"> & { place?: CeilingConfig["place"] }): string {
  const q = new URLSearchParams();
  q.set("ceiling", "");
  if (c.place) {
    q.set("lat", c.place.lat.toFixed(4));
    q.set("lon", c.place.lon.toFixed(4));
    q.set("name", c.place.name);
    if (c.place.tz) q.set("tz", c.place.tz);
  }
  if (c.rotation) q.set("rotate", String(Math.round(c.rotation)));
  if (c.fov !== 100) q.set("fov", String(Math.round(c.fov)));
  if (c.flip) q.set("flip", "");
  if (c.names !== "en") q.set("names", c.names);
  if (!c.lines) q.set("lines", "off");
  if (c.bright < 1) q.set("bright", c.bright.toFixed(2));
  if (c.red) q.set("red", "");
  if (c.day === "sky") q.set("day", "sky");
  if (c.info) q.set("info", "");
  if (c.lite) q.set("lite", "");
  return `${base}?${q.toString().replace(/=(&|$)/g, "$1")}`;
}

/** How much of the picture to black out by day (0 night, 1 full black), from the Sun's altitude. */
export function dayCover(sunAltitude: number, day: CeilingConfig["day"]) {
  if (day === "sky") return 0;
  // Fully dark once the Sun is up; the sky fades in through twilight.
  const t = Math.min(1, Math.max(0, (sunAltitude + 2) / 4));
  return t * t * (3 - 2 * t);
}
