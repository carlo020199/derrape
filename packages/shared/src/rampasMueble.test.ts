import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { createKart, giveBoost, type KartState } from "./kart";
import { createProgress, needsRespawn, respawnKart, updateProgress } from "./race";
import { pointAt, stepKartOnTrack, type Track } from "./track";
import { findTrack } from "./tracks/index";
import { buildTrackFromDef, type TrackDef } from "./tracks/types";
import { KART, LANDING, PADS, PHYSICS_DT } from "./tuning";

async function load(): Promise<{ def: TrackDef; track: Track }> {
  const def = await findTrack("desvan-de-las-maravillas")!.load();
  return { def, track: buildTrackFromDef(def) };
}

interface Salto {
  despegue: number;
  aterriza: number;
  /** Turbo del kart justo al aterrizar. */
  boost: { time: number; mult: number };
}

/** Un bot (carril `lane`) a fondo desde `desde` hasta `hasta` (m). Devuelve cada salto y el turbo con el que aterriza. */
function saltos(track: Track, desde: number, hasta: number, lane = 0): Salto[] {
  const pose = pointAt(track, desde);
  const s = createKart(pose.x, pose.z, pose.heading);
  s.speed = 12;
  const out: Salto[] = [];
  let was = false;
  let takeoff = 0;
  for (let i = 0; i < 60 * 25; i++) {
    const c = stepKartOnTrack(s, botInput({ lane, lookAhead: 12 }, s, track), PHYSICS_DT, track);
    if (s.airborne && !was) takeoff = c.distance;
    if (!s.airborne && was) out.push({ despegue: takeoff, aterriza: c.distance, boost: { time: s.boostTime, mult: s.boostMult } });
    was = s.airborne;
    if (c.distance > hasta) break;
  }
  return out;
}

/** Una vuelta de bot; cuenta los aterrizajes con turbo de rampa-mueble. */
function botLap(track: Track): { time: number | null; respawns: number; aterrizajes: number } {
  const pose = pointAt(track, 0);
  const s = createKart(pose.x, pose.z, pose.heading);
  s.speed = 12;
  const p = createProgress();
  let time = 0;
  let respawns = 0;
  let aterrizajes = 0;
  let was = false;
  while (p.finishTime === null && time < 150) {
    const c = stepKartOnTrack(s, botInput({ lane: 0, lookAhead: 12 }, s, track), PHYSICS_DT, track);
    time += PHYSICS_DT;
    if (was && !s.airborne && s.boostTime > LANDING.time - 0.05 && s.boostMult >= LANDING.mult) aterrizajes++;
    was = s.airborne;
    updateProgress(p, track, c.distance, time, 1);
    if (needsRespawn(s, p, PHYSICS_DT)) {
      respawnKart(s, p, track);
      respawns++;
    }
  }
  return { time: p.finishTime, respawns, aterrizajes };
}

/** Recta larga con relieve y una rampa S (labio en 100 m). */
function rectaConRampa(landBoost: boolean, azulDesde?: number): Track {
  const def: TrackDef = {
    id: "t",
    name: "t",
    theme: "pruebas",
    laps: 3,
    width: 16,
    verge: 6,
    control: [
      { x: 0, z: 0 },
      { x: 0, z: 400 },
      { x: 0, z: 800 },
      { x: 60, z: 900 },
      { x: 200, z: 900 },
      { x: 260, z: 800 },
      { x: 260, z: 400 },
      { x: 260, z: 0 },
      { x: 200, z: -100 },
      { x: 60, z: -100 },
    ],
    itemRows: [],
    seed: 1,
    zones: [
      { type: "ramp", size: "S", from: 96 / 2900, to: 100 / 2900, landBoost },
      ...(azulDesde === undefined ? [] : [{ type: "boostBlue" as const, from: azulDesde / 2900, to: (azulDesde + 40) / 2900 }]),
    ],
  };
  return buildTrackFromDef(def);
}

