import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

import { coinFaceTexture } from "./textures";

/**
 * The pieces of the Ayudhas world. Every tool is an object that says what it does (a checked tile, a clock, a moon,
 * a rupee coin, an unfinished shell), standing on its own orbit around the Ayudhas mark like pins on a map.
 * Solid objects are shaded with one studio matcap (textures.ts) rather than lights and an environment map: the same
 * glossy read, with small shaders that compile quickly on every GPU.
 */

export type Palette = Record<"night" | "text" | "blue" | "cyan" | "violet" | "emerald" | "amber", THREE.Color>;
/** Registers a GPU resource for disposal at teardown and returns it. */
export type Keep = <T extends { dispose(): void }>(resource: T) => T;

export const FLOOR_Y = -3.2;
const TAU = Math.PI * 2;
const WHITE = new THREE.Color("#ffffff");

export function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function glowSprite(keep: Keep, map: THREE.Texture, color: THREE.Color, opacity: number, scale: number) {
  const material = keep(new THREE.SpriteMaterial({
    map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  return sprite;
}

/* ------------------------------------------------------------------ the mark */

export type Monogram = { group: THREE.Group; mark: THREE.Mesh; ring: THREE.Group; dot: THREE.Mesh; glow: { value: number } };

/** The Ayudhas "A" from the logo, extruded and bevelled, with the logo's tilted orbit and its moving point. */
export function buildMonogram(p: Palette, keep: Keep, glowMap: THREE.Texture, matcap: THREE.Texture): Monogram {
  const S = 0.078; // logo units (a 64-unit box) to world units: the mark stands about 3.3 tall
  const pts = (list: [number, number][]) => list.map(([x, y]) => new THREE.Vector2((x - 32) * S, -(y - 31) * S));
  const shape = new THREE.Shape(pts([[32, 10], [48, 52], [40.5, 52], [37.3, 43.4], [26.7, 43.4], [23.5, 52], [16, 52]]));
  shape.holes.push(new THREE.Path(pts([[32, 23], [28.7, 34.5], [35.3, 34.5]])));
  const geo = keep(new THREE.ExtrudeGeometry(shape, {
    depth: 0.5, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.065, bevelSegments: 4, curveSegments: 1,
  }));
  geo.center();
  geo.computeBoundingBox();
  const box = geo.boundingBox ?? new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));

  // The logo's diagonal gradient, cyan at the top-left through blue to violet at the bottom-right.
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const w = box.max.x - box.min.x || 1;
  const h = box.max.y - box.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const t = 0.5 * ((pos.getX(i) - box.min.x) / w) + 0.5 * ((box.max.y - pos.getY(i)) / h);
    if (t < 0.5) c.copy(p.cyan).lerp(p.blue, t * 2);
    else c.copy(p.blue).lerp(p.violet, (t - 0.5) * 2);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const glow = { value: 0.2 };
  const material = keep(new THREE.MeshMatcapMaterial({ matcap, vertexColors: true }));
  // Let the gradient glow from within, and light its edges (a fresnel rim) so the bloom pass catches the silhouette.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.fragmentShader = "uniform float uGlow;\n" + shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      [
        "float rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.4);",
        "outgoingLight += vColor.rgb * uGlow + mix(vColor.rgb, vec3(1.0), 0.35) * rimF * 1.6;",
        "#include <opaque_fragment>",
      ].join("\n\t"),
    );
  };
  const mark = new THREE.Mesh(geo, material);

  const ring = new THREE.Group();
  ring.rotation.set(0.2, 0, 0.32); // the logo's orbit, tipped -18 degrees
  const torus = new THREE.Mesh(
    keep(new THREE.TorusGeometry(2.55, 0.022, 8, 220)),
    keep(new THREE.MeshBasicMaterial({ color: p.blue.clone().lerp(p.cyan, 0.3), transparent: true, opacity: 0.85 })),
  );
  torus.rotation.x = Math.PI / 2;
  const dot = new THREE.Mesh(keep(new THREE.SphereGeometry(0.11, 18, 12)), keep(new THREE.MeshBasicMaterial({ color: p.cyan })));
  dot.add(glowSprite(keep, glowMap, p.cyan, 0.9, 1.3));
  ring.add(torus, dot);

  const group = new THREE.Group();
  const halo = glowSprite(keep, glowMap, p.blue, 0.5, 9);
  halo.position.z = -1.2;
  const haze = glowSprite(keep, glowMap, p.violet, 0.22, 15);
  haze.position.z = -2;
  group.add(halo, haze, mark, ring);
  return { group, mark, ring, dot, glow };
}

