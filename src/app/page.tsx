import { Contact } from "@/components/contact";
import { Footer } from "@/components/footer";
import { Future } from "@/components/future";
import { Meaning } from "@/components/meaning";
import { Nav } from "@/components/nav";
import { OrbitWorld } from "@/components/orbit-world";
import { Pro } from "@/components/pro";
import { Stories } from "@/components/stories";
import { Universe } from "@/components/universe";
import { SITE } from "@/content/site";

import "./scenes.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", name: "Ayudhas", url: SITE.url, logo: `${SITE.url}/icon.svg`, email: SITE.email },
    { "@type": "WebSite", name: "Ayudhas", url: SITE.url },
  ],
};

export default function Home() {
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <Nav />
      <main id="main">
        <section id="top" className="gateway" aria-labelledby="gateway-title">
          <OrbitWorld />
          <div className="horizon" aria-hidden />
          <div className="wrap gateway-inner">
            <p className="label gateway-eyebrow"><span lang="sa" className="deva">आयुध</span> · āyudha · an instrument</p>
            <h1 id="gateway-title" className="gateway-title">Ayudhas</h1>
            <p className="gateway-tagline"><span className="grad">{SITE.tagline}</span></p>
            <p className="lede gateway-lede">
              One home for useful digital tools: tasks, time and Panchang on Android, money on the web, and more to come.
            </p>
            <div className="gateway-cta">
              <a className="btn btn-primary" href="#meaning">Explore Ayudhas</a>
              <a className="btn btn-ghost" href="#universe">Discover our tools</a>
            </div>
          </div>
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
