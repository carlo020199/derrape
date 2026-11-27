import * as THREE from "three";
import { pointAt, RAMP, surfaceY, type Track, type TrackLift, type TrackZone } from "@derrape/shared";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE, sharedVertexToonDouble } from "./materials";

// Rampas-mueble del Desván: cada rampa con `landBoost` es una cuña de tablones o de somier metálico
// (exacta a la física: sube RAMP[size].lip a lo largo de su tramo) con muebles viejos de adorno al borde del arcén.
// Todo el circuito va en UNA malla con color por vértice: 1 llamada de dibujo.
// Paleta: maderas, grises, óxido y verdes. NADA de Brasa/Llama/Espectro (son los turbos): una rampa no se confunde con un turbo.
// Óxido y verdín no están en la paleta de Dalí: son propuestas de utilería (PLAN §2.8, opción B) pendientes de su visto bueno.

export const FURNITURE = {
  maderaClara: PALETTE.huesoSombra, // #C8B597
  madera: PALETTE.marfil, // #8C7B66
  maderaOscura: 0x5a4636,
  metal: 0x6a6479, // gris violáceo
  oxido: 0xa8421f,
  verdin: 0x2f6f62,
  tapiz: PALETTE.ascua, // naranja rojizo (rojo), no Brasa
} as const;

/** Mitad del ancho de la cuña (la calzada: 16 m) y distancia lateral de los muebles de adorno (fuera de la calzada). */
const HALF = 8;
const FLANK = 12.4;
const LIFT = 0.04;

class Pieces {
  readonly list: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: number) {
    const flat = g.index ? g.toNonIndexed() : g;
    flat.deleteAttribute("uv");
    flat.computeVertexNormals();
    const n = flat.getAttribute("position").count;
    const c = new THREE.Color(color);
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.list.push(flat);
  }
  /** Caja con la base en `y`, centrada en x/z, en el marco `m`. */
  box(m: THREE.Matrix4, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y + h / 2, z));
    g.applyMatrix4(m);
    this.add(g, color);
  }
  /** Cilindro vertical (pata) o, con `rotZ`, horizontal (barrote). */
  cyl(m: THREE.Matrix4, r: number, h: number, color: number, x: number, y: number, z: number, rotZ = 0) {
    const g = new THREE.CylinderGeometry(r, r, h, 6);
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(rotZ).setPosition(x, y + (rotZ ? 0 : h / 2), z));
    g.applyMatrix4(m);
    this.add(g, color);
  }
}

/** Marco en el suelo junto a la pista: posición (x, y de la calzada, z) y rumbo. `turn` gira la pieza hacia la pista. */
function frame(track: Track, d: number, lateral: number, turn: number): THREE.Matrix4 {
  const p = pointAt(track, d, lateral);
  const y = surfaceY({ y: p.y, lateral, bank: p.bank });
  return new THREE.Matrix4().makeRotationY(p.heading + turn).setPosition(p.x, y, p.z);
}

