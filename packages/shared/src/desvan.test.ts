import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { createKart, giveBoost, stepKart, type KartInput } from "./kart";
import { createProgress, needsRespawn, respawnKart, updateProgress } from "./race";
import { closestPoint, pointAt, stepKartOnTrack, surfaceAt, type Track } from "./track";
import { measureSmoothness } from "./trackSmoothness";
import { findTrack, TRACKS } from "./tracks/index";
import { buildTrackFromDef, type TrackDef } from "./tracks/types";
import { KART, PADS, PHYSICS_DT, isPadType } from "./tuning";

const GAS: KartInput = { steer: 0, throttle: true, brake: false, drift: false };

async function load(): Promise<{ def: TrackDef; track: Track }> {
  const def = await findTrack("desvan-de-las-maravillas")!.load();
  return { def, track: buildTrackFromDef(def) };
}

/** Una vuelta de bot. Devuelve el tiempo (s) y cuántas veces hubo que reaparecer. */
function botLap(track: Track): { time: number | null; respawns: number } {
  const pose = pointAt(track, 0);
  const s = createKart(pose.x, pose.z, pose.heading);
  s.speed = 12;
  const p = createProgress();
  let time = 0;
  let respawns = 0;
  while (p.finishTime === null && time < 150) {
    const c = stepKartOnTrack(s, botInput({ lane: 0, lookAhead: 12 }, s, track), PHYSICS_DT, track);
    time += PHYSICS_DT;
    updateProgress(p, track, c.distance, time, 1);
    if (needsRespawn(s, p, PHYSICS_DT)) {
      respawnKart(s, p, track);
      respawns++;
    }
  }
  return { time: p.finishTime, respawns };
}

describe("Desván de las Maravillas: trazado", () => {
  it("está en el selector, fuera de copa, con 3 vueltas, ancho 16 y arcén 6", async () => {
    const entry = findTrack("desvan-de-las-maravillas")!;
    expect(entry.number).toBe(13);
    expect(entry.cup).toBeNull();
    const { def, track } = await load();
    expect(def.id).toBe(entry.id);
    expect(def.laps).toBe(3);
    expect(track.width).toBe(16);
    expect(track.verge).toBe(6);
    expect(track.relief).toBe(true);
    expect(track.length).toBeGreaterThan(1850);
    expect(track.length).toBeLessThan(1920);
    expect(TRACKS.filter((t) => t.number === 13)).toHaveLength(1);
  });

  it("los tramos no contiguos están a ≥ 38 m entre ejes (closestPoint es global)", async () => {
    const { track } = await load();
    const pts = track.points;
    let min = Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      for (let j = i + 1; j < pts.length; j += 2) {
        const gap = Math.abs(track.lengths[j]! - track.lengths[i]!);
        const along = Math.min(gap, track.length - gap);
        if (along < 120) continue;
        min = Math.min(min, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z));
      }
    }
    expect(min).toBeGreaterThanOrEqual(38);
  });

  it("cumple los límites de suavidad (pendiente, peralte y su ritmo)", async () => {
    const m = measureSmoothness((await load()).track);
    expect(m.maxGrade).toBeLessThanOrEqual(0.22);
    expect(m.maxBank).toBeLessThanOrEqual(30);
    expect(m.maxBankRate).toBeLessThanOrEqual(1.5);
    expect(m.maxBankAccel).toBeLessThanOrEqual(0.15);
    expect(m.maxNormalJump).toBeLessThanOrEqual(3);
  });

  it("un bot completa la vuelta sin reaparecer en 65–80 s (sin turbos) y con los turbos no tarda más", async () => {
    const { track } = await load();
    const plain = botLap({ ...track, zones: [] });
    expect(plain.respawns).toBe(0);
    expect(plain.time).not.toBeNull();
    expect(plain.time!).toBeGreaterThan(65);
    expect(plain.time!).toBeLessThan(80);
    const boosted = botLap(track);
    expect(boosted.respawns).toBe(0);
    expect(boosted.time).not.toBeNull();
    expect(boosted.time!).toBeLessThanOrEqual(plain.time!);
    expect(boosted.time!).toBeGreaterThan(55);
  });

  it("es horario: el peralte de las curvas a derechas es negativo y la horquilla interior es a izquierdas", async () => {
    const { track } = await load();
    expect(pointAt(track, 380).bank).toBeLessThan(-8);
    expect(pointAt(track, 1030).bank).toBeGreaterThan(8);
  });
});