/** Sube un kart a la rampa a velocidad normal y devuelve el estado justo al aterrizar. */
function aterrizar(track: Track, antes?: (s: KartState) => void, pasosDespues = 0): KartState {
  const pose = pointAt(track, 60);
  const s = createKart(pose.x, pose.z, pose.heading);
  s.speed = 26;
  antes?.(s);
  let was = false;
  for (let i = 0; i < 60 * 8; i++) {
    stepKartOnTrack(s, { steer: 0, throttle: true, brake: false, drift: false }, PHYSICS_DT, track);
    if (was && !s.airborne) {
      // El turbo de suelo se lee de la superficie en el paso siguiente: se dan unos pasos a fondo tras tocar suelo.
      for (let k = 0; k < pasosDespues; k++) stepKartOnTrack(s, { steer: 0, throttle: true, brake: false, drift: false }, PHYSICS_DT, track);
      return s;
    }
    was = s.airborne;
  }
  throw new Error("el kart no llegó a saltar");
}

describe("rampas-mueble: turbo al aterrizar", () => {
  it("aterrizar de una rampa con landBoost da ×1,5 durante 0,5 s", () => {
    const s = aterrizar(rectaConRampa(true));
    expect(LANDING.mult).toBe(1.5);
    expect(LANDING.time).toBe(0.5);
    expect(s.boostMult).toBe(1.5);
    expect(s.boostTime).toBeGreaterThan(LANDING.time - 0.03);
    expect(s.boostTime).toBeLessThanOrEqual(LANDING.time);
  });

  it("una rampa normal (sin landBoost, como las de la Laguna) no da turbo", () => {
    const s = aterrizar(rectaConRampa(false));
    expect(s.boostTime).toBe(0);
    expect(s.boostMult).toBe(1);
  });

  it("no se apila: gana el mayor (naranja ×1,75 sigue; un turbo menor no lo rebaja)", () => {
    const naranja = aterrizar(rectaConRampa(true), (s) => giveBoost(s, 5, PADS.boostOrange.mult));
    expect(naranja.boostMult).toBe(PADS.boostOrange.mult);
    expect(naranja.boostTime).toBeGreaterThan(2);
    // Y el turbo de aterrizaje es el mayor frente a un mini-turbo (×1,3): ×1,5, no ×1,5×1,3.
    const mini = aterrizar(rectaConRampa(true), (s) => giveBoost(s, 5, KART.boostSpeedMult));
    expect(mini.boostMult).toBe(1.5);
  });

  it("aterrizar DENTRO de un turbo azul de suelo (×1,5) no se apila: sigue ×1,5 y dura lo del azul", () => {
    // La S vuela ≈ 17 m desde el labio (100 m): el azul de 105 a 145 m cubre el aterrizaje.
    const track = rectaConRampa(true, 105);
    const s = aterrizar(track, undefined, 3);
    expect(s.surface).toBe("boostBlue");
    expect(s.boostMult).toBe(PADS.boostBlue.mult);
    expect(s.boostMult).toBe(LANDING.mult);
    // El azul (1,5 s) manda sobre el aterrizaje (0,5 s): la duración es la mayor, nunca la suma.
    expect(s.boostTime).toBeGreaterThan(LANDING.time + 0.5);
    expect(s.boostTime).toBeLessThanOrEqual(PADS.boostBlue.time);
  });

  it("aterrizar dentro de un naranja de suelo (×1,75) conserva el naranja", () => {
    const track = rectaConRampa(true, 105);
    const orange = { ...track, zones: track.zones.map((z) => (z.type === "boostBlue" ? { ...z, type: "boostOrange" as const } : z)) };
    const s = aterrizar(orange, undefined, 3);
    expect(s.surface).toBe("boostOrange");
    expect(s.boostMult).toBe(PADS.boostOrange.mult);
    expect(s.boostTime).toBeGreaterThan(2);
  });

  it("el kart acelera de verdad hacia ×1,5 tras aterrizar", () => {
    const track = rectaConRampa(true);
    const s = aterrizar(track);
    for (let i = 0; i < 20; i++) stepKartOnTrack(s, { steer: 0, throttle: true, brake: false, drift: false }, PHYSICS_DT, track);
    expect(s.speed).toBeGreaterThan(KART.maxSpeed * 1.2);
  });

  it("derrapando no se salta: sin vuelo no hay turbo de aterrizaje", () => {
    const track = rectaConRampa(true);
    const pose = pointAt(track, 60);
    const s = createKart(pose.x, pose.z, pose.heading);
    s.speed = 26;
    s.driftDir = 1;
    let saltado = false;
    for (let i = 0; i < 60 * 4; i++) {
      stepKartOnTrack(s, { steer: 0, throttle: true, brake: false, drift: true }, PHYSICS_DT, track);
      saltado ||= s.airborne;
    }
    expect(saltado).toBe(false);
  });
});

