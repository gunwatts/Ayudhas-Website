import {
  AstroTime, Body, Equator, Horizon, Illumination, Libration, MakeTime, MoonPhase, Observer, ObserverVector,
  RotateVector, Rotation_EQJ_HOR, RotationAxis, SearchHourAngle, SearchMoonQuarter, NextMoonQuarter, SearchRiseSet,
  GeoVector, Vector, type RotationMatrix,
} from "astronomy-engine";

/**
 * Where the Sun and the Moon really are, for one place and one moment, from Astronomy Engine (VSOP87 and the
 * ELP/MPP02-derived lunar theory it ships; positions agree with NASA JPL Horizons to about an arcminute). Everything
 * is computed in the browser, so the view stays live without a server or an API key.
 *
 * Two 3D frames are handed to the renderer, both right-handed with three.js conventions:
 * - SKY, around the observer: x = east, y = up (zenith), z = south (so north is -z).
 * - SPACE, around the Earth: J2000 equatorial axes (EQJ) turned so y is the celestial north pole: (x, z, -y).
 */

export type Vec3 = [number, number, number];
/** An orthonormal basis for a sphere mesh: its local x (longitude 0 on the equator), y (north pole) and z axes. */
export type Basis = { x: Vec3; y: Vec3; z: Vec3 };

export type Place = { lat: number; lon: number; height: number };

export type BodyInSky = {
  /** Degrees clockwise from true north. */
  azimuth: number;
  /** Degrees above the horizon, with standard atmospheric refraction. */
  altitude: number;
  /** Unit vector in the SKY frame. */
  dir: Vec3;
  /** Apparent visual magnitude. */
  magnitude: number;
  distanceKm: number;
};

export type PlanetInSky = { id: string; name: string; azimuth: number; altitude: number; dir: Vec3; magnitude: number };

/** The five planets the eye can see, with the colour each shows in a dark sky. */
export const PLANETS: { body: Body; id: string; name: string; hindi: string; color: string }[] = [
  { body: Body.Mercury, id: "mercury", name: "Mercury", hindi: "बुध", color: "#d9cbb5" },
  { body: Body.Venus, id: "venus", name: "Venus", hindi: "शुक्र", color: "#fff6dc" },
  { body: Body.Mars, id: "mars", name: "Mars", hindi: "मंगल", color: "#ffb08a" },
  { body: Body.Jupiter, id: "jupiter", name: "Jupiter", hindi: "बृहस्पति", color: "#ffe9c7" },
  { body: Body.Saturn, id: "saturn", name: "Saturn", hindi: "शनि", color: "#f2ddb0" },
];

export type MoonEvent = { kind: "new" | "first" | "full" | "last"; time: Date };

export type Snapshot = {
  time: Date;
  sun: BodyInSky & {
    /** Clear-sky global horizontal irradiance at the observer, W/m² (an estimate from the Sun's altitude). */
    clearSkyIrradiance: number;
  };
  moon: BodyInSky & {
    /** Ecliptic longitude difference Moon − Sun: 0 new, 90 first quarter, 180 full, 270 last quarter. */
    phaseAngle: number;
    /** Fraction of the disc lit, 0..1. */
    illuminated: number;
    phaseName: string;
    /** Days since the last new moon. */
    ageDays: number;
    /** Apparent diameter, degrees. */
    diameterDeg: number;
    /** Illuminance at the observer from the Moon, lux (before clouds). */
    lux: number;
    /** The Moon's body axes in the SKY frame (which face, and how it is tilted, as seen from this place). */
    basisSky: Basis;
    /** Geocentric position in the SPACE frame, Earth radii. */
    geoEarthRadii: Vec3;
    basisSpace: Basis;
  };
  /** The Sun's direction from the Earth in the SPACE frame (unit). */
  sunDirSpace: Vec3;
  /** The Earth's body axes in the SPACE frame (its daily turn and the tilt of its axis). */
  earthBasisSpace: Basis;
  /** The observer's position in the SPACE frame, unit length (on the Earth's surface). */
  observerSpace: Vec3;
  /** Column-major 3x3 rotation taking J2000 equatorial unit vectors into the SKY frame (for the star field). */
  eqjToSky: number[];
  /** The naked-eye planets, where they are in this sky and how bright. */
  planets: PlanetInSky[];
};

export type DayEvents = {
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date | null;
  moonrise: Date | null;
  moonset: Date | null;
  nextPhases: MoonEvent[];
};

const EARTH_RADIUS_KM = 6378.137;
const AU_KM = 149_597_870.7;
const SYNODIC_MONTH = 29.530588853;
const DEG = Math.PI / 180;

const observerOf = (p: Place) => new Observer(p.lat, p.lon, p.height);

