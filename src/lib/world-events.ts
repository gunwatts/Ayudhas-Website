/**
 * Typed window events between the page's components and the WebGL world, so neither imports the other
 * (the same pattern as the contact prefill event).
 */

export type WorldStatus = "loading" | "ready" | "fallback";

type Events = {
  /** The world started, or will not run on this device (the 2D orbit takes over). */
  "ayudhas:world-status": { status: WorldStatus };
  /** A destination is highlighted on the tools map, or null when none is. */
  "ayudhas:world-focus": { id: string | null };
  /** Choose a destination on the tools map (from the hero's floating labels or the 3D objects). */
  "ayudhas:select-destination": { id: string };
  /** How many open places the "What comes next" map shows. */
  "ayudhas:world-growth": { count: number };
};

export type WorldEvent = keyof Events;

export function emit<K extends WorldEvent>(name: K, detail: Events[K]) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function listen<K extends WorldEvent>(name: K, handler: (detail: Events[K]) => void) {
  const fn = (e: Event) => handler((e as CustomEvent<Events[K]>).detail);
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
}

/** The latest status, readable by components that mount after it was announced. */
export function currentWorldStatus(): WorldStatus {
  const s = document.documentElement.dataset.world;
  return s === "ready" || s === "fallback" ? s : "loading";
}

export function announceWorldStatus(status: WorldStatus) {
  document.documentElement.dataset.world = status;
  emit("ayudhas:world-status", { status });
}
