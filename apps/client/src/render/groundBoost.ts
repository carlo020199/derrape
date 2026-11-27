import * as THREE from "three";
import { isPadType, pointAt, surfaceY, type PadType, type Track } from "@derrape/shared";
import { PALETTE } from "./materials";

// Turbos de suelo (azul y naranja) pintados sobre la calzada. Todas las celdas de todas las zonas van en
// UNA malla fusionada con un atlas de dos fichas: 1 llamada de dibujo, sin importar cuántos turbos tenga el circuito.
// Azul = Espectro (turbo 1 de las chispas); naranja = Brasa (más naranja que Llama, que se lee amarillo). Flechas en Texto.

/** Largo de cada celda a lo largo de la pista y ancho máximo a lo ancho (m). */
export const CELL_LENGTH = 2.5;
export const CELL_WIDTH = 3;
/** Altura sobre la calzada: por encima de la línea de borde (0,07) no hace falta; el polygonOffset hace el resto. */
const LIFT = 0.05;

export type PadColor = "blue" | "orange";

export function padColor(type: PadType): PadColor {
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

/** Atlas 256×128: ficha azul a la izquierda y ficha naranja a la derecha. Cada ficha: fondo, borde oscuro y dos flechas hacia delante. */
function atlasTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  const tile = (x0: number, base: number) => {
    g.fillStyle = hex(PALETTE.sombra);
    g.fillRect(x0, 0, 128, 128);
    g.fillStyle = hex(base);
    g.fillRect(x0 + 6, 6, 116, 116);
    // Dos chevrones apuntando hacia arriba (el sentido de la marcha).
    for (const y of [26, 74]) {
      g.beginPath();
      g.moveTo(x0 + 20, y + 34);
      g.lineTo(x0 + 64, y);
      g.lineTo(x0 + 108, y + 34);
      g.lineTo(x0 + 108, y + 52);
      g.lineTo(x0 + 64, y + 18);
      g.lineTo(x0 + 20, y + 52);
      g.closePath();
      g.fillStyle = hex(PALETTE.texto);
      g.fill();
    }
  };
  tile(0, PALETTE.espectro);
  tile(128, PALETTE.brasa);
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
    const u0 = cell.color === "blue" ? 0 : 0.5;
    const quad = [
      [u0, 0],
      [u0 + 0.5, 0],
      [u0 + 0.5, 1],
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
