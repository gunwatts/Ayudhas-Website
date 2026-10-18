import { gsap } from "gsap";
import {
  BloomEffect, Effect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode,
} from "postprocessing";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";

import { cloudTransmission, type Basis, type Place, snapshot, type Snapshot, type Vec3 } from "./astro";

/**
 * Solar Vision's renderer: two real-time scenes on one WebGL canvas.
 * - "sky": the view from a rooftop at the visitor's place. Preetham daylight scattering lit by the true Sun (drawn
 *   clear), the real star field and constellations turned for that place and moment, and the Moon at its true
 *   topocentric position, size, phase, tilt and libration, shaded like lunar regolith.
 * - "space": the Earth turned to the true sidereal angle with its tilt, sunlit side, city lights on the night side
 *   and yesterday's real clouds from NASA GIBS; the Moon at its true geocentric direction; the Sun; and the visitor's
 *   place marked on the globe with lines to the Moon and the Sun.
 * Both render through bloom, exposure and ACES tone mapping (postprocessing).
 */

export type ViewMode = "sky" | "space";
export type Target = "sun" | "moon" | "you" | "earth" | "north" | "east" | "south" | "west";

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  /** Labels the engine pins over the Sun, the Moon and the visitor's place each frame. */
  labels: Partial<Record<"sun" | "moon" | "you", HTMLElement>>;
  reducedMotion: boolean;
  /** The simulated moment to show (live, scrubbed or fast-forwarded by the page). */
  clock: () => Date;
  /** True while time runs faster than real time, so positions are recomputed every frame. */
  fast: () => boolean;
  onReady: () => void;
  onHeading?: (azimuth: number, altitude: number, fov: number) => void;
  /** Screen margins (px) kept clear of off-screen labels, so they never sit under the page's panels. */
  insets?: () => { top: number; right: number; bottom: number; left: number };
};

export type SolarEngine = {
  setMode: (mode: ViewMode) => void;
  setPlace: (place: Place) => void;
  setConstellations: (on: boolean) => void;
  setTrueScale: (on: boolean) => void;
  /** Resolves true once the image is on the globe. */
  setSatelliteImage: (url: string) => Promise<boolean>;
  lookAt: (target: Target, closeUp?: boolean) => void;
  zoom: (factor: number) => void;
  /** Steer the sky view with the phone's own orientation; resolves false if the device cannot. */
  setDeviceOrientation: (on: boolean) => Promise<boolean>;
  setReducedMotion: (reduce: boolean) => void;
  dispose: () => void;
};

const DEG = Math.PI / 180;
const SKY_STAR_RADIUS = 2400;
const SKY_MOON_DISTANCE = 1000;
const SPACE_SUN_DISTANCE = 700;
const COMPRESSED_MOON_DISTANCE = 14; // Earth radii; the true mean distance is 60.3
const MOON_RADIUS_EARTHS = 1737.4 / 6378.137;

const v3 = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);
const basisQuaternion = (b: Basis, q = new THREE.Quaternion()) =>
  q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(b.x), v3(b.y), v3(b.z)));

/* ------------------------------------------------------------------ shaders and helpers */

class ExposureEffect extends Effect {
  constructor() {
    super("ExposureEffect", /* glsl */ `
      uniform float exposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
      }
    `, { uniforms: new Map([["exposure", new THREE.Uniform(1)]]) });
  }
  get value() { return this.uniforms.get("exposure")!.value as number; }
  set value(v: number) { this.uniforms.get("exposure")!.value = v; }
}

/** Star colour from its B−V index (Ballesteros' temperature, then a blackbody fit). */
function starColor(bv: number, out: THREE.Color) {
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)) / 100;
  const r = t <= 66 ? 1 : Math.min(1, 1.292936186 * Math.pow(t - 60, -0.1332047592));
  const g = t <= 66 ? Math.min(1, 0.3900815788 * Math.log(t) - 0.6318414438) : Math.min(1, 1.129890861 * Math.pow(t - 60, -0.0755148492));
  const b = t >= 66 ? 1 : t <= 19 ? 0 : Math.min(1, 0.5432067891 * Math.log(t - 10) - 1.1962540891);
  return out.setRGB(r, Math.max(0, g), Math.max(0, b)).lerp(new THREE.Color(1, 1, 1), 0.35);
}

const eqjUnit = (raDeg: number, decDeg: number) => {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)] as const;
};

const STAR_VERT = /* glsl */ `
  attribute float aMag;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uLimit;
  uniform float uTwinkle;
  uniform float uScale;
  uniform float uHorizonFade;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    float flux = pow(10.0, -0.4 * (aMag - 1.0));
    // Fainter than the sky's current limit: gone. Near the limit: fading.
    float visible = 1.0 - smoothstep(uLimit - 0.6, uLimit + 0.4, aMag);
    // Extinction and haze near the horizon, and nothing below it.
    float up = normalize(world.xyz).y;
    float horizon = mix(1.0, smoothstep(-0.01, 0.18, up), uHorizonFade);
    float twinkle = 1.0 - uTwinkle * 0.35 * (0.5 + 0.5 * sin(uTime * (2.0 + aPhase * 5.0) + aPhase * 60.0)) * (1.0 - up * 0.6);
    vColor = aColor;
    vAlpha = clamp(sqrt(flux) * 0.9, 0.05, 1.6) * visible * horizon * twinkle;
    gl_PointSize = clamp((1.8 + sqrt(flux) * 3.0) * uScale, 1.5, 11.0) * uPixelRatio;
  }
`;

const STAR_FRAG = /* glsl */ `
  uniform float uBrightness;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(vColor * vAlpha * uBrightness * core * core, 1.0);
  }
`;

const MOON_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vEastW;
  varying vec3 vNorthW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vec3 p = normalize(position);
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), p) + vec3(1e-5, 0.0, 0.0));
    vec3 north = cross(p, east);
    mat3 m = mat3(modelMatrix);
    vNormalW = normalize(m * p);
    vEastW = normalize(m * east);
    vNorthW = normalize(m * north);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/**
 * The Moon's surface: NASA LRO colour, relief from NASA's lunar elevation model, and Lommel–Seeliger reflectance
 * (regolith scatters light back towards the Sun, which is why the full Moon looks like a flat disc, not a ball).
 */
