import { lerp } from "@/lib/scroll-conductor";

/**
 * The scene ledger for the Ayudhas world: one composed camera shot and one world state per page section, in page
 * order. World units: the core mark is about 3.3 tall at the origin, tools orbit in the y = 0 plane at radii
 * 3.6 / 5.6 / 7.8 (times `spread`), and the map floor sits at y = -3.2. `frame` is where the camera target lands
 * on screen (0..1 from the top-left), applied as a lens shift.
 *
 * Composition rule: the opening scene is about the world itself, so the system fills the side the copy leaves
 * free. Every later scene is about its copy, so the camera pulls back and parks the system as a small emblem in
 * that scene's empty corner, while the floor and the stars keep the sense of travel between them. A phone's
 * column of copy has no empty corner, so on tall screens the system lifts out of frame after the opening.
 */

export type Vec3 = [number, number, number];
export type Shot = { pos: Vec3; target: Vec3; fov: number; frame: [number, number] };

export type WorldState = {
  /** Tone-mapping exposure: dims the world behind dense copy. */
  exposure: number;
  /** Opacity of the map floor. */
  grid: number;
  /** Opacity of the empty orbits that stand for future tools. */
  ghost: number;
  /** Opacity of the floating tool labels (the opening scene only). */
  tags: number;
  /** Orbit radius multiplier: the tools gather close to the mark or spread out over the map. */
  spread: number;
};

export type Chapter = { id: string; name: string; wide: Shot; tall: Shot; world: WorldState };

export const CHAPTERS: Chapter[] = [
  {
    id: "top",
    name: "Gateway",
    wide: { pos: [0, 5.2, 23], target: [0, -0.3, 0], fov: 34, frame: [0.765, 0.5] },
    tall: { pos: [0, 10.5, 28], target: [0, -0.6, 0], fov: 44, frame: [0.5, 0.29] },
    world: { exposure: 1, grid: 1, ghost: 0, tags: 1, spread: 0.7 },
  },
  {
    id: "meaning",
    name: "The name",
    wide: { pos: [-24, 6, 32], target: [0, 0.3, 0], fov: 30, frame: [0.84, 0.18] },
    tall: { pos: [-20, 8, 38], target: [0, 0.3, 0], fov: 44, frame: [0.5, -0.3] },
    world: { exposure: 0.74, grid: 0.5, ghost: 0, tags: 0, spread: 0.62 },
  },
  {
    id: "universe",
    name: "Tools",
    wide: { pos: [4, 34, 22], target: [0, -1, 0], fov: 32, frame: [0.79, 0.2] },
    tall: { pos: [3, 40, 26], target: [0, -1, 0], fov: 44, frame: [0.5, -0.3] },
    world: { exposure: 0.78, grid: 1, ghost: 0, tags: 0, spread: 0.66 },
  },
  {
    id: "pro",
    name: "Ayudhas Pro",
    wide: { pos: [32, 5, 24], target: [0, 0, 0], fov: 30, frame: [0.8, 0.68] },
    tall: { pos: [32, 6, 26], target: [0, 0, 0], fov: 44, frame: [0.5, -0.3] },
    world: { exposure: 0.72, grid: 0.55, ghost: 0, tags: 0, spread: 0.66 },
  },
  {
    id: "stories",
    name: "Stories",
    wide: { pos: [-26, 10, -24], target: [0, 0, 0], fov: 30, frame: [0.8, 0.17] },
    tall: { pos: [-28, 12, -28], target: [0, 0, 0], fov: 44, frame: [0.5, -0.3] },
    world: { exposure: 0.74, grid: 0.7, ghost: 0, tags: 0, spread: 0.66 },
  },
  {
    id: "future",
    name: "What comes next",
    wide: { pos: [0, 30, 34], target: [0, -1, 0], fov: 34, frame: [0.77, 0.2] },
    tall: { pos: [0, 36, 42], target: [0, -1, 0], fov: 46, frame: [0.5, -0.3] },
    world: { exposure: 0.9, grid: 0.8, ghost: 1, tags: 0, spread: 0.62 },
  },
  {
    id: "contact",
    name: "Contact",
    wide: { pos: [-6, -0.6, 40], target: [0, 0.4, 0], fov: 30, frame: [0.27, 0.8] },
    tall: { pos: [-4, -0.6, 46], target: [0, 0.4, 0], fov: 44, frame: [0.5, -0.3] },
    world: { exposure: 0.72, grid: 0.3, ghost: 0.35, tags: 0, spread: 0.6 },
  },
];

/** Smooth in-out easing for blending between two composed chapters. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function blendWorld(a: WorldState, b: WorldState, t: number): WorldState {
  return {
    exposure: lerp(a.exposure, b.exposure, t),
    grid: lerp(a.grid, b.grid, t),
    ghost: lerp(a.ghost, b.ghost, t),
    tags: lerp(a.tags, b.tags, t),
    spread: lerp(a.spread, b.spread, t),
  };
}

/** Portrait and near-square viewports use the tall compositions. */
export const isTall = (width: number, height: number) => width / Math.max(1, height) < 1.05;