/* ------------------------------------------------------------------ the tools */

export type ToolNode = {
  id: string;
  radius: number;
  speed: number;
  angle: number;
  phase: number;
  /** Side-to-side sway (radians) after facing the camera, so faces stay readable but show their depth. */
  sway: number;
  tumble: boolean;
  anchor: THREE.Group;
  body: THREE.Group;
  spinner: THREE.Group;
  glow: THREE.SpriteMaterial;
  pin: THREE.LineDashedMaterial;
  mark: THREE.MeshBasicMaterial;
  proxy: THREE.Mesh;
  focus: number;
  tick?: () => void;
};

/** Where each destination orbits: Pro's tasks and time close in, Panchang and Finance further out, the unknown last. */
const ORBITS: Record<string, { radius: number; angle: number }> = {
  tasks: { radius: 3.6, angle: 3.9 },
  time: { radius: 3.6, angle: 0.85 },
  panchang: { radius: 5.6, angle: 2.35 },
  finance: { radius: 5.6, angle: 5.5 },
  next: { radius: 7.8, angle: 3.45 },
};
export const ORBIT_RADII = [3.6, 5.6, 7.8];

function buildTasks(into: THREE.Group, hue: THREE.Color, keep: Keep, matcap: THREE.Texture) {
  const tile = new THREE.Mesh(
    keep(new RoundedBoxGeometry(1.15, 1.15, 0.22, 4, 0.16)),
    keep(new THREE.MeshMatcapMaterial({ matcap, color: hue.clone().multiplyScalar(0.62) })),
  );
  const ink = keep(new THREE.MeshBasicMaterial({ color: hue.clone().lerp(WHITE, 0.35) }));
  const stroke = (x1: number, y1: number, x2: number, y2: number) => {
    const m = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.068, Math.hypot(x2 - x1, y2 - y1), 4, 10)), ink);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0.125);
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    return m;
  };
  into.add(tile, stroke(-0.3, 0.02, -0.08, -0.2), stroke(-0.08, -0.2, 0.32, 0.24));
}

function buildTime(into: THREE.Group, hue: THREE.Color, p: Palette, keep: Keep, matcap: THREE.Texture) {
  const metal = keep(new THREE.MeshMatcapMaterial({ matcap, color: hue.clone().lerp(WHITE, 0.15) }));
  const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(0.6, 0.075, 16, 72)), metal);
  const face = new THREE.Mesh(
    keep(new THREE.CircleGeometry(0.56, 48)),
    keep(new THREE.MeshBasicMaterial({ color: p.night.clone().lerp(hue, 0.14), side: THREE.DoubleSide })),
  );
  const ticks = keep(new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.035, 0.1, 0.02)), keep(new THREE.MeshBasicMaterial({ color: hue })), 12));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    q.setFromAxisAngle(z, -a);
    m.compose(new THREE.Vector3(Math.sin(a) * 0.46, Math.cos(a) * 0.46, 0.015), q, new THREE.Vector3(1, i % 3 === 0 ? 1.5 : 1, 1));
    ticks.setMatrixAt(i, m);
  }
  const hand = (width: number, length: number, depth: number, color: THREE.Color) => {
    const g = keep(new THREE.BoxGeometry(width, length, 0.02));
    g.translate(0, length / 2 - 0.05, 0);
    const mesh = new THREE.Mesh(g, keep(new THREE.MeshBasicMaterial({ color })));
    mesh.position.z = depth;
    return mesh;
  };
  const hour = hand(0.055, 0.3, 0.03, p.text);
  const minute = hand(0.04, 0.42, 0.045, p.text);
  const second = hand(0.018, 0.47, 0.06, p.amber);
  const hub = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16)), metal);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.07;
  into.add(rim, face, ticks, hour, minute, second, hub);
  // The clock tells the visitor's real time.
  return () => {
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const min = d.getMinutes() + s / 60;
    const hr = (d.getHours() % 12) + min / 60;
    second.rotation.z = -(s / 60) * TAU;
    minute.rotation.z = -(min / 60) * TAU;
    hour.rotation.z = -(hr / 12) * TAU;
  };
}

