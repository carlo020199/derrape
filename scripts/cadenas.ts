// Simula cadenas de rampas-mueble del Desván con la física real (stepKartOnTrack), con el bot de
// carril 0 y con la entrada a varias velocidades. Imprime despegue, aterrizaje, vuelo y velocidad.
// Uso: npx tsx scripts/cadenas.ts
import { botInput, buildTrackFromDef, createKart, PHYSICS_DT, pointAt, stepKartOnTrack, type Track } from "../packages/shared/src";
import desvan from "../packages/shared/src/tracks/13-desvan-de-las-maravillas";

export interface Salto {
  despegue: number;
  aterriza: number;
  vuelo: number;
  v: number;
  limpio: boolean;
}

/** Un bot (carril 0) que pisa a fondo desde `desde` (m) con `v0`; devuelve los saltos hasta `hasta`. */
export function saltos(track: Track, desde: number, hasta: number, v0: number, truco = false, lane = 0): Salto[] {
  const start = pointAt(track, desde, 0);
  const k = createKart(start.x, start.z, start.heading);
  k.speed = v0;
  const out: Salto[] = [];
  let was = false;
  let takeoff = 0;
  for (let i = 0; i < 60 * 20; i++) {
    const c = stepKartOnTrack(k, { ...botInput({ lane, lookAhead: 12 }, k, track), trick: truco && k.airborne }, PHYSICS_DT, track);
    if (k.airborne && !was) takeoff = c.distance;
    if (!k.airborne && was) out.push({ despegue: takeoff, aterriza: c.distance, vuelo: c.distance - takeoff, v: k.speed, limpio: c.cleanLanding });
    was = k.airborne;
    if (c.distance > hasta) break;
  }
  return out;
}

if (process.argv[1]?.endsWith("cadenas.ts")) {
  const track = buildTrackFromDef(desvan);
  const rampas = track.zones.filter((z) => z.type === "ramp");
  console.log("rampas:", rampas.map((z) => `${z.size}@${z.from.toFixed(0)}-${z.to.toFixed(0)}`).join(" "));
  const fmt = (r: Salto[]) => r.map((s) => `${s.despegue.toFixed(0)}→${s.aterriza.toFixed(0)} (${s.vuelo.toFixed(0)} m, v=${s.v.toFixed(1)}${s.limpio ? "" : " SUCIO"})`).join(" | ");
  // Desde la parrilla, a fondo: carril 0 (pasa por el azul ancho) y carril 4,5 (pisa el naranja en franja de 70–78 m).
  for (const lane of [0, 4.5]) console.log(`A desde meta, carril ${lane}:`, fmt(saltos(track, 0, 300, 0, false, lane)));
  console.log("A con truco:", fmt(saltos(track, 0, 300, 0, true)));
  for (const [nombre, d0, d1] of [["C", 640, 800], ["F", 1000, 1250]] as const) {
    console.log(`${nombre}:`, fmt(saltos(track, d0, d1, 20)), "| truco:", fmt(saltos(track, d0, d1, 20, true)));
  }
}
