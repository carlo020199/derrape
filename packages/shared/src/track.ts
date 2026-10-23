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
  return { points, width };
}

export function closestPoint(track: Track, x: number, z: number): ClosestPoint {
  const pts = track.points;
  let best: ClosestPoint = { x: 0, z: 0, lateral: 0, segment: 0 };
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
      const side = Math.sign(dx * (z - a.z) - dz * (x - a.x)) || 1;
      best = { x: px, z: pz, lateral: Math.sqrt(d2) * side, segment: i };
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
  const a = track.points[0]!;
  const b = track.points[1]!;
  return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}
