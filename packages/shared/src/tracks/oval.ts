import type { TrackPoint } from "../track";

/**
 * Óvalo cerrado que empieza en la meta (abajo, z negativa) y gira en sentido antihorario.
 * Garantiza curvas amplias para el test de radio mínimo.
 */
export function ovalTrack(
  rx: number,
  rz: number,
  scale: number,
  n = 16,
  extra?: (t: number) => { y?: number; w?: number },
): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = -Math.PI / 2 + t * Math.PI * 2;
    const e = extra?.(t) ?? {};
    pts.push({
      x: rx * Math.cos(a) * scale,
      z: rz * Math.sin(a) * scale,
      y: e.y ?? 0,
      ...(e.w !== undefined ? { w: e.w } : {}),
    });
  }
  return pts;
}
