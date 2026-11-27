import * as THREE from "three";
import { closestPoint, pointAt, surfaceY, type Track } from "@derrape/shared";
import { PALETTE, sharedBoneToon, toonMaterial } from "./materials";

// Props de la Laguna de las Ánimas: árboles retorcidos (3 modelos), farolillos con halo y vallas de hueso.
// Todo instanciado o fusionado: cada familia es una llamada de dibujo. Sin luces reales ni sombras.

const { hueso: HUESO, huesoSombra: HUESO_SOMBRA, noche: NOCHE, sombra: SOMBRA, anima: ANIMA, animaProfunda: ANIMA_PROF } = PALETTE;
const LLAMA = PALETTE.llama;
const BRASA = PALETTE.brasa;

type Parts = THREE.BufferGeometry[];

function paint(geo: THREE.BufferGeometry, color: number) {
  const n = geo.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );

/** Pieza con color por vértice, normales suaves y ya colocada. */
function piece(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color: number) {
  if (!geo.getAttribute("normal")) geo.computeVertexNormals();
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.applyMatrix4(matrix);
  return paint(g, color);
}

function merge(parts: Parts): THREE.BufferGeometry {
  let count = 0;
  for (const g of parts) count += g.getAttribute("position").count;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.getAttribute("position").array as Float32Array, o * 3);
    col.set(g.getAttribute("color").array as Float32Array, o * 3);
    nor.set(g.getAttribute("normal").array as Float32Array, o * 3);
    o += g.getAttribute("position").count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return geo;
}

/** Tronco curvo: cápsulas encadenadas siguiendo una poligonal. */
function trunk(points: [number, number, number][], radius: number, color: number, parts: Parts) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]!);
    const b = new THREE.Vector3(...points[i + 1]!);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const r = radius * (1 - (i / points.length) * 0.45);
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    parts.push(piece(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 1.2), 1, 4), m, color));
  }
}

/** Copa de nube: grupo de esferas achatadas, dos tonos de Ánima. */
function crown(blobs: [number, number, number, number][], parts: Parts) {
  blobs.forEach(([x, y, z, r], i) => {
    parts.push(piece(new THREE.SphereGeometry(r, 6, 4), M(x, y, z, 0, 0, 0, 1, 0.82, 1), i % 2 === 0 ? ANIMA : ANIMA_PROF));
  });
}

/** Tres árboles retorcidos. Origen en la base del tronco. ~300-450 triángulos cada uno. */
export function treeGeometries(): THREE.BufferGeometry[] {
  const a: Parts = [];
  trunk(
    [
      [0, 0, 0],
      [0.5, 2.2, 0.1],
      [-0.4, 4.4, -0.2],
      [0.6, 6.4, 0.2],
    ],
    0.5,
    NOCHE,
    a,
  );
  trunk(
    [
      [0.2, 3.6, 0],
      [2.2, 5.2, 0.6],
    ],
    0.26,
    SOMBRA,
    a,
  );
  crown(
    [
      [0.6, 8.2, 0.2, 2.6],
      [-1.9, 7.0, 0.4, 1.9],
      [2.9, 7.0, 0.3, 1.9],
      [0.8, 9.5, -1.1, 1.8],
      [3.1, 6.0, 0.8, 1.2],
    ],
    a,
  );

  const b: Parts = [];
  trunk(
    [
      [0, 0, 0],
      [-0.5, 1.8, 0],
      [0.3, 3.4, 0.3],
      [-0.2, 4.8, 0],
    ],
    0.34,
    SOMBRA,
    b,
  );
  crown(
    [
      [-0.2, 6.0, 0, 2.0],
      [1.6, 5.4, 0.3, 1.4],
      [-1.8, 5.4, -0.2, 1.4],
      [0, 7.2, -0.4, 1.3],
    ],
    b,
  );

  const c: Parts = [];
  trunk(
    [
      [0, 0, 0],
      [0.3, 1.2, 0],
      [-0.2, 2.2, 0],
    ],
    0.3,
    NOCHE,
    c,
  );
  crown(
    [
      [-0.2, 3.5, 0, 1.9],
      [1.6, 3.1, 0.4, 1.3],
      [-1.9, 3.0, -0.2, 1.2],
    ],
    c,
  );
  return [merge(a), merge(b), merge(c)];
}

