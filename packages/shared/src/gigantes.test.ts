import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { createKart, giveBoost, type KartState } from "./kart";
import { checkpointCount, createProgress, needsRespawn, respawnKart, updateProgress } from "./race";
import { closestPoint, liftAt, pointAt, stepKartOnTrack, surfaceAt, type Track } from "./track";
import { findTrack } from "./tracks/index";
import { buildTrackFromDef, type TrackDef } from "./tracks/types";
import { LANDING, PHYSICS_DT, RAMP } from "./tuning";

async function load(): Promise<{ def: TrackDef; track: Track }> {
  const def = await findTrack("desvan-de-las-maravillas")!.load();
  return { def, track: buildTrackFromDef(def) };
}

const GAS = { steer: 0, throttle: true, brake: false, drift: false };

interface Vuelo {
  despegue: number;
  aterriza: number;
  y: number;
  lateral: number;
  cae: boolean;
  boost: { time: number; mult: number };
  /** Altura máxima sobre la pista durante el vuelo. */
  pico: number;
  /** Distancia mínima en planta a otro tramo (no contiguo) durante el vuelo. */
  separacion: number;
  /** Altura del suelo del labio de despegue. */
  yLabio: number;
}

/** Entra en la rampa XL que empieza en `desde` m a `v0` m/s (con turbo si pasa de la punta) y devuelve el primer vuelo. */
function entrar(track: Track, desde: number, v0: number, opts: { lane?: number; antes?: number } = {}): Vuelo {
  const { lane = 0, antes = 40 } = opts;
  const pose = pointAt(track, desde - antes, lane);
  const s = createKart(pose.x, pose.z, pose.heading);
  s.speed = v0;
  if (v0 > 26.5) giveBoost(s, 4, v0 / 26);
  const v: Vuelo = { despegue: 0, aterriza: 0, y: 0, lateral: 0, cae: false, boost: { time: 0, mult: 1 }, pico: 0, separacion: Infinity, yLabio: 0 };
  let was = false;
  for (let i = 0; i < 60 * 12; i++) {
    const c = stepKartOnTrack(s, botInput({ lane, lookAhead: 12 }, s, track), PHYSICS_DT, track);
    if (s.airborne) {
      v.pico = Math.max(v.pico, s.y - c.y);
      for (let k = 0; k < track.points.length; k += 2) {
        const along = Math.abs(track.lengths[k]! - c.distance);
        if (Math.min(along, track.length - along) < 150) continue;
        v.separacion = Math.min(v.separacion, Math.hypot(track.points[k]!.x - s.x, track.points[k]!.z - s.z));
      }
    }
    if (s.airborne && !was) {
      v.despegue = c.distance;
      v.yLabio = s.y;
    }
    if (!s.airborne && was) {
      v.aterriza = c.distance;
      v.y = c.y;
      v.lateral = c.lateral;
      v.boost = { time: s.boostTime, mult: s.boostMult };
      return v;
    }
    if (s.surface === "fall") {
      v.cae = true;
      return v;
    }
    was = s.airborne;
  }
  return v;
}

