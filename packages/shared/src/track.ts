// Pista: línea central cerrada con altura y ancho por punto, arcén y zonas especiales.
// La física es 2D (x, z); la altura solo se usa para dibujar.

import { bounceKart, type KartState } from "./kart";
import { KART, type KartTuning } from "./tuning";

export interface TrackPoint {
  x: number;
  z: number;
  /** Altura (m). Solo visual. */
  y?: number;
  /** Ancho del asfalto en este punto (m). Si falta, el de la pista. */
  w?: number;
}

/** Tipos de zona especial reutilizables por cualquier circuito. */
export type ZoneType = "slow" | "lowGrip" | "boostPad" | "fall";

export interface TrackZone {
  type: ZoneType;
  /** Tramo de la vuelta (m desde la salida). Si `to` < `from`, cruza la meta. */
  from: number;
  to: number;
  /** Franja lateral (m a la izquierda del centro). Por defecto, todo el ancho. */
  lateralMin: number;
  lateralMax: number;
}

export interface Track {
  /** Línea central cerrada (el último punto conecta con el primero), con y/w ya rellenos. */
  points: Required<TrackPoint>[];
  /** Distancia acumulada desde la salida hasta cada punto (m). */
  lengths: number[];
  /** Longitud de una vuelta (m). */
  length: number;
  /** Ancho por defecto del asfalto (m). */
  width: number;
  /** Arcén a cada lado del asfalto antes del muro (m). En el arcén se va lento. */
  verge: number;
  zones: TrackZone[];
}

export type Surface = "road" | "offroad" | ZoneType;

export interface ClosestPoint {
  x: number;
  z: number;
  y: number;
  /** Ancho del asfalto en ese punto. */
  width: number;
  /** Distancia con signo al centro: positiva a la izquierda según el sentido de la pista. */
  lateral: number;
  /** Índice del segmento. */
  segment: number;
  /** Distancia recorrida a lo largo de la pista desde la salida (0..length). */
  distance: number;
}

export function buildTrack(points: TrackPoint[], width: number, verge = 0, zones: TrackZone[] = []): Track {
  const full = points.map((p) => ({ x: p.x, z: p.z, y: p.y ?? 0, w: p.w ?? width }));
  const lengths: number[] = [0];
  for (let i = 1; i <= full.length; i++) {
    const a = full[i - 1]!;
    const b = full[i % full.length]!;
    lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const length = lengths.pop()!;
  return { points: full, lengths, length, width, verge, zones };
}

/** Óvalo de prueba: dos rectas unidas por semicírculos. */
export function createOvalTrack(straight = 120, radius = 45, width = 16, segmentsPerCurve = 32): Track {
  const points: TrackPoint[] = [];
  const half = straight / 2;
  // Recta derecha hacia +Z, curva arriba, recta izquierda hacia -Z, curva abajo.
  for (let i = 0; i <= segmentsPerCurve; i++) {
    const a = (i / segmentsPerCurve) * Math.PI;
    points.push({ x: radius * Math.cos(a), z: half + radius * Math.sin(a) });
  }
  for (let i = 0; i <= segmentsPerCurve; i++) {
    const a = Math.PI + (i / segmentsPerCurve) * Math.PI;
    points.push({ x: radius * Math.cos(a), z: -half + radius * Math.sin(a) });
  }
  return buildTrack(points, width);
}

/**
 * Curva suave y cerrada que pasa por los puntos de control (Catmull-Rom),
 * remuestreada a puntos separados `spacing` metros. Interpola también altura y ancho.
 */
export function smoothTrack(control: TrackPoint[], width: number, spacing = 3, verge = 0): Track {
  const n = control.length;
  const c = control.map((p) => ({ x: p.x, z: p.z, y: p.y ?? 0, w: p.w ?? width }));
  const dense: Required<TrackPoint>[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = c[(i - 1 + n) % n]!;
    const p1 = c[i]!;
    const p2 = c[(i + 1) % n]!;
    const p3 = c[(i + 2) % n]!;
    const steps = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / 0.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, cc: number, d: number) =>
        0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      dense.push({
        x: f(p0.x, p1.x, p2.x, p3.x),
        z: f(p0.z, p1.z, p2.z, p3.z),
        y: f(p0.y, p1.y, p2.y, p3.y),
        w: p1.w + (p2.w - p1.w) * t,
      });
    }
  }
  // Remuestrear a distancia constante para que los segmentos sean parecidos.
  const fine = buildTrack(dense, width);
  const count = Math.max(8, Math.round(fine.length / spacing));
  const points: TrackPoint[] = [];
  for (let i = 0; i < count; i++) {
    const p = pointAt(fine, (i / count) * fine.length);
    points.push({ x: p.x, z: p.z, y: p.y, w: p.width });
  }
  return buildTrack(points, width, verge);
}

