"use client";

import { useEffect, useState } from "react";

import { SITE } from "@/content/site";

import { Logo } from "./logo";

const LINKS = [
  { href: "#meaning", label: "Meaning" },
  { href: "#universe", label: "Tools" },
  { href: "#pro", label: "Ayudhas Pro" },
  { href: "#stories", label: "Stories" },
  { href: "#future", label: "Future" },
  { href: "#contact", label: "Contact" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive("#" + e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    LINKS.forEach((l) => {
      const el = document.querySelector(l.href);
      if (el) io.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="wrap nav-row">
        <a href="#top" className="nav-brand" aria-label="Ayudhas, back to top">
          <Logo size={30} /> <span>Ayudhas</span>
        </a>
        <nav aria-label="Sections" className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} aria-current={active === l.href ? "location" : undefined}>{l.label}</a>
          ))}
        </nav>
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
      <div id="mobile-menu" className={`mobile-menu glass ${open ? "open" : ""}`} hidden={!open}>
        <nav aria-label="Sections (mobile)">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <a href={SITE.financeUrl} className="btn btn-primary" onClick={() => setOpen(false)}>Open Ayudhas Finance ↗</a>
        </nav>
      </div>
    </header>
  );
}
