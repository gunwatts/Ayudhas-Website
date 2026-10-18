import { describe, expect, it } from "vitest";

import { clearSkyIrradiance, compassPoint, dayEvents, phaseName, snapshot, type Vec3 } from "@/components/solar/astro";

const HYDERABAD = { lat: 17.385, lon: 78.4867, height: 500 };
const IST = 19_800;
const minutesApart = (a: Date | null, iso: string) => Math.abs((a?.getTime() ?? NaN) - Date.parse(iso)) / 60_000;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const along = (b: { x: Vec3; y: Vec3; z: Vec3 }, v: Vec3): Vec3 => [
  b.x[0] * v[0] + b.y[0] * v[1] + b.z[0] * v[2],
  b.x[1] * v[0] + b.y[1] * v[1] + b.z[1] * v[2],
  b.x[2] * v[0] + b.y[2] * v[1] + b.z[2] * v[2],
];

describe("astronomy", () => {
  it("finds the April 2024 full moon at the USNO time (23 Apr 23:49 UTC)", () => {
    const { nextPhases } = dayEvents(new Date("2024-04-20T00:00:00Z"), HYDERABAD, IST);
    const full = nextPhases.find((p) => p.kind === "full");
    expect(minutesApart(full?.time ?? null, "2024-04-23T23:49:00Z")).toBeLessThan(3);
  });

  it("gives Hyderabad's June solstice sunrise and sunset to within a few minutes of almanac times", () => {
    const e = dayEvents(new Date("2024-06-21T06:00:00Z"), HYDERABAD, IST);
    expect(minutesApart(e.sunrise, "2024-06-21T00:13:00Z")).toBeLessThan(4); // 05:43 IST
    expect(minutesApart(e.sunset, "2024-06-21T13:22:00Z")).toBeLessThan(4); // 18:52 IST
  });

  it("orients the Earth so the observer's longitude and latitude land where Astronomy Engine puts them", () => {
    const s = snapshot(new Date("2025-03-01T10:00:00Z"), HYDERABAD);
    const lat = (HYDERABAD.lat * Math.PI) / 180;
    const lon = (HYDERABAD.lon * Math.PI) / 180;
    const local: Vec3 = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
    expect(dot(along(s.earthBasisSpace, local), s.observerSpace)).toBeGreaterThan(Math.cos((0.5 * Math.PI) / 180));
  });

  it("turns the Moon's near side towards the observer (within libration)", () => {
    const s = snapshot(new Date("2025-03-10T18:00:00Z"), HYDERABAD);
    expect(dot(s.moon.basisSky.x, s.moon.dir)).toBeLessThan(-Math.cos((10 * Math.PI) / 180));
  });

  it("reports a full moon as nearly fully lit and the Sun high at an equator equinox noon", () => {
    const s = snapshot(new Date("2024-04-23T23:49:00Z"), HYDERABAD);
    expect(s.moon.illuminated).toBeGreaterThan(0.99);
    expect(s.moon.phaseName).toBe("Full Moon");
    const noon = snapshot(new Date("2024-03-20T12:00:00Z"), { lat: 0, lon: 0, height: 0 });
    expect(noon.sun.altitude).toBeGreaterThan(85);
    expect(clearSkyIrradiance(noon.sun.altitude)).toBeGreaterThan(900);
  });

  it("names phases and compass points", () => {
    expect(phaseName(45)).toBe("Waxing Crescent");
    expect(phaseName(270)).toBe("Last Quarter");
    expect(compassPoint(112)).toBe("ESE");
    expect(compassPoint(359)).toBe("N");
  });
});

describe("wall time in a place's time zone", () => {
  it("round-trips a moment through the date-time picker value, across daylight saving", async () => {
    const { fromWallTime, toWallTime } = await import("@/components/solar/live");
    expect(toWallTime(new Date("2026-10-18T12:45:00Z"), "Asia/Kolkata")).toBe("2026-10-18T18:15");
    expect(fromWallTime("2026-10-18T18:15", "Asia/Kolkata")?.toISOString()).toBe("2026-10-18T12:45:00.000Z");
    // London: BST in July, GMT in December.
    expect(fromWallTime("2026-07-01T21:00", "Europe/London")?.toISOString()).toBe("2026-07-01T20:00:00.000Z");
    expect(fromWallTime("2026-12-01T21:00", "Europe/London")?.toISOString()).toBe("2026-12-01T21:00:00.000Z");
    expect(fromWallTime("not a date", "Europe/London")).toBeNull();
  });
});
