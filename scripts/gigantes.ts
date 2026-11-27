// Simula las rampas gigantes (XL) del Desván con la física real: entra a 20/26/39/45 m/s con el bot (carril
// `lane`) y anota despegue, aterrizaje, vuelo, altura del suelo, lateral y si cae al vacío (superficie `fall`).
// Uso: npx tsx scripts/gigantes.ts
import { botInput, buildTrackFromDef, closestPoint, createKart, giveBoost, PHYSICS_DT, pointAt, stepKartOnTrack, type Track } from "../packages/shared/src";
import desvan from "../packages/shared/src/tracks/13-desvan-de-las-maravillas";

export interface Entrada {
  v0: number;
  despegue: number | null;
  aterriza: number | null;
  vuelo: number;
  pico: number;
  /** Altura de la pista donde aterriza y lateral. */
  sueloY: number;
  lateral: number;
  cae: boolean;
  limpio: boolean;
  vAterriza: number;
  /** ¿Cobra el turbo de aterrizaje (×1,5)? */
  turbo: boolean;
}

/** Un kart a `v0` m/s a `antes` m del labio de la rampa XL que empieza en `desde` (m), con trucos opcionales. */
export function entrada(track: Track, desde: number, v0: number, hasta: number, opts: { antes?: number; lane?: number; truco?: boolean } = {}): Entrada {
  const { antes = 40, lane = 0, truco = false } = opts;
  const start = pointAt(track, desde - antes, lane);
  const k = createKart(start.x, start.z, start.heading);
  k.speed = v0;
  // Por encima de la punta (26 m/s) solo se llega con turbo: azul ×1,5 = 39 m/s, naranja ×1,75 = 45,5 m/s.
  if (v0 > 26.5) giveBoost(k, 4, v0 / 26);
  const out: Entrada = { v0, despegue: null, aterriza: null, vuelo: 0, pico: 0, sueloY: 0, lateral: 0, cae: false, limpio: false, vAterriza: 0, turbo: false };
  let was = false;
  for (let i = 0; i < 60 * 12; i++) {
    const c = stepKartOnTrack(k, { ...botInput({ lane, lookAhead: 12 }, k, track), trick: truco && k.airborne }, PHYSICS_DT, track);
    if (k.airborne) out.pico = Math.max(out.pico, k.y - c.y);
    if (k.airborne && !was) out.despegue = c.distance;
    if (!k.airborne && was) {
      out.aterriza = c.distance;
      out.vuelo = c.distance - (out.despegue ?? c.distance);
      out.sueloY = c.y;
      out.lateral = c.lateral;
      out.limpio = c.cleanLanding;
      out.vAterriza = k.speed;
      out.turbo = k.boostTime > 0 && k.boostMult >= 1.49;
    }
    if (k.surface === "fall") out.cae = true;
    was = k.airborne;
    if (c.distance > hasta || out.cae) break;
  }
  return out;
}

if (process.argv[1]?.endsWith("gigantes.ts")) {
  const track = buildTrackFromDef(desvan);
  const xl = track.zones.filter((z) => z.size === "XL");
  for (const z of xl) {
    console.log(`XL ${z.from.toFixed(0)}–${z.to.toFixed(0)} (y labio ${pointAt(track, z.to).y.toFixed(2)})`);
    for (const truco of [false, true]) {
      for (const v0 of [14, 20, 26, 39, 45.5]) {
        const e = entrada(track, z.from, v0, z.to + 200, { truco });
        console.log(
          `  v0 ${String(v0).padStart(4)} ${truco ? "truco" : "     "} despega ${e.despegue?.toFixed(0)} aterriza ${e.aterriza?.toFixed(0)} vuelo ${e.vuelo.toFixed(0)} m pico ${e.pico.toFixed(1)} m suelo ${e.sueloY.toFixed(1)} lat ${e.lateral.toFixed(1)} v ${e.vAterriza.toFixed(0)}${e.limpio ? "" : " SUCIO"}${e.turbo ? " TURBO" : ""}${e.cae ? " CAE" : ""}`,
        );
      }
    }
  }
  const c = closestPoint(track, pointAt(track, 1510).x, pointAt(track, 1510).z);
  console.log("altura meseta (1510 m):", c.y.toFixed(2));
}