const MOON_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uRelief;
  uniform vec3 uSunDir;
  uniform vec3 uEarthDir;
  uniform float uSunlight;
  uniform float uEarthshine;
  uniform vec3 uTint;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vEastW;
  varying vec3 vNorthW;
  varying vec3 vPosW;
  void main() {
    vec2 texel = vec2(1.0 / 1440.0, 1.0 / 720.0);
    float hE = texture2D(uRelief, vUv + vec2(texel.x, 0.0)).r - texture2D(uRelief, vUv - vec2(texel.x, 0.0)).r;
    float hN = texture2D(uRelief, vUv + vec2(0.0, texel.y)).r - texture2D(uRelief, vUv - vec2(0.0, texel.y)).r;
    vec3 n = normalize(vNormalW - (vEastW * hE + vNorthW * hN) * 2.2);
    vec3 v = normalize(cameraPosition - vPosW);
    float mu0 = max(dot(n, uSunDir), 0.0);
    float mu = max(dot(n, v), 0.0);
    float ls = mu0 / max(mu0 + mu, 1e-3);
    float lambert = mu0;
    float terminator = smoothstep(-0.02, 0.06, dot(normalize(vNormalW), uSunDir));
    vec3 albedo = texture2D(uMap, vUv).rgb;
    vec3 lit = albedo * mix(lambert, ls * 2.0, 0.72) * terminator * uSunlight;
    // Earthshine fades towards the limb, which also keeps the unlit edge soft.
    vec3 shine = albedo * max(dot(normalize(vNormalW), uEarthDir), 0.0) * smoothstep(0.0, 0.35, dot(normalize(vNormalW), v)) * uEarthshine;
    gl_FragColor = vec4((lit + shine) * uTint, 1.0);
  }
