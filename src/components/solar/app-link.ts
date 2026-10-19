/**
 * App mode: Solar Vision opened full screen inside the Ayudhas Pro app. The app never asks for the phone's location;
 * the person picks a city in the app, and the app opens this page with that city in the link's fragment:
 *
 *   /solar-vision/#app&lat=17.3850&lon=78.4867&name=Hyderabad&tz=Asia%2FKolkata
 *
 * The fragment (everything after #) stays in the browser: it is never sent to the web server. In app mode the page
 * also never asks for the device's location, never looks up a place name and never runs a place search, so the
 * chosen city does not leave the phone.
 *
 * The page talks back to the app with small messages (see `postToApp`): `hello` once it runs in app mode (the app
 * then hides its own fallback close button), `close` from the back button and `place` from the place button (the
 * app shows its own city list).
 */

export type AppPlace = { lat: number; lon: number; name: string; tz?: string };

export type AppMessage = "hello" | "close" | "place";

const coord = (v: string | null, limit: number) => {
  const n = v === null || v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : NaN;
};

/** Reads app mode from a location hash ("#app&lat=..."); null when it is not app mode or the place is missing. */
export function parseAppLink(hash: string): AppPlace | null {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  if (!q.has("app")) return null;
  const lat = coord(q.get("lat"), 90);
  const lon = coord(q.get("lon"), 180);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const tz = q.get("tz");
  return {
    lat,
    lon,
    name: q.get("name")?.trim().slice(0, 60) || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    tz: tz && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz) ? tz : undefined,
  };
}

/** Builds the app-mode link for a place (the inverse of parseAppLink). */
export function appLink(base: string, p: AppPlace): string {
  const q = new URLSearchParams();
  q.set("app", "");
  q.set("lat", p.lat.toFixed(4));
  q.set("lon", p.lon.toFixed(4));
  q.set("name", p.name);
  if (p.tz) q.set("tz", p.tz);
  return `${base}#${q.toString().replace(/^app=/, "app")}`;
}

type AppBridge = { postMessage: (message: string) => void };

/** Sends a message to the Ayudhas Pro app; does nothing in an ordinary browser. */
export function postToApp(type: AppMessage) {
  const bridge = (window as Window & { ReactNativeWebView?: AppBridge }).ReactNativeWebView;
  try { bridge?.postMessage(JSON.stringify({ source: "solar-vision", type })); } catch { /* not in the app */ }
}
