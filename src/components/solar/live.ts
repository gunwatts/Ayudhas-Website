/**
 * Live data from free, keyless services, all fetched from the visitor's browser:
 * - the browser's Geolocation API (asks the visitor's permission), for where they are;
 * - BigDataCloud's client-side reverse geocoding, for the place's name;
 * - Open-Meteo, for the time zone, current cloud cover and visibility, and for searching a place by name;
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

export type Weather = {
  cloudCover: number; // 0..1
  visibilityKm: number | null;
  temperatureC: number | null;
  utcOffsetSeconds: number;
  timeZone: string;
};

export type PlaceResult = { name: string; detail: string; lat: number; lon: number; height: number; timeZone?: string };

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

type OpenMeteo = {
  utc_offset_seconds: number;
  timezone: string;
  elevation?: number;
  current?: { cloud_cover?: number; visibility?: number; temperature_2m?: number };
};

export async function weather(lat: number, lon: number): Promise<Weather | null> {
  try {
    const r = await getJson<OpenMeteo>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=cloud_cover,visibility,temperature_2m&timezone=auto`,
    );
    return {
      cloudCover: (r.current?.cloud_cover ?? 0) / 100,
      visibilityKm: r.current?.visibility != null ? r.current.visibility / 1000 : null,
      temperatureC: r.current?.temperature_2m ?? null,
      utcOffsetSeconds: r.utc_offset_seconds,
      timeZone: r.timezone,
    };
  } catch {
    return null;
  }
}

type GeoSearch = { results?: { name: string; latitude: number; longitude: number; elevation?: number; admin1?: string; country?: string; timezone?: string }[] };

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return [];
  const r = await getJson<GeoSearch>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=en&format=json`,
  );
  return (r.results ?? []).map((p) => ({
    name: p.name,
    detail: [p.admin1, p.country].filter(Boolean).join(", "),
    lat: p.latitude,
    lon: p.longitude,
    height: p.elevation ?? 0,
    timeZone: p.timezone,
  }));
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
