import { describe, expect, it } from "vitest";

import { layoutMap, type PlanetSpec } from "@/components/map-layout";

// Button boxes as the site draws them: orb on top, name pill under it, 0.4rem padding.
const planets = (orb: number, scale = 1): PlanetSpec[] => [
  { id: "tasks", ring: 0, deg: 200, width: 64 * scale, height: orb + 45 },
  { id: "time", ring: 0, deg: 25, width: 60 * scale, height: orb + 45 },
  { id: "panchang", ring: 1, deg: 115, width: 98 * scale, height: orb + 45 },
  { id: "finance", ring: 1, deg: -38, width: 86 * scale, height: orb + 45 },
  { id: "next", ring: 2, deg: 232, width: 104 * scale, height: orb + 45 },
];

describe("tools map layout", () => {
  // [map width, map height, orb size, label scale]: phones under 360px get smaller orbs and labels (scenes.css).
  const sizes: [number, number, number, number?][] = [
    [288, 420, 32, 0.88], [342, 400, 38], [380, 400, 38], [460, 400, 38], [470, 380, 46], [560, 380, 46], [598, 460, 46], [752, 380, 46],
  ];
  for (const [width, height, orb, scale] of sizes) {
    it(`keeps every planet clear of the core, the others and the edges at ${width}×${height}`, () => {
      const specs = planets(orb, scale);
      const g = { width, height, orbRadius: orb / 2, coreRadius: orb > 40 ? 46 : orb > 34 ? 35 : 30, anchor: 6.4 + orb / 2 };
      const { core, planets: pos } = layoutMap(specs, g);
      const boxes = specs.map((p) => {
        const { x, y } = pos[p.id];
        return { id: p.id, l: x - p.width / 2, r: x + p.width / 2, t: y - g.anchor, b: y - g.anchor + p.height };
      });
      for (const b of boxes) {
        expect(b.l, `${b.id} left`).toBeGreaterThanOrEqual(0);
        expect(b.t, `${b.id} top`).toBeGreaterThanOrEqual(0);
        expect(b.r, `${b.id} right`).toBeLessThanOrEqual(width);
        expect(b.b, `${b.id} bottom`).toBeLessThanOrEqual(height);
        const dx = Math.max(b.l - core.x, 0, core.x - b.r);
        const dy = Math.max(b.t - core.y, 0, core.y - b.b);
        expect(Math.hypot(dx, dy), `${b.id} clears the core`).toBeGreaterThan(g.coreRadius);
      }
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const c = boxes[j];
        const hit = a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
        expect(hit, `${a.id} and ${c.id} overlap`).toBe(false);
      }
    });
  }
});