/** Poste de valla: fémur rematado en calavera. Origen en el pie. ~90 triángulos. */
export function skullPostGeometry(): THREE.BufferGeometry {
  const p: Parts = [];
  p.push(piece(new THREE.CapsuleGeometry(0.12, 0.6, 1, 4), M(0, 0.42, 0), HUESO));
  p.push(piece(new THREE.SphereGeometry(0.27, 6, 4), M(0, 1.0, 0, 0, 0, 0, 1, 0.95, 1.05), HUESO));
  p.push(piece(new THREE.SphereGeometry(0.15, 4, 2), M(0, 0.8, 0.05, 0, 0, 0, 1.15, 0.6, 1), HUESO_SOMBRA));
  for (const s of [-1, 1]) p.push(piece(new THREE.SphereGeometry(0.1, 5, 3), M(s * 0.1, 1.04, 0.2, 0, 0, 0, 1, 1.25, 0.55), NOCHE));
  // Dientes: tres bloques bajo la nariz.
  for (let i = -1; i <= 1; i++) p.push(piece(new THREE.BoxGeometry(0.06, 0.07, 0.05), M(i * 0.075, 0.86, 0.22), HUESO));
  return merge(p);
}

/** Dónde queda el borde exterior de una curva: lado de la calzada (1 = izquierda, -1 = derecha) o 0 si no hay curva. */
export function outerSide(bank: number, kappa: number): number {
  if (Math.abs(bank) >= 8) return bank > 0 ? -1 : 1;
  if (Math.abs(kappa) > 1 / 130) return kappa > 0 ? -1 : 1;
  return 0;
}

function headingKappa(track: Track, d: number) {
  let dh = pointAt(track, d + 4).heading - pointAt(track, d - 4).heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  return dh / 8;
}

/** Los postes se ven grandes (como en la referencia): cráneo ~0,5 m con cuencas y dientes legibles a 1×. */
const POST_SCALE = 1.7;

export interface FenceResult {
  posts: THREE.InstancedMesh;
  rope: THREE.Mesh;
  count: number;
  /** Tramos con valla (distancia inicial y final, m). */
  ranges: [number, number][];
}

/**
 * Vallas de hueso en el borde exterior de las curvas: un poste cada ~3,4 m unidos por cuerda.
 * El tramo se corta donde la pista deja de curvar.
 */