/** HOR (x north, y west, z zenith) to SKY (x east, y up, z south). */
const horToSky = (v: { x: number; y: number; z: number }): Vec3 => [-v.y, v.z, -v.x];
/** EQJ to SPACE. */
const eqjToSpace = (v: { x: number; y: number; z: number }): Vec3 => [v.x, v.z, -v.y];

export function skyDirection(azimuth: number, altitude: number): Vec3 {
  const a = azimuth * DEG;
  const h = altitude * DEG;
  return [Math.cos(h) * Math.sin(a), Math.sin(h), -Math.cos(h) * Math.cos(a)];
}

const unit = (v: Vector) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return new Vector(v.x / l, v.y / l, v.z / l, v.t);
};
const cross = (a: Vector, b: Vector) => new Vector(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x, a.t);

/**
 * A body's axes in EQJ from its IAU rotation elements: the north pole, and the prime meridian turned `spin` degrees
 * from the node where the body's equator crosses the J2000 equator.
 */
function bodyAxesEqj(body: Body, time: AstroTime) {
  const axis = RotationAxis(body, time);
  const pole = unit(axis.north);
  const node = unit(cross(new Vector(0, 0, 1, time), pole));
  const q = cross(pole, node);
  const w = axis.spin * DEG;
  const lon0 = new Vector(node.x * Math.cos(w) + q.x * Math.sin(w), node.y * Math.cos(w) + q.y * Math.sin(w), node.z * Math.cos(w) + q.z * Math.sin(w), time);
  const east = cross(pole, lon0);
  return { lon0, pole, east };
}

function toBasis(axes: { lon0: Vector; pole: Vector; east: Vector }, map: (v: Vector) => Vec3): Basis {
  const z = map(axes.east);
  // A sphere mesh in three.js puts longitude 90° east on its local -z axis.
  return { x: map(axes.lon0), y: map(axes.pole), z: [-z[0], -z[1], -z[2]] };
}

export function phaseName(angle: number): string {
  const a = ((angle % 360) + 360) % 360;
  if (a < 6 || a >= 354) return "New Moon";
  if (a < 84) return "Waxing Crescent";
  if (a < 96) return "First Quarter";
  if (a < 174) return "Waxing Gibbous";
  if (a < 186) return "Full Moon";
  if (a < 264) return "Waning Gibbous";
  if (a < 276) return "Last Quarter";
  return "Waning Crescent";
}

/**
 * Clear-sky global horizontal irradiance from the Sun's altitude: Kasten–Young air mass and Meinel's direct-beam
 * attenuation, plus a tenth for diffuse light. Good to roughly ±15% for a clear, dry sky.
 */
export function clearSkyIrradiance(altitude: number): number {
  if (altitude <= -0.83) return 0;
  const zenith = 90 - Math.max(altitude, 0);
  const airMass = 1 / (Math.cos(zenith * DEG) + 0.50572 * Math.pow(96.07995 - zenith, -1.6364));
  const direct = 1361 * Math.pow(0.7, Math.pow(airMass, 0.678));
  return Math.max(0, 1.1 * direct * Math.cos(zenith * DEG));
}

/** Kasten–Czeplak cloud factor: how much of the clear-sky light gets through a given cloud cover (0..1). */
export const cloudTransmission = (cover: number) => 1 - 0.75 * Math.pow(Math.min(1, Math.max(0, cover)), 3.4);

/** Illuminance (lux) from an apparent magnitude, then dimmed by the air mass along the line of sight. */
function moonLux(magnitude: number, altitude: number) {
  if (altitude <= 0) return 0;
  const zenith = 90 - altitude;
  const airMass = 1 / (Math.cos(zenith * DEG) + 0.50572 * Math.pow(96.07995 - zenith, -1.6364));
  const extinction = Math.pow(10, (-0.4 * 0.25 * airMass)); // 0.25 mag per air mass, a typical clear night
  return Math.pow(10, (-14.18 - magnitude) / 2.5) * extinction * Math.sin(altitude * DEG);
}

function matrixColumns(rot: RotationMatrix): number[] {
  const col = (v: Vector) => horToSky(RotateVector(rot, v));
  return [...col(new Vector(1, 0, 0, new AstroTime(0))), ...col(new Vector(0, 1, 0, new AstroTime(0))), ...col(new Vector(0, 0, 1, new AstroTime(0)))];
}

