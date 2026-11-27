import * as THREE from "three";
import { closestPoint, pointAt, type Track, type TrackDef } from "@derrape/shared";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FURNITURE, Pieces } from "./furniture";
import { PALETTE, sharedVertexToonDouble } from "./materials";

// Decorado lateral del Desván: un mundo de fantasía de muebles viejos GIGANTES (estanterías con libros enormes,
// lámparas de pie, armarios, cajas de juguetes, un osito de peluche que asoma, relojes de pie, torres de cubos).
// Todo se genera en código y se funde en DOS mallas: las piezas con luz toon (1 llamada) y las piezas que brillan
// por sí solas (pantallas de lámpara, esferas de reloj, ojos: MeshBasic, 1 llamada). Sin texturas ni luces reales.
// Los muebles de las rampas (furniture.ts) son de tamaño real; estos son del tamaño de una casa para que el
// circuito parezca un juguete olvidado en un desván.

/** Suelo del desván (el plano oscuro bajo la pista). */
export const DESVAN_GROUND_Y = -12;

/** Colores de utilería. Nada de Brasa/Llama/Espectro (los turbos) ni naranjas vivos: lejos de la calzada tampoco se confunden. */
export const DESVAN = {
  rosa: 0xc9689a,
  turquesa: 0x2f8f8f,
  malva: 0x7a56c9,
  azul: 0x4a62a8,
  crema: PALETTE.hueso,
  verdeBotella: 0x2f6f62,
  rojoLibro: 0x8f2f3a,
  luz: 0xffe9b0,
} as const;

const BOOKS = [DESVAN.rosa, DESVAN.turquesa, DESVAN.malva, DESVAN.azul, DESVAN.verdeBotella, DESVAN.rojoLibro, FURNITURE.tapiz, FURNITURE.maderaClara];

/** Radio de la huella y nombre de cada pieza. La altura sale del propio modelo. */
interface Proto {
  name: string;
  radius: number;
  build: (P: Pieces, L: Pieces, m: THREE.Matrix4, rnd: () => number) => void;
}

function estanteria(P: Pieces, _L: Pieces, m: THREE.Matrix4, rnd: () => number) {
  const W = 14;
  const H = 24;
  const D = 5;
  for (const sx of [-1, 1]) P.box(m, 0.8, H, D, FURNITURE.maderaOscura, sx * (W / 2 - 0.4), 0, 0);
  P.box(m, W, 0.8, D, FURNITURE.maderaOscura, 0, H - 0.8, 0);
  P.box(m, W + 1.2, 0.9, D + 0.8, FURNITURE.maderaClara, 0, H, 0);
  P.box(m, W - 1, H, 0.5, FURNITURE.madera, 0, 0, -D / 2 + 0.25);
  for (let row = 0; row < 5; row++) {
    const y = row * 4.7;
    P.box(m, W - 1.6, 0.5, D - 0.4, FURNITURE.madera, 0, y, 0.1);
    let x = -W / 2 + 1.2;
    while (x < W / 2 - 2) {
      const w = 0.7 + rnd() * 0.9;
      const h = 2.6 + rnd() * 1.3;
      if (x + w > W / 2 - 1.0) break;
      // Algún libro tumbado o inclinado.
      const lean = rnd() < 0.15 ? 0.25 : 0;
      P.box(m, w, h, D - 1.4, BOOKS[Math.floor(rnd() * BOOKS.length)]!, x + w / 2, y + 0.5, 0.2, lean);
      x += w + 0.05;
    }
  }
}

function libros(P: Pieces, _L: Pieces, m: THREE.Matrix4, rnd: () => number) {
  let y = 0;
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const w = 8 - i * 0.6 + rnd();
    const h = 1.4 + rnd() * 0.8;
    const rot = (rnd() - 0.5) * 0.9;
    const color = BOOKS[Math.floor(rnd() * BOOKS.length)]!;
    // Tapas y lomo; el canto de las páginas, en crema.
    P.box(m, w, h, 5.6, FURNITURE.maderaClara, 0.2, y + 0.18, 0, rot);
    P.box(m, w + 0.3, 0.2, 5.8, color, 0.2, y, 0, rot);
    P.box(m, w + 0.3, 0.2, 5.8, color, 0.2, y + h + 0.16, 0, rot);
    P.box(m, 0.4, h + 0.36, 5.8, color, 0.2 - (w / 2) * Math.cos(rot), y, (w / 2) * Math.sin(rot), rot);
    y += h + 0.36;
  }
}