export function createFences(track: Track, spacing = 3.4, maxPosts = 150): FenceResult {
  const edgeLat = (w: number) => w / 2 + track.verge + 0.1;
  type Post = { x: number; y: number; z: number; run: number; score: number; d: number };
  const all: Post[] = [];
  let run = 0;
  let prevSide = 0;
  for (let d = 0; d < track.length; d += spacing) {
    const p = pointAt(track, d);
    const kappa = headingKappa(track, d);
    const side = outerSide(p.bank, kappa);
    if (side === 0) {
      prevSide = 0;
      continue;
    }
    if (side !== prevSide) run++;
    prevSide = side;
    const e = pointAt(track, d, side * edgeLat(p.width));
    const score = Math.abs(p.bank) / 30 + Math.abs(kappa) * 40;
    all.push({ x: e.x, y: surfaceY({ y: e.y, lateral: side * edgeLat(p.width), bank: p.bank }) - 0.05, z: e.z, run, score, d });
  }
  // Presupuesto: nos quedamos con los tramos más curvados (puntuación media por tramo × longitud) hasta `maxPosts`.
  const byRun = new Map<number, Post[]>();
  for (const q of all) byRun.set(q.run, [...(byRun.get(q.run) ?? []), q]);
  const ranked = [...byRun.entries()].sort((a, b) => {
    const mean = (l: Post[]) => l.reduce((t, q) => t + q.score, 0) / l.length;
    return mean(b[1]) * Math.sqrt(b[1].length) - mean(a[1]) * Math.sqrt(a[1].length);
  });
  const keep = new Set<number>();
  let total = 0;
  for (const [id, list] of ranked) {
    if (total + list.length > maxPosts) continue;
    keep.add(id);
    total += list.length;
  }
  const placed = all.filter((q) => keep.has(q.run));
  const posts = new THREE.InstancedMesh(skullPostGeometry(), sharedBoneToon(), Math.max(1, placed.length));
  const m = new THREE.Matrix4();
  placed.forEach((q, i) => posts.setMatrixAt(i, m.compose(new THREE.Vector3(q.x, q.y, q.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7), new THREE.Vector3(POST_SCALE, POST_SCALE, POST_SCALE))));
  posts.count = placed.length;
  posts.frustumCulled = false;
  posts.name = "vallas-hueso";

  // Cuerda: prisma fino entre postes consecutivos del mismo tramo, un poco caída en el centro.
  const pos: number[] = [];
  const col: number[] = [];
  const nor: number[] = [];
  const c = new THREE.Color(HUESO_SOMBRA);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    for (const v of [a, b, d]) {
      pos.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
      nor.push(n.x, n.y, n.z);
    }
  };
  for (let i = 0; i < placed.length - 1; i++) {
    const a = placed[i]!;
    const b = placed[i + 1]!;
    if (a.run !== b.run) continue;
    const mid = (a.y + b.y) / 2 + 0.52 * POST_SCALE;
    const pa = new THREE.Vector3(a.x, a.y + 0.62 * POST_SCALE, a.z);
    const pb = new THREE.Vector3(b.x, b.y + 0.62 * POST_SCALE, b.z);
    const pm = new THREE.Vector3((a.x + b.x) / 2, mid, (a.z + b.z) / 2);
    const r = 0.06;
    // Dos prismas (a→m, m→b), sección triangular.
    for (const [s, e] of [[pa, pm], [pm, pb]] as const) {
      const up = new THREE.Vector3(0, r, 0);
      const side = new THREE.Vector3().subVectors(e, s).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(r);
      const s0 = s.clone().add(up);
      const s1 = s.clone().add(side).sub(up);
      const s2 = s.clone().sub(side).sub(up);
      const e0 = e.clone().add(up);
      const e1 = e.clone().add(side).sub(up);
      const e2 = e.clone().sub(side).sub(up);
      tri(s0, s1, e1);
      tri(s0, e1, e0);
      tri(s0, e0, e2);
      tri(s0, e2, s2);
      tri(s1, s2, e2);
      tri(s1, e2, e1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  const rope = new THREE.Mesh(geo, sharedBoneToon());
  rope.frustumCulled = false;
  rope.name = "cuerda-vallas";
  const ranges: [number, number][] = [];
  for (const id of keep) {
    const l = byRun.get(id)!;
    ranges.push([Math.round(l[0]!.d), Math.round(l[l.length - 1]!.d)]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return { posts, rope, count: placed.length, ranges };
}

/** Grupo de árboles instanciados: una malla por modelo. `height` da el suelo en cada punto. */
export function createTrees(track: Track, height: (x: number, z: number) => number, lagoonClear: (x: number, z: number) => boolean, target = 66): THREE.InstancedMesh[] {
  const geos = treeGeometries();
  const mat = toonMaterial({ vertexColors: true });
  const slots: { x: number; y: number; z: number; model: number; s: number; rot: number }[] = [];
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const stride = track.length / (target * 0.62);
  let k = 0;
  for (let d = 6; d < track.length; d += stride) {
    // Un árbol cerca del borde (lados alternos) y, cada tres, otro al otro lado: así los dos laterales del encuadre tienen árboles.
    const sides = k % 3 === 2 ? [1, -1] : [k % 2 === 0 ? 1 : -1];
    for (const side of sides) {
      const jitter = (rnd() - 0.5) * stride * 0.5;
      const p = pointAt(track, (d + jitter + track.length) % track.length);
      const lat = side * (p.width / 2 + track.verge + 4 + rnd() * 16);
      const at = pointAt(track, (d + jitter + track.length) % track.length, lat);
      const c = closestPoint(track, at.x, at.z);
      if (Math.abs(c.lateral) < c.width / 2 + track.verge + 2.5) continue;
      if (!lagoonClear(at.x, at.z)) continue;
      slots.push({ x: at.x, y: height(at.x, at.z) - 0.15, z: at.z, model: Math.floor(rnd() * 3), s: 0.85 + rnd() * 0.55, rot: rnd() * Math.PI * 2 });
    }
    k++;
  }
  // Relleno de la salida: la parrilla está unos 9 m sobre el terreno, así que los árboles van pegados al arcén
  // (a 3–8 m del borde, grandes, con la copa por encima de la calzada) y a los dos lados, para que los laterales del primer encuadre no queden vacíos.
  for (let i = 0; i < 22; i++) {
    const d = 4 + i * 5.5;
    const side = i % 2 === 0 ? 1 : -1;
    const p = pointAt(track, d);
    const at = pointAt(track, d + (rnd() - 0.5) * 3, side * (p.width / 2 + track.verge + 3.2 + rnd() * 4.5));
    if (!lagoonClear(at.x, at.z)) continue;
    slots.push({ x: at.x, y: height(at.x, at.z) - 0.15, z: at.z, model: i % 3, s: 1.5 + rnd() * 0.5, rot: rnd() * Math.PI * 2 });
  }
  // Tres árboles grandes solo a la derecha de la recta de salida (lateral negativo): enmarcan el borde como en ejemplo1 sin tapar
  // el campanario ni los farolillos de la izquierda. Las copas asoman sobre la calzada elevada.
  for (const [d, extra, model] of [[22, 6, 0], [46, 9, 1], [74, 7, 2]] as const) {
    const p = pointAt(track, d);
    const at = pointAt(track, d, -(p.width / 2 + track.verge + extra));
    if (!lagoonClear(at.x, at.z)) continue;
    slots.push({ x: at.x, y: height(at.x, at.z) - 0.15, z: at.z, model, s: 3.2, rot: d });
  }
  // Y uno a la izquierda, bien abierto y más cerca de la cámara: su copa queda en la esquina superior izquierda, sobre los farolillos.
  {
    const p = pointAt(track, 30);
    const at = pointAt(track, 30, p.width / 2 + track.verge + 14);
    if (lagoonClear(at.x, at.z)) slots.push({ x: at.x, y: height(at.x, at.z) - 0.15, z: at.z, model: 1, s: 3.4, rot: 2 });
  }
  const out: THREE.InstancedMesh[] = [];
  const m = new THREE.Matrix4();
  geos.forEach((geo, model) => {
    const mine = slots.filter((s) => s.model === model);
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, mine.length));
    mine.forEach((s, i) =>
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot), new THREE.Vector3(s.s, s.s, s.s))),
    );
    mesh.count = mine.length;
    mesh.frustumCulled = false;
    mesh.name = `arboles-${model + 1}`;
    out.push(mesh);
  });
  return out;
}