/** Lleva una distancia cualquiera al rango 0..length. */
export function wrapDistance(track: Track, d: number): number {
  return ((d % track.length) + track.length) % track.length;
}

/** Punto a `distance` metros desde la salida, desplazado `lateral` metros a la izquierda. */
export function pointAt(
  track: Track,
  distance: number,
  lateral = 0,
): { x: number; z: number; y: number; width: number; heading: number } {
  const d = wrapDistance(track, distance);
  const { points, lengths } = track;
  // Búsqueda binaria del segmento.
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lengths[mid]! <= d) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo]!;
  const b = points[(lo + 1) % points.length]!;
  const segLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const u = (d - lengths[lo]!) / segLen;
  const dx = (b.x - a.x) / segLen;
  const dz = (b.z - a.z) / segLen;
  // Normal izquierda (dz, -dx): la del sentido en que gira el kart con rumbo positivo.
  return {
    x: a.x + (b.x - a.x) * u + dz * lateral,
    z: a.z + (b.z - a.z) * u - dx * lateral,
    y: a.y + (b.y - a.y) * u,
    width: a.w + (b.w - a.w) * u,
    heading: Math.atan2(dx, dz),
  };
}

export function closestPoint(track: Track, x: number, z: number): ClosestPoint {
  const pts = track.points;
  let best = 0;
  let bestU = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
    const d2 = (x - (a.x + dx * u)) ** 2 + (z - (a.z + dz * u)) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
      bestU = u;
    }
  }
  const a = pts[best]!;
  const b = pts[(best + 1) % pts.length]!;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const px = a.x + dx * bestU;
  const pz = a.z + dz * bestU;
  // Producto cruzado: >0 si el punto está a la izquierda del segmento.
  const side = Math.sign(dz * (x - a.x) - dx * (z - a.z)) || 1;
  return {
    x: px,
    z: pz,
    y: a.y + (b.y - a.y) * bestU,
    width: a.w + (b.w - a.w) * bestU,
    lateral: Math.sqrt(bestD2) * side,
    segment: best,
    distance: track.lengths[best]! + Math.hypot(dx, dz) * bestU,
  };
}

function inZone(zone: TrackZone, c: ClosestPoint): boolean {
  if (c.lateral < zone.lateralMin || c.lateral > zone.lateralMax) return false;
  return zone.from <= zone.to
    ? c.distance >= zone.from && c.distance <= zone.to
    : c.distance >= zone.from || c.distance <= zone.to;
}

/** Superficie bajo el kart: las zonas especiales mandan; si no, asfalto o arcén. */
export function surfaceAt(track: Track, c: ClosestPoint): Surface {
  for (const z of track.zones) if (inZone(z, c)) return z.type;
  return Math.abs(c.lateral) <= c.width / 2 ? "road" : "offroad";
}

/**
 * Mantiene el kart dentro de los muros (asfalto + arcén) y devuelve el punto más cercano,
 * que también sirve para saber la superficie y el progreso.
 */
export function collideKartWithTrack(s: KartState, track: Track, t: KartTuning = KART): ClosestPoint {
  const c = closestPoint(track, s.x, s.z);
  const limit = c.width / 2 + track.verge - t.radius;
  const dist = Math.abs(c.lateral);
  if (dist <= limit) return c;
  // Normal hacia el centro de la pista.
  const nx = (c.x - s.x) / dist;
  const nz = (c.z - s.z) / dist;
  bounceKart(s, nx, nz, dist - limit, t);
  return { ...c, lateral: Math.sign(c.lateral) * limit };
}

/** Posición y rumbo de salida: inicio del primer segmento, mirando a lo largo de la pista. */
export function startPose(track: Track): { x: number; z: number; heading: number } {
  return pointAt(track, 0);
}

/** Posiciones de la parrilla de salida: dos columnas detrás de la meta. */
export function gridPose(track: Track, slot: number): { x: number; z: number; heading: number } {
  const row = Math.floor(slot / 2);
  const side = slot % 2 === 0 ? 1 : -1;
  const lateral = side * Math.min(3, track.width / 4);
  return pointAt(track, -6 - row * 6 - (side < 0 ? 3 : 0), lateral);
}
