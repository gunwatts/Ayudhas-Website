import * as THREE from "three";

/** Small procedural textures drawn once at start-up; nothing is downloaded. */

function canvas2d(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { canvas, ctx };
}

function finish(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft white falloff, tinted per use through the material colour (halos, nebulae, light pools). */
export function glowTexture() {
  const s = 128;
  const { canvas, ctx } = canvas2d(s);
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.5)");
  g.addColorStop(0.55, "rgba(255,255,255,0.1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return finish(canvas);
}

/**
 * A studio "matcap": how a glossy sphere looks under a soft key light (top left) and a cool rim (bottom right).
 * Materials sample it by surface normal and tint it, which gives lit, reflective-looking objects with tiny shaders:
 * no lights, no environment map, and quick to compile on every GPU.
 */
export function matcapTexture() {
  const s = 256;
  const { canvas, ctx } = canvas2d(s);
  const c = s / 2;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.clip();
  const body = ctx.createRadialGradient(c * 0.82, c * 0.76, s * 0.04, c, c, c);
  body.addColorStop(0, "#c9d0ec");
  body.addColorStop(0.45, "#7c84b0");
  body.addColorStop(0.85, "#2c3160");
  body.addColorStop(1, "#151838");
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, s, s);
  ctx.globalCompositeOperation = "lighter";
  const rim = ctx.createRadialGradient(c * 1.18, c * 1.22, c * 0.55, c * 1.1, c * 1.12, c * 1.02);
  rim.addColorStop(0, "rgba(120,170,255,0)");
  rim.addColorStop(0.8, "rgba(120,170,255,0.08)");
  rim.addColorStop(1, "rgba(150,190,255,0.5)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, s, s);
  const key = ctx.createRadialGradient(c * 0.66, c * 0.56, 0, c * 0.66, c * 0.56, c * 0.5);
  key.addColorStop(0, "rgba(255,255,255,0.85)");
  key.addColorStop(0.3, "rgba(255,255,255,0.28)");
  key.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, s, s);
  const glint = ctx.createRadialGradient(c * 0.6, c * 0.5, 0, c * 0.6, c * 0.5, c * 0.12);
  glint.addColorStop(0, "rgba(255,255,255,0.9)");
  glint.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glint;
  ctx.fillRect(0, 0, s, s);
  return finish(canvas);
}

/** A dashed ring: an open place on the map that is not named yet. */
export function slotTexture() {
  const s = 128;
  const { canvas, ctx } = canvas2d(s);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 5;
  ctx.setLineDash([9, 8]);
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  return finish(canvas);
}

/** The face of the Finance coin: a struck rim and the rupee sign, on the tool's own hue. */
export function coinFaceTexture(hue: string) {
  const s = 256;
  const { canvas, ctx } = canvas2d(s);
  const base = ctx.createRadialGradient(s * 0.38, s * 0.32, s * 0.05, s / 2, s / 2, s * 0.52);
  base.addColorStop(0, "#f2fff8");
  base.addColorStop(0.35, hue);
  base.addColorStop(1, "#0d3d2a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, s, s);
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.43, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.385, 0, Math.PI * 2);
  ctx.stroke();
  // A cylinder cap maps this canvas a quarter-turn clockwise once the coin faces the camera, so draw it turned back.
  ctx.translate(s / 2, s / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `800 ${Math.round(s * 0.46)}px "Segoe UI", Roboto, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillText("₹", 3, 7);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("₹", 0, 4);
  return finish(canvas);
}
