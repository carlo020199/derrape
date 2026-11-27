import * as THREE from "three";
import { closestPoint, pointAt, RAMP, surfaceNormal, surfaceY, type Track, type TrackDef } from "@derrape/shared";
import { createAnimasMoon, createClouds, createHills } from "./sky";
import { PALETTE, animasTerrainMaterial, boneToonMaterial, sharedBoneToon, toonMaterial } from "./materials";
import { createFences, createLanterns, createRocks, createTrees } from "./animasProps";

// Kit de Laguna de las Ánimas. Paleta del proyecto, formas redondas y toon.
// Los faroles son una sola malla instanciada: el brillo es el color, sin luces reales.

const HUESO = PALETTE.hueso;
const BRASA = PALETTE.brasa;
const LLAMA = PALETTE.llama;
const ANIMA = PALETTE.anima;
const CIRUELA = PALETTE.ciruela;
/**
 * Suelo del plano y del terreno de Ánimas (también `themes.ts`, `track.groundY`).
 * El peralte de la curva baja deja el arcén a -10,2 m; si el suelo queda en -8,
 * el plano de 1600 m y la malla del terreno (que no baja de `groundY - 0,3`)
 * atraviesan la calzada y el kart se hunde.
 */
export const ANIMAS_GROUND_Y = -12;
const GROUND_Y = ANIMAS_GROUND_Y;

function paint(geo: THREE.BufferGeometry, color: number) {
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function bake(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, color: number) {
  const src = geo.clone();
  // Normales suaves mientras la malla aún comparte vértices. Si se calculan
  // después de separar los triángulos, cada cara queda plana y el hueso se ve gris.
  if (!src.getAttribute("normal")) src.computeVertexNormals();
  const g = src.index ? src.toNonIndexed() : src;
  g.applyMatrix4(matrix);
  return paint(g, color);
}

function merge(parts: THREE.BufferGeometry[]) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of flat) count += g.getAttribute("position").count;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of flat) {
    const p = g.getAttribute("position");
    const c = g.getAttribute("color");
    const nrm = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      pos[(o + i) * 3] = p.getX(i);
      pos[(o + i) * 3 + 1] = p.getY(i);
      pos[(o + i) * 3 + 2] = p.getZ(i);
      if (c) {
        col[(o + i) * 3] = c.getX(i);
        col[(o + i) * 3 + 1] = c.getY(i);
        col[(o + i) * 3 + 2] = c.getZ(i);
      }
      if (nrm) {
        nor[(o + i) * 3] = nrm.getX(i);
        nor[(o + i) * 3 + 1] = nrm.getY(i);
        nor[(o + i) * 3 + 2] = nrm.getZ(i);
      }
    }
    o += p.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return geo;
}

const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );

/** Campanario: una sola malla, cuerpo Sombra #2E2547 con tejado Ciruela #1E1830. La luz cálida va aparte (`campanarioLuz`). */
export function campanarioGeometry(): THREE.BufferGeometry {
  const body = new THREE.CapsuleGeometry(1.7, 11, 3, 18);
  const roof = new THREE.ConeGeometry(2.5, 4.2, 20);
  return merge([bake(body, M(0, 7.2), PALETTE.sombra), bake(roof, M(0, 14.6), CIRUELA)]);
}

/**
 * Ventanas arqueadas y campana del campanario: Llama #FFB423 emisiva, una sola malla con color por vértice.
 * Tres ventanas por piso (−60°, 0°, 60°) para que alguna mire a la cámara desde la parrilla y desde la recta.
 */
function campanarioLuz(): THREE.BufferGeometry {
  const win = new THREE.CapsuleGeometry(0.42, 1.2, 3, 10);
  const bell = new THREE.SphereGeometry(0.95, 16, 12);
  const parts = [bake(bell, M(0, 9.2, 1.85), LLAMA)];
  for (const yaw of [-Math.PI / 3, 0, Math.PI / 3]) {
    const turn = new THREE.Matrix4().makeRotationY(yaw);
    for (const [y, r, sx, sy] of [[5.6, 1.62, 1, 1], [12.2, 1.45, 0.85, 0.8]] as const) {
      parts.push(bake(win, turn.clone().multiply(M(0, y, r, 0, 0, 0, sx, sy, 0.35)), LLAMA));
    }
  }
  return merge(parts);
}

