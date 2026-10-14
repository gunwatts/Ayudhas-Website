import * as THREE from "three";

import { DESTINATIONS } from "@/content/site";
import { clamp, damp, lerp, measureAnchors, progressAt, segment, smoothstep } from "@/lib/scroll-conductor";
import { emit, listen } from "@/lib/world-events";

import { blendWorld, CHAPTERS, type Chapter, easeInOut, isTall, type Shot } from "./chapters";
import {
  buildFloor, buildMonogram, buildStars, buildTool, FLOOR_Y, type Keep, ORBIT_RADII, orbitLine,
  type Palette, seeded, type ToolNode,
} from "./objects";
import { glowTexture, matcapTexture, slotTexture } from "./textures";

/**
 * The Ayudhas world: one persistent Three.js scene behind every section of the page. Native scroll is the conductor
 * (exact progress for anything interactive, damped progress for the camera), the camera travels a Catmull-Rom path
 * through one composed shot per section, and pointer, focus and selection only add local response.
 * Pauses when the tab is hidden; under reduced motion it renders still, composed frames on demand.
 */

export type WorldOptions = {
  canvas: HTMLCanvasElement;
  /** The WebGL 2 context already created on `canvas` while checking the device (see world.tsx). */
  context: WebGL2RenderingContext;
  /** Page sections in order; each id must match a chapter in CHAPTERS. */
  sections: HTMLElement[];
  /** Floating hero labels, keyed by destination id; the world positions them over their objects. */
  tags: Map<string, HTMLElement>;
  reducedMotion: boolean;
  /** Phones, tablets and small screens: fewer stars, no MSAA, lower pixel ratio, 30 fps while idle. */
  lowPower: boolean;
  onReady: () => void;
  onFail: () => void;
};

export type WorldController = { dispose: () => void; setReducedMotion: (reduce: boolean) => void };

const GHOST_RADII = [9.8, 11.6, 13.4, 15.2];
const STILL_CLOCK = 12; // the moment shown when motion is reduced
const INTRO_SECONDS = 2.4;
const INTERACTIVE = "a, button, input, select, textarea, label, summary, [role=button], [role=tab]";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => new THREE.Color(css.getPropertyValue(name).trim() || fallback);
  return {
    night: color("--night", "#060818"),
    text: color("--text", "#eef1ff"),
    blue: color("--blue", "#5b8cff"),
    cyan: color("--cyan", "#3fdcec"),
    violet: color("--violet", "#9b7bff"),
    emerald: color("--emerald", "#3ddc97"),
    amber: color("--amber", "#f5b85c"),
  };
}

