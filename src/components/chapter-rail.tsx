"use client";

import { useEffect, useRef, useState } from "react";

import { CHAPTERS } from "./world/chapters";

/**
 * The chapter rail on the right edge (wide screens): where you are in the story and a shortcut to any scene.
 * A pointer convenience only; keyboard and screen-reader users have the same destinations in the main navigation.
 */
export function ChapterRail() {
  const [active, setActive] = useState(CHAPTERS[0].id);
  const fillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    CHAPTERS.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) io.observe(el);
    });
    let frame = 0;
    const paint = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      fillRef.current?.style.setProperty("transform", `scaleY(${max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0})`);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="rail" aria-hidden="true">
      <span className="rail-track"><span ref={fillRef} className="rail-fill" /></span>
      {CHAPTERS.map((c, i) => (
        <a key={c.id} href={`#${c.id}`} tabIndex={-1} className={active === c.id ? "on" : undefined}>
          <span className="rail-name"><b>{String(i + 1).padStart(2, "0")}</b> {c.name}</span>
          <i />
        </a>
      ))}
    </div>
  );
}
