import Link from "next/link";

import { SITE } from "@/content/site";

import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <a href="#top" className="nav-brand" aria-label="Ayudhas, back to top"><Logo size={34} /> <span>Ayudhas</span></a>
          <p>Useful digital tools under one name. Inspired by the Sanskrit āyudha: an instrument in the hands of the person using it.</p>
        </div>
        <nav aria-label="Products" className="footer-col">
          <span className="label">Products</span>
          <a href={SITE.playUrl} rel="noopener">Ayudhas · Google Play ↗</a>
          <a href={SITE.financeUrl}>Ayudhas Finance ↗</a>
          <a href="#pro">Ayudhas Pro · Android (closed testing)</a>
          <Link href="/solar-vision/">Solar Vision · live Sun &amp; Moon</Link>
        </nav>
        <nav aria-label="Explore" className="footer-col">
          <span className="label">Explore</span>
          <a href="#meaning">The name</a>
          <a href="#universe">Tools</a>
          <a href="#future">What comes next</a>
        </nav>
        <div className="footer-col">
          <span className="label">Contact</span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          <a href="#contact">Contact form</a>
          <Link href="/privacypolicy/">Privacy policies</Link>
        </div>
      </div>
      <div className="footer-mark" aria-hidden="true">
        {[..."Ayudhas"].map((ch, i) => <span key={i}>{ch}</span>)}
      </div>
      <div className="wrap footer-base">
        <p>© 2026 Ayudhas. All rights reserved.</p>
        <p>ayudhas.com · finance.ayudhas.com</p>
      </div>
    </footer>
  );
}