export function createWorld(o: WorldOptions): WorldController {
  const { canvas, context, lowPower } = o;
  const root = document.documentElement;
  let reduce = o.reducedMotion;

  const chapters: Chapter[] = [];
  const sections: HTMLElement[] = [];
  for (const el of o.sections) {
    const chapter = CHAPTERS.find((c) => c.id === el.id);
    if (chapter) { chapters.push(chapter); sections.push(el); }
  }
  if (chapters.length < 2) throw new Error("The world needs at least two page sections");

  const bag = new Set<{ dispose(): void }>();
  const keep: Keep = (resource) => { bag.add(resource); return resource; };

  /* ------------------------------------------------------------ renderer and scene */

  // The context is transparent, so the CSS sky (body::before) shows through and its nebulae cost nothing here.
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  const palette = readPalette();
  renderer.setClearColor(palette.night, 0);
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps the brand hues true

  // No lights and no environment map: solids are shaded by one studio matcap, so every shader stays small.
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(palette.night, 0.016);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);

  const matcap = keep(matcapTexture());
  const glowMap = keep(glowTexture());
  const slotMap = keep(slotTexture());
  const world = new THREE.Group();
  scene.add(world);

  const stars = buildStars(keep, palette, lowPower ? 1100 : 2600, seeded(7));
  scene.add(stars.points);

  const floor = buildFloor(keep, palette.blue.clone().lerp(palette.cyan, 0.2));
  world.add(floor.mesh);
  const poolMaterial = keep(new THREE.MeshBasicMaterial({
    map: glowMap, color: palette.blue, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const pool = new THREE.Mesh(keep(new THREE.PlaneGeometry(20, 20)), poolMaterial);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = FLOOR_Y + 0.01;
  world.add(pool);

  const mono = buildMonogram(palette, keep, glowMap, matcap);
  world.add(mono.group);

  // Orbit lines scale with the chapter's `spread`; the tools ride them without changing size.
  const orbits = new THREE.Group();
  world.add(orbits);
  const orbitColor = palette.text.clone().lerp(palette.blue, 0.5);
  ORBIT_RADII.forEach((r, i) => orbits.add(orbitLine(keep, r, orbitColor, i === ORBIT_RADII.length - 1 ? 0.28 : 0.2, i === ORBIT_RADII.length - 1).line));

  // Empty orbits for tools that do not exist yet; the "What comes next" scene decides how many show.
  const ghosts = GHOST_RADII.map((r, i) => {
    const { line, material } = orbitLine(keep, r, palette.violet, 0, true);
    const slotMaterial = keep(new THREE.SpriteMaterial({ map: slotMap, color: palette.violet, transparent: true, opacity: 0, depthWrite: false }));
    const slot = new THREE.Sprite(slotMaterial);
    const a = 0.6 + i * 1.9;
    slot.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    slot.scale.setScalar(0.9);
    orbits.add(line, slot);
    return { material, slotMaterial, value: 0 };
  });

  const css = getComputedStyle(root);
  const proxyGeometry = keep(new THREE.SphereGeometry(0.95, 12, 8));
  const proxyMaterial = keep(new THREE.MeshBasicMaterial({ visible: false }));
  const tools: ToolNode[] = DESTINATIONS.map((d, i) => {
    const hue = new THREE.Color(css.getPropertyValue(d.hue).trim() || "#9b7bff");
    const node = buildTool(d.id, i, hue, palette, keep, glowMap, matcap, proxyGeometry, proxyMaterial);
    world.add(node.anchor);
    return node;
  });
  const proxies = tools.map((t) => t.proxy);

  /* ------------------------------------------------------------ the scroll conductor and camera path */

  let anchors: number[] = [];
  let widthAtMeasure = 0;
  const measure = () => {
    const vh = window.innerHeight;
    const y = window.scrollY;
    widthAtMeasure = window.innerWidth;
    anchors = measureAnchors(
      sections.map((el) => { const r = el.getBoundingClientRect(); return { top: r.top + y, height: r.height }; }),
      vh,
      document.documentElement.scrollHeight - vh,
    );
  };

  let tall = false;
  let shots: Shot[] = [];
  const curvePos = new THREE.CatmullRomCurve3([], false, "centripetal");
  const curveTarget = new THREE.CatmullRomCurve3([], false, "centripetal");
  const buildPath = () => {
    shots = chapters.map((c) => (tall ? c.tall : c.wide));
    curvePos.points = shots.map((s) => new THREE.Vector3(...s.pos));
    curveTarget.points = shots.map((s) => new THREE.Vector3(...s.target));
  };

  const view = { w: 1, h: 1 };
  const lens = { fov: 0, fx: 0, fy: 0, w: 0, h: 0 };
  const dprCap = lowPower ? 1.5 : 2;
  const nativeRatio = Math.min(window.devicePixelRatio || 1, dprCap);
  // Never drop below 0.75 of a CSS pixel (1 on high-density screens): past that, edges turn to stairs.
  const minScale = Math.min(1, (nativeRatio >= 2 ? 1 : 0.75) / nativeRatio);
  let perfScale = 1;
  const applySize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(nativeRatio * perfScale);
    canvas.dataset.quality = perfScale.toFixed(2);
    renderer.setSize(w, h, false);
    view.w = w;
    view.h = h;
    camera.aspect = w / h;
    stars.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    const nextTall = isTall(w, h);
    if (nextTall !== tall || !shots.length) { tall = nextTall; buildPath(); }
    lens.w = 0; // force the projection to update
    tagCache.forEach((c) => { c.half = 0; });
  };
  /** FOV plus a lens shift that puts the camera target at `frame` on screen, so copy keeps its side of the layout. */
  const setLens = (fov: number, fx: number, fy: number) => {
    if (lens.w === view.w && lens.h === view.h && Math.abs(lens.fov - fov) < 1e-3 && Math.abs(lens.fx - fx) < 1e-4 && Math.abs(lens.fy - fy) < 1e-4) return;
    Object.assign(lens, { fov, fx, fy, w: view.w, h: view.h });
    camera.fov = fov;
    camera.setViewOffset(view.w, view.h, -(fx - 0.5) * view.w, -(fy - 0.5) * view.h, view.w, view.h);
  };

  /* ------------------------------------------------------------ state */

  const state = { exact: 0, smooth: 0, intro: reduce ? 1 : 0, clock: STILL_CLOCK, pace: 1, tags: 0 };
  const pointer = {
    tx: 0, ty: 0, x: 0, y: 0, ndc: new THREE.Vector2(10, 10), moved: false,
    fine: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  };
  let selected: string | null =
    document.querySelector<HTMLElement>('[data-destination][aria-pressed="true"]')?.dataset.destination ?? null;
  const initialGrowth = Number(document.querySelector<HTMLElement>("[data-growth]")?.dataset.growth);
  let growth = Number.isFinite(initialGrowth) && initialGrowth > 0 ? initialGrowth : 1;
  let hoverTag: string | null = null;
  let hoverRay: string | null = null;
  let focusMoving = false;

  const universeIndex = chapters.findIndex((c) => c.id === "universe");
  const universeWeight = () => (universeIndex < 0 ? 0 : clamp(1 - Math.abs(state.smooth - universeIndex), 0, 1));
  const focusId = () => hoverTag ?? hoverRay ?? (universeWeight() > 0.35 ? selected : null);

  /* ------------------------------------------------------------ per-frame update */

  const pos = new THREE.Vector3();
  const target = new THREE.Vector3();
  const lean = new THREE.Vector3(); // scratch
  const leanBy = new THREE.Vector3();
  const leanGoal = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const tagCache = new Map<string, { transform: string; opacity: string; hot: boolean; half: number }>();

  function placeTags(fov: number, focus: string | null) {
    const tanHalf = Math.tan((fov * Math.PI) / 360);
    for (const tool of tools) {
      const el = o.tags.get(tool.id);
      if (!el) continue;
      tool.body.getWorldPosition(projected);
      const dist = Math.max(0.1, camera.position.distanceTo(projected));
      projected.project(camera);
      const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
      const alpha = onScreen ? state.tags : 0;
      const cache = tagCache.get(tool.id) ?? { transform: "", opacity: "", hot: false, half: 0 };
      // Keep each label whole on screen: measured once it is laid out, and again after a resize.
      if (!cache.half && alpha > 0) cache.half = el.offsetWidth / 2;
      const edge = cache.half + 8;
      const x = clamp((projected.x * 0.5 + 0.5) * view.w, edge, Math.max(edge, view.w - edge));
      const below = (view.h / (2 * tanHalf * dist)) * (0.85 + 0.2 * tool.focus) + 6; // just under the object
      const y = (-projected.y * 0.5 + 0.5) * view.h + below;
      const transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      const opacity = alpha.toFixed(2);
      if (cache.transform !== transform) el.style.transform = transform;
      if (cache.opacity !== opacity) {
        el.style.opacity = opacity;
        el.style.visibility = alpha < 0.02 ? "hidden" : "visible";
      }
      const hot = focus === tool.id;
      if (cache.hot !== hot) el.classList.toggle("is-hot", hot);
      tagCache.set(tool.id, { transform, opacity, hot, half: cache.half });
    }
  }

  function update(dt: number) {
    const n = chapters.length;
    const { index, next, t } = segment(state.smooth, n);
    const e = easeInOut(t);
    const a = shots[index];
    const b = shots[next];

    const u = clamp(state.smooth / (n - 1), 0, 1);
    curvePos.getPoint(u, pos);
    curveTarget.getPoint(u, target);
    let fov = lerp(a.fov, b.fov, e);
    const fx = lerp(a.frame[0], b.frame[0], e);
    const fy = lerp(a.frame[1], b.frame[1], e);
    const ws = blendWorld(chapters[index].world, chapters[next].world, e);

    // Wide shots are composed for 16:10. On narrower windows step back along the view so the system keeps its side.
    if (!tall) {
      const squeeze = clamp((1.6 - view.w / view.h) / 0.55, 0, 1);
      if (squeeze > 0) pos.addScaledVector(lean.subVectors(pos, target).normalize(), squeeze * 7);
    }

    // The opening shot: a long lens easing in from further back.
    const io = 1 - easeOutCubic(state.intro);
    pos.z += io * 7;
    pos.y += io * 1.4;
    fov += io * 6;

    // On the tools map, the view leans towards the chosen destination.
    const chosen = tools.find((tl) => tl.id === selected);
    leanGoal.set(0, 0, 0);
    if (chosen) leanGoal.copy(chosen.anchor.position).multiplyScalar(0.15 * universeWeight());
    if (reduce) leanBy.copy(leanGoal); else leanBy.lerp(leanGoal, 1 - Math.exp(-3 * dt));
    target.add(leanBy);

    // Pointer parallax, strongest in the opening scene. The target carries 42% of the move so the core stays put.
    const par = 1 - smoothstep(0, 1.6, state.smooth) * 0.55;
    pos.x += -pointer.x * 0.9 * par;
    pos.y += pointer.y * 0.5 * par;
    target.x += -pointer.x * 0.9 * 0.42 * par;
    target.y += pointer.y * 0.5 * 0.42 * par;

    camera.position.copy(pos);
    camera.lookAt(target);
    setLens(fov, fx, fy);
    camera.updateMatrixWorld();

    renderer.toneMappingExposure = ws.exposure;
    orbits.scale.set(ws.spread, 1, ws.spread);
    floor.material.uniforms.uOpacity.value = ws.grid;
    poolMaterial.opacity = 0.35 * ws.grid;
    ghosts.forEach((g, i) => {
      const want = ws.ghost * (i < growth ? 1 : 0.1);
      g.value = reduce ? want : damp(g.value, want, 4, dt);
      g.material.opacity = g.value * 0.5;
      g.slotMaterial.opacity = g.value * 0.85;
    });

    stars.material.uniforms.uTime.value = state.clock;
    stars.material.uniforms.uTwinkle.value = reduce ? 0 : 1;
    stars.points.rotation.y = state.clock * 0.004 - pointer.x * 0.03;
    stars.points.rotation.x = pointer.y * 0.015;

    mono.mark.rotation.y = Math.sin(state.clock * 0.22) * 0.38 + pointer.x * 0.25;
    mono.mark.rotation.x = pointer.y * 0.08;
    mono.group.position.y = Math.sin(state.clock * 0.6) * 0.08;
    const dotAngle = state.clock * 0.55;
    mono.dot.position.set(Math.cos(dotAngle) * 2.55, 0, Math.sin(dotAngle) * 2.55);
    mono.glow.value = 0.2 + 0.05 * Math.sin(state.clock * 1.1);

    // Orbits slow almost to a stop while a tool is pointed at, so its label is easy to take.
    const focus = focusId();
    const paceGoal = hoverTag || hoverRay ? 0.12 : 1;
    state.pace = reduce ? paceGoal : damp(state.pace, paceGoal, 3, dt);
    focusMoving = false;
    for (const tool of tools) {
      if (!reduce) tool.angle += dt * tool.speed * state.pace;
      const r = tool.radius * ws.spread;
      tool.anchor.position.set(Math.cos(tool.angle) * r, 0, Math.sin(tool.angle) * r);
      tool.body.position.y = Math.sin(state.clock * 0.9 + tool.phase) * 0.14;
      const want = focus === tool.id ? 1 : 0;
      tool.focus = reduce ? want : damp(tool.focus, want, 7, dt);
      if (Math.abs(tool.focus - want) > 0.002) focusMoving = true;
      tool.body.scale.setScalar(1 + 0.22 * tool.focus);
      tool.body.lookAt(camera.position);
      if (tool.sway) tool.body.rotateY(Math.sin(state.clock * 0.45 + tool.phase) * tool.sway);
      if (tool.tumble) tool.spinner.rotation.set(state.clock * 0.31, state.clock * 0.43, 0);
      tool.glow.opacity = 0.26 + 0.42 * tool.focus;
      tool.pin.opacity = (0.22 + 0.4 * tool.focus) * (0.4 + 0.6 * ws.grid);
      tool.mark.opacity = (0.4 + 0.5 * tool.focus) * (0.3 + 0.7 * ws.grid);
      tool.tick?.();
    }

    state.tags = ws.tags * smoothstep(0.45, 1, state.intro);
    placeTags(fov, focus);

    if (pointer.moved) {
      pointer.moved = false;
      let hit: string | null = null;
      if (pointer.fine && state.tags > 0.3) {
        raycaster.setFromCamera(pointer.ndc, camera);
        const id = raycaster.intersectObjects(proxies, false)[0]?.object.userData.toolId;
        if (typeof id === "string") hit = id;
      }
      if (hit !== hoverRay) { hoverRay = hit; root.classList.toggle("world-hot", hit !== null); }
    }
  }

  /* ------------------------------------------------------------ the frame loop */

  let running = !document.hidden;
  let started = false;
  let disposed = false;
  let announced = false;
  let raf = 0;
  let dirty = true;
  let lastFrame = performance.now();
  let lastRender = lastFrame;
  let bornAt = lastFrame;
  const perf: number[] = [];

  const schedule = () => { if (!raf && running && started) raf = requestAnimationFrame(frame); };
  const requestRender = () => { dirty = true; schedule(); };

  /**
   * Lower the pixel ratio when frames run long; raise it again only after a sustained run of fast frames. If frames
   * are still slow at the floor, ask the page to drop its own costly effects (live blur behind panels, grain).
   */
  let slowAtFloor = 0;
  function governor(raw: number, now: number) {
    if (now - bornAt < 2500) return;
    perf.push(raw);
    if (perf.length < 45) return;
    // The median, so a one-off stall (a tab switch, a long task elsewhere on the page) does not count as slowness.
    const typical = perf.sort((x, y) => x - y)[perf.length >> 1];
    perf.length = 0;
    if (typical > 0.024 && perfScale > minScale) { perfScale = Math.max(minScale, perfScale * (typical > 0.05 ? 0.75 : 0.88)); applySize(); }
    else if (typical > 0.024 && ++slowAtFloor >= 2) root.classList.add("world-lite");
    else if (typical < 0.0145 && perfScale < 1) { slowAtFloor = 0; perfScale = Math.min(1, perfScale + 0.08); applySize(); }
  }

  function frame(now: number) {
    raf = 0;
    if (!running || disposed) return;
    const raw = (now - lastFrame) / 1000;
    lastFrame = now;
    const step = Math.min(raw, 1 / 30);

    state.exact = progressAt(window.scrollY, anchors);
    const goal = reduce ? Math.round(state.exact) : state.exact;
    state.smooth = reduce ? goal : damp(state.smooth, goal, 5.2, step);
    if (Math.abs(state.smooth - goal) < 1e-4) state.smooth = goal;
    const follow = reduce ? 1 : 1 - Math.pow(1 - 0.055, step * 60);
    pointer.x += (pointer.tx - pointer.x) * follow;
    pointer.y += (pointer.ty - pointer.y) * follow;

    const settling = Math.abs(state.smooth - goal) > 1e-3 || state.intro < 1 || focusMoving
      || Math.abs(pointer.tx - pointer.x) > 1e-3 || Math.abs(pointer.ty - pointer.y) > 1e-3;
    if (reduce) {
      if (!dirty) return;
    } else if (lowPower && !settling && now - lastRender < 1000 / 30 - 2) {
      schedule(); // ambient motion on phones runs at 30 fps; scrolling and touch stay at full rate
      return;
    }

    const dt = Math.min((now - lastRender) / 1000, 1 / 30);
    lastRender = now;
    if (!reduce) {
      state.clock += dt;
      state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);
    }
    update(dt);
    renderer.render(scene, camera);
    dirty = false;
    if (!announced) { announced = true; o.onReady(); }
    if (!reduce && !(lowPower && !settling)) governor(raw, now);
    if (!reduce) schedule();
  }

  /* ------------------------------------------------------------ input and lifecycle */

  const goToTool = (id: string) => {
    emit("ayudhas:select-destination", { id });
    const universe = document.getElementById("universe");
    if (!universe) return;
    if (location.hash === "#universe") universe.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    else location.hash = "#universe";
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.ndc.set(pointer.tx, -pointer.ty);
    pointer.moved = true;
    if (reduce) requestRender();
  };
  const onPointerLeave = () => {
    pointer.tx = 0;
    pointer.ty = 0;
    pointer.ndc.set(10, 10);
    pointer.moved = true;
    requestRender();
  };
  const onClick = (e: MouseEvent) => {
    if (!hoverRay || state.tags < 0.3) return;
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
    if (window.getSelection()?.isCollapsed === false) return;
    goToTool(hoverRay);
  };
  const onScroll = () => { if (reduce) requestRender(); };
  const onResize = () => {
    if (!pointer.fine && window.innerWidth === widthAtMeasure) return; // a touch browser's toolbar, not a real resize
    measure();
    requestRender();
  };
  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    running = true;
    lastFrame = lastRender = performance.now();
    requestRender();
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
    o.onFail();
  };

  const tagCleanups: (() => void)[] = [];
  o.tags.forEach((el, id) => {
    const enter = () => { hoverTag = id; requestRender(); };
    const leave = () => { if (hoverTag === id) hoverTag = null; requestRender(); };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("focus", enter);
    el.addEventListener("blur", leave);
    tagCleanups.push(() => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focus", enter);
      el.removeEventListener("blur", leave);
    });
  });

  const offFocus = listen("ayudhas:world-focus", ({ id }) => { selected = id; requestRender(); });
  const offGrowth = listen("ayudhas:world-growth", ({ count }) => { growth = count; requestRender(); });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  root.addEventListener("mouseleave", onPointerLeave);
  window.addEventListener("blur", onPointerLeave);
  window.addEventListener("click", onClick);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost);
  const canvasObserver = new ResizeObserver(() => { applySize(); requestRender(); });
  canvasObserver.observe(canvas);
  const contentObserver = new ResizeObserver(() => { measure(); requestRender(); });
  contentObserver.observe(document.body);

  measure();
  applySize();
  state.exact = progressAt(window.scrollY, anchors);
  state.smooth = reduce ? Math.round(state.exact) : state.exact;
  update(0);
  // Compile every shader before the first visible frame, so the first scroll does not stall.
  renderer.compileAsync(scene, camera).catch(() => undefined).finally(() => {
    if (disposed) return;
    started = true;
    bornAt = lastFrame = lastRender = performance.now();
    requestRender();
  });

  return {
    setReducedMotion(next) {
      reduce = next;
      if (reduce) state.intro = 1;
      requestRender();
    },
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      offFocus();
      offGrowth();
      tagCleanups.forEach((f) => f());
      window.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("mouseleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      window.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvasObserver.disconnect();
      contentObserver.disconnect();
      o.tags.forEach((el) => {
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.style.removeProperty("visibility");
        el.classList.remove("is-hot");
      });
      root.classList.remove("world-hot", "world-lite");
      bag.forEach((r) => r.dispose());
      bag.clear();
      renderer.dispose();
    },
  };
}
