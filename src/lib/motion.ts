"use client";

import { type RefObject, useEffect, useState, useSyncExternalStore } from "react";

import { currentWorldStatus, listen, type WorldStatus } from "./world-events";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the visitor asked the OS for less motion. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** True while the element is on screen; used to pause animations that would otherwise run off-screen. */
export function useInView(ref: RefObject<Element | null>, rootMargin = "0px") {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

/** Whether the 3D world is loading, running, or replaced by the 2D fallback on this device. */
export function useWorldStatus(): WorldStatus {
  return useSyncExternalStore(
    (cb) => listen("ayudhas:world-status", cb),
    currentWorldStatus,
    () => "loading",
  );
}
