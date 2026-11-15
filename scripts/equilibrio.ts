// Simula una vuelta de cada combinación personaje + coche con el piloto automático (sin derrapar)
// y muestra los tiempos. Sirve para ver desequilibrios: uso `npx tsx scripts/equilibrio.ts [circuito]`.
import {
  CHARACTERS, KART, KARTS, PHYSICS_DT, botInput, closestPoint, createKart, deriveTuning,
  buildTrackFromDef, findTrack, gridPose, stepKartOnTrack, statsFor, type Track,
} from "../packages/shared/src/index";

async function lap(track: Track, char: string, kartId: string, lane: number, look: number): Promise<number> {
  const stats = statsFor(char, kartId);
  const k = KARTS.find((x) => x.id === kartId)!;
  const tuning = deriveTuning(KART, stats, k.driftChargeMult ?? 1);
  const p = gridPose(track, 0);
  const s = createKart(p.x, p.z, p.heading);
  let prev = closestPoint(track, s.x, s.z).distance;
  let travelled = 0;
  for (let i = 0; i < 60 * 600; i++) {
    const c = stepKartOnTrack(s, botInput({ lane, lookAhead: look }, s, track), PHYSICS_DT, track, tuning);
    let d = c.distance - prev;
    if (d < -track.length / 2) d += track.length;
    if (d > track.length / 2) d -= track.length;
    travelled += d;
    prev = c.distance;
    if (travelled >= track.length) return (i + 1) * PHYSICS_DT;
  }
  return Infinity;
}

const trackId = process.argv[2] ?? "paseo-del-puerto";
const def = await findTrack(trackId)!.load();
const track = buildTrackFromDef(def);
const rows: { name: string; t: number }[] = [];
for (const k of KARTS) {
  const times = CHARACTERS.map((c) => 0);
  for (let i = 0; i < CHARACTERS.length; i++) times[i] = await lap(track, CHARACTERS[i]!.id, k.id, 0, 14);
  rows.push({ name: k.name.padEnd(9), t: times.reduce((a, b) => a + b) / times.length });
  console.log(k.name.padEnd(9), times.map((t) => t.toFixed(2)).join("  "), " media", rows.at(-1)!.t.toFixed(2));
}
console.log("personajes:", CHARACTERS.map((c) => c.id).join(" "));
