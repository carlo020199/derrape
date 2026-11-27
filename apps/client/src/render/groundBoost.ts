import * as THREE from "three";
import { isPadType, pointAt, surfaceY, type PadType, type Track } from "@derrape/shared";
import { PALETTE } from "./materials";

// Turbos de suelo (azul y naranja) pintados sobre la calzada. Todas las celdas de todas las zonas van en
// UNA malla fusionada con un atlas de tres fichas: 1 llamada de dibujo, sin importar cuántos turbos tenga el circuito.
// Azul = Espectro (turbo 1 de las chispas); naranja = Brasa (más naranja que Llama, que se lee amarillo). Flechas en Texto.
// El raíl triturbo es una ficha aparte: borde metálico (Hueso/Marfil) y tres chevrones (Espectro, Llama, Ánima).

/** Largo de cada celda a lo largo de la pista y ancho máximo a lo ancho (m). */
export const CELL_LENGTH = 2.5;
export const CELL_WIDTH = 3;
/** Altura sobre la calzada: por encima de la línea de borde (0,07) no hace falta; el polygonOffset hace el resto. */
const LIFT = 0.05;

export type PadColor = "blue" | "orange" | "tri";

export function padColor(type: PadType): PadColor {
  if (type === "boostTri") return "tri";
  return type.startsWith("boostBlue") ? "blue" : "orange";
}

export interface PadCell {
  color: PadColor;
  /** Esquinas (x, y, z): atrás-izquierda, atrás-derecha, delante-derecha, delante-izquierda. */
  corners: [number, number, number][];
}

/** Celdas de los turbos de suelo. Sin Three.js ni DOM: se puede probar en Node. */
export function groundBoostCells(track: Track): PadCell[] {
  const cells: PadCell[] = [];
  for (const z of track.zones) {
    if (!isPadType(z.type)) continue;
    const to = z.to < z.from ? z.to + track.length : z.to;
    const rows = Math.max(1, Math.round((to - z.from) / CELL_LENGTH));
    const cols = Math.max(1, Math.round((z.lateralMax - z.lateralMin) / CELL_WIDTH));
    const point = (d: number, lateral: number): [number, number, number] => {
      const p = pointAt(track, d, lateral);
      return [p.x, surfaceY({ y: p.y, lateral, bank: p.bank }) + LIFT, p.z];
    };
    for (let r = 0; r < rows; r++) {
      const d0 = z.from + ((to - z.from) * r) / rows;
      const d1 = z.from + ((to - z.from) * (r + 1)) / rows;
      for (let c = 0; c < cols; c++) {
        // pointAt: lateral + = izquierda. Se recorre de derecha (lateralMin) a izquierda.
        const l0 = z.lateralMin + ((z.lateralMax - z.lateralMin) * c) / cols;
        const l1 = z.lateralMin + ((z.lateralMax - z.lateralMin) * (c + 1)) / cols;
        cells.push({ color: padColor(z.type), corners: [point(d0, l1), point(d0, l0), point(d1, l0), point(d1, l1)] });
      }
    }
  }
  return cells;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

const TILE = 128;
/** Columna (0..2) de cada color en el atlas. */
const TILE_COLUMN: Record<PadColor, number> = { blue: 0, orange: 1, tri: 2 };

/** Atlas 384×128: fichas azul, naranja y triturbo. Azul y naranja: fondo, borde oscuro y dos flechas hacia delante. */
function atlasTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = TILE * 3;
  c.height = TILE;
  const g = c.getContext("2d")!;
  // Chevrón apuntando hacia arriba (el sentido de la marcha) con la punta en (cx, y).
  const chevron = (x0: number, y: number, color: number, half = 44, thick = 18) => {
    const cx = x0 + 64;
    g.beginPath();
    g.moveTo(cx - half, y + 34);
    g.lineTo(cx, y);
    g.lineTo(cx + half, y + 34);
    g.lineTo(cx + half, y + 34 + thick);
    g.lineTo(cx, y + thick);
    g.lineTo(cx - half, y + 34 + thick);
    g.closePath();
    g.fillStyle = hex(color);
    g.fill();
  };
  const tile = (x0: number, base: number) => {
    g.fillStyle = hex(PALETTE.sombra);
    g.fillRect(x0, 0, TILE, TILE);
    g.fillStyle = hex(base);
    g.fillRect(x0 + 6, 6, 116, 116);
    for (const y of [26, 74]) chevron(x0, y, PALETTE.texto, 44, 18);
  };
  // Raíl: la ficha se estira a 2 m de ancho, así que los chevrones son estrechos y el borde (rieles) ocupa 1/6 a cada lado.
  const rail = (x0: number) => {
    g.fillStyle = hex(PALETTE.marfil);
    g.fillRect(x0, 0, TILE, TILE);
    g.fillStyle = hex(PALETTE.hueso); // brillo del riel
    g.fillRect(x0 + 4, 0, 6, TILE);
    g.fillRect(x0 + TILE - 10, 0, 6, TILE);
    g.fillStyle = hex(PALETTE.noche);
    g.fillRect(x0 + 18, 0, TILE - 36, TILE);
    chevron(x0, 6, PALETTE.turbo1, 38, 12);
    chevron(x0, 48, PALETTE.turbo2, 38, 12);
    chevron(x0, 90, PALETTE.turbo3, 38, 12);
  };
  tile(TILE * TILE_COLUMN.blue, PALETTE.espectro);
  tile(TILE * TILE_COLUMN.orange, PALETTE.brasa);
  rail(TILE * TILE_COLUMN.tri);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Malla única con todos los turbos de suelo del circuito, o null si no hay. */
export function groundBoostMesh(track: Track): THREE.Mesh | null {
  const cells = groundBoostCells(track);
  if (cells.length === 0) return null;
  const pos = new Float32Array(cells.length * 12);
  const uv = new Float32Array(cells.length * 8);
  const index: number[] = [];
  cells.forEach((cell, i) => {
    cell.corners.forEach((p, k) => pos.set(p, i * 12 + k * 3));
    // Esquinas: atrás-izq, atrás-der, delante-der, delante-izq. v = 1 es delante (arriba de la ficha).
    const u0 = TILE_COLUMN[cell.color] / 3;
    const quad = [
      [u0, 0],
      [u0 + 1 / 3, 0],
      [u0 + 1 / 3, 1],
      [u0, 1],
    ];
    quad.forEach(([u, v], k) => uv.set([u!, v!], i * 8 + k * 2));
    const o = i * 4;
    index.push(o, o + 2, o + 1, o, o + 3, o + 2);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({
    map: atlasTexture(),
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "turbos-suelo";
  mesh.renderOrder = 1;
  return mesh;
}