const MOON_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vNormalView;
  varying vec3 vLocal;
  void main() {
    vNormalView = normalize(normalMatrix * normal);
    vLocal = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const MOON_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uLit;
  uniform vec3 uDark;
  uniform vec3 uRim;
  uniform vec3 uSun;
  uniform float uGlow;
  varying vec3 vNormalView;
  varying vec3 vLocal;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  void main() {
    vec3 n = normalize(vNormalView);
    float lit = smoothstep(-0.06, 0.24, dot(n, normalize(uSun)));
    float maria = noise(vLocal * 3.2) * 0.6 + noise(vLocal * 7.5) * 0.4;
    vec3 surface = mix(uLit * 0.78, uLit, smoothstep(0.35, 0.75, maria));
    vec3 color = mix(uDark, surface, lit);
    float rim = pow(1.0 - max(n.z, 0.0), 2.6);
    color += uRim * rim * (0.45 + uGlow * 0.6) + surface * uGlow * 0.18;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function buildMoon(into: THREE.Group, hue: THREE.Color, keep: Keep) {
  const material = keep(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uLit: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uRim: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3(0.78, 0.38, 0.3).normalize() }, uGlow: { value: 0 },
    }]),
    vertexShader: MOON_VERT,
    fragmentShader: MOON_FRAG,
    fog: true,
  }));
  material.uniforms.uLit.value = new THREE.Color("#fff1d0").lerp(hue, 0.22);
  material.uniforms.uDark.value = hue.clone().multiplyScalar(0.06);
  material.uniforms.uRim.value = hue.clone();
  into.add(new THREE.Mesh(keep(new THREE.SphereGeometry(0.58, 48, 32)), material));
  return material;
}

function buildCoin(into: THREE.Group, hue: THREE.Color, keep: Keep, matcap: THREE.Texture) {
  const face = keep(coinFaceTexture(`#${hue.getHexString(THREE.SRGBColorSpace)}`));
  face.anisotropy = 4;
  const cap = keep(new THREE.MeshMatcapMaterial({ matcap, map: face, color: WHITE.clone().multiplyScalar(1.25) }));
  const edge = keep(new THREE.MeshMatcapMaterial({ matcap, color: hue }));
  const coin = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.62, 0.62, 0.13, 72, 1)), [edge, cap, cap]);
  coin.rotation.x = Math.PI / 2;
  into.add(coin);
}

function buildNext(into: THREE.Group, hue: THREE.Color, keep: Keep) {
  const shell = keep(new THREE.IcosahedronGeometry(0.55, 0));
  const lines = new THREE.LineSegments(
    keep(new THREE.EdgesGeometry(shell)),
    keep(new THREE.LineDashedMaterial({ color: hue, dashSize: 0.09, gapSize: 0.07, transparent: true, opacity: 0.9 })),
  );
  lines.computeLineDistances();
  const seed = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.15, 0)), keep(new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.75 })));
  into.add(lines, seed);
}

function buildOrb(into: THREE.Group, hue: THREE.Color, keep: Keep, matcap: THREE.Texture) {
  into.add(new THREE.Mesh(keep(new THREE.SphereGeometry(0.5, 32, 20)), keep(new THREE.MeshMatcapMaterial({ matcap, color: hue }))));
}