describe("Desván: plataforma flotante (tramo elevado de la propia pista)", () => {
  it("datos: la meseta está a +3 m, sube y baja con pendiente suave y los lados son zonas fall", async () => {
    const { def, track } = await load();
    expect(track.lifts).toHaveLength(1);
    const lift = track.lifts[0]!;
    expect(lift.rise).toBe(3);
    expect(pointAt(track, lift.from + 10).y).toBeCloseTo(3, 1);
    expect(pointAt(track, lift.to - 10).y).toBeCloseTo(3, 1);
    expect(pointAt(track, lift.from - lift.easeIn - 6).y).toBeCloseTo(0, 1);
    expect(pointAt(track, lift.to + lift.easeOut + 6).y).toBeCloseTo(0, 1);
    // Pendiente máxima en subida (≈ 7 %) y bajada (≈ 11 %): bajo el 22 % de `trackSmoothness`.
    let g = 0;
    for (let d = lift.from - lift.easeIn - 10; d < lift.to + lift.easeOut + 10; d += 1) g = Math.max(g, Math.abs(pointAt(track, d + 1).y - pointAt(track, d).y));
    expect(g).toBeLessThan(0.12);
    // `liftAt` es la misma función que usa el mapa de alturas.
    expect(liftAt(track.lifts, track.length, lift.from + 5)).toBeCloseTo(3, 6);
    expect(liftAt(track.lifts, track.length, 300)).toBe(0);
    // A los lados no hay suelo: fall; en la calzada, asfalto (el eje y ±7 m).
    const mid = (lift.from + lift.to) / 2;
    const surf = (lateral: number) => surfaceAt(track, closestPoint(track, pointAt(track, mid, lateral).x, pointAt(track, mid, lateral).z));
    expect(surf(0)).toBe("road");
    expect(surf(7)).toBe("road");
    expect(surf(-7)).toBe("road");
    expect(surf(9)).toBe("fall");
    expect(surf(-9)).toBe("fall");
    // Una fila de cajas encima de la meseta.
    expect(def.itemRows.some((f) => f * track.length > lift.from && f * track.length < lift.to)).toBe(true);
  });

  it("hay dos rampas gigantes XL con muro alto: la de la plataforma y la que termina en salto", async () => {
    const { track } = await load();
    const xl = track.zones.filter((z) => z.size === "XL");
    expect(xl).toHaveLength(2);
    expect(RAMP.XL.lip).toBeGreaterThan(3 * 1.2);
    expect(xl[0]!.from).toBeGreaterThan(1400); // H, junto a la plataforma
    expect(xl[1]!.from).toBeGreaterThan(738); // D, diagonal 1
    expect(xl[1]!.to).toBeLessThan(979);
    // La plataforma empieza justo tras el labio de la primera.
    expect(track.lifts[0]!.from - track.lifts[0]!.easeIn).toBeGreaterThanOrEqual(xl[0]!.to - 1);
    for (const z of xl) expect(z.landBoost).toBe(true);
  });

  for (const v0 of [14, 20, 26, 39, 45.5]) {
    it(`vuelo y aterrizaje en la plataforma entrando a ${v0} m/s: despega en el labio, aterriza sobre la pista elevada sin caer`, async () => {
      const { track } = await load();
      const xl = track.zones.find((z) => z.size === "XL")!;
      const v = entrar(track, xl.from, v0);
      expect(v.cae).toBe(false);
      expect(v.despegue).toBeGreaterThan(xl.to - 1);
      expect(v.despegue).toBeLessThan(xl.to + 1);
      const lift = track.lifts[0]!;
      // Aterriza sobre la subida o la meseta, nunca después de la bajada.
      expect(v.aterriza).toBeGreaterThan(lift.from - lift.easeIn);
      expect(v.aterriza).toBeLessThan(lift.to);
      expect(v.y).toBeGreaterThan(1.5);
      expect(v.y).toBeLessThanOrEqual(3.01);
      expect(Math.abs(v.lateral)).toBeLessThan(3);
      // Cobra el turbo de aterrizaje ×1,5 (con un turbo de suelo más fuerte, gana el mayor).
      expect(v.boost.mult).toBeGreaterThanOrEqual(LANDING.mult - 1e-6);
      expect(v.boost.time).toBeGreaterThan(LANDING.time - 0.05);
    });
  }

  it("con naranja (45,5 m/s) el vuelo llega a la meseta y no se pasa del final", async () => {
    const { track } = await load();
    const xl = track.zones.find((z) => z.size === "XL")!;
    const v = entrar(track, xl.from, 45.5);
    expect(v.aterriza).toBeGreaterThan(track.lifts[0]!.from);
    expect(v.aterriza).toBeLessThan(track.lifts[0]!.to - 20);
  });

  it("sin saltar (lento, a 8 m/s) se sube la cuesta hasta la meseta y no se cae", async () => {
    const { track } = await load();
    const lift = track.lifts[0]!;
    const pose = pointAt(track, lift.from - lift.easeIn + 2);
    const s = createKart(pose.x, pose.z, pose.heading);
    s.speed = 6;
    let alto = 0;
    for (let i = 0; i < 60 * 8; i++) {
      const c = stepKartOnTrack(s, botInput({ lane: 0, lookAhead: 12 }, s, track), PHYSICS_DT, track);
      expect(s.surface).not.toBe("fall");
      alto = Math.max(alto, s.groundY);
      if (c.distance > lift.to) break;
    }
    expect(alto).toBeGreaterThan(2.9);
  });

  it("la cámara de persecución solo necesita la altura de la pista bajo el kart: surfaceY coincide con la meseta", async () => {
    const { track } = await load();
    const lift = track.lifts[0]!;
    const p = pointAt(track, lift.from + 20);
    const c = closestPoint(track, p.x, p.z);
    expect(c.y).toBeCloseTo(3, 1);
    expect(c.bank).toBeCloseTo(0, 0);
  });
});