/** Roca pequeña de 20 caras con los vértices movidos (mismo desplazamiento en cada copia de un vértice): Niebla arriba, Sombra en los flancos. */
function rockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const pos = geo.getAttribute("position");
  const top = new THREE.Color(PALETTE.niebla);
  const side = new THREE.Color(SOMBRA);
  const col = new Float32Array(pos.count * 3);
  const jit = (x: number, y: number, z: number, k: number) => {
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + k * 11.13) * 43758.5453;
    return h - Math.floor(h) - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 1 + jit(x, y, z, 1) * 0.55;
    pos.setXYZ(i, x * k, y * k * 0.62, z * k);
    const c = side.clone().lerp(top, THREE.MathUtils.clamp(0.5 + y * 0.9, 0, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Rocas pequeñas (0,3–1,3 m) en las laderas junto a la pista: una sola malla instanciada, en grupos de 1 a 3.
 * Rompen las zonas planas del terreno a los lados del encuadre sin acercarse al arcén.
 */
export function createRocks(track: Track, height: (x: number, z: number) => number, lagoonClear: (x: number, z: number) => boolean, groups = 110): THREE.InstancedMesh {
  const slots: { x: number; y: number; z: number; s: number; sy: number; rot: number }[] = [];
  let seed = 9173;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const stride = track.length / groups;
  for (let g = 0; g < groups; g++) {
    const d = (g * stride + rnd() * stride * 0.8) % track.length;
    const side = g % 2 === 0 ? 1 : -1;
    const p = pointAt(track, d);
    const lat = side * (p.width / 2 + track.verge + 1.8 + rnd() * 9);
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const at = pointAt(track, d + (rnd() - 0.5) * 4, lat + (rnd() - 0.5) * 2.4);
      const c = closestPoint(track, at.x, at.z);
      if (Math.abs(c.lateral) < c.width / 2 + track.verge + 1.2) continue;
      if (!lagoonClear(at.x, at.z)) continue;
      const s = 0.3 + rnd() * rnd() * 1.1;
      slots.push({ x: at.x, y: height(at.x, at.z) - s * 0.1, z: at.z, s, sy: 0.7 + rnd() * 0.7, rot: rnd() * Math.PI * 2 });
    }
  }
  const mesh = new THREE.InstancedMesh(rockGeometry(), toonMaterial({ vertexColors: true }), Math.max(1, slots.length));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  slots.forEach((r, i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(r.x, r.y, r.z), q.setFromAxisAngle(up, r.rot), new THREE.Vector3(r.s, r.s * r.sy, r.s))));
  mesh.count = slots.length;
  mesh.frustumCulled = false;
  mesh.name = "rocas";
  return mesh;
}