`;

const ATMOS_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const ATMOS_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uOuter;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 v = normalize(cameraPosition - vPosW);
    float facing = dot(normalize(vNormalW), v);
    vec3 p = vPosW;
    float rim;
    if (uOuter > 0.5) {
      // The glow beyond the limb: brightest where the view ray grazes the surface, gone 6% of a radius out.
      vec3 dir = -v;
      float tca = dot(-cameraPosition, dir);
      float d = sqrt(max(dot(cameraPosition, cameraPosition) - tca * tca, 0.0));
      rim = pow(1.0 - clamp((d - 1.0) / 0.06, 0.0, 1.0), 3.0) * 0.9;
      p = cameraPosition + dir * tca;
    } else {
      rim = pow(1.0 - abs(facing), 4.0) * 0.55;
    }
    float sunSide = dot(normalize(p), uSunDir);
    float day = smoothstep(-0.3, 0.4, sunSide);
    vec3 color = mix(vec3(0.32, 0.58, 1.0), vec3(1.0, 0.5, 0.25), (1.0 - smoothstep(-0.15, 0.3, sunSide)) * 0.7);
    gl_FragColor = vec4(color * rim * day * 1.5, 1.0);
  }
`;

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.2, "rgba(255,255,255,0.45)");
    g.addColorStop(0.5, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

function letterTexture(text: string, color: string) {
  return canvasTexture(128, 128, (ctx) => {
    ctx.font = "700 64px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 68);
  });
}

/** Concrete for the roof: speckled grey with a few stains, drawn once. */
function concreteTexture(rand: () => number) {
  const t = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#77736d";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const v = 90 + Math.floor(rand() * 60);
      ctx.fillStyle = `rgba(${v},${v - 3},${v - 8},${0.25 + rand() * 0.35})`;
      ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 2);
    }
    for (let i = 0; i < 14; i++) {
      const g = ctx.createRadialGradient(rand() * 512, rand() * 512, 0, rand() * 512, rand() * 512, 40 + rand() * 120);
      g.addColorStop(0, "rgba(40,38,35,0.18)");
      g.addColorStop(1, "rgba(40,38,35,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
    }
    ctx.strokeStyle = "rgba(40,38,35,0.35)";
    ctx.lineWidth = 2;
    for (let i = 128; i < 512; i += 128) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

/** A building facade: rows of windows, some lit (drawn into the emissive map). */
function facadeTextures(rand: () => number) {
  const draw = (lit: boolean) => (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = lit ? "#000" : "#3b3d44";
    ctx.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 256; y += 16) for (let x = 6; x < 128; x += 14) {
      const on = rand() < 0.3;
      ctx.fillStyle = lit ? (on ? (rand() < 0.7 ? "#ffd59a" : "#cfe3ff") : "#000") : "#23252b";
      ctx.fillRect(x, y, 8, 9);
    }
  };
  const map = canvasTexture(128, 256, draw(false));
  const glow = canvasTexture(128, 256, draw(true));
  for (const t of [map, glow]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return { map, glow };
}

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/* ------------------------------------------------------------------ the engine */

export async function createSolarEngine(o: EngineOptions): Promise<SolarEngine> {
  const { canvas } = o;
  const lowPower = window.matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency ?? 8) <= 4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);

  const loader = new THREE.TextureLoader();
  const load = (url: string, srgb = true) => loader.loadAsync(url).then((t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  });
  const [moonMap, moonRelief, earthDay, earthNight, earthClouds, earthNormal, earthSpec, sunMap, starsData, linesData] = await Promise.all([
    load("/solar/moon-color.webp"),
    load("/solar/moon-relief.webp", false),
    load("/solar/earth-day.webp"),
    load("/solar/earth-night.webp"),
    load("/solar/earth-clouds.webp", false),
    load("/solar/earth-normal.webp", false),
    load("/solar/earth-specular.webp", false),
    load("/solar/sun.webp"),
    fetch("/solar/stars.json").then((r) => r.json() as Promise<[number, number, number, number][]>),
    fetch("/solar/constellations.json").then((r) => r.json() as Promise<[number, number][][][]>),
  ]);

  let mode: ViewMode = "sky";
  let place: Place = { lat: 0, lon: 0, height: 0 };
  // The sky is drawn clear: no live weather service is used (see live.ts). The cloud and haze terms stay in the
  // shading so a future, commercially licensed weather source can drive them again.
  const cloudCover = 0;
  const visibilityKm: number | null = null;
  let trueScale = false;
  let reduce = o.reducedMotion;
  let snap: Snapshot = snapshot(o.clock(), place);
  let lastSnapAt = 0;
  const glow = glowTexture();
  const disposables: { dispose(): void }[] = [glow, moonMap, moonRelief, earthDay, earthNight, earthClouds, earthNormal, earthSpec, sunMap];

  /* --------------------------------------------------- shared: stars and constellations */

  const starGeometry = new THREE.BufferGeometry();
  {
    const n = starsData.length;
    const pos = new Float32Array(n * 3);
    const mag = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const c = new THREE.Color();
    const rand = seeded(11);
    starsData.forEach(([ra, dec, m, bv], i) => {
      const [x, y, z] = eqjUnit(ra, dec);
      pos.set([x, y, z], i * 3);
      mag[i] = m;
      starColor(bv, c);
      col.set([c.r, c.g, c.b], i * 3);
      phase[i] = rand();
    });
    starGeometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    starGeometry.setAttribute("aMag", new THREE.BufferAttribute(mag, 1));
    starGeometry.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    starGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  }
  const lineGeometry = new THREE.BufferGeometry();
  {
    const pts: number[] = [];
    for (const figure of linesData) for (const seg of figure) for (let i = 0; i < seg.length - 1; i++) {
      pts.push(...eqjUnit(seg[i][0], seg[i][1]), ...eqjUnit(seg[i + 1][0], seg[i + 1][1]));
    }
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  }
  disposables.push(starGeometry, lineGeometry);

  const makeStars = (radius: number, horizonFade: number) => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uLimit: { value: 6 }, uTwinkle: { value: 1 },
        uScale: { value: 1 }, uBrightness: { value: 1 }, uHorizonFade: { value: horizonFade },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const points = new THREE.Points(starGeometry, material);
    points.scale.setScalar(radius);
    points.matrixAutoUpdate = false;
    points.frustumCulled = false;
    points.renderOrder = 1;
    disposables.push(material);
    return { points, material };
  };
  const makeLines = (radius: number) => {
    const material = new THREE.LineBasicMaterial({ color: 0x7fa6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const lines = new THREE.LineSegments(lineGeometry, material);
    lines.scale.setScalar(radius);
    lines.matrixAutoUpdate = false;
    lines.frustumCulled = false;
    lines.renderOrder = 1;
    disposables.push(material);
    return { lines, material };
  };

  const makeMoon = (radius: number) => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: moonMap }, uRelief: { value: moonRelief }, uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uEarthDir: { value: new THREE.Vector3(0, 0, 1) }, uSunlight: { value: 2 }, uEarthshine: { value: 0.01 },
        uTint: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: MOON_VERT,
      fragmentShader: MOON_FRAG,
    });
    const geometry = new THREE.SphereGeometry(radius, 96, 64);
    disposables.push(material, geometry);
    return { mesh: new THREE.Mesh(geometry, material), material };
  };

  /* --------------------------------------------------- the rooftop sky */

  const sky = new THREE.Scene();
  const skyCam = new THREE.PerspectiveCamera(60, 1, 0.1, 6000);
  const skyDome = new Sky();
  skyDome.scale.setScalar(5000);
  skyDome.renderOrder = -2;
  const domeU = skyDome.material.uniforms;
  domeU.mieDirectionalG.value = 0.75;
  domeU.cloudScale.value = 0.00025;
  domeU.cloudSpeed.value = 0.00003;
  // Preetham's model switches off once the Sun is 2° down, so twilight and the night sky are added here: the glow
  // over the set Sun, the deepening blue overhead, the pink Belt of Venus opposite, then airglow and moonlit blue.
  domeU.uSunAlt = { value: 0 };
  domeU.uDayGlow = { value: 1 };
  domeU.uNightSky = { value: new THREE.Vector3() };
  skyDome.material.fragmentShader = skyDome.material.fragmentShader
    .replace("uniform float time;", "uniform float time;\nuniform float uSunAlt;\nuniform float uDayGlow;\nuniform vec3 uNightSky;")
    .replace("vec3 L0 = vec3( 0.1 ) * Fex;", "vec3 L0 = vec3( 0.1 ) * Fex * uDayGlow;")
    .replace(/(vec3 texColor = [^;]+;)/, `$1
      {
        float e = max(direction.y, 0.0);
        vec2 sd = normalize(vSunDirection.xz + vec2(1e-5));
        vec2 dd = normalize(direction.xz + vec2(1e-5));
        float toward = 0.5 + 0.5 * dot(sd, dd);
        float h = uSunAlt;
        float window = smoothstep(-18.0, -3.0, h) * (1.0 - smoothstep(0.0, 5.0, h));
        vec3 glow = vec3(1.0, 0.42, 0.13) * exp(-e * 7.0) * pow(toward, 2.5) * smoothstep(-12.0, -1.0, h);
        vec3 band = vec3(1.0, 0.7, 0.35) * exp(-e * 3.0) * pow(toward, 4.0) * smoothstep(-8.0, 0.0, h);
        vec3 dome = vec3(0.16, 0.30, 0.62) * exp(-e * 0.9) * (0.6 + 0.4 * toward) * smoothstep(-18.0, -2.0, h);
        vec3 venus = vec3(0.6, 0.36, 0.46) * exp(-pow((e - 0.1) * 8.0, 2.0)) * pow(1.0 - toward, 2.0) * smoothstep(-7.0, -1.0, h);
        texColor += (glow * 0.5 + band * 0.3 + dome * 0.32 + venus * 0.18) * window * 0.05;
        texColor += uNightSky * (1.0 + exp(-e * 3.0) * 0.8);
      }`);
  skyDome.material.needsUpdate = true;
  sky.add(skyDome);
  disposables.push(skyDome.geometry, skyDome.material);

  const skyStars = makeStars(SKY_STAR_RADIUS, 1);
  const skyLines = makeLines(SKY_STAR_RADIUS);
  sky.add(skyStars.points, skyLines.lines);

  const skyMoon = makeMoon(1);
  // Additive over the sky (the atmosphere's light sits in front of the Moon), but it writes depth, so stars behind
  // its dark side stay hidden.
  skyMoon.material.blending = THREE.AdditiveBlending;
  skyMoon.material.transparent = true;
  skyMoon.mesh.renderOrder = 0;
  sky.add(skyMoon.mesh);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xdfe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  moonHalo.renderOrder = 2;
  sky.add(moonHalo);
  const sunGlare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff1d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  sunGlare.renderOrder = 2;
  sky.add(sunGlare);
  disposables.push(moonHalo.material, sunGlare.material);

  const sunLight = new THREE.DirectionalLight(0xffffff, 0);
  const moonLight = new THREE.DirectionalLight(0xbcd0ff, 0);
  const hemi = new THREE.HemisphereLight(0x9ec5ff, 0x3a342c, 0.3);
  sky.add(sunLight, sunLight.target, moonLight, moonLight.target, hemi);
  sky.fog = new THREE.Fog(0x8fb3d9, 300, 3800);

  // The rooftop: a concrete slab, a low parapet and a water tank, the eye 1.6 m above the roof.
  const rand = seeded(5);
  const concrete = concreteTexture(rand);
  const roofMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95, metalness: 0 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb9b1a5, roughness: 0.9 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.55 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 12), roofMat);
  roof.position.y = -1.75;
  const walls = new THREE.Group();
  for (const [x, z, w, d] of [[0, -6, 12.5, 0.25], [0, 6, 12.5, 0.25], [-6, 0, 0.25, 12.5], [6, 0, 0.25, 12.5]] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), wallMat);
    wall.position.set(x, -1.1, z);
    walls.add(wall);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 32), tankMat);
  tank.position.set(4.2, -0.9, 4.4);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 64), new THREE.MeshStandardMaterial({ color: 0x2b2d2a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -12;
  sky.add(roof, walls, tank, ground);
  disposables.push(concrete, roofMat, wallMat, tankMat, roof.geometry, tank.geometry, ground.geometry, ground.material as THREE.Material);
  walls.children.forEach((w) => disposables.push((w as THREE.Mesh).geometry));

  // The neighbourhood: buildings out to 700 m, low enough that the horizon stays almost clear, windows lit at night.
  const facade = facadeTextures(rand);
  const buildingMat = new THREE.MeshStandardMaterial({ map: facade.map, emissiveMap: facade.glow, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.9 });
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const count = lowPower ? 140 : 260;
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, count);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 70 + Math.pow(rand(), 0.8) * 650;
      const maxTop = r * Math.tan(1.8 * DEG);
      const h = 6 + rand() * (12 + maxTop - 6);
      const w = 10 + rand() * 26;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
      m.compose(new THREE.Vector3(Math.cos(a) * r, -12, Math.sin(a) * r), q, new THREE.Vector3(w, h, 10 + rand() * 26));
      buildings.setMatrixAt(i, m);
    }
  }
  sky.add(buildings);
  disposables.push(facade.map, facade.glow, buildingMat, buildingGeo);

  // Compass letters on the horizon.
  const compass: THREE.Sprite[] = [];
  for (const [label, az] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]] as const) {
    const tex = letterTexture(label, label === "N" ? "#ff8a8a" : "#e8eeff");
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    const r = 900;
    s.position.set(Math.sin(az * DEG) * r, Math.tan(2.2 * DEG) * r, -Math.cos(az * DEG) * r);
    s.scale.setScalar(70);
    s.renderOrder = 3;
    compass.push(s);
    sky.add(s);
    disposables.push(tex, s.material);
  }

  /* --------------------------------------------------- space */

  const space = new THREE.Scene();
  const spaceCam = new THREE.PerspectiveCamera(40, 1, 0.01, 5000);
  spaceCam.position.set(0, 1.2, 4.2);
  const controls = new OrbitControls(spaceCam, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.25;
  controls.maxDistance = 120;
  controls.enablePan = false;
  controls.enabled = false;

  const spaceStars = makeStars(2000, 0);
  spaceStars.points.matrix.set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1).multiply(new THREE.Matrix4().makeScale(2000, 2000, 2000));
  spaceStars.material.uniforms.uLimit.value = 6.2;
  spaceStars.material.uniforms.uTwinkle.value = 0;
  space.add(spaceStars.points);

  const earth = new THREE.Group();
  space.add(earth);
  const live = { texture: null as THREE.Texture | null, mix: { value: 0 } };
  const liveUniform = { value: earthDay as THREE.Texture };
  const sunDirUniform = { value: new THREE.Vector3(1, 0, 0) };
  const earthMat = new THREE.MeshPhongMaterial({
    map: earthDay, normalMap: earthNormal, normalScale: new THREE.Vector2(0.55, 0.55), specularMap: earthSpec,
    specular: new THREE.Color(0x4a5c78), shininess: 22, emissive: new THREE.Color(0xffc58a), emissiveMap: earthNight,
  });
  // Night lights only where the Sun has set; yesterday's satellite image wherever it has data.
  earthMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDirW = sunDirUniform;
    shader.uniforms.uLive = liveUniform;
    shader.uniforms.uLiveMix = live.mix;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vNormalWorld;")
      .replace("#include <defaultnormal_vertex>", "#include <defaultnormal_vertex>\nvNormalWorld = normalize(mat3(modelMatrix) * objectNormal);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uSunDirW;\nuniform sampler2D uLive;\nuniform float uLiveMix;\nvarying vec3 vNormalWorld;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        vec3 liveColor = texture2D(uLive, vMapUv).rgb;
        float liveMask = smoothstep(0.03, 0.09, dot(liveColor, vec3(0.299, 0.587, 0.114))) * uLiveMix;
        diffuseColor.rgb = mix(diffuseColor.rgb, liveColor * 1.05, liveMask);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        float sunUp = dot(normalize(vNormalWorld), uSunDirW);
        totalEmissiveRadiance *= (1.0 - smoothstep(-0.2, 0.05, sunUp)) * 1.6;`);
  };
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat);
  const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, alphaMap: earthClouds, transparent: true, opacity: 0.85, depthWrite: false, shininess: 2 });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 96, 64), cloudMat);
  const atmosUniforms = (outer: number) => ({ uSunDir: sunDirUniform, uOuter: { value: outer } });
  const haze = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 64), new THREE.ShaderMaterial({
    uniforms: atmosUniforms(0), vertexShader: ATMOS_VERT, fragmentShader: ATMOS_FRAG, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), new THREE.ShaderMaterial({
    uniforms: atmosUniforms(1), vertexShader: ATMOS_VERT, fragmentShader: ATMOS_FRAG, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.BackSide,
  }));
  earth.add(earthMesh, clouds);
  space.add(haze, halo);
  disposables.push(earthMat, earthMesh.geometry, cloudMat, clouds.geometry, haze.geometry, haze.material as THREE.Material, halo.geometry, halo.material as THREE.Material);

  const spaceMoon = makeMoon(MOON_RADIUS_EARTHS);
  space.add(spaceMoon.mesh);
  const orbitLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x8aa2d8, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.45 }));
  space.add(orbitLine);
  disposables.push(orbitLine.geometry, orbitLine.material as THREE.Material);

  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(9, 64, 48), new THREE.MeshBasicMaterial({ map: sunMap, color: new THREE.Color(6, 4.6, 3.2) }));
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sunHalo.scale.setScalar(120);
  space.add(sunMesh, sunHalo);
  disposables.push(sunMesh.geometry, sunMesh.material as THREE.Material, sunHalo.material);

  const spaceSun = new THREE.DirectionalLight(0xffffff, 3.2);
  space.add(spaceSun, spaceSun.target, new THREE.AmbientLight(0x223355, 0.06));

  // The visitor's place: a beacon on the globe, and lines from it to the Moon and towards the Sun.
  const you = new THREE.Group();
  const youDot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 3.2) }));
  const youGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x3fdcec, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  youGlow.scale.setScalar(0.12);
  you.add(youDot, youGlow);
  space.add(you);
  const toMoon = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
    new THREE.LineDashedMaterial({ color: 0x9fd8ff, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.8 }));
  const toSun = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
    new THREE.LineDashedMaterial({ color: 0xffc66b, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.7 }));
  space.add(toMoon, toSun);
  disposables.push(youDot.geometry, youDot.material as THREE.Material, youGlow.material, toMoon.geometry, toMoon.material as THREE.Material, toSun.geometry, toSun.material as THREE.Material);

  /* --------------------------------------------------- post-processing */

  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: lowPower ? 0 : 4 });
  const renderPass = new RenderPass(sky, skyCam);
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.9, luminanceSmoothing: 0.3, intensity: 0.9, radius: 0.75 });
  const exposure = new ExposureEffect();
  composer.addPass(renderPass);
  composer.addPass(new EffectPass(skyCam, bloom, exposure, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));

  /* --------------------------------------------------- the sky camera (drag to look, wheel or pinch to zoom) */

  const look = { az: 180, alt: 25, fov: 70, taz: 180, talt: 25, tfov: 70 };
  let device: { alpha: number; beta: number; gamma: number; offset: number } | null = null;
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const onDown = (e: PointerEvent) => {
    if (mode !== "sky") return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gsap.killTweensOf(look);
  };
  const onMove = (e: PointerEvent) => {
    if (mode !== "sky" || !pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) look.tfov = THREE.MathUtils.clamp(look.tfov * (pinch / d), 0.8, 100);
      pinch = d;
      return;
    }
    if (device) return;
    const degPerPx = look.fov / canvas.clientHeight;
    look.taz = look.taz - (e.clientX - prev.x) * degPerPx;
    look.talt = THREE.MathUtils.clamp(look.talt + (e.clientY - prev.y) * degPerPx, -40, 89.5);
  };
  const onUp = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; };
  const onWheel = (e: WheelEvent) => {
    if (mode !== "sky") return;
    e.preventDefault();
    look.tfov = THREE.MathUtils.clamp(look.tfov * Math.exp(e.deltaY * 0.0012), 0.8, 100);
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  type OrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
  const onOrient = (e: OrientationEvent) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return;
    // iOS reports a compass heading separately; elsewhere the absolute event's alpha is already north-based.
    const offset = typeof e.webkitCompassHeading === "number" ? (360 - e.webkitCompassHeading) - e.alpha : 0;
    device = { alpha: e.alpha, beta: e.beta, gamma: e.gamma, offset: device ? device.offset * 0.9 + offset * 0.1 : offset };
  };
  const zee = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  const deviceQuaternion = (out: THREE.Quaternion) => {
    if (!device) return out;
    const orient = (screen.orientation?.angle ?? 0) * DEG;
    euler.set(device.beta * DEG, (device.alpha + device.offset) * DEG, -device.gamma * DEG, "YXZ");
    out.setFromEuler(euler);
    out.multiply(q1);
    out.multiply(q0.setFromAxisAngle(zee, -orient));
    return out;
  };

  /* --------------------------------------------------- sizing */

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h, false);
    for (const cam of [skyCam, spaceCam]) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    const pr = renderer.getPixelRatio();
    skyStars.material.uniforms.uPixelRatio.value = pr;
    spaceStars.material.uniforms.uPixelRatio.value = pr;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  /* --------------------------------------------------- per-frame state */

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const skyMatrix = new THREE.Matrix4();
  const horizonColor = new THREE.Color();
  const sunColor = new THREE.Color();
  const tmpScale = new THREE.Matrix4();
  let constellations = false;
  let clockS = 0;

  function updateSky() {
    const s = snap;
    const sunAlt = s.sun.altitude;
    const sunDir = v3(s.sun.dir);
    const moonDir = v3(s.moon.dir);

    domeU.sunPosition.value.copy(sunDir).multiplyScalar(450000);
    // Haze from the reported visibility: clear air near 2, murky air towards 10.
    const vis = visibilityKm ?? 20;
    domeU.turbidity.value = THREE.MathUtils.clamp(2.2 + (24 - Math.min(vis, 24)) * 0.2, 2.2, 7);
    domeU.rayleigh.value = sunAlt > 0 ? 2.6 : 2.2;
    domeU.mieCoefficient.value = 0.004 + 0.004 * cloudCover;
    domeU.cloudCoverage.value = cloudCover;
    domeU.cloudDensity.value = 0.35 + 0.35 * cloudCover;
    domeU.time.value = clockS;
    domeU.uSunAlt.value = sunAlt;
    domeU.uDayGlow.value = THREE.MathUtils.smoothstep(sunAlt, -4, 2);
    const moonSky = s.moon.altitude > 0 ? s.moon.illuminated * Math.sin(s.moon.altitude * DEG) * (1 - cloudCover * 0.4) : 0;
    (domeU.uNightSky.value as THREE.Vector3).set(0.0005 + 0.0022 * moonSky, 0.0007 + 0.004 * moonSky, 0.0013 + 0.008 * moonSky);

    // Stars: the real field turned for this place and moment.
    const m = s.eqjToSky;
    skyMatrix.set(m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1);
    skyStars.points.matrix.copy(skyMatrix).multiply(tmpScale.makeScale(SKY_STAR_RADIUS, SKY_STAR_RADIUS, SKY_STAR_RADIUS));
    skyLines.lines.matrix.copy(skyStars.points.matrix);
    // The naked-eye limit: 6 in a dark sky, brighter with twilight, moonlight and cloud.
    const dark = THREE.MathUtils.smoothstep(-sunAlt, 2, 15);
    const moonGlow = s.moon.altitude > 0 ? s.moon.illuminated * 1.6 : 0;
    const limit = THREE.MathUtils.lerp(-1.5, 6.0, dark) - moonGlow - cloudCover * 2.5;
    skyStars.material.uniforms.uLimit.value = limit;
    skyStars.material.uniforms.uBrightness.value = 1.5 * (1 - cloudCover * 0.6) * THREE.MathUtils.lerp(0.2, 1, dark);
    skyStars.material.uniforms.uTwinkle.value = reduce ? 0 : 1;
    skyStars.material.uniforms.uTime.value = clockS;
    skyStars.material.uniforms.uScale.value = THREE.MathUtils.clamp(60 / look.fov, 1, 3);
    skyLines.material.opacity = constellations ? 0.32 * dark : 0;

    // The Moon: true direction, apparent size, orientation, sunlight from the true Sun, a little earthshine.
    const r = SKY_MOON_DISTANCE * Math.tan((s.moon.diameterDeg / 2) * DEG);
    skyMoon.mesh.position.copy(moonDir).multiplyScalar(SKY_MOON_DISTANCE);
    skyMoon.mesh.scale.setScalar(r);
    basisQuaternion(s.moon.basisSky, skyMoon.mesh.quaternion);
    skyMoon.material.uniforms.uSunDir.value.copy(sunDir);
    skyMoon.material.uniforms.uEarthDir.value.copy(moonDir).negate();
    // Earthshine is strongest at a thin crescent (a nearly full Earth in the Moon's sky) and faint by the quarters.
    skyMoon.material.uniforms.uEarthshine.value = 0.016 * Math.pow(1 - s.moon.illuminated, 3) * dark;
    // Reddened and dimmed through the long air path near the horizon.
    const low = THREE.MathUtils.smoothstep(18 - s.moon.altitude, 0, 18);
    skyMoon.material.uniforms.uTint.value.setRGB(1, 1 - 0.32 * low, 1 - 0.6 * low).multiplyScalar(1 - 0.45 * low * low);
    skyMoon.material.uniforms.uSunlight.value = 1.7 * (1 - cloudCover * 0.6);
    skyMoon.mesh.visible = s.moon.altitude > -2;
    moonHalo.position.copy(skyMoon.mesh.position);
    moonHalo.scale.setScalar(r * 14);
    moonHalo.material.opacity = s.moon.altitude > 0 ? 0.22 * s.moon.illuminated * dark * (1 - cloudCover * 0.5) : 0;

    sunGlare.position.copy(sunDir).multiplyScalar(1500);
    sunGlare.scale.setScalar(70);
    sunGlare.material.opacity = sunAlt > -0.8 ? 0.35 * (1 - cloudCover * 0.8) : 0;

    // Light on the roof and the city.
    const day = THREE.MathUtils.smoothstep(sunAlt, -6, 10);
    sunColor.setRGB(1, THREE.MathUtils.lerp(0.55, 0.96, THREE.MathUtils.smoothstep(sunAlt, 0, 25)), THREE.MathUtils.lerp(0.32, 0.9, THREE.MathUtils.smoothstep(sunAlt, 0, 30)));
    sunLight.color.copy(sunColor);
    sunLight.position.copy(sunDir).multiplyScalar(100);
    sunLight.intensity = sunAlt > 0 ? 3 * Math.min(1, s.sun.clearSkyIrradiance / 900 + 0.15) * cloudTransmission(cloudCover) : 0;
    moonLight.position.copy(moonDir).multiplyScalar(100);
    moonLight.intensity = s.moon.altitude > 0 ? Math.min(0.6, s.moon.lux * 2.4) * (1 - cloudCover * 0.7) : 0;
    hemi.intensity = 0.05 + 0.9 * day;
    hemi.color.setRGB(THREE.MathUtils.lerp(0.25, 0.62, day), THREE.MathUtils.lerp(0.3, 0.77, day), THREE.MathUtils.lerp(0.5, 1, day));
    buildingMat.emissiveIntensity = 0.1 * (1 - day);
    horizonColor.setRGB(THREE.MathUtils.lerp(0.02, 0.5, day), THREE.MathUtils.lerp(0.03, 0.58, day), THREE.MathUtils.lerp(0.06, 0.7, day));
    if (sunAlt > -8 && sunAlt < 8) horizonColor.lerp(new THREE.Color(0.85, 0.5, 0.35), 0.35 * (1 - Math.abs(sunAlt) / 8));
    (sky.fog as THREE.Fog).color.copy(horizonColor);
    (sky.fog as THREE.Fog).far = THREE.MathUtils.clamp((visibilityKm ?? 20) * 600, 2500, 6000);

    // Exposure follows the light, like an eye adapting: bright day to dark night.
    exposure.value = THREE.MathUtils.lerp(9, 0.3, THREE.MathUtils.smoothstep(sunAlt, -14, 6));
    const letters = THREE.MathUtils.clamp(0.7 / exposure.value, 0.07, 1);
    compass.forEach((c) => { c.material.color.setScalar(letters); });
    // Bloom only what would dazzle after exposure: the Sun's disc by day, the Moon and bright stars by night.
    bloom.luminanceMaterial.threshold = 1.5 / exposure.value;
    bloom.intensity = THREE.MathUtils.lerp(0.9, 0.22, day);

    // Camera.
    const k = reduce ? 1 : 1 - Math.exp(-dt * 7);
    look.az += (look.taz - look.az) * k;
    look.alt += (look.talt - look.alt) * k;
    look.fov += (look.tfov - look.fov) * k;
    skyCam.fov = look.fov;
    skyCam.updateProjectionMatrix();
    if (device) {
      deviceQuaternion(skyCam.quaternion);
      skyCam.getWorldDirection(tmp);
      look.az = look.taz = ((Math.atan2(tmp.x, -tmp.z) / DEG) + 360) % 360;
      look.alt = look.talt = Math.asin(THREE.MathUtils.clamp(tmp.y, -1, 1)) / DEG;
    } else {
      tmp.set(Math.cos(look.alt * DEG) * Math.sin(look.az * DEG), Math.sin(look.alt * DEG), -Math.cos(look.alt * DEG) * Math.cos(look.az * DEG));
      skyCam.lookAt(tmp);
    }
    o.onHeading?.(((look.az % 360) + 360) % 360, look.alt, look.fov);
  }
  function placeMoonInSpace() {
    const s = snap;
    const geo = v3(s.moon.geoEarthRadii);
    const dist = trueScale ? geo.length() : COMPRESSED_MOON_DISTANCE;
    return geo.normalize().multiplyScalar(dist);
  }

  let orbitAt = -Infinity;
  function updateOrbit(now: Date) {
    // The Moon's path over the month around now, sampled from the same ephemeris.
    const pts: THREE.Vector3[] = [];
    for (let i = -14; i <= 14; i += 0.5) {
      const p = snapshot(new Date(now.getTime() + i * 86_400_000), place).moon.geoEarthRadii;
      const v = v3(p);
      const d = trueScale ? v.length() : COMPRESSED_MOON_DISTANCE;
      pts.push(v.normalize().multiplyScalar(d));
    }
    orbitLine.geometry.dispose();
    orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    orbitLine.computeLineDistances();
    const mat = orbitLine.material as THREE.LineDashedMaterial;
    mat.dashSize = trueScale ? 1 : 0.25;
    mat.gapSize = trueScale ? 0.7 : 0.18;
    orbitAt = now.getTime();
  }

  function updateSpace() {
    const s = snap;
    const sunDir = v3(s.sunDirSpace);
    sunDirUniform.value.copy(sunDir);
    basisQuaternion(s.earthBasisSpace, earth.quaternion);
    // Without the live image, the stock cloud layer drifts slowly so the globe never looks frozen.
    clouds.visible = live.mix.value < 0.5;
    clouds.rotation.y = clockS * 0.002;

    spaceSun.position.copy(sunDir).multiplyScalar(50);
    sunMesh.position.copy(sunDir).multiplyScalar(SPACE_SUN_DISTANCE);
    sunMesh.rotation.y = clockS * 0.01;
    sunHalo.position.copy(sunMesh.position);

    const moonPos = placeMoonInSpace();
    spaceMoon.mesh.position.copy(moonPos);
    basisQuaternion(s.moon.basisSpace, spaceMoon.mesh.quaternion);
    spaceMoon.material.uniforms.uSunDir.value.copy(sunDir);
    spaceMoon.material.uniforms.uEarthDir.value.copy(moonPos).negate().normalize();
    spaceMoon.material.uniforms.uEarthshine.value = 0.02 * (1 - s.moon.illuminated);
    spaceMoon.material.uniforms.uSunlight.value = 1.6;
    spaceMoon.material.uniforms.uTint.value.setRGB(1, 1, 1);

    const obs = v3(s.observerSpace);
    you.position.copy(obs).multiplyScalar(1.003);
    youGlow.material.opacity = reduce ? 0.9 : 0.6 + 0.35 * Math.sin(clockS * 3);
    const setLine = (line: THREE.Line, to: THREE.Vector3) => {
      const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(0, you.position.x, you.position.y, you.position.z);
      pos.setXYZ(1, to.x, to.y, to.z);
      pos.needsUpdate = true;
      line.computeLineDistances();
    };
    setLine(toMoon, moonPos);
    setLine(toSun, tmp2.copy(obs).add(tmp.copy(sunDir).multiplyScalar(2.2)));
    if (Math.abs(s.time.getTime() - orbitAt) > 3 * 3600_000) updateOrbit(s.time);

    exposure.value = 1.05;
    bloom.luminanceMaterial.threshold = 0.85;
    controls.update();
  }

  /* --------------------------------------------------- labels */

  const projected = new THREE.Vector3();
  const labelState = new Map<HTMLElement, string>();
  /** Screen radius (px) of a sphere of `radius` at `world`, so a label's ring can sit around a large disc. */
  const screenRadius = (world: THREE.Vector3, radius: number, cam: THREE.PerspectiveCamera) => {
    const dist = Math.max(1e-6, world.distanceTo(cam.position));
    return (radius / dist / Math.tan((cam.fov * DEG) / 2)) * (canvas.clientHeight / 2);
  };
  function pin(el: HTMLElement | undefined, world: THREE.Vector3 | null, cam: THREE.PerspectiveCamera, radiusPx = 0) {
    if (!el) return;
    let style = "hidden";
    if (world) {
      projected.copy(world).project(cam);
      const behind = projected.z > 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      let x = (projected.x * 0.5 + 0.5) * w;
      let y = (-projected.y * 0.5 + 0.5) * h;
      const inside = !behind && x > 0 && x < w && y > 0 && y < h;
      if (!inside) {
        // Off screen: hold the label on the edge, pointing the way to turn.
        let dx = projected.x * (behind ? -1 : 1);
        let dy = -projected.y * (behind ? -1 : 1);
        const scale = 1 / Math.max(Math.abs(dx), Math.abs(dy), 1e-6);
        dx *= scale; dy *= scale;
        x = (dx * 0.5 + 0.5) * w;
        y = (dy * 0.5 + 0.5) * h;
        const inset = o.insets?.() ?? { top: 90, right: 70, bottom: 90, left: 70 };
        x = THREE.MathUtils.clamp(x, inset.left + 50, w - inset.right - 50);
        y = THREE.MathUtils.clamp(y, inset.top + 20, h - inset.bottom - 40);
        const angle = Math.atan2(dy, dx) / DEG;
        style = `edge|${x.toFixed(0)}|${y.toFixed(0)}|${angle.toFixed(0)}`;
      } else {
        style = `on|${x.toFixed(0)}|${y.toFixed(0)}|0|${Math.round(Math.min(radiusPx, 2000))}`;
      }
    }
    if (labelState.get(el) === style) return;
    labelState.set(el, style);
    if (style === "hidden") { el.dataset.state = "hidden"; return; }
    const [state, x, y, angle, r = "0"] = style.split("|");
    el.dataset.state = state;
    el.style.setProperty("--ring", `${Math.max(22, Number(r) * 2 + 12)}px`);
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.setProperty("--angle", `${angle}deg`);
  }

  /* --------------------------------------------------- loop */

  let raf = 0;
  let last = performance.now();
  let dt = 0.016;
  let disposed = false;
  let ready = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clockS += reduce ? 0 : dt;
    if (o.fast() || now - lastSnapAt > 250) {
      snap = snapshot(o.clock(), place);
      lastSnapAt = now;
    }
    if (mode === "sky") {
      updateSky();
      pin(o.labels.sun, tmp.copy(v3(snap.sun.dir)).multiplyScalar(1000), skyCam);
      tmp.copy(v3(snap.moon.dir)).multiplyScalar(SKY_MOON_DISTANCE);
      pin(o.labels.moon, tmp, skyCam, screenRadius(tmp, skyMoon.mesh.scale.x, skyCam));
      pin(o.labels.you, null, skyCam);
    } else {
      updateSpace();
      pin(o.labels.sun, tmp.copy(sunMesh.position), spaceCam, screenRadius(sunMesh.position, 9, spaceCam));
      pin(o.labels.moon, tmp.copy(spaceMoon.mesh.position), spaceCam, screenRadius(spaceMoon.mesh.position, MOON_RADIUS_EARTHS, spaceCam));
      // Only while the visitor's side of the Earth faces the camera.
      const facing = tmp2.copy(you.position).normalize().dot(tmp.copy(spaceCam.position).sub(you.position).normalize()) > 0.05;
      pin(o.labels.you, facing ? tmp.copy(you.position) : null, spaceCam);
    }
    composer.render(dt);
    if (!ready) { ready = true; o.onReady(); }
  };

  const setMode = (next: ViewMode) => {
    mode = next;
    renderPass.mainScene = next === "sky" ? sky : space;
    renderPass.mainCamera = next === "sky" ? skyCam : spaceCam;
    controls.enabled = next === "space";
    canvas.style.cursor = next === "sky" ? "grab" : "default";
    labelState.clear();
  };
  setMode("sky");

  const engine: SolarEngine = {
    setMode,
    setPlace(p) {
      place = p;
      snap = snapshot(o.clock(), place);
      orbitAt = -Infinity;
    },
    setConstellations(on) { constellations = on; },
    setTrueScale(on) { trueScale = on; orbitAt = -Infinity; },
    setSatelliteImage(url) {
      return loader.loadAsync(url).then((t) => {
        if (disposed) { t.dispose(); return false; }
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        live.texture?.dispose();
        live.texture = t;
        liveUniform.value = t;
        if (reduce) live.mix.value = 1;
        else gsap.to(live.mix, { value: 1, duration: 2.5, ease: "power2.out" });
        return true;
      }).catch(() => false);
    },
    lookAt(target, closeUp = false) {
      const dur = reduce ? 0 : 1.6;
      if (mode === "sky") {
        const azAlt: Record<string, [number, number]> = {
          sun: [snap.sun.azimuth, snap.sun.altitude], moon: [snap.moon.azimuth, snap.moon.altitude],
          north: [0, 15], east: [90, 15], south: [180, 15], west: [270, 15],
        };
        const t = azAlt[target];
        if (!t) return;
        // Turn the short way round.
        const delta = ((t[0] - look.taz + 540) % 360) - 180;
        const fov = closeUp ? (target === "moon" ? snap.moon.diameterDeg * 2.6 : 8) : Math.max(look.tfov, 45);
        gsap.to(look, { taz: look.taz + delta, talt: THREE.MathUtils.clamp(t[1], -10, 89), tfov: fov, duration: dur, ease: "power3.inOut" });
        return;
      }
      const center = target === "moon" ? spaceMoon.mesh.position.clone() : new THREE.Vector3();
      let camPos: THREE.Vector3;
      if (target === "moon") {
        // Stand between the Earth and the Moon, a little to the side, so its lit face shows.
        camPos = center.clone().add(center.clone().normalize().multiplyScalar(-1.1).add(new THREE.Vector3(0, 0.25, 0)));
      } else if (target === "you") {
        camPos = you.position.clone().normalize().multiplyScalar(3.1);
      } else if (target === "sun") {
        camPos = v3(snap.sunDirSpace).multiplyScalar(-4).add(new THREE.Vector3(0, 1.2, 0));
      } else {
        camPos = new THREE.Vector3(0, 1.4, 1).normalize().multiplyScalar(5).add(v3(snap.sunDirSpace).multiplyScalar(1.5));
      }
      gsap.to(controls.target, { x: center.x, y: center.y, z: center.z, duration: dur, ease: "power3.inOut" });
      gsap.to(spaceCam.position, { x: camPos.x, y: camPos.y, z: camPos.z, duration: dur, ease: "power3.inOut" });
      controls.minDistance = target === "moon" ? 0.4 : 1.25;
    },
    zoom(f) {
      if (mode === "sky") look.tfov = THREE.MathUtils.clamp(look.tfov * f, 0.8, 100);
      else {
        const d = spaceCam.position.clone().sub(controls.target);
        d.multiplyScalar(f);
        if (d.length() > controls.minDistance && d.length() < controls.maxDistance) spaceCam.position.copy(controls.target).add(d);
      }
    },
    async setDeviceOrientation(on) {
      window.removeEventListener("deviceorientationabsolute", onOrient as EventListener);
      window.removeEventListener("deviceorientation", onOrient as EventListener);
      device = null;
      if (!on) return false;
      const Doe = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
      if (!Doe) return false;
      try {
        if (typeof Doe.requestPermission === "function" && (await Doe.requestPermission()) !== "granted") return false;
      } catch { return false; }
      const absolute = "ondeviceorientationabsolute" in window;
      window.addEventListener(absolute ? "deviceorientationabsolute" : "deviceorientation", onOrient as EventListener);
      return true;
    },
    setReducedMotion(v) { reduce = v; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("deviceorientationabsolute", onOrient as EventListener);
      window.removeEventListener("deviceorientation", onOrient as EventListener);
      gsap.killTweensOf([look, live.mix, controls.target, spaceCam.position]);
      controls.dispose();
      composer.dispose();
      live.texture?.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };

  raf = requestAnimationFrame(frame);
  return engine;
}
