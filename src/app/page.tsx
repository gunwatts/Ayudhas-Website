import { ChapterRail } from "@/components/chapter-rail";
import { Contact } from "@/components/contact";
import { Cursor } from "@/components/cursor";
import { Footer } from "@/components/footer";
import { Future } from "@/components/future";
import { HeroTools } from "@/components/hero-tools";
import { Meaning } from "@/components/meaning";
import { MotionDirector } from "@/components/motion-director";
import { Nav } from "@/components/nav";
import { OrbitWorld } from "@/components/orbit-world";
import { Pro } from "@/components/pro";
import { ScrollDirector } from "@/components/scroll-director";
import { Stories } from "@/components/stories";
import { Universe } from "@/components/universe";
import { World } from "@/components/world/world";
import { SITE } from "@/content/site";

import "./scenes.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", name: "Ayudhas", url: SITE.url, logo: `${SITE.url}/icon.svg`, email: SITE.email },
    { "@type": "WebSite", name: "Ayudhas", url: SITE.url },
    {
      "@type": "MobileApplication", name: "Ayudhas", operatingSystem: "Android", applicationCategory: "ProductivityApplication",
      installUrl: SITE.playUrl, offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    },
  ],
};

export default function Home() {
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <World />
      <Nav />
      <main id="main">
        <section id="top" className="gateway" aria-labelledby="gateway-title" data-chapter>
          <OrbitWorld />
          <div className="horizon" aria-hidden />
          <div className="wrap gateway-inner">
            <p className="label gateway-eyebrow"><span lang="sa" className="deva">आयुध</span> · āyudha · an instrument</p>
            <h1 id="gateway-title" className="gateway-title" aria-label="Ayudhas">
              <span aria-hidden="true">
                {[..."Ayudhas"].map((ch, i) => <span key={i} className="ch" style={{ ["--i" as string]: i }}>{ch}</span>)}
              </span>
            </h1>
            <p className="gateway-tagline"><span className="grad">{SITE.tagline}</span></p>
            <p className="lede gateway-lede">
              One home for useful digital tools: tasks, time, alarms and Panchang on Android, money on the web, and more to come.
            </p>
            <div className="gateway-cta">
              <a className="btn btn-primary" href="#meaning">Explore Ayudhas</a>
              <a className="btn btn-ghost" href="#universe">Discover our tools</a>
            </div>
          </div>
          <HeroTools />
          <a href="#meaning" className="scroll-cue" aria-label="Scroll to the story"><span /></a>
        </section>
        <Meaning />
        <Universe />
        <Pro />
        <Stories />
        <Future />
        <Contact />
      </main>
      <Footer />
      <ChapterRail />
      <MotionDirector />
      <ScrollDirector />
      <Cursor />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