export function triangleCount(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  return pos ? pos.count / 3 : 0;
}

/**
 * Lomo apoyado en la calzada: bajo por detrás, alto en el labio (z = 0).
 * No es un disco flotante: la base está en y = 0 y el ancho cabe en la pista.
 */
function humpGeometry(len: number, lip: number, halfWidth: number, yScale = 1) {
  const radius = Math.max(0.34, lip * 0.62);
  const straight = Math.max(0.5, len * 0.62);
  const g = new THREE.CapsuleGeometry(radius, straight, 5, 14);
  g.rotateX(Math.PI / 2);
  g.translate(0, radius * 0.72, -len * 0.28);
  g.scale(halfWidth / radius, yScale, 1);
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const flat = g.index ? g.toNonIndexed() : g;
  const pos = flat.getAttribute("position");
  const bone = new THREE.Color(HUESO);
  const shade = new THREE.Color(PALETTE.huesoSombra);
  const brasa = new THREE.Color(BRASA);
  const colors = new Float32Array(pos.count * 3);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    zMin = Math.min(zMin, pos.getZ(i));
    zMax = Math.max(zMax, pos.getZ(i));
  }
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getZ(i) - zMin) / (zMax - zMin || 1);
    // Tres franjas anchas en la cara de llegada, no solo en el labio.
    const stripe = Math.floor(u * 8);
    const band = stripe % 2 === 1 && stripe <= 5 && pos.getY(i) > radius * 0.25;
    const c = band ? brasa : pos.getY(i) > radius * 0.7 ? bone : shade;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

/**
 * Mandíbula del salto L y cráneo abierto.
 * El paladar queda al menos a 4,42 + 6 m sobre la calzada: el kart no lo roza.
 */
export function jawLocalGeometry(): THREE.BufferGeometry {
  const lip = RAMP.L.lip;
  const len = RAMP.L.len;
  const jaw = humpGeometry(len, lip, 6.0);
  const parts: THREE.BufferGeometry[] = [jaw];
  const tooth = new THREE.SphereGeometry(0.46, 12, 10);
  for (const x of [-2.8, -1.4, 0, 1.4, 2.8]) {
    parts.push(bake(tooth, M(x, lip * 0.72, -0.15, 0, 0, 0, 0.8, 1.25, 0.7), HUESO));
  }
  // Mofletes pegados a la mandíbula. El arco sale de ellos y cruza por encima de la pista.
  // Columnas de hueso: salen de la mandíbula y se funden con los pies del arco.
  const leg = new THREE.CapsuleGeometry(1.55, 6.2, 5, 14);
  parts.push(bake(leg, M(-6.4, 4.4, -0.15), HUESO));
  parts.push(bake(leg, M(6.4, 4.4, -0.15), HUESO));
  const archR = 7.9;
  const tube = 1.45;
  const footY = 5.05;
  const arch = new THREE.TorusGeometry(archR, tube, 12, 28, Math.PI);
  // Los pies del arco (y local 0) quedan en los mofletes. El intradós del centro supera 10,4 m.
  parts.push(bake(arch, M(0, footY, -0.15), HUESO));
  return merge(parts);
}

/** Vértices del cráneo que caen sobre la trayectoria (no los mofletes). */
export function flightCorridorMinY(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  let min = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(x) > 3.2 || z < -1 || z > 20 || y < 4) continue;
    min = Math.min(min, y);
  }
  return min;
}

function placeOnTrack(mesh: THREE.Object3D, x: number, y: number, z: number, heading: number) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = heading;
}

