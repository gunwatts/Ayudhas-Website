import type Lenis from "lenis";

/**
 * The one smooth-scroll engine on the page (Lenis, started by SmoothScroll). Anything that scrolls the page in code
 * goes through `scrollToHash`, so it glides with Lenis when it runs and falls back to the browser otherwise
 * (reduced motion, before hydration, or if Lenis failed to start).
 */

let current: Lenis | null = null;

export function setLenis(lenis: Lenis | null) {
  current = lenis;
}

export function getLenis() {
  return current;
}

/** Height of the fixed navigation, kept clear above a scrolled-to section (matches scroll-padding-top). */
export const NAV_OFFSET = 84;

/**
 * Scroll to `#id`, record it in the address bar, and move focus there for keyboard and screen-reader users.
 * Returns false when there is no such element, so a caller can let the browser handle the link.
 */
export function scrollToHash(hash: string, { push = true }: { push?: boolean } = {}): boolean {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const target = id ? document.getElementById(id) : null;
  if (!target) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lenis = current;
  if (lenis && !reduce) {
    lenis.scrollTo(id === "top" ? 0 : target, { offset: -NAV_OFFSET, duration: 1.4 });
  } else {
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  if (push && location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
  // Focus follows the jump (as a native anchor would for the skip link), without a second scroll.
  if (!target.matches("a, button, input, select, textarea, [tabindex]")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  return true;
}