function lampara(P: Pieces, L: Pieces, m: THREE.Matrix4) {
  const H = 22;
  P.solid(m, new THREE.CylinderGeometry(3.4, 4, 0.9, 10), FURNITURE.maderaOscura, 0, 0.45, 0);
  P.solid(m, new THREE.CylinderGeometry(0.55, 0.7, H, 8), FURNITURE.oxido, 0, H / 2, 0);
  P.solid(m, new THREE.SphereGeometry(1.1, 8, 6), FURNITURE.metal, 0, 6, 0);
  P.solid(m, new THREE.SphereGeometry(1.0, 8, 6), FURNITURE.metal, 0, H - 2, 0);
  // Pantalla: tronco de cono abierto (de tela) y bombilla/luz interior que brilla.
  const shade = new THREE.CylinderGeometry(3.2, 6, 6, 12, 1, true);
  P.solid(m, shade, DESVAN.crema, 0, H + 2.4, 0);
  L.solid(m, new THREE.SphereGeometry(1.6, 8, 6), DESVAN.luz, 0, H + 2.2, 0);
  L.solid(m, new THREE.CylinderGeometry(3.0, 5.7, 5.6, 12, 1, true), 0xe8cf94, 0, H + 2.4, 0);
}

function cajaJuguetes(P: Pieces, L: Pieces, m: THREE.Matrix4, rnd: () => number) {
  P.box(m, 12, 7, 8, DESVAN.malva, 0, 0);
  P.box(m, 12.4, 0.8, 8.4, FURNITURE.maderaClara, 0, 7);
  P.box(m, 12.1, 0.9, 8.1, DESVAN.rosa, 0, 3);
  // Letras: cubos de colores asomando por arriba y uno caído delante.
  const cubes: [number, number, number, number, number][] = [
    [-2.5, 7.8, 0, 3.6, DESVAN.turquesa],
    [2.2, 7.8, 0.5, 3.2, DESVAN.rosa],
    [-0.2, 11.2, 0.2, 3.0, DESVAN.azul],
    [8.2, 0, 4.2, 4, DESVAN.verdeBotella],
  ];
  for (const [x, y, z, s, c] of cubes) {
    const rot = (rnd() - 0.5) * 0.8;
    P.box(m, s, s, s, c, x, y, z, rot);
    // Cara con "letra": un cuadrado crema al frente.
    L.box(m, s * 0.5, s * 0.5, 0.06, DESVAN.crema, x + Math.sin(rot) * (s / 2 + 0.03), y + s * 0.25, z + Math.cos(rot) * (s / 2 + 0.03), rot);
  }
  P.solid(m, new THREE.SphereGeometry(2.4, 10, 8), DESVAN.rosa, -8.6, 2.4, 3.4);
}

function armario(P: Pieces, _L: Pieces, m: THREE.Matrix4) {
  P.box(m, 10, 22, 5, FURNITURE.madera, 0, 0.8);
  P.box(m, 11, 1, 5.8, FURNITURE.maderaClara, 0, 22.8);
  for (const sx of [-1, 1]) P.box(m, 1, 0.8, 1, FURNITURE.maderaOscura, sx * 4.4, 0, 1.8);
  for (const sx of [-1, 1]) {
    P.box(m, 4.4, 19.5, 0.35, FURNITURE.maderaOscura, sx * 2.35, 1.6, 2.7);
    P.box(m, 3.4, 8, 0.2, FURNITURE.madera, sx * 2.35, 2.6, 2.95);
    P.box(m, 3.4, 8, 0.2, FURNITURE.madera, sx * 2.35, 12, 2.95);
    P.box(m, 0.55, 0.55, 0.55, FURNITURE.metal, sx * 0.75, 11, 3.1);
  }
}

