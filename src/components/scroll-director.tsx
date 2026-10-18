"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";

import { scrollToHash, setLenis } from "@/lib/smooth-scroll";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Smooth scrolling and scroll-linked choreography for the whole page:
 * - Lenis eases wheel and trackpad scrolling (touch keeps the native feel) and runs on GSAP's ticker, so the 3D
 *   world, ScrollTrigger and the page all advance in the same frame. Off under reduced motion.
 * - Same-page links glide through `scrollToHash` (focus and the address bar follow, as with a native jump).
 * - GSAP ScrollTrigger scrubs the hero's exit, parallax depth (`[data-depth]`), the Ayudhas Pro phone turning in
 *   3D, the feature image opening up, and the footer wordmark rising. Reveals stay in MotionDirector (CSS).
 */
export function ScrollDirector() {
  // Lenis and anchor links.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;

    const start = () => {
      if (lenis || reduce.matches) return;
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false });
      lenis.on("scroll", ScrollTrigger.update);
      const instance = lenis;
      tick = (time: number) => instance.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      setLenis(lenis);
    };
    const stop = () => {
      if (tick) gsap.ticker.remove(tick);
      tick = null;
      lenis?.destroy();
      lenis = null;
      setLenis(null);
    };
    const onPreference = () => (reduce.matches ? stop() : start());
    start();
    reduce.addEventListener("change", onPreference);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
      if (!link || link.target) return;
      const hash = link.getAttribute("href") ?? "";
      if (hash.length > 1 && scrollToHash(hash)) e.preventDefault();
    };
    document.addEventListener("click", onClick);

    return () => {
      reduce.removeEventListener("change", onPreference);
      document.removeEventListener("click", onClick);
      stop();
    };
  }, []);

  // Scroll-linked choreography.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // The opening lifts away: letters tip back into depth from the centre out, then the copy and the cue.
      const hero = gsap.timeline({
        scrollTrigger: { trigger: ".gateway", start: "top top", end: "bottom 15%", scrub: 0.6 },
        defaults: { ease: "none" },
      });
      hero
        .to(".gateway-title .ch", {
          yPercent: -55, rotationX: 62, z: -120, opacity: 0, transformPerspective: 700, transformOrigin: "50% 100%",
          stagger: { each: 0.035, from: "center" },
        }, 0)
        .to([".gateway-eyebrow", ".gateway-tagline", ".gateway-lede", ".gateway-cta"], { y: -90, opacity: 0, stagger: 0.04 }, 0.05)
        .to(".scroll-cue", { opacity: 0, duration: 0.15 }, 0);

      // Depth: elements drift against the scroll by their weight, so layers separate as the page moves.
      gsap.utils.toArray<HTMLElement>("[data-depth]").forEach((el) => {
        const depth = Number(el.dataset.depth) || 0.2;
        gsap.fromTo(el, { y: depth * 110 }, {
          y: -depth * 110, ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        });
      });

      // Ayudhas Pro: the phone turns towards the reader as it crosses the screen.
      gsap.fromTo(".pro-device", { rotationY: -28, rotationX: 9, transformPerspective: 1400 }, {
        rotationY: 12, rotationX: -4, ease: "none",
        scrollTrigger: { trigger: ".pro-grid", start: "top bottom", end: "bottom top", scrub: 0.8 },
      });

      // The store graphic opens from a narrow window and settles.
      gsap.fromTo(".pro-feature", { clipPath: "inset(10% 7% 10% 7% round 28px)" }, {
        clipPath: "inset(0% 0% 0% 0% round 22px)", ease: "none",
        scrollTrigger: { trigger: ".pro-feature", start: "top 95%", end: "top 40%", scrub: 0.6 },
      });
      gsap.fromTo(".pro-feature-media img", { scale: 1.12 }, {
        scale: 1, ease: "none",
        scrollTrigger: { trigger: ".pro-feature", start: "top bottom", end: "center 60%", scrub: true },
      });

      // The footer wordmark rises letter by letter as the page ends.
      gsap.fromTo(".footer-mark span", { yPercent: 110, rotationX: -50, transformPerspective: 800 }, {
        yPercent: 0, rotationX: 0, ease: "none", stagger: 0.06,
        scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: 0.8 },
      });
    });

    // Layout shifts when the display faces arrive; measure again once they have.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => mm.revert();
  });

  return null;
}
