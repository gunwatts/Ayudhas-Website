import { describe, expect, it } from "vitest";

import { blendWorld, CHAPTERS, easeInOut, isTall } from "@/components/world/chapters";
import { DESTINATIONS } from "@/content/site";
import { damp, measureAnchors, progressAt, segment } from "@/lib/scroll-conductor";

describe("measureAnchors", () => {
  const sections = [
    { top: 0, height: 900 },
    { top: 900, height: 1200 },
    { top: 2100, height: 800 },
    { top: 2900, height: 1000 },
  ];

  it("composes the first chapter at the top and each later one at its section's centre", () => {
    expect(measureAnchors(sections, 900, 3000)).toEqual([0, 1050, 2050, 2950]);
  });

  it("stays inside the scroll range and strictly increasing", () => {
    const a = measureAnchors([{ top: 0, height: 100 }, { top: 100, height: 50 }, { top: 150, height: 40 }], 900, 0);
    expect(a[0]).toBe(0);
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
  });
});

describe("progressAt", () => {
  const anchors = [0, 1000, 2000, 2600];

  it("maps scroll to a fractional chapter", () => {
    expect(progressAt(0, anchors)).toBe(0);
    expect(progressAt(500, anchors)).toBeCloseTo(0.5);
    expect(progressAt(2300, anchors)).toBeCloseTo(2.5);
  });

  it("clamps before the first and after the last chapter", () => {
    expect(progressAt(-50, anchors)).toBe(0);
    expect(progressAt(9000, anchors)).toBe(3);
  });

  it("gives the same answer every time for the same scroll position", () => {
    expect(progressAt(1234, anchors)).toBe(progressAt(1234, anchors));
  });
});

describe("segment", () => {
  it("finds the two chapters either side and the distance between them", () => {
    expect(segment(2.35, 7)).toEqual({ index: 2, next: 3, t: expect.closeTo(0.35) });
    expect(segment(6, 7)).toEqual({ index: 5, next: 6, t: 1 });
    expect(segment(0, 1)).toEqual({ index: 0, next: 0, t: 0 });
  });
});

describe("damp", () => {
  it("approaches the target independently of frame rate", () => {
    let at60 = 0;
    for (let i = 0; i < 60; i++) at60 = damp(at60, 1, 5.2, 1 / 60);
    let at30 = 0;
    for (let i = 0; i < 30; i++) at30 = damp(at30, 1, 5.2, 1 / 30);
    expect(at60).toBeCloseTo(at30, 6);
    expect(at60).toBeLessThan(1);
  });
});

describe("the scene ledger", () => {
  it("has one chapter for every section of the page, in page order", () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(["top", "meaning", "universe", "pro", "stories", "future", "contact"]);
  });

  it("composes every shot with a sensible lens, outside the core mark", () => {
    for (const c of CHAPTERS) {
      for (const shot of [c.wide, c.tall]) {
        expect(shot.fov).toBeGreaterThan(20);
        expect(shot.fov).toBeLessThan(70);
        const [x, y, z] = shot.pos;
        expect(Math.hypot(x, y, z)).toBeGreaterThan(4);
      }
    }
  });

  it("keeps the system on screen on wide screens, and on phones only in the opening scene", () => {
    const onScreen = (frame: [number, number]) => frame.every((f) => f >= 0.05 && f <= 0.95);
    for (const c of CHAPTERS) expect(onScreen(c.wide.frame)).toBe(true);
    expect(CHAPTERS.filter((c) => onScreen(c.tall.frame)).map((c) => c.id)).toEqual(["top"]);
  });

  it("gives the opening scene the most room, then parks the system smaller behind the copy", () => {
    const [opening, ...rest] = CHAPTERS;
    for (const c of rest) expect(c.world.spread).toBeLessThan(opening.world.spread);
  });

  it("only shows the floating tool labels in the opening scene", () => {
    expect(CHAPTERS.filter((c) => c.world.tags > 0).map((c) => c.id)).toEqual(["top"]);
  });

  it("knows every destination it must draw", () => {
    expect(DESTINATIONS.map((d) => d.id)).toEqual(["tasks", "time", "panchang", "finance", "next"]);
  });

  it("blends world states and eases between chapters", () => {
    const mid = blendWorld(CHAPTERS[0].world, CHAPTERS[1].world, 0.5);
    expect(mid.exposure).toBeCloseTo((CHAPTERS[0].world.exposure + CHAPTERS[1].world.exposure) / 2);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(isTall(390, 844)).toBe(true);
    expect(isTall(1440, 900)).toBe(false);
  });
});
