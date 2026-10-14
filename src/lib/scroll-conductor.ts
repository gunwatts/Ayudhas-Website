/**
 * Native scroll as the conductor of the page's chapters (after the build-threejs-scroll-worlds skill).
 * Each chapter is "composed" when its section's centre sits at the viewport centre (the first at the top of the
 * page; anything past the last, such as the footer, holds the last). scrollY maps to a fractional chapter value
 * such as 2.35: chapter 2, 35% of the way to chapter 3. Pure functions: one scroll position, one state.
 */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach of `current` towards `target`. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export type SectionBox = { top: number; height: number };

/** Scroll positions at which each chapter is composed. Strictly increasing, within [0, maxScroll]. */
export function measureAnchors(sections: SectionBox[], viewportHeight: number, maxScroll: number): number[] {
  const max = Math.max(1, maxScroll);
  const anchors = sections.map((s, i) => (i === 0 ? 0 : clamp(s.top + s.height / 2 - viewportHeight / 2, 0, max)));
  for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
  return anchors;
}

/** Fractional chapter for a scroll position: 0 at the first anchor, anchors.length - 1 at the last. */
export function progressAt(y: number, anchors: number[]): number {
  if (anchors.length < 2 || y <= anchors[0]) return 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y <= anchors[i + 1]) return i + clamp((y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]), 0, 1);
  }
  return anchors.length - 1;
}

/** The two chapters either side of a progress value and how far between them it is. */
export function segment(progress: number, count: number) {
  const last = Math.max(0, count - 1);
  const index = clamp(Math.floor(progress), 0, Math.max(0, last - 1));
  const next = Math.min(last, index + 1);
  return { index, next, t: next === index ? 0 : clamp(progress - index, 0, 1) };
}