describe("Desván de las Maravillas: turbos de suelo (datos)", () => {
  it("13 azules y 6 naranjas, dentro de la vuelta y sin solaparse", async () => {
    const { track } = await load();
    const pads = track.zones.filter((z) => isPadType(z.type));
    expect(pads).toHaveLength(19);
    expect(pads.filter((z) => z.type.startsWith("boostBlue"))).toHaveLength(13);
    expect(pads.filter((z) => z.type.startsWith("boostOrange"))).toHaveLength(6);
    for (const z of pads) {
      expect(z.from).toBeGreaterThanOrEqual(0);
      expect(z.to).toBeLessThanOrEqual(track.length);
      expect(z.to).toBeGreaterThan(z.from);
      expect(z.lateralMin).toBeGreaterThanOrEqual(-track.width / 2);
      expect(z.lateralMax).toBeLessThanOrEqual(track.width / 2);
    }
    const sorted = [...pads].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.from, `solape en ${sorted[i]!.from}`).toBeGreaterThan(sorted[i - 1]!.to);
  });

  it("el nombre del tipo coincide con el ancho: ancho = ≥ 12 m, franja = ≤ 6 m", async () => {
    const { track } = await load();
    for (const z of track.zones.filter((z) => isPadType(z.type))) {
      const span = z.lateralMax - z.lateralMin;
      if (z.type.endsWith("Narrow")) expect(span, z.type).toBeLessThanOrEqual(6);
      else expect(span, z.type).toBeGreaterThanOrEqual(12);
    }
  });

  it("la pista devuelve la superficie de turbo en la zona y asfalto fuera de la franja", async () => {
    const { track } = await load();
    const narrow = track.zones.find((z) => z.type === "boostBlueNarrow" && z.lateralMin === 3)!;
    const d = (narrow.from + narrow.to) / 2;
    const at = (lateral: number) => {
      const q = pointAt(track, d, lateral);
      return surfaceAt(track, closestPoint(track, q.x, q.z));
    };
    expect(at(4.5)).toBe("boostBlueNarrow");
    expect(at(-4.5)).toBe("road");
    const wide = track.zones.find((z) => z.type === "boostOrange")!;
    const q = pointAt(track, (wide.from + wide.to) / 2, -6);
    expect(surfaceAt(track, closestPoint(track, q.x, q.z))).toBe("boostOrange");
  });

  it("un kart que pasa por encima de un turbo lo recibe (carril de la franja y duración de la franja)", async () => {
    const { track } = await load();
    const z = track.zones.find((q) => q.type === "boostOrangeNarrow" && q.from > 60 && q.from < 100)!;
    const start = pointAt(track, z.from - 6, (z.lateralMin + z.lateralMax) / 2);
    const s = createKart(start.x, start.z, start.heading);
    s.speed = KART.maxSpeed;
    let got = 0;
    for (let i = 0; i < 60 * 1; i++) {
      stepKartOnTrack(s, GAS, PHYSICS_DT, track);
      got = Math.max(got, s.boostMult * (s.boostTime > 0 ? 1 : 0));
    }
    expect(got).toBe(PADS.boostOrangeNarrow.mult);
  });
});

