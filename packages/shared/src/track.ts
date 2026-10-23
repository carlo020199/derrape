// Pista como línea central cerrada con ancho. En la Fase 3 pasa a ser spline 3D con datos por circuito.

import { bounceKart, type KartState } from "./kart";
import { KART, type KartTuning } from "./tuning";

export interface TrackPoint {
  x: number;
  z: number;
}

export interface Track {
  /** Línea central cerrada (el último punto conecta con el primero). */
  points: TrackPoint[];
  /** Distancia acumulada desde la salida hasta cada punto (m). */
  lengths: number[];
  /** Longitud de una vuelta (m). */
  length: number;
  /** Ancho total de la pista (m). */
  width: number;
}

export interface ClosestPoint {
  x: number;
  z: number;
  /** Distancia con signo al centro: positiva a la izquierda según el sentido de la pista. */
  lateral: number;
  /** Índice del segmento. */
  segment: number;
  /** Distancia recorrida a lo largo de la pista desde la salida (0..length). */
  distance: number;
}

export function buildTrack(points: TrackPoint[], width: number): Track {
  const lengths: number[] = [0];
  for (let i = 1; i <= points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i % points.length]!;
    lengths.push(lengths[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const length = lengths.pop()!;
  return { points, lengths, length, width };
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
 * remuestreada a puntos separados `spacing` metros.
 */
export function smoothTrack(control: TrackPoint[], width: number, spacing = 3): Track {
  const n = control.length;
  const dense: TrackPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = control[(i - 1 + n) % n]!;
    const p1 = control[i]!;
    const p2 = control[(i + 1) % n]!;
    const p3 = control[(i + 2) % n]!;
    const steps = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / 0.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  // Remuestrear a distancia constante para que los segmentos sean parecidos.
  const fine = buildTrack(dense, width);
  const count = Math.max(8, Math.round(fine.length / spacing));
  const points: TrackPoint[] = [];
  for (let i = 0; i < count; i++) {
    const p = pointAt(fine, (i / count) * fine.length);
    points.push({ x: p.x, z: p.z });
  }
  return buildTrack(points, width);
}

/** Lleva una distancia cualquiera al rango 0..length. */
export function wrapDistance(track: Track, d: number): number {
  return ((d % track.length) + track.length) % track.length;
}

/** Punto a `distance` metros desde la salida, desplazado `lateral` metros a la izquierda. */
export function pointAt(track: Track, distance: number, lateral = 0): { x: number; z: number; heading: number } {
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
  return { x: a.x + (b.x - a.x) * u + dz * lateral, z: a.z + (b.z - a.z) * u - dx * lateral, heading: Math.atan2(dx, dz) };
}

export function closestPoint(track: Track, x: number, z: number): ClosestPoint {
  const pts = track.points;
  let best: ClosestPoint = { x: 0, z: 0, lateral: 0, segment: 0, distance: 0 };
  let bestD2 = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2));
    const px = a.x + dx * u;
    const pz = a.z + dz * u;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      // Producto cruzado: >0 si el punto está a la izquierda del segmento.
      const side = Math.sign(dz * (x - a.x) - dx * (z - a.z)) || 1;
      best = {
        x: px,
        z: pz,
        lateral: Math.sqrt(d2) * side,
        segment: i,
        distance: track.lengths[i]! + Math.sqrt(len2) * u,
      };
    }
  }
  return best;
}

/** Mantiene el kart dentro de los bordes de la pista. Devuelve true si ha chocado. */
export function collideKartWithTrack(s: KartState, track: Track, t: KartTuning = KART): boolean {
  const c = closestPoint(track, s.x, s.z);
  const limit = track.width / 2 - t.radius;
  const dist = Math.abs(c.lateral);
  if (dist <= limit) return false;
  // Normal hacia el centro de la pista.
  const nx = (c.x - s.x) / dist;
  const nz = (c.z - s.z) / dist;
  bounceKart(s, nx, nz, dist - limit, t);
  return true;
}

/** Posición y rumbo de salida: inicio del primer segmento, mirando a lo largo de la pista. */
export function startPose(track: Track): { x: number; z: number; heading: number } {
  return pointAt(track, 0);
}
