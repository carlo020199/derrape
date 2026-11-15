import { describe, expect, it } from "vitest";
import { closestPoint, createOvalTrack, pointAt, rampCrossed, surfaceHeight, type Track } from "./track";
import { KART } from "./tuning";
import { TRACKS } from "./tracks/index";
import { buildTrackFromDef } from "./tracks/types";

function checkShape(track: Track) {
  const pts = track.points;
  const n = pts.length;
  // Ninguna parte de la pista se solapa con otra (distancia > ancho entre tramos lejanos).
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const along = Math.min(Math.abs(track.lengths[i]! - track.lengths[j]!), track.length - Math.abs(track.lengths[i]! - track.lengths[j]!));
      const outer = track.width + track.verge * 2;
      if (along < outer * 2.5) continue;
      const d = Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z);
      expect(d, `tramos ${i} y ${j} demasiado cerca`).toBeGreaterThan(outer + 4);
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
  for (const entry of TRACKS) {
    it(`${entry.name}: no se cruza ni tiene curvas imposibles`, async () => {
      const def = await entry.load();
      expect(def.id).toBe(entry.id);
      checkShape(buildTrackFromDef(def));
    });
  }

  it("Paseo del Puerto: vuelta de 60–75 s a un ritmo realista", async () => {
    const def = await TRACKS.find((t) => t.id === "paseo-del-puerto")!.load();
    const track = buildTrackFromDef(def);
    // Ritmo medio de una vuelta buena: ~85 % de la punta (curvas, derrapes y turbos se compensan).
    const lap = track.length / (KART.maxSpeed * 0.85);
    expect(lap).toBeGreaterThan(60);
    expect(lap).toBeLessThan(75);
  });

  it("pointAt y closestPoint están de acuerdo en distancia y lado", async () => {
    const pruebas = buildTrackFromDef(await TRACKS[0]!.load());
    for (const track of [pruebas, createOvalTrack()]) {
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

describe("Laguna de las Ánimas", () => {
  const load = async () => buildTrackFromDef(await TRACKS.find((t) => t.id === "laguna-de-las-animas")!.load());

  it("mide unos 1.450 m y se recorre en sentido antihorario", async () => {
    const track = await load();
    expect(track.length).toBeGreaterThan(1380);
    expect(track.length).toBeLessThan(1520);
    // Rumbo positivo = izquierda: una vuelta antihoraria suma +360º.
    let turned = 0;
    for (let d = 0; d < track.length; d += 3) {
      let diff = pointAt(track, d + 3).heading - pointAt(track, d).heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      turned += diff;
    }
    expect(turned).toBeCloseTo(Math.PI * 2, 1);
  });

  it("los peraltes inclinan la pista hacia el interior de cada curva", async () => {
    const track = await load();
    let banked = 0;
    for (let d = 0; d < track.length; d += 6) {
      const here = pointAt(track, d);
      if (Math.abs(here.bank) < 0.15) continue;
      banked++;
      let turn = pointAt(track, d + 12).heading - pointAt(track, d - 12).heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      // Curva a la izquierda (turn > 0) → peralte negativo (borde derecho alto), y al revés.
      expect(Math.sign(turn), `peralte al revés en ${d} m`).toBe(-Math.sign(here.bank));
      // Y el borde exterior queda más alto que el centro.
      const outside = pointAt(track, d, -Math.sign(turn) * 5);
      const c = closestPoint(track, outside.x, outside.z);
      expect(surfaceHeight(c)).toBeGreaterThan(c.y);
    }
    expect(banked).toBeGreaterThan(30);
  });

  it("tiene tres rampas (S, M, L) en recta y se detectan al cruzarlas hacia delante", async () => {
    const track = await load();
    expect(track.ramps.map((r) => r.size)).toEqual(["S", "M", "L"]);
    for (const ramp of track.ramps) {
      // En recta: el rumbo casi no cambia en 30 m alrededor.
      let turn = pointAt(track, ramp.distance + 20).heading - pointAt(track, ramp.distance - 10).heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      expect(Math.abs(turn), `rampa ${ramp.size} en curva`).toBeLessThan(0.25);
      const after = pointAt(track, ramp.distance + 0.3);
      const c = closestPoint(track, after.x, after.z);
      expect(rampCrossed(track, ramp.distance - 0.2, c)?.size).toBe(ramp.size);
      expect(rampCrossed(track, ramp.distance + 0.1, c)).toBeNull(); // ya la había pasado
      const beside = pointAt(track, ramp.distance + 0.3, track.width / 2 + 3);
      expect(rampCrossed(track, ramp.distance - 0.2, closestPoint(track, beside.x, beside.z))).toBeNull(); // por el arcén
    }
  });
});