export function snapshot(date: Date, place: Place): Snapshot {
  const time = MakeTime(date);
  const observer = observerOf(place);
  const toHor = Rotation_EQJ_HOR(time, observer);

  const sunEq = Equator(Body.Sun, time, observer, true, true);
  const sunHor = Horizon(time, observer, sunEq.ra, sunEq.dec, "normal");
  const sunIllum = Illumination(Body.Sun, time);

  const moonEq = Equator(Body.Moon, time, observer, true, true);
  const moonHor = Horizon(time, observer, moonEq.ra, moonEq.dec, "normal");
  const moonIllum = Illumination(Body.Moon, time);
  const lib = Libration(time);
  const phaseAngle = MoonPhase(time);

  const moonAxes = bodyAxesEqj(Body.Moon, time);
  // The Earth's axes straight from Astronomy Engine's own Earth model (precession, nutation, sidereal time): the
  // surface points at 0°N 0°E and at the North Pole, so the observer lands exactly where ObserverVector puts them.
  const lon0 = unit(ObserverVector(time, new Observer(0, 0, 0), false));
  const pole = unit(ObserverVector(time, new Observer(90, 0, 0), false));
  const earthAxes = { lon0, pole, east: cross(pole, lon0) };
  const moonGeo = GeoVector(Body.Moon, time, true);
  const sunGeo = unit(GeoVector(Body.Sun, time, true));
  const obs = unit(ObserverVector(time, observer, false));
  const kmPerAu = AU_KM / EARTH_RADIUS_KM;

  return {
    time: date,
    sun: {
      azimuth: sunHor.azimuth,
      altitude: sunHor.altitude,
      dir: skyDirection(sunHor.azimuth, sunHor.altitude),
      magnitude: sunIllum.mag,
      distanceKm: sunEq.dist * AU_KM,
      clearSkyIrradiance: clearSkyIrradiance(sunHor.altitude),
    },
    moon: {
      azimuth: moonHor.azimuth,
      altitude: moonHor.altitude,
      dir: skyDirection(moonHor.azimuth, moonHor.altitude),
      magnitude: moonIllum.mag,
      distanceKm: moonEq.dist * AU_KM,
      phaseAngle,
      illuminated: moonIllum.phase_fraction,
      phaseName: phaseName(phaseAngle),
      ageDays: (phaseAngle / 360) * SYNODIC_MONTH,
      diameterDeg: lib.diam_deg,
      lux: moonLux(moonIllum.mag, moonHor.altitude),
      basisSky: toBasis(moonAxes, (v) => horToSky(RotateVector(toHor, v))),
      geoEarthRadii: eqjToSpace(new Vector(moonGeo.x * kmPerAu, moonGeo.y * kmPerAu, moonGeo.z * kmPerAu, time)),
      basisSpace: toBasis(moonAxes, eqjToSpace),
    },
    sunDirSpace: eqjToSpace(sunGeo),
    earthBasisSpace: toBasis(earthAxes, eqjToSpace),
    observerSpace: eqjToSpace(obs),
    eqjToSky: matrixColumns(toHor),
    planets: PLANETS.map((p) => {
      const eq = Equator(p.body, time, observer, true, true);
      const hor = Horizon(time, observer, eq.ra, eq.dec, "normal");
      return {
        id: p.id, name: p.name, azimuth: hor.azimuth, altitude: hor.altitude,
        dir: skyDirection(hor.azimuth, hor.altitude), magnitude: Illumination(p.body, time).mag,
      };
    }),
  };
}

/** Midnight at the start of the observer's local day, given the place's UTC offset in seconds. */
export function startOfLocalDay(date: Date, utcOffsetSeconds: number) {
  const local = date.getTime() + utcOffsetSeconds * 1000;
  const midnight = Math.floor(local / 86_400_000) * 86_400_000;
  return new Date(midnight - utcOffsetSeconds * 1000);
}

const QUARTERS: MoonEvent["kind"][] = ["new", "first", "full", "last"];

export function dayEvents(date: Date, place: Place, utcOffsetSeconds: number): DayEvents {
  const observer = observerOf(place);
  const start = MakeTime(startOfLocalDay(date, utcOffsetSeconds));
  const within = (t: AstroTime | null) => (t && t.ut - start.ut < 1 ? t.date : null);
  let noon: Date | null = null;
  try { noon = within(SearchHourAngle(Body.Sun, observer, 0, start, +1).time); } catch { noon = null; }

  const nextPhases: MoonEvent[] = [];
  let q = SearchMoonQuarter(MakeTime(date));
  for (let i = 0; i < 4; i++) {
    nextPhases.push({ kind: QUARTERS[q.quarter], time: q.time.date });
    q = NextMoonQuarter(q);
  }
  return {
    sunrise: within(SearchRiseSet(Body.Sun, observer, +1, start, 1)),
    sunset: within(SearchRiseSet(Body.Sun, observer, -1, start, 1)),
    solarNoon: noon,
    moonrise: within(SearchRiseSet(Body.Moon, observer, +1, start, 1)),
    moonset: within(SearchRiseSet(Body.Moon, observer, -1, start, 1)),
    nextPhases,
  };
}

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compassPoint = (azimuth: number) => POINTS[Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16];