function clear(track: Track, x: number, z: number, margin: number) {
  const c = closestPoint(track, x, z);
  return Math.abs(c.lateral) > c.width / 2 + track.verge + margin;
}

function stars() {
  const n = 48;
  const pos = new Float32Array(n * 3);
  let s = 1111;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < n; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = rnd() * 0.7;
    const r = 180;
    pos[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
    pos[i * 3 + 1] = 40 + Math.sin(phi) * r;
    pos[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: HUESO, size: 1.4, sizeAttenuation: false }));
  pts.name = "estrellas";
  return pts;
}

/** Brasa de fondo y chevrones Llama. El plano entero va al 55 % de opacidad. */
function chevronTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#FF6A1F";
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "rgba(255, 180, 35, 0.7)";
  for (let i = 0; i < 3; i++) {
    const y = 6 + i * 20;
    g.beginPath();
    g.moveTo(0, y + 8);
    g.lineTo(64, y);
    g.lineTo(128, y + 8);
    g.lineTo(128, y + 14);
    g.lineTo(64, y + 6);
    g.lineTo(0, y + 14);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Paneles de turbo pegados a la calzada. Antes eran cajas horizontales de casi
 * todo el ancho: en un peralte asomaban como losas amarillas.
 */
function boostMarks(track: Track) {
  // 2 m a lo ancho de la pista y 3 m a lo largo. Un solo panel por salida, en la trazada.
  const geo = new THREE.PlaneGeometry(2, 3);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: chevronTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const spots: THREE.Matrix4[] = [];
  const nrm = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  for (const z of track.zones) {
    if (z.type !== "boostPad") continue;
    const end = z.to < z.from ? z.to + track.length : z.to;
    const d = (z.from + (end - z.from) / 2) % track.length;
    const p = pointAt(track, d);
    const c = closestPoint(track, p.x, p.z);
    const n = surfaceNormal(track, c);
    nrm.set(n.x, n.y, n.z).normalize();
    fwd.set(Math.sin(p.heading), 0, Math.cos(p.heading));
    fwd.addScaledVector(nrm, -fwd.dot(nrm));
    if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, 1);
    fwd.normalize();
    right.crossVectors(fwd, nrm).normalize();
    basis.makeBasis(right, nrm, fwd);
    basis.setPosition(p.x + nrm.x * 0.02, surfaceY(c) + nrm.y * 0.02, p.z + nrm.z * 0.02);
    spots.push(basis.clone());
  }
  if (spots.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  spots.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.name = "paneles-turbo";
  return mesh;
}

/**
 * Cauce de la laguna: tira de triángulos con ancho variable a lo largo de una curva Catmull-Rom,
 * más un óvalo bajo el salto. `aCentre` vale 1 en el eje y 0 en la orilla (color y espuma).
 * Las posiciones están en mundo (x, z); el mesh solo pone la altura.
 */
const FAR_LIFT = 22;

export interface LagoonShape {
  mid: { x: number; z: number };
  rx: number;
  rz: number;
  /** Ejes de cauce con su semiancho: del óvalo al campanario y el río lejano que cruza el valle de cara a la salida. */
  rivers: { x: number; z: number; half: number; lift: number }[][];
}

export function lagoonShape(mid: { x: number; z: number }, end: { x: number; z: number }): LagoonShape {
  const rx = 78;
  const rz = 38;
  const dx = end.x - mid.x;
  const dz = end.z - mid.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const curve = new THREE.CatmullRomCurve3(
    [0, 0.14, 0.3, 0.46, 0.62, 0.78, 0.92].map((t, i) => {
      const off = [0, 8, -9, 8, -6, 4, 0][i]!;
      return new THREE.Vector3(mid.x + dx * t + nx * off, 0, mid.z + dz * t + nz * off);
    }),
  );
  const steps = 44;
  const river: LagoonShape["rivers"][number] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    curve.getPoint(t, p);
    const half = (13 + 4 * Math.sin(t * 9) + 3 * Math.sin(t * 17)) * (1 - 0.3 * t) * Math.min(1, 0.4 + t * 6);
    river.push({ x: p.x, z: p.z, half, lift: 0 });
  }
  // Río lejano: cruza el valle por detrás del gancho de la pista, justo en la línea de mirada desde la
  // salida, y entra en el óvalo por debajo de la calzada (el talud lo tapa).
  const far = new THREE.CatmullRomCurve3(
    [
      [-300, 440, 45],
      [-170, 400, 50],
      [-60, 382, 56],
      [40, 376, 52],
      [60, 300, 36],
      [mid.x + 6, 250, 24],
      [mid.x, mid.z + rz * 0.6, 14],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  );
  const halfs = [60, 68, 76, 70, 44, 26, 14];
  const arm: LagoonShape["rivers"][number] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    far.getPoint(t, p);
    const f = t * (halfs.length - 1);
    const k = Math.min(halfs.length - 2, Math.floor(f));
    // El río lejano queda más alto que la laguna para que asome por encima del final de la pista vista desde la salida.
    arm.push({ x: p.x, z: p.z, half: halfs[k]! + (halfs[k + 1]! - halfs[k]!) * (f - k), lift: FAR_LIFT * (1 - THREE.MathUtils.smoothstep(t, 0.6, 1)) });
  }
  return { mid, rx, rz, rivers: [river, arm] };
}

