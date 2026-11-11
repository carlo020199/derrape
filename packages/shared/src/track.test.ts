import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { createKart } from "./kart";
import { createProgress, needsRespawn, respawnKart, updateProgress } from "./race";
import {
  closestPoint,
  createOvalTrack,
  gradeAlong,
  pointAt,
  stepKartOnTrack,
  surfaceAt,
  surfaceY,
  type Track,
  type TrackZone,
} from "./track";
import { KART, PHYSICS_DT, RAMP } from "./tuning";
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

  for (const entry of TRACKS.filter((t) => t.number >= 2)) {
    it(`${entry.name}: vuelta de 50–75 s a un ritmo realista`, async () => {
      const track = buildTrackFromDef(await entry.load());
      const lap = track.length / (KART.maxSpeed * 0.85);
      expect(lap).toBeGreaterThan(50);
      expect(lap).toBeLessThan(75);
    });
  }

  it("zonas de Playa Dorada: arena y rampas", async () => {
    const track = buildTrackFromDef(await TRACKS.find((t) => t.id === "playa-dorada")!.load());
    const mid = pointAt(track, track.length * 0.3, 12);
    const c = closestPoint(track, mid.x, mid.z);
    expect(surfaceAt(track, c)).toBe("slow");
    const ramp = pointAt(track, track.length * 0.6, 0);
    expect(surfaceAt(track, closestPoint(track, ramp.x, ramp.z))).toBe("ramp");
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

  it("sin peralte la superficie es la línea central y el relieve no cambia el óvalo", () => {
    const track = createOvalTrack();
    const c = closestPoint(track, 0, 0);
    expect(track.relief).toBe(false);
    expect(c.bank).toBe(0);
    expect(surfaceY(c)).toBeCloseTo(c.y, 6);
    expect(gradeAlong(track, c, 0)).toBe(0);
    const s = createKart(40, 0, Math.PI / 2);
    s.speed = 20;
    const before = { x: s.x, z: s.z, speed: s.speed };
    stepKartOnTrack(s, { steer: 0, throttle: true, brake: false, drift: false }, PHYSICS_DT, track);
    expect(s.airborne).toBe(false);
    expect(s.x).not.toBe(before.x);
  });

  it("el peralte levanta el borde exterior en los dos sentidos", () => {
    const left = surfaceY({ y: 10, lateral: 4, bank: 40 });
    const right = surfaceY({ y: 10, lateral: -4, bank: 40 });
    expect(left).toBeLessThan(10);
    expect(right).toBeGreaterThan(10);
    const leftNeg = surfaceY({ y: 10, lateral: 4, bank: -40 });
    expect(leftNeg).toBeGreaterThan(10);
  });

  it("Laguna de las Ánimas cabe en los límites de diseño y los aterrizajes caen en asfalto", async () => {
    const def = await TRACKS.find((t) => t.id === "laguna-de-las-animas")!.load();
    const track = buildTrackFromDef(def);
    expect(track.relief).toBe(true);
    const limits = designLimits(track);
    expect(limits.maxGrade, `pendiente ${limits.maxGrade}`).toBeLessThanOrEqual(0.22);
    expect(limits.maxBank).toBeLessThanOrEqual(40);
    expect(limits.maxBankRate, `peralte ${limits.maxBankRate} °/m`).toBeLessThanOrEqual(2);
    expect(limits.minCrest, `cresta ${limits.minCrest} m`).toBeGreaterThanOrEqual(48);

    const ramps = track.zones.filter((z) => z.type === "ramp" && z.size);
    expect(ramps.map((z) => z.size).sort()).toEqual(["L", "M", "M", "S", "S", "S"]);
    for (const z of ramps) {
      const landing = rampLanding(track, z);
      expect(landing.landed, `${z.size} no aterriza`).toBe(true);
      expect(Math.abs(landing.lateral), `${z.size} lateral ${landing.lateral}`).toBeLessThan(landing.half);
      expect(Math.abs(landing.bank), `${z.size} peralte ${landing.bank}`).toBeLessThan(10);
      expect(landing.surface).not.toBe("fall");
    }
  });

  it("un bot da una vuelta a Laguna de las Ánimas sin caerse ni atascarse", async () => {
    const track = buildTrackFromDef(await TRACKS.find((t) => t.id === "laguna-de-las-animas")!.load());
    const pose = pointAt(track, 0);
    const s = createKart(pose.x, pose.z, pose.heading);
    s.speed = 12;
    const p = createProgress();
    let time = 0;
    let respawns = 0;
    let jumps = 0;
    let badLandings = 0;
    while (p.finishTime === null && time < 120) {
      const wasAir = s.airborne;
      const c = stepKartOnTrack(s, botInput({ lane: 0, lookAhead: 12 }, s, track), PHYSICS_DT, track);
      if (wasAir && !s.airborne) {
        jumps++;
        // En asfalto. El peralte de diseño (< 10°) se comprueba en el salto a velocidad punta;
        // el bot puede llevar un poco de turbo y caer un poco más adentro de la curva.
        if (Math.abs(c.lateral) > c.width / 2 - 0.2 || Math.abs(c.bank) > 18 || s.surface === "fall") badLandings++;
      }
      time += PHYSICS_DT;
      updateProgress(p, track, c.distance, time, 1);
      if (needsRespawn(s, p, PHYSICS_DT)) {
        respawnKart(s, p, track);
        respawns++;
      }
    }
    expect(p.finishTime).not.toBeNull();
    // La simulación de diseño (sin paneles de turbo) daba 58,7–67 s.
    // Con los dos paneles y el agarre μ = 1,1 una vuelta a fondo sale un poco por debajo.
    expect(p.finishTime!).toBeGreaterThan(52);
    expect(p.finishTime!).toBeLessThan(68);
    expect(respawns).toBe(0);
    expect(jumps).toBe(6);
    expect(badLandings).toBe(0);
  }, 20_000);

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

function inZone(zone: TrackZone, distance: number) {
  return zone.from <= zone.to ? distance >= zone.from && distance <= zone.to : distance >= zone.from || distance <= zone.to;
}

function designLimits(track: Track) {
  const pts = track.points;
  const n = pts.length;
  let maxGrade = 0;
  let maxBank = 0;
  let maxBankRate = 0;
  let minCrest = Infinity;
  const win = 3;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    const ds = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    maxGrade = Math.max(maxGrade, Math.abs(b.y - a.y) / ds);
    maxBank = Math.max(maxBank, Math.abs(a.bank));
    maxBankRate = Math.max(maxBankRate, Math.abs(b.bank - a.bank) / ds);
    const p0 = pts[(i - win + n) % n]!;
    const p2 = pts[(i + win) % n]!;
    const ds1 = Math.hypot(a.x - p0.x, a.z - p0.z) || 1;
    const ds2 = Math.hypot(p2.x - a.x, p2.z - a.z) || 1;
    const g1 = (a.y - p0.y) / ds1;
    const g2 = (p2.y - a.y) / ds2;
    const d2 = (g2 - g1) / ((ds1 + ds2) / 2);
    if (d2 < -1e-4) {
      const slope = (g1 + g2) / 2;
      const radius = (1 + slope * slope) ** 1.5 / Math.abs(d2);
      const onRamp = track.zones.some((z) => z.type === "ramp" && z.size && inZone(z, track.lengths[i]!));
      if (!onRamp) minCrest = Math.min(minCrest, radius);
    }
  }
  return { maxGrade, maxBank, maxBankRate, minCrest };
}

/** Aterrizaje a velocidad punta siguiendo la línea central, como en la simulación de diseño. */
function rampLanding(track: Track, zone: TrackZone) {
  const spec = RAMP[zone.size!];
  const lip = pointAt(track, zone.to);
  const c0 = closestPoint(track, lip.x, lip.z);
  const grade = gradeAlong(track, c0, lip.heading);
  const th = Math.atan(spec.lip / spec.len);
  const pitch = Math.asin(Math.max(-1, Math.min(1, grade)));
  const v = KART.maxSpeed;
  let vy = v * Math.sin(th + pitch);
  let y = lip.y + spec.lip;
  let dist = zone.to;
  const vx = v * Math.cos(th);
  let landed = false;
  let lateral = 0;
  let bank = 0;
  let half = 1;
  let surface: string = "road";
  for (let i = 0; i < 400; i++) {
    vy -= RAMP.gGame * PHYSICS_DT;
    y += vy * PHYSICS_DT;
    dist += vx * PHYSICS_DT;
    if (i < 3) continue;
    const p = pointAt(track, dist);
    if (y <= p.y) {
      const c = closestPoint(track, p.x, p.z);
      landed = true;
      lateral = c.lateral;
      bank = c.bank;
      half = c.width / 2;
      surface = surfaceAt(track, c);
      break;
    }
  }
  return { landed, lateral, bank, half, surface };
}
