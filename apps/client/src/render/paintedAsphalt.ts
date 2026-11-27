import * as THREE from "three";
import { closestPoint, type PaintedAreaDef, type Track, type TrackDef } from "@derrape/shared";
import { PALETTE } from "./materials";

// Asfalto pintado decorativo (Desván): escapatorias rosa y morada con motivos de fantasía y «patrocinadores»
// inventados, como los logos de las escapatorias de F1. NO es superficie de juego: `surfaceAt` no lo conoce y queda
// fuera del muro. Una sola malla (losas + faldón) con una textura canvas de 1024×576: 1 llamada de dibujo.
// Colores: solo la paleta del juego (Ánima/Ánima profunda para el morado, el rosa de las cenefas de la Feria, Texto, Hueso, Ciruela).

const ROSA = 0xff5fa2;
/** Lado (px) de la ficha de cada zona y alto de la tira de muestras de color del faldón. */
export const TILE = 512;
const SWATCH = 64;
const ATLAS_W = TILE * 2;
const ATLAS_H = TILE + SWATCH;
/** Grosor del faldón de la losa (m): sin él, vista de lado, la losa sería de papel flotando sobre el vacío. */
const SKIRT = 0.6;

export type AreaKind = PaintedAreaDef["kind"];
const COLUMN: Record<AreaKind, number> = { rosa: 0, morada: 1 };

const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const css = (c: THREE.Color | number) => `#${(c instanceof THREE.Color ? c : new THREE.Color(c)).getHexString()}`;

/** Colores de cada zona: asfalto, borde, línea pintada, motivo principal y motivo secundario. */
const SCHEME: Record<AreaKind, { asphalt: THREE.Color; edge: THREE.Color; line: THREE.Color; main: THREE.Color; alt: THREE.Color }> = {
  rosa: {
    asphalt: mix(PALETTE.ciruela, ROSA, 0.42),
    edge: mix(PALETTE.ciruela, ROSA, 0.7),
    line: new THREE.Color(PALETTE.texto),
    main: new THREE.Color(ROSA),
    alt: new THREE.Color(PALETTE.hueso),
  },
  morada: {
    asphalt: mix(PALETTE.ciruela, PALETTE.animaProfunda, 0.8),
    edge: new THREE.Color(PALETTE.anima),
    line: new THREE.Color(PALETTE.hueso),
    main: new THREE.Color(PALETTE.anima),
    alt: new THREE.Color(PALETTE.texto),
  },
};

export interface PaintedArea {
  kind: AreaKind;
  points: { x: number; z: number }[];
  /** Altura de la losa: un poco por debajo del asfalto más bajo de alrededor. */
  y: number;
}

/** Zonas pintadas del circuito con su altura. Sin Three.js ni DOM. */
export function paintedAreas(track: Track, def: TrackDef): PaintedArea[] {
  return (def.paint ?? []).map((a) => {
    const cx = a.points.reduce((s, p) => s + p.x, 0) / a.points.length;
    const cz = a.points.reduce((s, p) => s + p.z, 0) / a.points.length;
    const low = Math.min(...[...a.points, { x: cx, z: cz }].map((p) => closestPoint(track, p.x, p.z).y));
    return { kind: a.kind, points: a.points, y: low - 0.1 };
  });
}

/**
 * Sistema de coordenadas de una zona: u a lo largo de su lado más largo, v hacia arriba visto desde arriba
 * (así el texto se lee sin espejo), en metros desde la esquina inferior izquierda de su caja.
 */
export interface AreaFrame {
  u: { x: number; z: number };
  v: { x: number; z: number };
  cx: number;
  cz: number;
  /** Píxeles de ficha por metro. */
  ppm: number;
  /** Polígono en (u, v) con origen en la esquina de la caja (v hacia arriba). */
  poly: { u: number; v: number }[];
  width: number;
  height: number;
}