const FLY_VERT = /* glsl */ `
attribute float aPhase;
uniform float uTime;
varying float vTw;
void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.9 + aPhase * 6.283) * 0.8;
  p.x += sin(uTime * 0.5 + aPhase * 17.0) * 1.2;
  p.z += cos(uTime * 0.45 + aPhase * 11.0) * 1.2;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vTw = 0.55 + 0.45 * sin(uTime * 2.2 + aPhase * 40.0);
  gl_PointSize = clamp(620.0 / max(-mv.z, 1.0), 3.0, 26.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FLY_FRAG = /* glsl */ `
varying float vTw;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float k = clamp(1.0 - d, 0.0, 1.0);
  gl_FragColor = vec4(mix(vec3(0.247, 0.949, 0.784), vec3(0.95, 1.0, 0.9), k * k), (k * k * 0.9 + pow(k, 3.0)) * vTw);
}
`;

/**
 * Luciérnagas Espectro (#3FF2C8) sobre la laguna y el cauce: unos 200 puntos aditivos en una sola llamada, sin triángulos.
 * Suben y bajan ±0,8 m y parpadean; dan vida al agua lejana sin tocar el terreno.
 */
export function createFireflies(over: { x: number; z: number; y: number; rx: number; rz: number }, rivers: { x: number; z: number; half: number; lift: number }[][], count = 200): THREE.Points {
  let seed = 7771;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.8;
      pos.set([over.x + Math.cos(a) * over.rx * r, over.y + 1.5 + rnd() * 3.5, over.z + Math.sin(a) * over.rz * r], i * 3);
    } else {
      const river = rivers[i % rivers.length]!;
      const q = river[Math.floor(rnd() * river.length)]!;
      pos.set([q.x + (rnd() - 0.5) * q.half * 1.4, over.y + q.lift + 1.5 + rnd() * 4, q.z + (rnd() - 0.5) * q.half * 1.4], i * 3);
    }
    phase[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: FLY_VERT,
    fragmentShader: FLY_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  pts.name = "luciernagas";
  pts.onBeforeRender = () => {
    mat.uniforms.uTime!.value = performance.now() / 1000;
  };
  return pts;
}

const HALO_VERT = /* glsl */ `
attribute vec3 aOffset;
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 c = aOffset;
  c.y += sin(uTime * 1.7 + c.x * 0.37 + c.z * 0.21) * 0.15;
  vec4 mv = viewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * 7.4;
  gl_Position = projectionMatrix * mv;
}
`;

const HALO_FRAG = /* glsl */ `
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float k = clamp(1.0 - d, 0.0, 1.0);
  float a = (k * k * k * 0.5 + pow(k, 1.4) * 0.14);
  gl_FragColor = vec4(1.0, 0.416, 0.122, a);
}
`;

/** Farolillo de papel: cuerpo Llama con aro Brasa y tapas de Sombra (el Hueso duro arriba y abajo parecía un plato). */
function lanternGeometry() {
  const p: Parts = [];
  p.push(piece(new THREE.SphereGeometry(0.34, 6, 4), M(0, 0, 0, 0, 0, 0, 1, 1.2, 1), LLAMA));
  p.push(piece(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 5), M(0, 0.44, 0), SOMBRA));
  p.push(piece(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 5), M(0, -0.44, 0), SOMBRA));
  p.push(piece(new THREE.TorusGeometry(0.31, 0.04, 3, 6), M(0, 0.0, 0, Math.PI / 2), BRASA));
  // Borla colgando bajo el farolillo (ejemplo1): hilo de Sombra y flecos de Brasa.
  p.push(piece(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 4), M(0, -0.56, 0), SOMBRA));
  p.push(piece(new THREE.ConeGeometry(0.09, 0.3, 5), M(0, -0.78, 0, Math.PI), BRASA));
  return merge(p);
}

function lanternMaterial() {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader =
      "uniform float uTime;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
#ifdef USE_INSTANCING
         float sw = sin(uTime * 1.7 + instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21);
         transformed.y += sw * 0.15;
         transformed.x += sw * position.y * 0.07;
#endif`,
      );
    mat.userData.shader = shader;
  };
  return mat;
}

export interface Lanterns {
  bodies: THREE.InstancedMesh;
  halos: THREE.Mesh;
  poles: THREE.Mesh | null;
  count: number;
}