export function buildTool(
  id: string, index: number, hue: THREE.Color, p: Palette, keep: Keep, glowMap: THREE.Texture, matcap: THREE.Texture,
  proxyGeometry: THREE.BufferGeometry, proxyMaterial: THREE.Material,
): ToolNode {
  const spec = ORBITS[id] ?? { radius: 7.8 + 1.8 * (index - 4), angle: index * 1.3 };
  const anchor = new THREE.Group();
  const body = new THREE.Group();
  const spinner = new THREE.Group();
  anchor.add(body);
  body.add(spinner);

  let tick: (() => void) | undefined;
  let moon: THREE.ShaderMaterial | undefined;
  if (id === "tasks") buildTasks(spinner, hue, keep, matcap);
  else if (id === "time") tick = buildTime(spinner, hue, p, keep, matcap);
  else if (id === "panchang") moon = buildMoon(spinner, hue, keep);
  else if (id === "finance") buildCoin(spinner, hue, keep, matcap);
  else if (id === "next") buildNext(spinner, hue, keep);
  else buildOrb(spinner, hue, keep, matcap);

  const glowSpriteObj = glowSprite(keep, glowMap, hue, 0.3, 2.9);
  body.add(glowSpriteObj);

  // A pin dropped to the map floor, and the spot where it lands.
  const pin = keep(new THREE.LineDashedMaterial({ color: hue, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.35, depthWrite: false }));
  const pinLine = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.75, 0), new THREE.Vector3(0, FLOOR_Y, 0)])), pin);
  pinLine.computeLineDistances();
  const mark = keep(new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  const spot = new THREE.Mesh(keep(new THREE.RingGeometry(0.26, 0.32, 40)), mark);
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = FLOOR_Y + 0.02;
  anchor.add(pinLine, spot);

  const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
  proxy.userData.toolId = id;
  body.add(proxy);

  const node: ToolNode = {
    id, radius: spec.radius, speed: 0.18 / spec.radius, angle: spec.angle, phase: index * 1.7,
    sway: id === "next" ? 0 : id === "finance" ? 0.55 : 0.42, tumble: id === "next",
    anchor, body, spinner, glow: glowSpriteObj.material, pin, mark, proxy, focus: 0, tick,
  };
  if (moon) {
    const uniforms = moon.uniforms;
    const base = node.tick;
    node.tick = () => { base?.(); uniforms.uGlow.value = node.focus; };
  }
  return node;
}

/* ------------------------------------------------------------------ orbits and the map */

export function orbitLine(keep: Keep, radius: number, color: THREE.Color, opacity: number, dashed: boolean) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 192; i++) {
    const a = (i / 192) * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geometry = keep(new THREE.BufferGeometry().setFromPoints(pts));
  const material = dashed
    ? keep(new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.32, gapSize: 0.28, depthWrite: false }))
    : keep(new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  return { line, material };
}

const FLOOR_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uCell;
  varying vec3 vWorld;
  float grid(vec2 p) {
    vec2 g = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), vec2(1e-4));
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    vec2 p = vWorld.xz + uCell * 2.5; // keep the major lines from crossing right under the mark
    float minor = grid(p / uCell);
    float major = grid(p / (uCell * 5.0));
    float fade = 1.0 - smoothstep(10.0, 46.0, length(vWorld.xz));
    fade *= 1.0 - smoothstep(26.0, 72.0, distance(cameraPosition, vWorld));
    float a = (minor * 0.16 + major * 0.34) * fade * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The map floor: a fine grid that fades with distance, so the world reads as a place you travel over. */
export function buildFloor(keep: Keep, color: THREE.Color) {
  const geometry = keep(new THREE.PlaneGeometry(220, 220));
  geometry.rotateX(-Math.PI / 2);
  const material = keep(new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uOpacity: { value: 1 }, uCell: { value: 1.6 } },
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = FLOOR_Y;
  mesh.renderOrder = -1;
  return { mesh, material };
}

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkle;
  uniform float uScale;
  uniform float uWarp;
  uniform float uDrift;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    // Near dust drifts on slow, independent loops, so the space in front of the camera feels inhabited.
    p += uDrift * vec3(sin(uTime * 0.21 + aPhase * 31.0), cos(uTime * 0.17 + aPhase * 17.0), sin(uTime * 0.13 + aPhase * 23.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = 1.0 - uTwinkle * 0.5 * (0.5 + 0.5 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0));
    // Fast scrolling swells and brightens every point: the sense of speed between scenes.
    vAlpha *= 1.0 + uWarp * 1.4;
    gl_PointSize = min(14.0, aSize * uPixelRatio * (uScale / -mv.z) * (1.0 + uWarp * 0.9));
  }
