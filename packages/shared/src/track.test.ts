import { describe, expect, it } from "vitest";
import { closestPoint, createOvalTrack, pointAt, type Track } from "./track";
import { pruebasTrack } from "./tracks/00-pruebas";

function checkShape(track: Track) {
  const pts = track.points;
  const n = pts.length;
  // Ninguna parte de la pista se solapa con otra (distancia > ancho entre tramos lejanos).
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const along = Math.min(Math.abs(track.lengths[i]! - track.lengths[j]!), track.length - Math.abs(track.lengths[i]! - track.lengths[j]!));
      if (along < track.width * 2.5) continue;
      const d = Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z);
      expect(d, `tramos ${i} y ${j} demasiado cerca`).toBeGreaterThan(track.width + 4);
    }
  }
  // Las curvas no son tan cerradas que el borde interior se doble.
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]!;
    const b = pts[i]!;
    const c = pts[(i + 1) % n]!;
    const ab = Math.hypot(b.x - a.x, b.z - a.z);
    const bc = Math.hypot(c.x - b.x, c.z - b.z);
    const ac = Math.hypot(c.x - a.x, c.z - a.z);
    const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    const radius = area2 < 1e-9 ? Infinity : (ab * bc * ac) / (2 * area2);
    expect(radius, `curva demasiado cerrada en ${i}`).toBeGreaterThan(track.width / 2 + 1);
  }
}

describe("pista", () => {
  it("el circuito de pruebas no se cruza ni tiene curvas imposibles", () => {
    checkShape(pruebasTrack);
    expect(pruebasTrack.length).toBeGreaterThan(500);
  });

  it("pointAt y closestPoint están de acuerdo en distancia y lado", () => {
    for (const track of [pruebasTrack, createOvalTrack()]) {
      for (const d of [0, 37, track.length * 0.4, track.length * 0.8]) {
        for (const lateral of [-4, 0, 4]) {
          const p = pointAt(track, d, lateral);
          const c = closestPoint(track, p.x, p.z);
          expect(c.lateral).toBeCloseTo(lateral, 1);
          const diff = Math.abs(c.distance - d) % track.length;
          expect(Math.min(diff, track.length - diff)).toBeLessThan(0.5);
        }
      }
    }
  });

  it("la izquierda de la pista es hacia donde gira el kart con rumbo positivo", () => {
    const track = createOvalTrack();
    const p = pointAt(track, 0);
    const left = pointAt(track, 0, 3);
    // Girar a la izquierda suma rumbo: la dirección (sin, cos) del rumbo+90º apunta a la izquierda.
    const lx = Math.sin(p.heading + Math.PI / 2);
    const lz = Math.cos(p.heading + Math.PI / 2);
    expect((left.x - p.x) * lx + (left.z - p.z) * lz).toBeCloseTo(3, 3);
  });
});
