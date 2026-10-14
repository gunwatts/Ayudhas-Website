"use client";

import { useEffect } from "react";

/**
 * Page-wide motion that is not tied to one component:
 * - reveals: `.reveal` elements (and `.split` headings inside them) rise in once as they enter the viewport,
 *   staggered 85 ms per sibling. What is already on screen when this runs is shown as is, without animating,
 *   and nothing is hidden unless this has run, so content never depends on JavaScript.
 * - off-screen scenes get `is-offscreen`, which pauses their CSS animations (see globals.css).
 * - on fine pointers, glass panels get a soft spotlight under the cursor and `[data-tilt]` panels lean towards it.
 */
export function MotionDirector() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    // 1. Reveals.
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const siblings = new Map<Element, number>();
    for (const el of items) {
      const parent = el.parentElement;
      if (!parent) continue;
      const n = siblings.get(parent) ?? 0;
      el.style.setProperty("--d", String(n));
      siblings.set(parent, n + 1);
    }
    const vh = window.innerHeight;
    for (const el of items) {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) el.classList.add("is-in");
    }
    root.classList.add("motion");
    const reveal = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        reveal.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    for (const el of items) if (!el.classList.contains("is-in")) reveal.observe(el);
    cleanups.push(() => reveal.disconnect());

    // 2. Pause CSS animations in scenes that are off screen.
    const pauser = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("is-offscreen", !e.isIntersecting);
    }, { rootMargin: "120px 0px" });
    document.querySelectorAll("main > section, body > footer").forEach((el) => pauser.observe(el));
    cleanups.push(() => pauser.disconnect());

    // 3. Spotlight and tilt, for mice and trackpads only.
    if (!reduce && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      let current: HTMLElement | null = null;
      let rect: DOMRect | null = null;
      let px = 0;
      let py = 0;
      let frame = 0;
      const settle = (el: HTMLElement) => {
        el.style.removeProperty("--rx");
        el.style.removeProperty("--ry");
      };
      const flush = () => {
        frame = 0;
        if (!current) return;
        rect ??= current.getBoundingClientRect();
        const x = px - rect.left;
        const y = py - rect.top;
        current.style.setProperty("--mx", `${x.toFixed(0)}px`);
        current.style.setProperty("--my", `${y.toFixed(0)}px`);
        if (current.hasAttribute("data-tilt")) {
          const nx = x / Math.max(1, rect.width) - 0.5;
          const ny = y / Math.max(1, rect.height) - 0.5;
          current.style.setProperty("--rx", `${(-ny * 6).toFixed(2)}deg`);
          current.style.setProperty("--ry", `${(nx * 8).toFixed(2)}deg`);
        }
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const hit = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tilt], .glass") : null;
        if (hit !== current) {
          if (current) settle(current);
          current = hit;
          rect = null;
        }
        px = e.clientX;
        py = e.clientY;
        if (current && !frame) frame = requestAnimationFrame(flush);
      };
      const onLeave = () => {
        if (current) settle(current);
        current = null;
      };
      const forget = () => { rect = null; };
      document.addEventListener("pointermove", onMove, { passive: true });
      root.addEventListener("mouseleave", onLeave);
      window.addEventListener("scroll", forget, { passive: true });
      window.addEventListener("resize", forget, { passive: true });
      cleanups.push(() => {
        cancelAnimationFrame(frame);
        document.removeEventListener("pointermove", onMove);
        root.removeEventListener("mouseleave", onLeave);
        window.removeEventListener("scroll", forget);
        window.removeEventListener("resize", forget);
      });
    }

    return () => {
      cleanups.forEach((f) => f());
      root.classList.remove("motion");
    };
  }, []);

  return null;
}