`;

const STAR_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vColor, a * a * vAlpha * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export type StarField = { near: number; far: number; size: number; scale: number; drift: number };
const SKY_STARS: StarField = { near: 40, far: 160, size: 1.1, scale: 110, drift: 0 };

export function buildStars(keep: Keep, p: Palette, count: number, rand: () => number, field: StarField = SKY_STARS) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const tints = [p.text, p.text, p.text, p.blue, p.violet, p.cyan];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * TAU;
    const s = Math.sqrt(1 - u * u);
    const r = field.near + Math.pow(rand(), 0.7) * (field.far - field.near);
    positions[i * 3] = s * Math.cos(th) * r;
    positions[i * 3 + 1] = u * r * 0.7 + 4;
    positions[i * 3 + 2] = s * Math.sin(th) * r;
    sizes[i] = field.size * (1 + Math.pow(rand(), 4) * 3.1);
    phases[i] = rand();
    c.copy(tints[Math.floor(rand() * tints.length)]).lerp(p.text, 0.45);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  const geometry = keep(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  const material = keep(new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPixelRatio: { value: 1 }, uTwinkle: { value: 1 }, uOpacity: { value: 1 },
      uScale: { value: field.scale }, uWarp: { value: 0 }, uDrift: { value: field.drift },
    },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  return { points: new THREE.Points(geometry, material), material };
}

/* ------------------------------------------------------------------ the sky */

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w * 0.9999; // at the far plane, behind everything
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uNight;
  uniform vec3 uDeep;
  uniform vec3 uBlue;
  uniform vec3 uViolet;
  uniform vec3 uCyan;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uHue;
  varying vec3 vDir;
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
  void main() {
    vec3 d = normalize(vDir);
    vec3 q = d * 2.2 + vec3(uTime * 0.006, 0.0, uTime * 0.004);
    float warp = fbm(q + fbm(q * 1.7) * 1.3);
    float clouds = smoothstep(0.42, 0.9, warp);
    float wisps = smoothstep(0.55, 0.95, fbm(q * 3.1 - 4.0));
    // Base: the night overhead, a deeper indigo towards the horizon band.
    float band = exp(-pow(d.y * 2.4 - 0.15, 2.0));
    vec3 color = mix(uNight, uDeep, band * 0.85);
    // Two nebula families that trade places as the scenes go by (uHue).
    vec3 nebA = mix(uBlue, uViolet, smoothstep(0.3, 0.8, noise(d * 3.0 + 2.0)));
    vec3 nebB = mix(uViolet, uCyan, smoothstep(0.3, 0.8, noise(d * 2.5 - 5.0)));
    vec3 neb = mix(nebA, nebB, uHue);
    color += neb * clouds * 0.22 * uIntensity;
    color += mix(uCyan, uBlue, 0.5) * wisps * clouds * 0.12 * uIntensity;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * The night sky as a slowly drifting nebula on a dome around the camera, drawn first and at the far plane.
 * It replaces the CSS gradient once the world runs (the canvas is opaque so bloom can glow over empty space).
 */
export function buildSky(keep: Keep, p: Palette) {
  const material = keep(new THREE.ShaderMaterial({
    uniforms: {
      uNight: { value: p.night.clone() },
      uDeep: { value: new THREE.Color("#0b0f2e") },
      uBlue: { value: p.blue.clone() },
      uViolet: { value: p.violet.clone() },
      uCyan: { value: p.cyan.clone() },
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uHue: { value: 0 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  }));
  const mesh = new THREE.Mesh(keep(new THREE.SphereGeometry(300, 48, 24)), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, material };
}
