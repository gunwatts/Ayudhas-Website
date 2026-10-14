"use client";

import { useEffect, useRef } from "react";

import { useInView, useReducedMotion, useWorldStatus } from "@/lib/motion";

type Glyph = "check" | "clock" | "moon" | "rupee" | "spark";
type Tool = { glyph: Glyph; color: string; phase: number };
type Orbit = { rx: number; ry: number; tilt: number; speed: number; tools: Tool[] };
type Star = { x: number; y: number; z: number; tw: number };

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#fff";

/**
 * The gateway's 2D orbit: a glowing core (Ayudhas) with tools on tilted orbits, over a parallax star field.
 * It is the still poster while the 3D world loads, and the animated scene on devices that do not run the 3D world.
 * Runs only while visible; draws a single still frame for reduced motion.
 */
export function OrbitWorld() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(wrapRef, "100px");
  const status = useWorldStatus();
  const animate = status === "fallback";

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !wrap || !ctx) return;

    const colors = { blue: css("--blue"), cyan: css("--cyan"), amber: css("--amber"), emerald: css("--emerald"), violet: css("--violet") };
    const orbits: Orbit[] = [
      { rx: 0.22, ry: 0.07, tilt: -0.32, speed: 0.22, tools: [{ glyph: "check", color: colors.blue, phase: 0.4 }, { glyph: "clock", color: colors.cyan, phase: 3.5 }] },
      { rx: 0.34, ry: 0.11, tilt: 0.18, speed: -0.14, tools: [{ glyph: "moon", color: colors.amber, phase: 1.6 }, { glyph: "rupee", color: colors.emerald, phase: 4.6 }] },
      { rx: 0.42, ry: 0.14, tilt: -0.08, speed: 0.08, tools: [{ glyph: "spark", color: colors.violet, phase: 2.6 }] },
    ];
    let w = 0, h = 0, dpr = 1, stars: Star[] = [];
    let px = 0, py = 0, tx = 0, ty = 0;
    let raf = 0, t0 = performance.now(), last = 0, started = false;
    // Phones and touch devices: fewer stars and 30 fps, to keep the page responsive and the battery cool.
    const lowPower = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
    const frameGap = lowPower ? 1000 / 30 : 0;

    const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = seeded(42);
      const count = Math.min(lowPower ? 60 : 160, Math.round((w * h) / (lowPower ? 12000 : 7000)));
      stars = Array.from({ length: count }, () => ({ x: rand() * w, y: rand() * h, z: 0.2 + rand() * 0.8, tw: rand() * 6.28 }));
    };

    const drawGlyph = (g: Glyph, x: number, y: number, s: number, color: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1.4, s * 0.16); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      if (g === "check") { ctx.moveTo(-s * 0.42, 0); ctx.lineTo(-s * 0.1, s * 0.32); ctx.lineTo(s * 0.45, -s * 0.36); ctx.stroke(); }
      else if (g === "clock") { ctx.arc(0, 0, s * 0.48, 0, Math.PI * 2); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.3); ctx.moveTo(0, 0); ctx.lineTo(s * 0.22, s * 0.1); ctx.stroke(); }
      else if (g === "moon") { ctx.arc(0, 0, s * 0.48, Math.PI * 0.35, Math.PI * 1.65); ctx.arc(s * 0.2, 0, s * 0.36, Math.PI * 1.6, Math.PI * 0.4, true); ctx.closePath(); ctx.fill(); }
      else if (g === "rupee") { ctx.font = `700 ${s * 1.15}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("₹", 0, s * 0.05); }
      else { for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5); } ctx.stroke(); }
      ctx.restore();
    };

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.5 + px * 14, cy = h * 0.5 + py * 10, base = Math.min(w, h * 1.7);

      for (const s of stars) {
        const a = 0.25 + 0.55 * s.z * (0.6 + 0.4 * Math.sin(t * 1.3 + s.tw));
        ctx.fillStyle = `rgba(220,228,255,${a.toFixed(3)})`;
        ctx.fillRect(s.x + px * 26 * s.z, s.y + py * 18 * s.z, s.z * 1.6, s.z * 1.6);
      }

      type Item = { depth: number; draw: () => void };
      const items: Item[] = [];
      for (const o of orbits) {
        const rx = base * o.rx, ry = base * o.ry;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(o.tilt);
        ctx.strokeStyle = "rgba(170,190,255,0.16)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        for (const tool of o.tools) {
          const a = tool.phase + t * o.speed;
          const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
          const x = cx + ex * Math.cos(o.tilt) - ey * Math.sin(o.tilt);
          const y = cy + ex * Math.sin(o.tilt) + ey * Math.cos(o.tilt);
          const depth = Math.sin(a);
          const scale = 0.78 + 0.32 * (depth + 1) / 2;
          const r = Math.max(14, base * 0.035) * scale;
          items.push({
            depth,
            draw: () => {
              const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
              glow.addColorStop(0, tool.color + "55"); glow.addColorStop(1, "transparent");
              ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
              ctx.globalAlpha = 0.55 + 0.45 * (depth + 1) / 2;
              ctx.fillStyle = "rgba(20,26,70,0.85)"; ctx.strokeStyle = tool.color; ctx.lineWidth = 1.5;
              ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              drawGlyph(tool.glyph, x, y, r * 0.95, tool.color);
              ctx.globalAlpha = 1;
            },
          });
        }
      }
      items.filter((i) => i.depth < 0).sort((a, b) => a.depth - b.depth).forEach((i) => i.draw());

      const core = base * 0.075;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 4.2);
      halo.addColorStop(0, "rgba(91,140,255,0.45)"); halo.addColorStop(0.45, "rgba(155,123,255,0.16)"); halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, core * 4.2, 0, Math.PI * 2); ctx.fill();
      const sphere = ctx.createRadialGradient(cx - core * 0.35, cy - core * 0.4, core * 0.1, cx, cy, core);
      sphere.addColorStop(0, "#eaf6ff"); sphere.addColorStop(0.35, colors.cyan); sphere.addColorStop(0.75, colors.blue); sphere.addColorStop(1, colors.violet);
      ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(cx, cy, core * (1 + 0.025 * Math.sin(t * 1.6)), 0, Math.PI * 2); ctx.fill();

      items.filter((i) => i.depth >= 0).sort((a, b) => a.depth - b.depth).forEach((i) => i.draw());
    };

    const loop = (now: number) => {
      if (now - last >= frameGap) { last = now; frame(now); }
      raf = requestAnimationFrame(loop);
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const running = () => animate && started && inView && !reduce && !document.hidden;
    const sync = () => {
      cancelAnimationFrame(raf);
      if (running()) raf = requestAnimationFrame(loop);
      else frame(t0 + 2600); // a pleasant still frame
    };

    resize();
    const ro = new ResizeObserver(() => { resize(); if (!running()) frame(t0 + 2600); });
    ro.observe(wrap);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", sync);
    t0 = performance.now() - 2600;
    sync(); // paints a still frame straight away
    // Start moving only once the page has loaded and the browser is idle, so the text paints first.
    let idle = 0;
    const begin = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
      idle = ric(() => { started = true; t0 = performance.now() - 2600; sync(); }, { timeout: 2500 } as IdleRequestOptions) as number;
    };
    let delay = 0;
    if (document.readyState === "complete") delay = window.setTimeout(begin, 600);
    else window.addEventListener("load", () => { delay = window.setTimeout(begin, 600); }, { once: true });
    return () => {
      window.clearTimeout(delay);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle); else window.clearTimeout(idle);
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [inView, reduce, animate]);

  return (
    <div ref={wrapRef} className="orbit-world" aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
