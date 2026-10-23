// Piloto automático sencillo: sigue la pista con un carril fijo. De momento sirve de diana
// para probar objetos; en el futuro, base de los bots.

import type { KartInput, KartState } from "./kart";
import { closestPoint, pointAt, type Track } from "./track";

export interface BotDriver {
  /** Carril preferido (m a la izquierda del centro). */
  lane: number;
  /** Metros por delante a los que apunta. */
  lookAhead: number;
}

export function botInput(bot: BotDriver, s: KartState, track: Track): KartInput {
  const c = closestPoint(track, s.x, s.z);
  const target = pointAt(track, c.distance + bot.lookAhead, bot.lane);
  const desired = Math.atan2(target.x - s.x, target.z - s.z);
  let diff = desired - s.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Rumbo positivo = izquierda = steer negativo.
  const steer = Math.max(-1, Math.min(1, -diff * 2.5));
  return { steer, throttle: true, brake: false, drift: false };
}
