"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";

const INTERACTIVE = "a, button, [role=tab], [role=button], select, label, summary";
const MAGNETIC = ".btn, .nav-links a, .tabs button, .planet";

/**
 * A soft ring that trails the pointer and swells over anything clickable, and buttons that lean towards the
 * pointer (magnetic). Mice and trackpads only, and never under reduced motion. The system cursor stays visible:
 * the ring is a highlight, not a replacement.
 */
export function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ring = ringRef.current;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ring || !fine || reduce) return;

    const root = document.documentElement;
    root.classList.add("has-cursor");
    const x = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
    const y = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });
    let magnet: HTMLElement | null = null;
    let shown = false;

    const release = (el: HTMLElement) => gsap.to(el, { "--mag-x": "0px", "--mag-y": "0px", duration: 0.6, ease: "elastic.out(1, 0.45)" });

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!shown) {
        shown = true;
        gsap.set(ring, { x: e.clientX, y: e.clientY });
        ring.classList.add("on");
      }
      x(e.clientX);
      y(e.clientY);
      const target = e.target instanceof Element ? e.target : null;
      ring.classList.toggle("hot", Boolean(target?.closest(INTERACTIVE)));
      ring.classList.toggle("text", Boolean(target?.closest("input, textarea")));

      const next = target?.closest<HTMLElement>(MAGNETIC) ?? null;
      if (next !== magnet) {
        if (magnet) release(magnet);
        magnet = next;
      }
      if (magnet && magnet.getAttribute("aria-disabled") !== "true") {
        const r = magnet.getBoundingClientRect();
        const pull = magnet.classList.contains("btn") ? 0.28 : 0.18;
        gsap.to(magnet, {
          "--mag-x": `${((e.clientX - (r.left + r.width / 2)) * pull).toFixed(1)}px`,
          "--mag-y": `${((e.clientY - (r.top + r.height / 2)) * pull).toFixed(1)}px`,
          duration: 0.35, ease: "power3.out", overwrite: "auto",
        });
      }
    };
    const onLeave = () => {
      shown = false;
      ring.classList.remove("on", "hot", "text");
      if (magnet) release(magnet);
      magnet = null;
    };
    const onDown = () => ring.classList.add("down");
    const onUp = () => ring.classList.remove("down");

    window.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      root.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return <div ref={ringRef} className="cursor" aria-hidden="true" />;
}
