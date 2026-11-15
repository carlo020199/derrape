// Piloto automático sencillo: sigue la pista con un carril fijo. En un circuito con relieve
// se mete hacia el interior del peralte, se centra antes de cada rampa y suelta el acelerador
// si la curva que viene no cabe a esa velocidad.

import type { KartInput, KartState } from "./kart";
import { closestPoint, forwardDelta, pointAt, type Track } from "./track";
import { BANK, KART } from "./tuning";

export interface BotDriver {
  /** Carril preferido (m a la izquierda del centro). */
  lane: number;
  /** Metros por delante a los que apunta. */
  lookAhead: number;
}

function turnRadius(a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }) {
  const ab = Math.hypot(b.x - a.x, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.z - b.z);
  const ac = Math.hypot(c.x - a.x, c.z - a.z);
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  if (area2 < 1e-3) return Infinity;
  return (ab * bc * ac) / (2 * area2);
}

export function botInput(bot: BotDriver, s: KartState, track: Track): KartInput {
  const c = closestPoint(track, s.x, s.z);
  let lane = bot.lane;
  let look = bot.lookAhead;
  let brake = false;
  let trick = false;
  if (track.relief) {
    look = Math.max(8, Math.abs(s.speed) * 0.6);
    if (Math.abs(c.bank) > 6) lane = Math.sign(c.bank) * Math.min(c.width / 4, 3.2);
    const soon = Math.max(6, Math.abs(s.speed) * 0.6);
    for (const z of track.zones) {
      if (z.type !== "ramp" || !z.size) continue;
      if (forwardDelta(track.length, c.distance, z.from) < soon) lane = 0;
    }
    const ahead = pointAt(track, c.distance + Math.max(look, 12));
    const back = pointAt(track, c.distance - 8);
    const radius = turnRadius(back, c, ahead);
    const bonus = 1 + BANK.turnBonus * Math.sin(Math.abs((c.bank * Math.PI) / 180));
    const v = Math.abs(s.speed);
    const low = Math.min(1, v / KART.turnFullSpeed);
    const high = 1 - (1 - KART.turnAtTopSpeed) * Math.min(1, v / KART.maxSpeed);
    const omega = KART.turnRate * Math.max(0.35, low) * high * bonus;
    if (radius < 500 && v > 14 && v / radius > omega * 0.82) brake = true;
    trick = s.airborne && Math.floor(c.distance) % 2 === 0;
  }
  const target = pointAt(track, c.distance + look, lane);
  const desired = Math.atan2(target.x - s.x, target.z - s.z);
  let diff = desired - s.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Rumbo positivo = izquierda = steer negativo.
  const steer = Math.max(-1, Math.min(1, -diff * (track.relief ? 3.4 : 2.5)));
  return { steer, throttle: !brake, brake, drift: false, trick };
}