/** Recta larga plana con rampas `size` a partir de `desde`, con los huecos labio→rampa dados (mismo montaje que `herramientas/cadenas.mts` del plan). */
function cadenaEnRecta(size: "S" | "M", huecos: number[]): Salto[] {
  const len = size === "S" ? 4 : 8;
  const zones: TrackDef["zones"] = [];
  let d = 120;
  for (let i = 0; i <= huecos.length; i++) {
    zones!.push({ type: "ramp", size, from: d / 2900, to: (d + len) / 2900, landBoost: true });
    d += len + (huecos[i] ?? 0);
  }
  const base = rectaConRampa(true);
  const def = { ...base, zones: [] } as Track;
  const track: Track = { ...def, zones: zones!.map((z) => ({ type: z.type, size: z.size, landBoost: z.landBoost, from: z.from * 2900, to: z.to * 2900, lateralMin: -30, lateralMax: 30 })) };
  const pose = pointAt(track, 60);
  const s = createKart(pose.x, pose.z, pose.heading);
  s.speed = 26;
  const out: Salto[] = [];
  let was = false;
  let takeoff = 0;
  for (let i = 0; i < 60 * 14; i++) {
    const c = stepKartOnTrack(s, { steer: 0, throttle: true, brake: false, drift: false }, PHYSICS_DT, track);
    if (s.airborne && !was) takeoff = c.distance;
    if (!s.airborne && was) out.push({ despegue: takeoff, aterriza: c.distance, boost: { time: s.boostTime, mult: s.boostMult } });
    was = s.airborne;
    if (c.distance > 450) break;
  }
  return out;
}

describe("rampas-mueble: vuelos de diseño (los números de herramientas/cadenas.mts del plan)", () => {
  it("S sola a 26 m/s vuela ≈ 17 m y M sola ≈ 24 m", () => {
    const s = cadenaEnRecta("S", [])[0]!;
    const m = cadenaEnRecta("M", [])[0]!;
    expect(s.aterriza - s.despegue).toBeGreaterThan(15);
    expect(s.aterriza - s.despegue).toBeLessThan(19);
    expect(m.aterriza - m.despegue).toBeGreaterThan(22);
    expect(m.aterriza - m.despegue).toBeLessThan(26);
  });

  it("S×3 con huecos 26/42 (los del plan): vuelos ≈ 17 → 32 → 32 m, cada uno con ×1,5", () => {
    const v = cadenaEnRecta("S", [26, 42]);
    expect(v).toHaveLength(3);
    const largo = v.map((x) => x.aterriza - x.despegue);
    expect(largo[0]).toBeGreaterThan(15);
    expect(largo[0]).toBeLessThan(19);
    expect(largo[1]).toBeGreaterThan(29);
    expect(largo[1]).toBeLessThan(35);
    expect(largo[2]).toBeGreaterThan(29);
    expect(largo[2]).toBeLessThan(35);
    for (const x of v) expect(x.boost.mult).toBe(1.5);
  });

  it("M×2 con hueco 32: encadena los dos saltos", () => {
    expect(cadenaEnRecta("M", [32])).toHaveLength(2);
  });
});