describe("Desván: caída de la plataforma y reaparición", () => {
  it("un kart en la meseta que se sale por el borde (|lateral| > 8,5 m) cae: needsRespawn", async () => {
    const { track } = await load();
    const lift = track.lifts[0]!;
    const mid = (lift.from + lift.to) / 2;
    const pose = pointAt(track, mid, 7.5);
    const s = createKart(pose.x, pose.z, pose.heading);
    s.speed = 12;
    const p = createProgress();
    let cayó = false;
    for (let i = 0; i < 120 && !cayó; i++) {
      // Gira hacia la izquierda (el borde).
      stepKartOnTrack(s, { steer: -1, throttle: true, brake: false, drift: false }, PHYSICS_DT, track);
      cayó = needsRespawn(s, p, PHYSICS_DT);
    }
    expect(cayó).toBe(true);
    expect(s.surface).toBe("fall");
  });

  it("aterrizar en el aire fuera de la calzada (a 9 m del eje) también es caída", async () => {
    const { track } = await load();
    const lift = track.lifts[0]!;
    const pose = pointAt(track, lift.from + 30, 9);
    const s = createKart(pose.x, pose.z, pose.heading);
    s.speed = 20;
    s.airborne = true;
    s.y = pose.y + 2;
    s.vy = 0;
    let fall = false;
    for (let i = 0; i < 120 && !fall; i++) {
      stepKartOnTrack(s, GAS, PHYSICS_DT, track);
      fall = s.surface === "fall";
    }
    expect(fall).toBe(true);
  });

  it("reaparecer tras caer de la meseta deja el kart en la calzada, a la altura de la pista, parado y sin caer otra vez", async () => {
    const { track } = await load();
    const lift = track.lifts[0]!;
    const mid = (lift.from + lift.to) / 2;
    const p = createProgress();
    // El último checkpoint pisado: el de la meseta.
    const n = checkpointCount(track);
    p.respawnDistance = Math.floor((mid / track.length) * n) * (track.length / n);
    const pose = pointAt(track, mid, 9);
    const s = createKart(pose.x, pose.z, pose.heading);
    s.speed = 20;
    stepKartOnTrack(s, GAS, PHYSICS_DT, track);
    expect(needsRespawn(s, p, PHYSICS_DT)).toBe(true);
    respawnKart(s, p, track);
    expect(s.speed).toBe(0);
    expect(s.airborne).toBe(false);
    const c = stepKartOnTrack(s, GAS, PHYSICS_DT, track);
    expect(Math.abs(c.lateral)).toBeLessThan(1);
    expect(s.surface).toBe("road");
    expect(s.groundY).toBeGreaterThan(2.5);
    // Sigue su camino sin volver a caer.
    for (let i = 0; i < 60 * 4; i++) {
      stepKartOnTrack(s, botInput({ lane: 0, lookAhead: 12 }, s, track), PHYSICS_DT, track);
      expect(s.surface).not.toBe("fall");
    }
  });

  it("reaparecer con el último checkpoint dentro de una cuña XL deja al kart justo tras el labio (no 4 m en el aire)", async () => {
    const { track } = await load();
    const xl = track.zones.find((z) => z.size === "XL")!;
    const p = createProgress();
    p.respawnDistance = xl.from + 6; // +2 → dentro de la cuña
    const s = createKart(0, 0, 0);
    respawnKart(s, p, track);
    const c = closestPoint(track, s.x, s.z);
    expect(c.distance).toBeGreaterThan(xl.to);
    expect(c.distance).toBeLessThan(xl.to + 4);
    const step = stepKartOnTrack(s, GAS, PHYSICS_DT, track);
    expect(s.climb).toBe(0);
    expect(step.lateral).toBeCloseTo(0, 0);
  });

  it("caer en la plataforma y reaparecer sigue dejando completar la carrera (checkpoints en orden)", async () => {
    const { track } = await load();
    const lift = track.lifts[0]!;
    const n = checkpointCount(track);
    const p = createProgress();
    // Un kart que cruza la meta y llega a la meseta, cae y reaparece.
    updateProgress(p, track, 1, 0, 3);
    for (let d = 5; d < lift.from + 5; d += 20) updateProgress(p, track, d, 1, 3);
    expect(p.next).toBeGreaterThan(n / 2);
    const s = createKart(0, 0, 0);
    respawnKart(s, p, track);
    const c = closestPoint(track, s.x, s.z);
    expect(c.distance).toBeGreaterThan(lift.from - lift.easeIn - 60);
    expect(c.distance).toBeLessThan(lift.to);
  });
});

