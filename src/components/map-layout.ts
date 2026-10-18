/**
 * Layout for the tools map: each destination sits on its orbit around the Ayudhas core, at the angle nearest its
 * preferred one where its orb and label clear the core, the other planets and the edges of the map. Pure geometry in
 * pixels, so it holds at any size (a phone's narrow card as much as a wide desktop one).
 */

export type PlanetSpec = {
  id: string;
  ring: number;
  /** Preferred angle in degrees, screen space: 0 is right, 90 is down. */
  deg: number;
  /** The button's measured box: the orb on top, the name under it. */
  width: number;
  height: number;
};

export type MapGeometry = {
  width: number;
  height: number;
  coreRadius: number;
  orbRadius: number;
  /** From the top of a planet's box to its orb's centre. */
  anchor: number;
};

export type MapLayout = {
  core: { x: number; y: number };
  rings: { rx: number; ry: number }[];
  planets: Record<string, { x: number; y: number }>;
};

const GAP = 6;
/** Inner, middle and outer orbit as fractions of the largest orbit that fits. */
const RING_SCALE = [0.56, 0.79, 1];

type Box = { l: number; t: number; r: number; b: number };

const boxAt = (x: number, y: number, p: PlanetSpec, g: MapGeometry): Box => ({
  l: x - p.width / 2, r: x + p.width / 2, t: y - g.anchor, b: y - g.anchor + p.height,
});

const overlaps = (a: Box, b: Box) => a.l < b.r + GAP && b.l < a.r + GAP && a.t < b.b + GAP && b.t < a.b + GAP;

/** Distance from a point to the nearest point of a box. */
function distanceToBox(x: number, y: number, b: Box) {
  const dx = Math.max(b.l - x, 0, x - b.r);
  const dy = Math.max(b.t - y, 0, y - b.b);
  return Math.hypot(dx, dy);
}

export function layoutMap(specs: PlanetSpec[], g: MapGeometry): MapLayout {
  const widest = Math.max(...specs.map((p) => p.width), 0);
  const tallest = Math.max(...specs.map((p) => p.height), 0);
  const core = { x: g.width / 2, y: g.height / 2 - (tallest - 2 * g.anchor) / 2 };
  // The outer orbit leaves room for a whole planet box inside the map on every side.
  const maxRx = Math.max(40, g.width / 2 - widest / 2 - GAP);
  const maxRy = Math.max(30, Math.min(core.y - g.anchor, g.height - core.y - (tallest - g.anchor)) - GAP);
  // Orbits read as a tilted plane: flatter than a circle on wide maps (never flatter than 0.55). A narrow, tall map
  // (a phone) has little width to spare, so there they may round out to use the height instead.
  const ry = Math.min(maxRy, maxRx * (g.width < g.height * 1.2 ? 1.6 : 0.78));
  const rx = Math.min(maxRx, ry / 0.55);
  const rings = RING_SCALE.map((s) => ({ rx: rx * s, ry: ry * s }));

  const coreBox = { x: core.x, y: core.y, r: g.coreRadius + GAP };
  const placed: Box[] = [];
  const planets: MapLayout["planets"] = {};
  const fits = (b: Box) =>
    b.l >= GAP && b.t >= GAP && b.r <= g.width - GAP && b.b <= g.height - GAP
    && distanceToBox(coreBox.x, coreBox.y, b) > coreBox.r
    && placed.every((o) => !overlaps(o, b));

  // Widest labels choose first: they have the fewest places that fit.
  for (const p of [...specs].sort((x, y) => y.width - x.width)) {
    let best: { x: number; y: number; box: Box } | null = null;
    // Nearest angle first (0, +5, -5, +10, ...) on its own orbit; if that orbit is full, the other orbits, outer
    // ones first, so a crowded small map still finds every destination a clear place.
    const own = Math.min(p.ring, rings.length - 1);
    const order = [own, ...rings.map((_, i) => i).filter((i) => i > own), ...rings.map((_, i) => i).filter((i) => i < own).reverse()];
    for (const ring of order) {
      if (best) break;
      const { rx: a, ry: c } = rings[ring];
      for (let step = 0; step <= 72 && !best; step++) {
        const offset = step === 0 ? 0 : Math.ceil(step / 2) * 5 * (step % 2 ? 1 : -1);
        const rad = ((p.deg + offset) * Math.PI) / 180;
        const x = core.x + a * Math.cos(rad);
        const y = core.y + c * Math.sin(rad);
        const box = boxAt(x, y, p, g);
        if (fits(box)) best = { x, y, box };
      }
    }
    // Nothing fits (a tiny map): fall back to the preferred spot rather than hide a destination.
    if (!best) {
      const r = rings[Math.min(p.ring, rings.length - 1)];
      const rad = (p.deg * Math.PI) / 180;
      const x = core.x + r.rx * Math.cos(rad);
      const y = core.y + r.ry * Math.sin(rad);
      best = { x, y, box: boxAt(x, y, p, g) };
    }
    placed.push(best.box);
    planets[p.id] = { x: best.x, y: best.y };
  }
  return { core, rings, planets };
}
