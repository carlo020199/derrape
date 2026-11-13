import type { KartInput } from "@derrape/shared";
import { settings } from "../ui/settings";
import { readGyroSteer } from "./gyro";
import { readKeyboard } from "./keyboard";
import { touch } from "./touch";

/** Combina teclado, táctil y giroscopio en una sola entrada para el kart. */
export function readInput(): KartInput {
  const kb = readKeyboard();
  if (!touch.active) return kb;

  // En móvil se acelera siempre (como en los juegos de karts para móvil).
  const steer = settings.gyro ? readGyroSteer() : touch.steer;
  const trick = touch.trick;
  touch.trick = false;
  return {
    steer: Math.max(-1, Math.min(1, steer + kb.steer)),
    throttle: !kb.brake,
    brake: kb.brake,
    drift: touch.drift || kb.drift,
    driftSide: touch.driftSide,
    trick,
  };
}