export function areaFrame(points: { x: number; z: number }[]): AreaFrame {
  let best = 0;
  let ux = 1;
  let uz = 0;
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len > best) {
      best = len;
      ux = (b.x - a.x) / len;
      uz = (b.z - a.z) / len;
    }
  });
  // Visto desde arriba el eje derecho es x y el de arriba es -z: rotar u 90° a la izquierda da v = (uz, -ux).
  const vx = uz;
  const vz = -ux;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cz = points.reduce((s, p) => s + p.z, 0) / points.length;
  const raw = points.map((p) => ({ u: (p.x - cx) * ux + (p.z - cz) * uz, v: (p.x - cx) * vx + (p.z - cz) * vz }));
  const umin = Math.min(...raw.map((p) => p.u));
  const umax = Math.max(...raw.map((p) => p.u));
  const vmin = Math.min(...raw.map((p) => p.v));
  const vmax = Math.max(...raw.map((p) => p.v));
  const width = umax - umin;
  const height = vmax - vmin;
  const ppm = (TILE * 0.98) / Math.max(width, height);
  return {
    u: { x: ux, z: uz },
    v: { x: vx, z: vz },
    cx,
    cz,
    ppm,
    poly: raw.map((p) => ({ u: p.u - umin, v: p.v - vmin })),
    width,
    height,
  };
}

/** Distancia (m) de un punto al borde más cercano del polígono y si está dentro (polígono convexo). */
function clearance(poly: { u: number; v: number }[], u: number, v: number): number {
  let d = Infinity;
  let inside = true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ex = b.u - a.u;
    const ev = b.v - a.v;
    const len = Math.hypot(ex, ev) || 1;
    const cross = (ex * (v - a.v) - ev * (u - a.u)) / len;
    d = Math.min(d, Math.abs(cross));
    const t = Math.max(0, Math.min(1, ((u - a.u) * ex + (v - a.v) * ev) / (len * len)));
    d = Math.min(d, Math.hypot(u - (a.u + ex * t), v - (a.v + ev * t)));
    if (cross < 0) inside = false;
  }
  // El signo de `cross` depende del sentido del polígono: se acepta cualquiera de los dos.
  if (inside) return d;
  const allNegative = poly.every((_, i) => {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    return (b.u - a.u) * (v - a.v) - (b.v - a.v) * (u - a.u) <= 0;
  });
  return allNegative ? d : -d;
}

export type MotifKind = "estrella" | "seta" | "calavera" | "logo";
export interface Motif {
  kind: MotifKind;
  /** Centro en metros (u, v) del marco de la zona. */
  u: number;
  v: number;
  /** Radio del motivo; en un logo, el semiancho. */
  size: number;
  /** Medio alto del logo. */
  half?: number;
  text?: string;
  variant: number;
}

const LOGOS: Record<AreaKind, string[]> = {
  rosa: ["SETAS MIL", "PAN DE LUNA"],
  morada: ["CHISPA-COLA", "DON CALAVERA"],
};
const MOTIFS: Record<AreaKind, MotifKind[]> = {
  rosa: ["seta", "estrella", "seta", "calavera", "estrella"],
  morada: ["calavera", "estrella", "calavera", "seta", "estrella"],
};

/**
 * Reparte logos y motivos dentro de la zona: primero los logos en los puntos más despejados, luego los adornos.
 * Determinista (sin azar): mismas zonas, mismos dibujos.
 */
export function layoutMotifs(kind: AreaKind, frame: AreaFrame): Motif[] {
  const out: Motif[] = [];
  const step = 1.5;
  const grid: { u: number; v: number; c: number }[] = [];
  for (let u = 0; u <= frame.width; u += step) {
    for (let v = 0; v <= frame.height; v += step) {
      const c = clearance(frame.poly, u, v);
      if (c > 0.5) grid.push({ u, v, c });
    }
  }
  grid.sort((a, b) => b.c - a.c || a.u - b.u || a.v - b.v);
  const free = (u: number, v: number, r: number) => out.every((m) => Math.hypot(m.u - u, m.v - v) >= m.size * (m.half ? 1.05 : 1) + r);
  const scale = Math.min(1, Math.max(frame.width, frame.height) / 45);
  const logoHalf = 2.1 * scale;
  const logoWide = 6.3 * scale;
  for (const text of LOGOS[kind]) {
    for (const g of grid) {
      const corners = [
        [g.u - logoWide, g.v - logoHalf],
        [g.u + logoWide, g.v - logoHalf],
        [g.u + logoWide, g.v + logoHalf],
        [g.u - logoWide, g.v + logoHalf],
      ] as const;
      if (!corners.every(([u, v]) => clearance(frame.poly, u, v) >= 1)) continue;
      if (!free(g.u, g.v, logoWide + 0.8)) continue;
      out.push({ kind: "logo", u: g.u, v: g.v, size: logoWide, half: logoHalf, text, variant: out.length });
      break;
    }
  }
  const r = 2.1 * scale;
  const kinds = MOTIFS[kind];
  let n = 0;
  for (const g of grid) {
    if (n >= 10) break;
    if (g.c < r + 0.8 || !free(g.u, g.v, r + 0.6)) continue;
    out.push({ kind: kinds[n % kinds.length]!, u: g.u, v: g.v, size: r, variant: n });
    n++;
  }
  return out;
}