function silla(P: Pieces, _L: Pieces, m: THREE.Matrix4) {
  P.box(m, 8, 1.2, 8, DESVAN.verdeBotella, 0, 9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(m, 0.9, 9, 0.9, FURNITURE.maderaOscura, sx * 3.5, 0, sz * 3.5);
  P.box(m, 8, 0.8, 0.9, FURNITURE.maderaOscura, 0, 5, 3.5);
  for (const sx of [-1, 1]) P.box(m, 0.9, 14, 0.9, FURNITURE.maderaOscura, sx * 3.5, 10.2, -3.5);
  P.box(m, 8, 3.2, 0.9, FURNITURE.maderaOscura, 0, 20, -3.5);
  P.box(m, 6.4, 5, 0.6, DESVAN.verdeBotella, 0, 14.4, -3.5);
}

/** King Kong, pero de peluche: un osito sentado que asoma tras la pista. */
function osito(P: Pieces, L: Pieces, m: THREE.Matrix4) {
  const fur = 0x7a5a48;
  const belly = 0xb89a7c;
  const ball = (r: number, color: number, x: number, y: number, z: number, sy = 1) => {
    const g = new THREE.SphereGeometry(r, 8, 6);
    g.scale(1, sy, 1);
    P.solid(m, g, color, x, y, z);
  };
  ball(5.6, fur, 0, 5.6, 0, 1.05);
  ball(4, belly, 0, 5, 3.2, 1.1);
  ball(3.8, fur, 0, 13.2, 0.4);
  for (const sx of [-1, 1]) {
    ball(1.5, fur, sx * 3.1, 16.6, 0);
    ball(0.8, DESVAN.rosa, sx * 3.1, 16.6, 0.9);
    ball(2, fur, sx * 6, 6.5, 2.6, 1.5);
    ball(2.3, fur, sx * 3.4, 1.4, 4.2);
    ball(1.4, belly, sx * 3.4, 1.4, 6);
    L.solid(m, new THREE.SphereGeometry(0.5, 6, 5), PALETTE.ciruela, sx * 1.5, 13.9, 4);
  }
  ball(1.6, belly, 0, 12.2, 3.6);
  ball(0.65, PALETTE.ciruela, 0, 12.7, 5.1);
  // Lazo de tela.
  P.box(m, 4.4, 1.1, 0.7, DESVAN.rosa, 0, 9.4, 3.4, 0);
  P.box(m, 1, 1.6, 0.9, DESVAN.rosa, 0, 9.2, 3.6);
}

function reloj(P: Pieces, L: Pieces, m: THREE.Matrix4) {
  P.box(m, 5.6, 25, 3.8, FURNITURE.maderaOscura, 0, 0);
  P.box(m, 6.4, 1, 4.4, FURNITURE.maderaClara, 0, 25);
  P.box(m, 4, 4.2, 0.4, FURNITURE.madera, 0, 0.8, 1.95);
  P.box(m, 3.4, 8, 0.3, PALETTE.sombra, 0, 5.4, 1.95);
  P.solid(m, new THREE.CylinderGeometry(0.2, 0.2, 7, 5), FURNITURE.metal, 0, 9, 2.3);
  P.solid(m, new THREE.SphereGeometry(1, 8, 6), FURNITURE.oxido, 0, 5.4, 2.5);
  // Esfera: disco que brilla, con las dos agujas oscuras.
  const face = new THREE.CylinderGeometry(2.1, 2.1, 0.3, 14);
  face.rotateX(Math.PI / 2);
  L.solid(m, face, DESVAN.crema, 0, 17.4, 1.98);
  P.box(m, 0.22, 1.7, 0.2, PALETTE.ciruela, 0, 17.4, 2.2);
  P.box(m, 1.3, 0.22, 0.2, PALETTE.ciruela, 0.55, 17.4, 2.22);
}

function torreCubos(P: Pieces, L: Pieces, m: THREE.Matrix4, rnd: () => number) {
  let y = 0;
  const colors = [DESVAN.azul, DESVAN.rosa, DESVAN.turquesa, DESVAN.malva, DESVAN.crema];
  for (let i = 0; i < 5; i++) {
    const s = 6.5 - i * 0.8;
    const rot = (rnd() - 0.5) * 0.7;
    P.box(m, s, s, s, colors[i % colors.length]!, (rnd() - 0.5) * 1.2, y, (rnd() - 0.5) * 1.2, rot);
    L.box(m, s * 0.45, s * 0.45, 0.06, i % 2 ? DESVAN.crema : PALETTE.ciruela, Math.sin(rot) * (s / 2 + 0.03), y + s / 2, Math.cos(rot) * (s / 2 + 0.03), rot);
    y += s;
  }
}

/** Pelota de playa a rayas gigante (sobre una caja baja, para que no parezca flotar). */
function pelota(P: Pieces, _L: Pieces, m: THREE.Matrix4) {
  const bands = [DESVAN.rosa, DESVAN.crema, DESVAN.turquesa, DESVAN.crema, DESVAN.malva];
  const R = 5.5;
  bands.forEach((c, i) => {
    const a = (i / bands.length) * Math.PI;
    const b = ((i + 1) / bands.length) * Math.PI;
    P.solid(m, new THREE.SphereGeometry(R, 12, 8, 0, Math.PI * 2, a, b - a), c, 0, R, 0);
  });
}

const PROTOS: Proto[] = [
  { name: "estanteria", radius: 8, build: estanteria },
  { name: "lampara", radius: 6.5, build: lampara },
  { name: "libros", radius: 5, build: libros },
  { name: "caja-juguetes", radius: 10, build: cajaJuguetes },
  { name: "armario", radius: 6.5, build: armario },
  { name: "osito", radius: 8, build: osito },
  { name: "reloj", radius: 4.5, build: reloj },
  { name: "silla", radius: 6, build: silla },
  { name: "torre-cubos", radius: 5, build: torreCubos },
  { name: "pelota", radius: 6, build: pelota },
];

/** Una pieza colocada (sin Three.js): para poder probar la disposición en Node. */
export interface Placement {
  proto: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  radius: number;
  /** Distancia del centro al eje de la pista más cercana (m). */
  axisDistance: number;
}

export const SCENERY_STEP = 34;
const SCALES = [1.4, 1, 0.7];

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** ¿Está el punto dentro del círculo envolvente de alguna zona de asfalto pintado (con margen)? */
function inPaint(def: TrackDef, x: number, z: number, margin: number) {
  for (const a of def.paint ?? []) {
    const cx = a.points.reduce((s, p) => s + p.x, 0) / a.points.length;
    const cz = a.points.reduce((s, p) => s + p.z, 0) / a.points.length;
    const r = Math.max(...a.points.map((p) => Math.hypot(p.x - cx, p.z - cz)));
    if (Math.hypot(x - cx, z - cz) < r + margin) return true;
  }
  return false;
}

/**
 * Reparte los muebles gigantes a ambos lados de la pista, siempre fuera del muro (+ su radio + 5 m) y de la
 * pista más cercana, sin pisar el asfalto pintado ni otro mueble. Determinista y sin Three.js.
 */
export function sceneryPlacements(track: Track, def: TrackDef): Placement[] {
  const rnd = lcg(1301);
  const out: Placement[] = [];
  const recent: number[] = [];
  for (let d = 10; d < track.length; d += SCENERY_STEP) {
    for (const side of [1, -1]) {
      // Una clase al azar, sin repetir las dos anteriores (para que no haya tres lámparas seguidas).
      let k = Math.floor(rnd() * PROTOS.length);
      while (recent.includes(k)) k = (k + 1) % PROTOS.length;
      recent.push(k);
      if (recent.length > 2) recent.shift();
      const proto = PROTOS[k]!;
      const on = pointAt(track, d, 0);
      const jitter = rnd();
      for (const scale of SCALES) {
        const r = proto.radius * scale;
        const lateral = side * (on.width / 2 + track.verge + 5 + r + jitter * 14);
        const p = pointAt(track, d, lateral);
        const c = closestPoint(track, p.x, p.z);
        const axis = Math.abs(c.lateral);
        // Siempre fuera del muro de la pista más cercana, no sólo de la de este tramo.
        if (axis < c.width / 2 + track.verge + 5 + r) continue;
        if (inPaint(def, p.x, p.z, r + 4)) continue;
        if (out.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.radius + r + 1.5)) continue;
        out.push({ proto: proto.name, x: p.x, z: p.z, yaw: Math.atan2(on.x - p.x, on.z - p.z), scale, radius: r, axisDistance: axis });
        break;
      }
    }
  }
  return out;
}