describe("Desván: separación entre tramos y vuelta del bot con las rampas gigantes", () => {
  it("los tramos no contiguos están a ≥ 38 m en planta (muro + arcén = 28 m), también bajo la plataforma", async () => {
    const { track } = await load();
    const pts = track.points;
    let min = Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      for (let j = i + 1; j < pts.length; j += 2) {
        const along = track.lengths[j]! - track.lengths[i]!;
        if (Math.min(along, track.length - along) < 150) continue;
        min = Math.min(min, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z));
      }
    }
    expect(min).toBeGreaterThanOrEqual(38);
  });

  for (const [nombre, idx] of [["la de la plataforma", 0], ["la que termina en salto", 1]] as const) {
    it(`el vuelo de ${nombre} (hasta ×1,75) queda a > 30 m de cualquier otro tramo y no pasa de los 12 m de altura`, async () => {
      const { track } = await load();
      const xl = track.zones.filter((z) => z.size === "XL")[idx]!;
      for (const v0 of [20, 26, 39, 45.5]) {
        const v = entrar(track, xl.from, v0);
        expect(v.cae).toBe(false);
        expect(v.separacion).toBeGreaterThan(30);
        expect(v.pico).toBeLessThan(12);
      }
    });
  }

  it("la XL de la diagonal termina en un salto largo (≥ 28 m a 26 m/s, ≈ 85 m con naranja) y aterriza antes de la horquilla", async () => {
    const { track } = await load();
    const xl = track.zones.filter((z) => z.size === "XL")[1]!;
    const lento = entrar(track, xl.from, 26);
    const naranja = entrar(track, xl.from, 45.5);
    expect(lento.aterriza - lento.despegue).toBeGreaterThan(28);
    expect(naranja.aterriza - naranja.despegue).toBeGreaterThan(70);
    expect(naranja.aterriza).toBeLessThan(979);
    expect(naranja.boost.mult).toBeGreaterThanOrEqual(LANDING.mult - 1e-6);
  });

  it("el bot da la vuelta completa pasando por las dos rampas gigantes: sin reaparecer, en 55–85 s, y aterriza en la plataforma", async () => {
    const { track } = await load();
    const lift = track.lifts[0]!;
    const pose = pointAt(track, 0);
    const s: KartState = createKart(pose.x, pose.z, pose.heading);
    s.speed = 12;
    const p = createProgress();
    let time = 0;
    let respawns = 0;
    let was = false;
    const vuelos: { despegue: number; aterriza: number }[] = [];
    let takeoff = 0;
    while (p.finishTime === null && time < 150) {
      const c = stepKartOnTrack(s, botInput({ lane: 0, lookAhead: 12 }, s, track), PHYSICS_DT, track);
      time += PHYSICS_DT;
      if (s.airborne && !was) takeoff = c.distance;
      if (!s.airborne && was) vuelos.push({ despegue: takeoff, aterriza: c.distance });
      was = s.airborne;
      updateProgress(p, track, c.distance, time, 1);
      if (needsRespawn(s, p, PHYSICS_DT)) {
        respawnKart(s, p, track);
        respawns++;
      }
    }
    expect(respawns).toBe(0);
    expect(p.finishTime).not.toBeNull();
    expect(p.finishTime!).toBeGreaterThan(55);
    expect(p.finishTime!).toBeLessThan(85);
    const xl = track.zones.filter((z) => z.size === "XL");
    for (const z of xl) expect(vuelos.some((v) => Math.abs(v.despegue - z.to) < 1.5)).toBe(true);
    const aPlataforma = vuelos.find((v) => Math.abs(v.despegue - xl[0]!.to) < 1.5)!;
    expect(aPlataforma.aterriza).toBeGreaterThan(lift.from - lift.easeIn);
    expect(aPlataforma.aterriza).toBeLessThan(lift.to);
  });
});