/**
 * Geometría fusionada: losa plana por zona (abanico desde el primer vértice; los polígonos son convexos) y faldón.
 * Las UV de la losa salen de la caja de la zona; las del faldón apuntan a una muestra de color lisa del atlas.
 */
export function paintedGeometry(areas: PaintedArea[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const push = (x: number, y: number, z: number, u: number, v: number) => {
    pos.push(x, y, z);
    uv.push(u, v);
    return pos.length / 3 - 1;
  };
  for (const area of areas) {
    const f = areaFrame(area.points);
    const col = COLUMN[area.kind];
    const first = pos.length / 3;
    f.poly.forEach((p, i) => {
      const q = area.points[i]!;
      // Píxel de la ficha: x desde la izquierda, y desde arriba (v crece hacia arriba).
      const px = col * TILE + p.u * f.ppm;
      const cy = (f.height - p.v) * f.ppm;
      push(q.x, area.y, q.z, px / ATLAS_W, 1 - cy / ATLAS_H);
    });
    for (let i = 1; i < f.poly.length - 1; i++) index.push(first, first + i, first + i + 1);
    const sw = [(col + 0.5) * TILE, TILE + SWATCH / 2];
    const n = area.points.length;
    for (let i = 0; i < n; i++) {
      const a = area.points[i]!;
      const b = area.points[(i + 1) % n]!;
      const o = pos.length / 3;
      for (const [p, y] of [
        [a, area.y],
        [b, area.y],
        [b, area.y - SKIRT],
        [a, area.y - SKIRT],
      ] as const) {
        push(p.x, y, p.z, sw[0]! / ATLAS_W, 1 - sw[1]! / ATLAS_H);
      }
      index.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------------------------------------- textura

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, line: string) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = Math.max(2, r * 0.12);
  g.lineJoin = "round";
  g.strokeStyle = line;
  g.stroke();
}

function mushroom(g: CanvasRenderingContext2D, x: number, y: number, r: number, cap: string, dots: string, stem: string, line: string) {
  g.lineWidth = Math.max(2, r * 0.1);
  g.strokeStyle = line;
  g.fillStyle = stem;
  g.beginPath();
  g.roundRect(x - r * 0.32, y, r * 0.64, r * 0.85, r * 0.2);
  g.fill();
  g.stroke();
  g.fillStyle = cap;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.8, 0, Math.PI, 0);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = dots;
  for (const [dx, dy, dr] of [
    [-0.45, -0.35, 0.2],
    [0.25, -0.5, 0.25],
    [0.55, -0.2, 0.15],
  ] as const) {
    g.beginPath();
    g.arc(x + dx * r, y + dy * r, dr * r, 0, Math.PI * 2);
    g.fill();
  }
}

function skull(g: CanvasRenderingContext2D, x: number, y: number, r: number, bone: string, ink: string) {
  g.lineWidth = Math.max(2, r * 0.1);
  g.strokeStyle = ink;
  g.fillStyle = bone;
  g.beginPath();
  g.arc(x, y - r * 0.1, r * 0.85, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.roundRect(x - r * 0.5, y + r * 0.45, r, r * 0.55, r * 0.15);
  g.fill();
  g.stroke();
  // Ojos grandes y sonrisa: calavera simpática.
  g.fillStyle = ink;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + s * r * 0.35, y - r * 0.15, r * 0.22, r * 0.28, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.arc(x, y + r * 0.15, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  g.lineCap = "round";
  g.stroke();
}

function logo(g: CanvasRenderingContext2D, m: Motif, ppm: number, x: number, y: number, k: (typeof SCHEME)[AreaKind]) {
  const w = m.size * ppm * 2;
  const h = (m.half ?? 1) * ppm * 2;
  const alt = m.variant % 2 === 1;
  g.lineWidth = Math.max(3, h * 0.08);
  g.strokeStyle = css(k.line);
  g.fillStyle = css(alt ? k.main : mix(PALETTE.ciruela, k.main.getHex(), 0.2));
  g.beginPath();
  g.roundRect(x - w / 2, y - h / 2, w, h, h * 0.3);
  g.fill();
  g.stroke();
  g.fillStyle = css(alt ? PALETTE.ciruela : k.line);
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = h * 0.55;
  g.font = `${size}px "Lilita One", Impact, "Arial Black", sans-serif`;
  const text = m.text ?? "";
  const maxWidth = w * 0.88;
  const measured = g.measureText(text).width;
  if (measured > maxWidth) {
    size *= maxWidth / measured;
    g.font = `${size}px "Lilita One", Impact, "Arial Black", sans-serif`;
  }
  g.fillText(text, x, y + h * 0.03);
}

/** Atlas 1024×576: ficha rosa, ficha morada y debajo la tira de muestras lisas del faldón. */
function atlasTexture(areas: PaintedArea[]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = ATLAS_W;
  c.height = ATLAS_H;
  const g = c.getContext("2d")!;
  for (const kind of ["rosa", "morada"] as const) {
    const col = COLUMN[kind];
    const k = SCHEME[kind];
    g.fillStyle = css(mix(PALETTE.ciruela, k.edge.getHex(), 0.5));
    g.fillRect(col * TILE, TILE, TILE, SWATCH);
    g.fillStyle = css(k.asphalt);
    g.fillRect(col * TILE, 0, TILE, TILE);
    const area = areas.find((a) => a.kind === kind);
    if (!area) continue;
    const f = areaFrame(area.points);
    const height = f.height;
    const px = (u: number) => col * TILE + u * f.ppm;
    const py = (v: number) => (height - v) * f.ppm;
    g.save();
    g.beginPath();
    g.rect(col * TILE, 0, TILE, TILE);
    g.clip();
    // Borde pintado y línea de puntos interior, como el borde de una escapatoria.
    g.beginPath();
    f.poly.forEach((p, i) => (i === 0 ? g.moveTo(px(p.u), py(p.v)) : g.lineTo(px(p.u), py(p.v))));
    g.closePath();
    g.lineJoin = "round";
    g.lineWidth = f.ppm * 1.4;
    g.strokeStyle = css(k.edge);
    g.stroke();
    g.lineWidth = f.ppm * 0.25;
    g.strokeStyle = css(k.line);
    g.setLineDash([f.ppm * 1.2, f.ppm * 0.9]);
    g.save();
    g.translate(px(f.width / 2), py(f.height / 2));
    g.scale(0.9, 0.9);
    g.translate(-px(f.width / 2), -py(f.height / 2));
    g.stroke();
    g.restore();
    g.setLineDash([]);
    for (const m of layoutMotifs(kind, f)) {
      const x = px(m.u);
      const y = py(m.v);
      const r = m.size * f.ppm;
      if (m.kind === "logo") logo(g, m, f.ppm, x, y, k);
      else if (m.kind === "estrella") star(g, x, y, r, css(m.variant % 2 ? k.alt : k.main), css(PALETTE.ciruela));
      else if (m.kind === "seta") mushroom(g, x, y - r * 0.35, r, css(k.main), css(k.alt), css(PALETTE.hueso), css(PALETTE.ciruela));
      else skull(g, x, y, r, css(PALETTE.hueso), css(PALETTE.ciruela));
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Malla única con las zonas pintadas del circuito, o null si no tiene. */
export function paintedAsphaltMesh(track: Track, def: TrackDef): THREE.Mesh | null {
  const areas = paintedAreas(track, def);
  if (areas.length === 0) return null;
  const mesh = new THREE.Mesh(
    paintedGeometry(areas),
    new THREE.MeshBasicMaterial({ map: atlasTexture(areas), side: THREE.DoubleSide }),
  );
  mesh.name = "asfalto-pintado";
  return mesh;
}
