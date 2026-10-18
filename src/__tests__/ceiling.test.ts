import { describe, expect, it } from "vitest";

import { ceilingLink, dayCover, parseCeiling } from "@/components/solar/ceiling";

describe("ceiling mode link", () => {
  it("is off without ?ceiling", () => {
    expect(parseCeiling("")).toBeNull();
    expect(parseCeiling("?lat=1&lon=2")).toBeNull();
  });

  it("reads every setting, clamping bad values to safe ones", () => {
    const c = parseCeiling("?ceiling&lat=17.385&lon=78.487&name=Home&rotate=-90&fov=500&flip&names=hi&lines=off&bright=0&red&day=sky&info&lite")!;
    expect(c.place).toEqual({ lat: 17.385, lon: 78.487, name: "Home", tz: undefined });
    expect(c.rotation).toBe(270);
    expect(c.fov).toBe(140);
    expect(c).toMatchObject({ flip: true, names: "hi", lines: false, bright: 0.1, red: true, day: "sky", info: true, lite: true });
  });

  it("has sensible defaults and ignores a half-given place", () => {
    const c = parseCeiling("?ceiling&lat=abc&lon=78")!;
    expect(c).toMatchObject({ rotation: 0, fov: 100, flip: false, names: "en", lines: true, bright: 1, red: false, day: "dark", place: null });
  });

  it("builds a link that reads back the same", () => {
    const cfg = { rotation: 90, fov: 110, flip: true, names: "hi" as const, lines: true, bright: 0.7, red: true, day: "dark" as const, info: false, lite: true,
      place: { lat: 28.6139, lon: 77.209, name: "New Delhi", tz: "Asia/Kolkata" } };
    const link = ceilingLink("https://ayudhas.com/solar-vision/", cfg);
    expect(link.startsWith("https://ayudhas.com/solar-vision/?ceiling&lat=28.6139")).toBe(true);
    expect(parseCeiling(link.slice(link.indexOf("?")))).toEqual(cfg);
  });

  it("goes dark by day, through twilight", () => {
    expect(dayCover(-10, "dark")).toBe(0);
    expect(dayCover(5, "dark")).toBe(1);
    expect(dayCover(0, "dark")).toBeCloseTo(0.5, 5);
    expect(dayCover(30, "sky")).toBe(0);
  });
});