describe("turbos de suelo: reglas de multiplicador y duración", () => {
  const stepOn = (type: keyof typeof PADS, prep?: (s: ReturnType<typeof createKart>) => void) => {
    const s = createKart();
    s.speed = 20;
    prep?.(s);
    s.surface = type;
    stepKart(s, GAS, PHYSICS_DT);
    return s;
  };

  it("azul ×1,5 (1,5 s ancho, 2 s franja) y naranja ×1,75 (2,5 s ancho, 3 s franja)", () => {
    expect(PADS.boostBlue).toEqual({ mult: 1.5, time: 1.5 });
    expect(PADS.boostBlueNarrow).toEqual({ mult: 1.5, time: 2 });
    expect(PADS.boostOrange).toEqual({ mult: 1.75, time: 2.5 });
    expect(PADS.boostOrangeNarrow).toEqual({ mult: 1.75, time: 3 });
    for (const type of Object.keys(PADS) as (keyof typeof PADS)[]) {
      const s = stepOn(type);
      expect(s.boostMult).toBe(PADS[type].mult);
      // El paso ya gastó 1/60 s.
      expect(s.boostTime).toBeCloseTo(PADS[type].time - PHYSICS_DT, 6);
    }
  });

  it("el turbo dura lo indicado después de salir de la zona", () => {
    const s = stepOn("boostOrangeNarrow");
    s.surface = "road";
    let t = PHYSICS_DT;
    while (s.boostTime > 0 && t < 10) {
      stepKart(s, GAS, PHYSICS_DT);
      t += PHYSICS_DT;
    }
    expect(t).toBeCloseTo(3, 1);
    expect(s.boostMult).toBe(1);
  });

  it("no se multiplican con un mini-turbo en marcha: gana el mayor", () => {
    const mini = (s: ReturnType<typeof createKart>) => giveBoost(s, 1, KART.boostSpeedMult);
    expect(stepOn("boostBlue", mini).boostMult).toBe(1.5);
    expect(stepOn("boostOrange", mini).boostMult).toBe(1.75);
    // Un mini-turbo mayor que el suelo manda sobre el azul.
    const strongMini = (s: ReturnType<typeof createKart>) => giveBoost(s, 1, 1.6);
    expect(stepOn("boostBlue", strongMini).boostMult).toBe(1.6);
  });

  it("azul sobre naranja y naranja sobre azul no se apilan (nunca ×2,6) y la duración se alarga", () => {
    const afterOrange = stepOn("boostBlueNarrow", (s) => giveBoost(s, 0.5, PADS.boostOrange.mult));
    expect(afterOrange.boostMult).toBe(1.75);
    expect(afterOrange.boostTime).toBeCloseTo(PADS.boostBlueNarrow.time - PHYSICS_DT, 6);
    const afterBlue = stepOn("boostOrange", (s) => giveBoost(s, 1.5, PADS.boostBlue.mult));
    expect(afterBlue.boostMult).toBe(1.75);
    expect(afterBlue.boostTime).toBeCloseTo(PADS.boostOrange.time - PHYSICS_DT, 6);
  });

  it("dos turbos iguales seguidos tampoco se acumulan en tiempo (se renueva, no se suma)", () => {
    const s = stepOn("boostBlue");
    for (let i = 0; i < 30; i++) {
      s.surface = "boostBlue";
      stepKart(s, GAS, PHYSICS_DT);
    }
    expect(s.boostMult).toBe(1.5);
    expect(s.boostTime).toBeLessThanOrEqual(PADS.boostBlue.time);
  });

  it("la velocidad sube hasta la punta ×mult y no más (azul 39 m/s, naranja 45,5 m/s)", () => {
    for (const [type, mult] of [
      ["boostBlue", 1.5],
      ["boostOrange", 1.75],
    ] as const) {
      const s = createKart();
      s.speed = KART.maxSpeed;
      for (let i = 0; i < 60 * 2; i++) {
        s.surface = type;
        stepKart(s, GAS, PHYSICS_DT);
      }
      expect(s.speed).toBeCloseTo(KART.maxSpeed * mult, 3);
    }
  });

  it("un trompo cancela el turbo (como con los demás)", () => {
    const s = stepOn("boostOrange");
    s.spinTime = 1;
    stepKart(s, GAS, PHYSICS_DT);
    expect(s.boostTime).toBe(0);
  });
});