/** Lado (m) de cada celda del decorado: cada celda es una malla con su esfera envolvente, para que el GPU descarte las lejanas. */
export const CHUNK = 170;

/** Mallas del decorado: muebles con luz toon por celdas (1 llamada por celda visible) y una malla de piezas que brillan. */
export function desvanScenery(track: Track, def: TrackDef): THREE.Mesh[] {
  const rnd = lcg(77);
  const cells = new Map<string, { P: Pieces }>();
  const L = new Pieces();
  for (const pl of sceneryPlacements(track, def)) {
    const proto = PROTOS.find((q) => q.name === pl.proto)!;
    const m = new THREE.Matrix4()
      .makeRotationY(pl.yaw)
      .scale(new THREE.Vector3(pl.scale, pl.scale, pl.scale))
      .premultiply(new THREE.Matrix4().makeTranslation(pl.x, DESVAN_GROUND_Y - 0.3, pl.z));
    const key = `${Math.floor(pl.x / CHUNK)},${Math.floor(pl.z / CHUNK)}`;
    let cell = cells.get(key);
    if (!cell) cells.set(key, (cell = { P: new Pieces() }));
    proto.build(cell.P, L, m, rnd);
  }
  const make = (pieces: Pieces, material: THREE.Material, name: string, cull: boolean) => {
    const geo = mergeGeometries(pieces.list, false);
    for (const g of pieces.list) g.dispose();
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.frustumCulled = cull;
    return mesh;
  };
  const meshes = [...cells.values()].map((c) => make(c.P, sharedVertexToonDouble(), "decorado-muebles", true));
  meshes.push(make(L, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), "decorado-luces", false));
  return meshes;
}