function comoda(P: Pieces, m: THREE.Matrix4, h = 1.7) {
  P.box(m, 2.4, h, 1.8, FURNITURE.madera, 0, 0.25);
  P.box(m, 2.6, 0.16, 2, FURNITURE.maderaClara, 0, 0.25 + h);
  for (const [i, y] of [0.45, 0.45 + h / 3, 0.45 + (2 * h) / 3].entries()) {
    P.box(m, 2.0, h / 3 - 0.18, 0.1, FURNITURE.maderaOscura, 0, y, 0.92);
    P.box(m, 0.4, 0.14, 0.14, FURNITURE.metal, i % 2 ? -0.5 : 0.5, y + h / 6 - 0.2, 1.02);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(m, 0.25, 0.25, 0.25, FURNITURE.maderaOscura, sx * 1.05, 0, sz * 0.75);
}

function mesa(P: Pieces, m: THREE.Matrix4) {
  P.box(m, 3, 0.18, 1.8, FURNITURE.maderaClara, 0, 1.45);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(m, 0.22, 1.45, 0.22, FURNITURE.madera, sx * 1.3, 0, sz * 0.7);
}

function sillon(P: Pieces, m: THREE.Matrix4) {
  P.box(m, 2.2, 0.8, 1.9, FURNITURE.verdin, 0, 0.3);
  P.box(m, 2.2, 1.3, 0.5, FURNITURE.verdin, 0, 0.3, -0.7);
  for (const sx of [-1, 1]) P.box(m, 0.4, 0.5, 1.9, FURNITURE.verdin, sx * 1.15, 1.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(m, 0.2, 0.3, 0.2, FURNITURE.maderaOscura, sx * 0.9, 0, sz * 0.75);
}

/** Cabecero de cama metálico: dos postes de óxido y barrotes grises. */
function cabecero(P: Pieces, m: THREE.Matrix4) {
  for (const sx of [-1, 1]) P.cyl(m, 0.12, 2.6, FURNITURE.oxido, sx * 1.4, 0, 0);
  for (const y of [0.5, 1.3, 2.1]) P.cyl(m, 0.07, 2.8, FURNITURE.metal, 0, y, 0, Math.PI / 2);
  for (const x of [-0.7, 0, 0.7]) P.cyl(m, 0.05, 2.1, FURNITURE.metal, x, 0.3, 0);
}

function baul(P: Pieces, m: THREE.Matrix4) {
  P.box(m, 2.4, 1.1, 1.5, FURNITURE.maderaOscura, 0, 0);
  P.box(m, 2.5, 0.35, 1.6, FURNITURE.madera, 0, 1.1);
  for (const x of [-0.8, 0.8]) P.box(m, 0.18, 1.5, 1.62, FURNITURE.oxido, x, 0);
  P.box(m, 0.3, 0.3, 0.12, FURNITURE.metal, 0, 0.7, 0.8);
}

function tablones(P: Pieces, m: THREE.Matrix4) {
  [FURNITURE.maderaClara, FURNITURE.madera, FURNITURE.maderaClara].forEach((c, i) => P.box(m, 3.2, 0.22, 0.7, c, 0, i * 0.22, (i - 1) * 0.1, (i - 1) * 0.28));
  P.box(m, 0.4, 0.5, 0.4, FURNITURE.oxido, 1.9, 0, 0.3);
}

const LEFT = [comoda, cabecero, baul, tablones, (P: Pieces, m: THREE.Matrix4) => {
  comoda(P, m);
  comoda(P, new THREE.Matrix4().copy(m).multiply(new THREE.Matrix4().makeTranslation(0, 2.2, 0)).multiply(new THREE.Matrix4().makeRotationY(0.25)), 1.2);
}, sillon];
const RIGHT = [sillon, mesa, comoda, cabecero, mesa, comoda];

type Deck = "tablon" | "somier";

/** Cuña de la rampa en coordenadas de mundo: sube `lip` m a lo largo del tramo, sigue la curva, el peralte y la cuesta. */
function deck(P: Pieces, track: Track, z: TrackZone, kind: Deck) {
  const lip = RAMP[z.size!].lip;
  const rows = Math.max(2, Math.round(z.to - z.from));
  const cols = 6;
  const at = (d: number, l: number, up: number): [number, number, number] => {
    const p = pointAt(track, d, l);
    return [p.x, surfaceY({ y: p.y, lateral: l, bank: p.bank }) + up, p.z];
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], color: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    P.add(g, color);
  };
  const tri = (a: number[], b: number[], c: number[], color: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    P.add(g, color);
  };
  const h = (d: number) => LIFT + (lip * (d - z.from)) / (z.to - z.from);
  const base = -0.5;
  for (let r = 0; r < rows; r++) {
    const d0 = z.from + ((z.to - z.from) * r) / rows;
    const d1 = z.from + ((z.to - z.from) * (r + 1)) / rows;
    for (let c = 0; c < cols; c++) {
      const l0 = -HALF + ((2 * HALF) / cols) * c;
      const l1 = l0 + (2 * HALF) / cols;
      const color =
        kind === "tablon"
          ? c % 2 === 0
            ? FURNITURE.maderaClara
            : FURNITURE.madera
          : r % 2 === 0
            ? FURNITURE.metal
            : FURNITURE.oxido;
      quad(at(d0, l0, h(d0)), at(d0, l1, h(d0)), at(d1, l1, h(d1)), at(d1, l0, h(d1)), color);
    }
  }
  // Faldón del labio y costados.
  const side = kind === "tablon" ? FURNITURE.maderaOscura : FURNITURE.oxido;
  quad(at(z.to, -HALF, base), at(z.to, HALF, base), at(z.to, HALF, h(z.to)), at(z.to, -HALF, h(z.to)), side);
  for (const l of [-HALF, HALF]) {
    quad(at(z.from, l, base), at(z.to, l, base), at(z.to, l, h(z.to)), at(z.from, l, h(z.from)), side);
  }
  tri(at(z.from, -HALF, base), at(z.from, HALF, base), at(z.from, HALF, h(z.from)), side);
}

/** Grosor del tablero de la plataforma (m) y su media anchura: la calzada (±8) más un borde de madera clara de 0,35 m. */
const SLAB = 1.5;
const SLAB_HALF = HALF + 0.35;

/**
 * Plataforma flotante: un tablero de madera con borde de tablón claro y cajones de cómoda en los costados, bajo la
 * calzada elevada (`TrackLift`). Sigue la altura de la pista (sube, meseta, baja) y el peralte. El arcén no se dibuja ahí.
 */
function plataforma(P: Pieces, track: Track, lift: TrackLift) {
  const d0 = lift.from - lift.easeIn;
  const d1 = lift.to + lift.easeOut;
  const rows = Math.round((d1 - d0) / 2);
  const at = (d: number, l: number, up: number): [number, number, number] => {
    const p = pointAt(track, d, l);
    return [p.x, surfaceY({ y: p.y, lateral: l, bank: p.bank }) + up, p.z];
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], color: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    P.add(g, color);
  };
  for (let r = 0; r < rows; r++) {
    const a = d0 + ((d1 - d0) * r) / rows;
    const b = d0 + ((d1 - d0) * (r + 1)) / rows;
    // Borde de tablón claro (de HALF a SLAB_HALF) a los dos lados, justo bajo el asfalto.
    for (const s of [1, -1]) {
      quad(at(a, s * HALF, -0.02), at(a, s * SLAB_HALF, -0.02), at(b, s * SLAB_HALF, -0.02), at(b, s * HALF, -0.02), FURNITURE.maderaClara);
      // Costado: del borde del tablero hacia abajo.
      const top = -0.02;
      const bottom = -SLAB;
      quad(at(a, s * SLAB_HALF, top), at(a, s * SLAB_HALF, bottom), at(b, s * SLAB_HALF, bottom), at(b, s * SLAB_HALF, top), r % 2 === 0 ? FURNITURE.maderaOscura : FURNITURE.madera);
    }
    // Panza del tablero.
    quad(at(a, -SLAB_HALF, -SLAB), at(a, SLAB_HALF, -SLAB), at(b, SLAB_HALF, -SLAB), at(b, -SLAB_HALF, -SLAB), FURNITURE.maderaOscura);
  }
  // Cajones de cómoda en los costados (una cara de 5 m con tirador metálico), cada 10 m.
  for (let d = d0 + 12; d < d1 - 8; d += 10) {
    for (const s of [1, -1]) {
      const m = frame(track, d, s * SLAB_HALF, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      m.multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.04));
      // El marco queda en la calzada elevada (altura del borde): el cajón cuelga bajo ella.
      P.box(m, 5, SLAB - 0.5, 0.12, FURNITURE.madera, 0, -SLAB + 0.25);
      P.box(m, 1.2, 0.14, 0.2, FURNITURE.metal, 0, -SLAB / 2 - 0.1, 0.1);
    }
  }
}

/** Malla de todas las rampas-mueble y plataformas del circuito (null si no tiene). Un solo material, una llamada de dibujo. */
export function furnitureMesh(track: Track): THREE.Mesh | null {
  const ramps = track.zones.filter((z) => z.type === "ramp" && z.size && z.landBoost);
  if (!ramps.length) return null;
  const P = new Pieces();
  for (const lift of track.lifts) plataforma(P, track, lift);
  ramps.forEach((z, i) => {
    deck(P, track, z, i % 2 === 0 ? "tablon" : "somier");
    const mid = (z.from + z.to) / 2;
    // Los muebles miran hacia la pista (±90°). Los de la izquierda (+lateral) se giran a la derecha y al revés.
    LEFT[i % LEFT.length]!(P, frame(track, mid, FLANK, -Math.PI / 2));
    RIGHT[i % RIGHT.length]!(P, frame(track, mid, -FLANK, Math.PI / 2));
  });
  const geo = mergeGeometries(P.list, false);
  for (const g of P.list) g.dispose();
  const mesh = new THREE.Mesh(geo, sharedVertexToonDouble());
  mesh.name = "rampas-mueble";
  mesh.frustumCulled = false;
  return mesh;
}
