"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/lib/motion";
import { announceWorldStatus } from "@/lib/world-events";

import type { WorldController } from "./engine";

/** WebGL drawn on the CPU: compiling the world's shaders there can freeze the page for seconds. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen/i;

/** Phones, tablets and small screens get fewer stars, no MSAA, a lower pixel ratio and 30 fps while idle. */
function isLowPower() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760 || (navigator.hardwareConcurrency ?? 8) <= 4;
}

/** Devices that should not even try: Save-Data on, or very little memory. */
const prefersLight = () => Boolean(navigator.connection?.saveData) || (navigator.deviceMemory ?? 8) < 2;

/**
 * Create the world's WebGL 2 context on its canvas, or return null where the light 2D orbit should run instead:
 * no hardware WebGL 2, or a software renderer. The same context is handed to Three.js, so checking costs nothing extra.
 */
function openContext(canvas: HTMLCanvasElement, lowPower: boolean): WebGL2RenderingContext | null {
  try {
    const gl = canvas.getContext("webgl2", {
      alpha: true, premultipliedAlpha: true, depth: true, stencil: false, powerPreference: "high-performance",
      // MSAA only where pixels are coarse; high-density screens are sharp without it.
      antialias: !lowPower && (window.devicePixelRatio || 1) < 1.5,
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) return null;
    // failIfMajorPerformanceCaveat misses some software renderers, so ask the driver's name where the browser allows.
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info && SOFTWARE_RENDERER.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)))) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return null;
    }
    return gl;
  } catch {
    return null;
  }
}

/**
 * The fixed WebGL layer behind the whole page. Three.js and the scene load in their own chunk once the page has
 * loaded, the browser is idle and the visitor is not mid-scroll; until then (and on devices that should not run it)
 * the hero's 2D orbit stands in.
 */
export function World() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controller = useRef<WorldController | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersLight()) {
      announceWorldStatus("fallback");
      return;
    }
    let disposed = false;
    announceWorldStatus("loading");
    const engine = import("./engine"); // start the download now; build later
    const fail = () => {
      controller.current?.dispose();
      controller.current = null;
      if (!disposed) announceWorldStatus("fallback");
    };
    const build = () => {
      // Opening a WebGL context is itself a burst of work (the GPU process wakes up), so it waits for this moment too.
      const lowPower = isLowPower();
      const context = openContext(canvas, lowPower);
      if (!context) {
        announceWorldStatus("fallback");
        return;
      }
      engine
        .then(({ createWorld }) => {
          if (disposed) return;
          const tags = new Map<string, HTMLElement>();
          document.querySelectorAll<HTMLElement>("[data-tool-tag]").forEach((el) => {
            if (el.dataset.toolTag) tags.set(el.dataset.toolTag, el);
          });
          controller.current = createWorld({
            canvas,
            context,
            tags,
            sections: Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]")),
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            lowPower,
            onReady: () => { if (!disposed) announceWorldStatus("ready"); },
            onFail: fail,
          });
        })
        .catch(fail);
    };

    // Building the scene is one burst of main-thread work, so it waits for a quiet moment: after load, when the
    // browser is idle, and not while the visitor is scrolling (an anchor jump must not stutter).
    let idle = 0;
    let timer = 0;
    let lastScroll = 0;
    const onScroll = () => { lastScroll = performance.now(); };
    const whenStill = () => {
      const quiet = performance.now() - lastScroll;
      if (quiet < 400) { timer = window.setTimeout(whenStill, 400 - quiet); return; }
      window.removeEventListener("scroll", onScroll);
      build();
    };
    const whenIdle = () => {
      // Safari has no requestIdleCallback.
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(whenStill, { timeout: 1500 });
      else timer = window.setTimeout(whenStill, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener("load", whenIdle);
      window.removeEventListener("scroll", onScroll);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.setReducedMotion(reduce);
  }, [reduce]);

  return (
    <div className="world" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
