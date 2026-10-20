"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SITE } from "@/content/site";

import { Logo } from "./logo";

const LINKS = [
  { href: "#meaning", label: "Meaning" },
  { href: "#universe", label: "Tools" },
  { href: "#pro", label: "Ayudhas app" },
  { href: "#stories", label: "Stories" },
  { href: "#future", label: "Future" },
  { href: "#contact", label: "Contact" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    if (open) delete headerRef.current?.dataset.hidden;
  }, [open]);

  // Scrolled state, the progress hairline, and tucking the bar away while reading down (back on any scroll up).
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    // A wheel or trackpad flick upwards shows the bar at once, even while smooth scrolling is still gliding down.
    let upUntil = 0;
    const paint = () => {
      frame = 0;
      const y = window.scrollY;
      const header = headerRef.current;
      setScrolled(y > 24);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      barRef.current?.style.setProperty("transform", `scaleX(${max > 0 ? Math.min(1, y / max).toFixed(4) : 0})`);
      if (header) {
        const keep = openRef.current || header.contains(document.activeElement) || y < window.innerHeight * 0.8;
        if (keep || y < last - 4 || performance.now() < upUntil) delete header.dataset.hidden;
        else if (y > last + 4) header.dataset.hidden = "true";
      }
      last = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY >= -2) return;
      upUntil = performance.now() + 900;
      delete headerRef.current?.dataset.hidden;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive("#" + e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    LINKS.forEach((l) => {
      const el = document.querySelector(l.href);
      if (el) io.observe(el);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      io.disconnect();
    };
  }, []);

  // The pill that slides to the section on screen.
  useEffect(() => {
    let alive = true;
    const place = () => {
      const pill = pillRef.current;
      const link = active ? linksRef.current?.querySelector<HTMLElement>(`a[href="${active}"]`) : null;
      if (!alive || !pill) return;
      if (!link) { pill.style.opacity = "0"; return; }
      pill.style.opacity = "1";
      pill.style.width = `${link.offsetWidth}px`;
      pill.style.transform = `translateX(${link.offsetLeft}px)`;
    };
    place();
    document.fonts.ready.then(place);
    window.addEventListener("resize", place);
    return () => {
      alive = false;
      window.removeEventListener("resize", place);
    };
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header ref={headerRef} className={`nav ${scrolled ? "is-scrolled" : ""} ${open ? "is-open" : ""}`}>
      <div className="wrap nav-row">
        <a href="#top" className="nav-brand" aria-label="Ayudhas, back to top">
          <Logo size={30} /> <span>Ayudhas</span>
        </a>
        <nav ref={linksRef} aria-label="Sections" className="nav-links">
          <span ref={pillRef} className="nav-pill" aria-hidden />
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} aria-current={active === l.href ? "location" : undefined}>{l.label}</a>
          ))}
        </nav>
        <Link className="btn btn-ghost nav-cta nav-solar" href="/solar-vision/"><span className="nav-solar-dot" aria-hidden />Solar Vision</Link>
        <a className="btn btn-ghost nav-cta" href={SITE.financeUrl}>Ayudhas Finance ↗</a>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span aria-hidden className={`burger ${open ? "x" : ""}`}><i /><i /></span>
        </button>
      </div>
      <span ref={barRef} className="nav-progress" aria-hidden />
      <div id="mobile-menu" className={`mobile-menu glass ${open ? "open" : ""}`} hidden={!open}>
        <nav aria-label="Sections (mobile)">
          {LINKS.map((l, i) => (
            <a key={l.href} href={l.href} style={{ ["--i" as string]: i }} onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <Link href="/solar-vision/" className="btn btn-ghost" style={{ ["--i" as string]: LINKS.length }} onClick={() => setOpen(false)}>
            <span className="nav-solar-dot" aria-hidden />Solar Vision: live Sun &amp; Moon
          </Link>
          <a href={SITE.financeUrl} className="btn btn-primary" style={{ ["--i" as string]: LINKS.length + 1 }} onClick={() => setOpen(false)}>
            Open Ayudhas Finance ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
