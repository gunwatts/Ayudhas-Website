/**
 * Live data from free, keyless services, all fetched from the visitor's browser:
 * - the browser's Geolocation API (asks the visitor's permission), for where they are;
 * - BigDataCloud's client-side reverse geocoding, for the place's name;
 * - OpenStreetMap's Nominatim, for searching a place by name (on submit only, as its usage policy asks; results
 *   credit OpenStreetMap contributors);
 * - an offline time-zone map (@photostructure/tz-lookup, CC0), loaded only when a searched place needs it;
 * - NASA GIBS, for yesterday's full-Earth satellite image (VIIRS true colour), so the globe shows real clouds.
 * Each call fails soft: the view keeps working from the astronomy alone.
 */

export type Location = {
  lat: number;
  lon: number;
  height: number;
  name: string;
  /** How the location was found, shown to the visitor. */
  source: "device" | "search" | "default";
  accuracyM?: number;
  /** IANA time zone, when known before the weather arrives. */
  timeZone?: string;
};

export type PlaceResult = { name: string; detail: string; lat: number; lon: number; height: number };

/** Used until the visitor shares a location or picks one: Hyderabad, India. */
export const DEFAULT_LOCATION: Location = {
  lat: 17.385, lon: 78.4867, height: 505, name: "Hyderabad, India", source: "default", timeZone: "Asia/Kolkata",
};

const TIMEOUT = 20_000;

async function getJson<T>(url: string, retries = 1): Promise<T> {
  try {
    return await getJsonOnce<T>(url);
  } catch (e) {
    if (retries <= 0) throw e;
    return getJsonOnce<T>(url);
  }
}

async function getJsonOnce<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export function locateDevice(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject(new Error("This browser cannot share a location.")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        height: pos.coords.altitude ?? 0,
        name: "Your location",
        source: "device",
        accuracyM: pos.coords.accuracy,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? "Location permission was declined." : "Your location could not be found.")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60_000 },
    );
  });
}

type ReverseGeocode = { city?: string; locality?: string; principalSubdivision?: string; countryName?: string };

export async function placeName(lat: number, lon: number): Promise<string | null> {
  try {
    const r = await getJson<ReverseGeocode>(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=en`,
    );
    const parts = [r.city || r.locality, r.principalSubdivision, r.countryName].filter(Boolean);
    return parts.length ? Array.from(new Set(parts)).slice(0, 2).join(", ") : null;
  } catch {
    return null;
  }
}

type Nominatim = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
}[];

/** Search places by name with OpenStreetMap's Nominatim. Call it when the visitor submits, never per keystroke. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const r = await getJson<Nominatim>(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=6&addressdetails=1&accept-language=en`,
    0,
  );
  const seen = new Set<string>();
  return r.map((p) => {
    const a = p.address ?? {};
    const name = p.name || a.city || a.town || a.village || p.display_name.split(",")[0];
    return {
      name,
      detail: [a.state, a.country].filter((part) => part && part !== name).join(", ") || p.display_name,
      lat: Number(p.lat),
      lon: Number(p.lon),
      height: 0,
    };
  }).filter((p) => {
    // A city and its district often share a name and sit a few kilometres apart: keep the first.
    const key = `${p.name}|${p.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The IANA time zone at a point, from an offline boundary map bundled with the site (no network call). */
export async function timeZoneAt(lat: number, lon: number): Promise<string | undefined> {
  try {
    const { default: tzlookup } = await import("@photostructure/tz-lookup");
    return tzlookup(lat, lon);
  } catch {
    return undefined;
  }
}

/** NASA GIBS: the whole Earth in true colour from the NOAA-20 VIIRS passes of the previous UTC day. */
export function satelliteImageUrl(now = new Date()) {
  const day = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  return "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0"
    + "&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024"
    + `&FORMAT=image/jpeg&TIME=${day}`;
}

/** A time zone's UTC offset (seconds) at a moment, from the browser's own time-zone database. */
export function zoneOffsetSeconds(timeZone: string | undefined, at: Date): number {
  if (!timeZone) return -at.getTimezoneOffset() * 60;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000) * 60;
  } catch {
    return -at.getTimezoneOffset() * 60;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A moment as the value of a `datetime-local` input, in the given time zone's wall time ("YYYY-MM-DDTHH:mm"). */
export function toWallTime(at: Date, timeZone: string | undefined): string {
  const local = new Date(at.getTime() + zoneOffsetSeconds(timeZone, at) * 1000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** The moment a `datetime-local` value names in the given time zone, or null if it is not a valid date and time. */
export function fromWallTime(value: string, timeZone: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  if (!Number.isFinite(asUtc)) return null;
  // The offset depends on the moment itself (daylight saving), so settle it in two steps.
  const first = asUtc - zoneOffsetSeconds(timeZone, new Date(asUtc)) * 1000;
  return new Date(asUtc - zoneOffsetSeconds(timeZone, new Date(first)) * 1000);
}