/**
 * Farolillos: 15–30, flotando junto a la pista (oscilan ±0,15 m y ±4°), algunos colgados de postes de Sombra en las curvas.
 * Cada farolillo lleva un halo aditivo (sprite instanciado, un solo dibujo). Sin luces reales.
 */
export function createLanterns(track: Track, height: (x: number, z: number) => number, over: { x: number; z: number; y: number; rx: number; rz: number } | null, count = 30): Lanterns {
  const spots: { x: number; y: number; z: number; pole: boolean; heading: number }[] = [];
  // 10 farolillos en los primeros 140 m (se ven desde la salida) y el resto repartido por la vuelta.
  const near = 10;
  // 6 más flotan sobre la laguna, delante de la recta de salida.
  const lake = over ? 6 : 0;
  const stride = (track.length - 160) / (count - near - lake);
  for (let i = 0; i < count - lake; i++) {
    const d = i < near ? 12 + i * 15 : 160 + (i - near) * stride + stride * 0.3;
    const p = pointAt(track, d);
    const curve = outerSide(p.bank, headingKappa(track, d));
    // En las curvas, colgados de un poste en el interior; en recta, flotando a uno u otro lado.
    const side = curve !== 0 ? -curve : i % 2 === 0 ? 1 : -1;
    const lat = side * (p.width / 2 + track.verge + (curve !== 0 ? 1.2 : i < near ? 2.4 + (i % 2) * 1.2 : 3.5 + (i % 3) * 2.5));
    const at = pointAt(track, d, lat);
    const ground = Math.max(height(at.x, at.z), at.y - 1.5);
    const pole = curve !== 0;
    spots.push({ x: at.x, y: pole ? at.y + 3.6 : Math.max(ground + 2.6, at.y + 3.4) + (i % 3) * 0.6, z: at.z, pole, heading: p.heading });
  }
  if (over) {
    for (let k = 0; k < lake; k++) {
      const a = (k / lake) * Math.PI * 2 + 0.4;
      const rr = 0.35 + 0.4 * ((k * 7) % 5) / 5;
      spots.push({ x: over.x + Math.cos(a) * over.rx * rr, y: over.y + 5 + (k % 3) * 4, z: over.z + Math.sin(a) * over.rz * rr, pole: false, heading: 0 });
    }
  }
  const bodies = new THREE.InstancedMesh(lanternGeometry(), lanternMaterial(), spots.length);
  const offsets = new Float32Array(spots.length * 3);
  const m = new THREE.Matrix4();
  spots.forEach((s, i) => {
    bodies.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(i * 1.3) * 0.06), new THREE.Vector3(2.3, 2.3, 2.3)));
    offsets.set([s.x, s.y, s.z], i * 3);
  });
  bodies.count = spots.length;
  bodies.frustumCulled = false;
  bodies.name = "farolillos";
  bodies.onBeforeRender = () => {
    const shader = bodies.material.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
    if (shader) shader.uniforms.uTime.value = performance.now() / 1000;
  };

  const quad = new THREE.PlaneGeometry(1, 1);
  const halo = new THREE.InstancedBufferGeometry();
  halo.index = quad.index;
  halo.setAttribute("position", quad.getAttribute("position"));
  halo.setAttribute("uv", quad.getAttribute("uv"));
  halo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
  halo.instanceCount = spots.length;
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: HALO_VERT,
    fragmentShader: HALO_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const halos = new THREE.Mesh(halo, haloMat);
  halos.frustumCulled = false;
  halos.renderOrder = 3;
  halos.name = "halos-farolillos";
  halos.onBeforeRender = () => {
    haloMat.uniforms.uTime!.value = performance.now() / 1000;
  };

  // Postes de Sombra con brazo para los que cuelgan en las curvas.
  const polesParts: Parts = [];
  for (const s of spots) {
    if (!s.pole) continue;
    const groundY = s.y - 3.6;
    polesParts.push(piece(new THREE.CylinderGeometry(0.1, 0.14, 4.4, 5), M(s.x, groundY + 2.2 - 0.05, s.z), SOMBRA));
    polesParts.push(piece(new THREE.SphereGeometry(0.2, 5, 3), M(s.x, groundY + 4.4, s.z), SOMBRA));
  }
  const poles = polesParts.length ? new THREE.Mesh(merge(polesParts), toonMaterial({ vertexColors: true })) : null;
  if (poles) {
    poles.frustumCulled = false;
    poles.name = "postes-farolillo";
  }
  return { bodies, halos, poles, count: spots.length };
}