/** Distancia aproximada a la orilla (negativa dentro del agua), para excavar el terreno. */
export function lagoonDistance(shape: LagoonShape, x: number, z: number): { d: number; lift: number } {
  const ex = (x - shape.mid.x) / shape.rx;
  const ez = (z - shape.mid.z) / shape.rz;
  let d = (Math.hypot(ex, ez) - 1) * Math.min(shape.rx, shape.rz);
  let lift = 0;
  for (const river of shape.rivers) {
    for (const r of river) {
      const e = Math.hypot(x - r.x, z - r.z) - r.half;
      if (e < d) {
        d = e;
        lift = r.lift;
      }
    }
  }
  return { d, lift };
}

/**
 * Cauce de la laguna: tira de triángulos con ancho variable más un óvalo.
 * `aCentre` vale 1 en el eje y 0 en la orilla (color y espuma). Posiciones en mundo (x, z).
 */
export function lagoonGeometry(shape: LagoonShape): THREE.BufferGeometry {
  const pos: number[] = [];
  const cen: number[] = [];
  const idx: number[] = [];
  const { mid, rx, rz, rivers } = shape;
  pos.push(mid.x, 0, mid.z);
  cen.push(1);
  const seg = 32;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const k = 1 + 0.08 * Math.sin(a * 3);
    pos.push(mid.x + Math.cos(a) * rx * k, 0, mid.z + Math.sin(a) * rz * k);
    cen.push(0);
    idx.push(0, 1 + i, 1 + ((i + 1) % seg));
  }
  for (const river of rivers) {
    const base = pos.length / 3;
    for (let i = 0; i < river.length; i++) {
      const c = river[i]!;
      const a = river[Math.max(0, i - 1)]!;
      const b = river[Math.min(river.length - 1, i + 1)]!;
      const tl = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const lx = -(b.z - a.z) / tl;
      const lz = (b.x - a.x) / tl;
      pos.push(c.x + lx * c.half, c.lift, c.z + lz * c.half, c.x, c.lift, c.z, c.x - lx * c.half, c.lift, c.z - lz * c.half);
      cen.push(0, 1, 0);
      if (i < river.length - 1) {
        const o = base + i * 3;
        idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("aCentre", new THREE.BufferAttribute(new Float32Array(cen), 1));
  geo.setIndex(idx);
  return geo;
}

function vhash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, z: number) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = vhash(ix, iz);
  const b = vhash(ix + 1, iz);
  const c = vhash(ix, iz + 1);
  const d = vhash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Altura del terreno en (x, z). Abraza la calzada: junto al borde queda por debajo (1 m, suficiente
 * para que la malla de 7,6 m no atraviese el peralte al interpolar) y baja con pendiente suave
 * hacia el valle, así no hay un talud negro de 40 m a los lados. Lejos de todo camino se suman
 * colinas de ruido. Nunca sube por encima de otro tramo de pista cercano (pasos a distinto nivel)
 * y deja la cuenca de la laguna excavada.
 */
export function terrainHeightField(track: Track, shape: LagoonShape, waterY: number, groundY: number, hill?: { x: number; z: number; top: number }) {
  const samples: { x: number; z: number; y: number; r: number; d: number }[] = [];
  for (let i = 0; i < track.points.length; i += 3) {
    const p = track.points[i]!;
    samples.push({ x: p.x, z: p.z, y: p.y, r: p.w / 2 + track.verge, d: track.lengths[i]! });
  }
  return (x: number, z: number) => {
    const c = closestPoint(track, x, z);
    const edge = c.width / 2 + track.verge;
    const lat = THREE.MathUtils.clamp(c.lateral, -edge, edge);
    let out = Math.max(0, Math.abs(c.lateral) - edge);
    const roadY = surfaceY({ y: c.y, lateral: lat, bank: c.bank });
    let h = roadY - 1.0 - out * 0.42;
    // Otros tramos de pista (por debajo o por encima): el terreno no los tapa ni los deja flotando.
    for (const q of samples) {
      let sep = Math.abs(q.d - c.distance);
      sep = Math.min(sep, track.length - sep);
      if (sep < 70) continue;
      const dd = Math.max(0, Math.hypot(x - q.x, z - q.z) - q.r);
      if (dd > 60) continue;
      h = Math.min(h, q.y - 4.5 + dd * 0.45);
      out = Math.min(out, dd);
    }
    const amp = 4 + 11 * vnoise(x * 0.012 + 3, z * 0.012);
    const bumps = vnoise(x * 0.045, z * 0.045) * 0.65 + vnoise(x * 0.11, z * 0.11) * 0.35;
    h += amp * bumps * THREE.MathUtils.smoothstep(out, 8, 42);
    const { d, lift } = lagoonDistance(shape, x, z);
    h = Math.min(h, waterY + lift - 1.2 + Math.max(0, d) * 0.45);
    // Isla-colina del campanario, al final del río: el agua la rodea.
    if (hill) {
      const hd = Math.hypot(x - hill.x, z - hill.z);
      if (hd < 40) h = Math.max(h, hill.top - Math.max(0, hd - 7) * 0.6);
    }
    // El piso nunca puede quedar por encima de la calzada cercana (el peralte la baja más que groundY).
    return Math.max(h, Math.min(groundY - 0.3, roadY - 1.0));
  };
}

/**
 * Terreno de hierba toon morada a los lados de la pista: rejilla con la altura de `terrainHeightField`,
 * partida en 5×5 trozos para que el frustum culling descarte lo que no se ve (cada trozo, una llamada).
 * Color por vértice #2E2547 → #5B4E7A (más claro en las lomas). Normales por diferencias centrales: sin costuras.
 */
export function terrainMeshes(height: (x: number, z: number) => number, groundY: number, material: THREE.Material): THREE.Mesh[] {
  const x0 = -380;
  const z0 = -300;
  const n = 100;
  const chunks = 5;
  const step = 760 / n;
  const stepZ = step * 1.05;
  const W = n + 1;
  const h = new Float32Array(W * W);
  const px = (i: number) => x0 + i * step;
  const pz = (j: number) => z0 + j * stepZ;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) h[j * W + i] = height(px(i), pz(j));
  const at = (i: number, j: number) => h[Math.min(n, Math.max(0, j)) * W + Math.min(n, Math.max(0, i))]!;
  // Un tono por encima de la paleta: el sombreado toon y la niebla lo oscurecen hasta ~#2E2547 → #5B4E7A.
  const lo = new THREE.Color(0x5b3fb0);
  const hi = new THREE.Color(0x9b6bff);
  const tmp = new THREE.Color();
  const meshes: THREE.Mesh[] = [];
  const cells = n / chunks;
  for (let cj = 0; cj < chunks; cj++) {
    for (let ci = 0; ci < chunks; ci++) {
      const pos: number[] = [];
      const nor: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      for (let j = cj * cells; j <= (cj + 1) * cells; j++) {
        for (let i = ci * cells; i <= (ci + 1) * cells; i++) {
          const y = at(i, j);
          pos.push(px(i), y, pz(j));
          const nx = (at(i - 1, j) - at(i + 1, j)) / (2 * step);
          const nz = (at(i, j - 1) - at(i, j + 1)) / (2 * stepZ);
          const len = Math.hypot(nx, 1, nz);
          nor.push(nx / len, 1 / len, nz / len);
          const t = THREE.MathUtils.clamp(0.18 + 0.5 * vnoise(px(i) * 0.02 + 9, pz(j) * 0.02) + 0.55 * (vnoise(px(i) * 0.085 + 5, pz(j) * 0.085) - 0.5) + (y - groundY) * 0.004 + (vhash(i, j) - 0.5) * 0.34, 0, 1);
          tmp.copy(lo).lerp(hi, t);
          col.push(tmp.r, tmp.g, tmp.b);
        }
      }
      const row = cells + 1;
      for (let j = 0; j < cells; j++) {
        for (let i = 0; i < cells; i++) {
          const a = j * row + i;
          idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = "terreno";
      meshes.push(mesh);
    }
  }
  return meshes;
}

const WATER_VERT = /* glsl */ `
attribute float aCentre;
varying float vCentre;
varying vec2 vXZ;
#include <fog_pars_vertex>
void main() {
  vCentre = aCentre;
  vXZ = position.xz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

// Color Espectro #3FF2C8 en el eje y #1FA896 en la orilla; ondas y espuma con ruido de valor barato.
const WATER_FRAG = /* glsl */ `
uniform float uTime;
varying float vCentre;
varying vec2 vXZ;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 q = vXZ * 0.16;
  float n = vnoise(q + vec2(uTime * 0.12, uTime * 0.07)) * 0.6 + vnoise(q * 2.3 - vec2(uTime * 0.18, -uTime * 0.1)) * 0.4;
  float c = clamp(vCentre + (n - 0.5) * 0.35, 0.0, 1.0);
  vec3 deep = vec3(0.122, 0.659, 0.588);
  vec3 light = vec3(0.247, 0.949, 0.784);
  vec3 col = mix(deep, light, smoothstep(0.0, 0.85, c));
  // Ondas: bandas de espuma que se desplazan, cortadas en escalones (toon).
  float w = sin((vXZ.x * 0.35 + vXZ.y * 0.28) + n * 6.0 - uTime * 1.3);
  float foam = step(0.82, w * 0.5 + 0.5) * smoothstep(0.1, 0.5, c);
  col = mix(col, vec3(0.75, 1.0, 0.93), foam * 0.55);
  // Orilla clara.
  col = mix(col, vec3(0.80, 1.0, 0.94), (1.0 - smoothstep(0.0, 0.16, vCentre)) * 0.9);
  gl_FragColor = vec4(col, 1.0);
  // La niebla solo apaga el agua a medias: el río lejano tiene que seguir brillando como un camino de luz.
  #ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * 0.3);
  #endif
}
`;

function lagoonMaterial() {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    fog: true,
    side: THREE.DoubleSide,
  });
  return mat;
}

export function decorateAnimas(scene: THREE.Object3D, track: Track, def: TrackDef) {
  // Cielo de Ánimas: luna grande sobre la recta de salida, nubes en capas y colinas lejanas.
  // Todo cuelga de la cúpula, así que sigue a la cámara y no cuenta como geometría de pista.
  const dome = scene.getObjectByName("cielo");
  const oldMoon = scene.getObjectByName("luna");
  oldMoon?.parent?.remove(oldMoon);
  if (dome) {
    dome.add(stars());
    dome.add(createClouds(PALETTE.niebla, PALETTE.sombra));
    dome.add(createHills());
    const moon = createAnimasMoon(9);
    // Delante del kart en la salida (la recta mira a +z), alta y algo a la izquierda del eje.
    moon.position.set(40, 62, 200).setLength(214);
    moon.lookAt(0, 0, 0);
    dome.add(moon);
  }

  const bone = sharedBoneToon();

  // Campanario a un lado de la recta, a unos 50 m de la parrilla: silueta entera, no un muro en la cámara.
  // Se asienta sobre el terreno (ver más abajo), que abraza la pista y ya hace de cerro.
  const spot = pointAt(track, 92, 16);
  const road = pointAt(track, 92, 0);
  const towerFoot = { x: spot.x, z: spot.z };
  const placeTower = (groundY: number) => {
    const tower = new THREE.Mesh(campanarioGeometry(), bone);
    tower.position.set(spot.x, groundY - 0.4, spot.z);
    tower.scale.setScalar(1.6);
    // De cara a la parrilla (d = 18), no a la calzada de al lado: así la campana y las ventanas se ven desde la salida.
    const grid = pointAt(track, 18, 0);
    tower.rotation.y = Math.atan2(grid.x - spot.x, grid.z - spot.z);
    tower.add(new THREE.Mesh(campanarioLuz(), new THREE.MeshBasicMaterial({ vertexColors: true })));
    const bellRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 8, 16), boneToonMaterial());
    bellRing.position.set(0, 9.2, 1.85);
    bellRing.rotation.x = Math.PI / 2;
    tower.add(bellRing);
    tower.name = "campanario";
    scene.add(tower);
  };
  let towerPlaced = false;

  // Salto L: mandíbula. Los ojos van aparte (un lit sin luz, color ánima).
  const big = track.zones.find((z) => z.type === "ramp" && z.size === "L");
  if (big) {
    const lip = pointAt(track, big.to);
    const jaw = new THREE.Mesh(jawLocalGeometry(), bone);
    placeOnTrack(jaw, lip.x, lip.y, lip.z, lip.heading);
    jaw.name = "mandibula";
    const brasaMat = new THREE.MeshBasicMaterial({ color: BRASA });
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.22, 0.42), brasaMat);
      band.position.set(0, 0.85 + i * 0.48, -0.35);
      jaw.add(band);
    }
    scene.add(jaw);
    const eyeGeo = new THREE.SphereGeometry(0.78, 12, 10);
    const eyes = new THREE.InstancedMesh(eyeGeo, new THREE.MeshBasicMaterial({ color: ANIMA }), 2);
    const base = new THREE.Matrix4().makeRotationY(lip.heading);
    base.setPosition(lip.x, lip.y, lip.z);
    // Cuencas en la cara del cráneo, mirando a quien se acerca.
    for (const [i, x] of [-1.35, 1.35].entries()) {
      const local = M(x, 11.4, -1.15);
      eyes.setMatrixAt(i, base.clone().multiply(local));
    }
    eyes.frustumCulled = false;
    eyes.name = "ojos-calavera";
    scene.add(eyes);
  }

  // Rampas S y M: lomos de hueso.
  const humps: THREE.BufferGeometry[] = [];
  const stripes: THREE.BufferGeometry[] = [];
  for (const z of track.zones) {
    if (z.type !== "ramp" || !z.size || z.size === "L") continue;
    const spec = RAMP[z.size];
    const lip = pointAt(track, z.to);
    const g = humpGeometry(spec.len, spec.lip, Math.min(2.15, lip.width * 0.16), 1.45);
    g.applyMatrix4(M(lip.x, lip.y, lip.z, 0, lip.heading));
    humps.push(g);
    if (z.size === "M") {
      const box = new THREE.BoxGeometry(4.2, 0.38, 0.32);
      const world = new THREE.Matrix4().makeRotationY(lip.heading).setPosition(lip.x, lip.y, lip.z);
      for (let i = 0; i < 3; i++) {
        stripes.push(bake(box, world.clone().multiply(M(0, 1.05 + i * 0.48, -5.35 + i * 0.42)), BRASA));
      }
      box.dispose();
    }
  }
  if (humps.length) scene.add(new THREE.Mesh(merge(humps), bone));
  if (stripes.length) {
    const paint = new THREE.Mesh(merge(stripes), new THREE.MeshBasicMaterial({ color: BRASA }));
    paint.name = "franjas-rampa";
    scene.add(paint);
  }

  // Laguna bajo el salto, siempre por debajo del asfalto más bajo de la zona (1,8 m).
  // Es un río de luz: óvalo bajo el salto y un cauce que serpentea hasta el pie del campanario.
  // Una sola malla con ShaderMaterial barato (ruido en UV + tiempo), sin texturas.
  if (big) {
    let low = Infinity;
    for (let d = big.from - 6; d <= big.to + 50; d += 2) {
      const p = pointAt(track, d);
      low = Math.min(low, p.y);
      low = Math.min(low, surfaceY({ y: p.y, lateral: p.width / 2, bank: p.bank }));
      low = Math.min(low, surfaceY({ y: p.y, lateral: -p.width / 2, bank: p.bank }));
    }
    const waterY = low - 1.8;
    // El óvalo queda en el interior del gancho que forma la pista, entre la recta de salida y el salto.
    const lip2 = pointAt(track, big.to);
    const mid = { x: (towerFoot.x + lip2.x) / 2 - 2, z: Math.max(towerFoot.z, lip2.z) + 15 };
    const shape = lagoonShape(mid, towerFoot);
    const lagoon = new THREE.Mesh(lagoonGeometry(shape), lagoonMaterial());
    const height = terrainHeightField(track, shape, waterY, GROUND_Y, { x: spot.x, z: spot.z, top: road.y - 6 });
    for (const chunk of terrainMeshes(height, GROUND_Y, animasTerrainMaterial())) scene.add(chunk);
    placeTower(height(towerFoot.x, towerFoot.z));
    towerPlaced = true;
    lagoon.position.y = waterY;
    lagoon.renderOrder = 0; // después del cielo (-1): el río lejano queda a más de 230 m, fuera de la cúpula
    lagoon.frustumCulled = false;
    lagoon.name = "laguna";
    const waterMat = lagoon.material as THREE.ShaderMaterial;
    lagoon.onBeforeRender = () => {
      waterMat.uniforms.uTime!.value = performance.now() / 1000;
    };
    scene.add(lagoon);

    // Árboles, farolillos y vallas de hueso. `height` es el mismo terreno que se dibuja.
    for (const mesh of createTrees(track, height, (x, z) => lagoonDistance(shape, x, z).d > 8)) scene.add(mesh);
    scene.add(createRocks(track, height, (x, z) => lagoonDistance(shape, x, z).d > 8));
    const lanterns = createLanterns(track, height, { x: shape.mid.x, z: shape.mid.z, y: waterY, rx: shape.rx, rz: shape.rz });
    scene.add(lanterns.bodies, lanterns.halos);
    if (lanterns.poles) scene.add(lanterns.poles);
    const fences = createFences(track);
    scene.add(fences.posts, fences.rope);
  }

  if (!towerPlaced) placeTower(spot.y);

  const pumpkinMark = def.landmarks?.find((m) => m.kind === "calabaza");
  if (pumpkinMark && clear(track, pumpkinMark.x, pumpkinMark.z, 0)) {
    const y = closestPoint(track, pumpkinMark.x, pumpkinMark.z).y;
    const pumpkin = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10), toonMaterial({ color: BRASA }));
    pumpkin.position.set(pumpkinMark.x, y + 1.6, pumpkinMark.z);
    scene.add(pumpkin);
  }

  const pads = boostMarks(track);
  if (pads) {
    pads.frustumCulled = false;
    scene.add(pads);
  }
}