describe("Desván: cadenas de rampas-mueble", () => {
  it("hay 6 rampas S/M con landBoost: cadena de 3 S en la recta de meta, S sola, cadena de 2 M", async () => {
    const { track } = await load();
    const rampas = track.zones.filter((z) => z.type === "ramp");
    expect(rampas.map((z) => z.size)).toEqual(["S", "S", "S", "S", "M", "M"]);
    expect(rampas.every((z) => z.landBoost === true)).toBe(true);
    expect(rampas.slice(0, 3).every((z) => z.from < 233)).toBe(true);
  });

  it("cadena de 3 S: saltas, aterrizas con ×1,5 y vuelves a saltar, tres veces, antes de la curva B", async () => {
    const { track } = await load();
    const r = saltos(track, 60, 300);
    expect(r.length).toBeGreaterThanOrEqual(3);
    const [a, b, c] = r;
    // Cada aterrizaje queda antes del labio siguiente y despega a partir de él.
    const rampas = track.zones.filter((z) => z.type === "ramp");
    expect(a!.aterriza).toBeLessThan(rampas[1]!.from);
    expect(b!.despegue).toBeGreaterThanOrEqual(rampas[1]!.to - 0.5);
    expect(b!.aterriza).toBeLessThan(rampas[2]!.from);
    expect(c!.despegue).toBeGreaterThanOrEqual(rampas[2]!.to - 0.5);
    expect(c!.aterriza).toBeLessThan(233 + 15);
    for (const x of [a!, b!, c!]) expect(x.boost.mult).toBe(1.5);
    expect(a!.boost.time).toBeGreaterThan(LANDING.time - 0.03);
  });

  it("cadena de 2 M: los dos saltos encadenan y la salida va a ×1,5", async () => {
    const { track } = await load();
    const r = saltos(track, 1020, 1250).filter((x) => x.despegue > 1080);
    expect(r.length).toBeGreaterThanOrEqual(2);
    const rampas = track.zones.filter((z) => z.type === "ramp" && z.size === "M");
    expect(r[0]!.aterriza).toBeLessThan(rampas[1]!.from);
    expect(r[1]!.despegue).toBeGreaterThanOrEqual(rampas[1]!.to - 0.5);
    expect(r[1]!.boost.mult).toBe(1.5);
    // Aterriza antes de la curva G (≈1.199 m).
    expect(r[1]!.aterriza).toBeLessThan(1200);
  });

  it("con un naranja de franja antes de la cadena de 3 S se salta una rampa, pero no se pierde la siguiente", async () => {
    const { track } = await load();
    const r = saltos(track, 0, 300, 4.5);
    expect(r.length).toBeGreaterThanOrEqual(2);
  });

  it("la rampa-mueble solo actúa en la calzada: por el arcén se pasa sin saltar", async () => {
    const { track } = await load();
    for (const [lateral, salta] of [[0, true], [11, false], [-11, false]] as const) {
      const pose = pointAt(track, 60, lateral);
      const s = createKart(pose.x, pose.z, pose.heading);
      s.speed = 26;
      let voló = false;
      // Recto por el borde: la recta de meta es recta hasta la tercera rampa (≈ 125 m).
      for (let i = 0; i < 60 * 3; i++) {
        const c = stepKartOnTrack(s, { steer: 0, throttle: true, brake: false, drift: false }, PHYSICS_DT, track);
        voló ||= s.airborne;
        if (c.distance > 125) break;
      }
      expect(voló, `lateral ${lateral}`).toBe(salta);
    }
  });

  it("un vuelo de rampa-mueble nunca pasa cerca de otro tramo de la pista (closestPoint es global)", async () => {
    const { track } = await load();
    const pts = track.points;
    for (const z of track.zones.filter((q) => q.type === "ramp")) {
      // El mayor vuelo posible (M a ×1,75: ≈ 61 m) más los 8 m de la propia rampa.
      for (let d = z.from; d <= z.to + 70; d += 4) {
        const p = pointAt(track, d, 0);
        for (let i = 0; i < pts.length; i++) {
          const along = Math.abs(track.lengths[i]! - d);
          if (Math.min(along, track.length - along) < 150) continue;
          expect(Math.hypot(pts[i]!.x - p.x, pts[i]!.z - p.z)).toBeGreaterThan(30);
        }
      }
    }
  });

  it("el bot completa la vuelta con las rampas, sin reaparecer, y cobra el turbo de aterrizaje", async () => {
    const { track } = await load();
    const r = botLap(track);
    expect(r.respawns).toBe(0);
    expect(r.time).not.toBeNull();
    expect(r.time!).toBeGreaterThan(55);
    expect(r.time!).toBeLessThan(80);
    expect(r.aterrizajes).toBeGreaterThanOrEqual(5);
  });
});
