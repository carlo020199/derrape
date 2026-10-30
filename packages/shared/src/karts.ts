// Los 10 coches (datos) y la fórmula personaje + coche → estadísticas → ajuste de la simulación.
// Estadísticas del coche en escala 1–5 y suman 12 (así ninguno es mejor en todo). Ver docs/CONTENIDO.md.

import { WEIGHT_CLASS_MOD, findCharacter, type CharacterDef } from "./characters";
import { KART, type KartTuning } from "./tuning";

export interface KartStats {
  speed: number;
  accel: number;
  handling: number;
  weight: number;
}

export const STAT_NAMES: Record<keyof KartStats, string> = {
  speed: "Velocidad",
  accel: "Aceleración",
  handling: "Manejo",
  weight: "Peso",
};

/** Forma del coche (el cliente lo construye con primitivas). Medidas en metros; +Z es delante. */
export interface KartLook {
  /** Largo y ancho del chasis. */
  length: number;
  width: number;
  /** Altura del chasis sobre el suelo. */
  height: number;
  /** Radio y ancho de las ruedas delanteras y traseras. */
  frontWheel: number;
  rearWheel: number;
  frontWheelW: number;
  rearWheelW: number;
  /** Alerón: ninguno, normal o enorme. */
  wing: 0 | 1 | 2;
  /** Carrocería extra: nada, caja (todoterreno), furgoneta, jaula de buggy o manillar de patinete. */
  body: "none" | "box" | "van" | "cage" | "bars";
  /** Morro puntiagudo (deportivos). */
  nose: boolean;
}

export interface KartDef {
  id: string;
  name: string;
  style: string;
  stats: KartStats;
  /** Para quién va bien. */
  forWho: string;
  /** Extra del coche: multiplicador de la carga del turbo de derrape. */
  driftChargeMult?: number;
  look: KartLook;
}

const L = (look: Partial<KartLook>): KartLook => ({
  length: 2.2,
  width: 1.3,
  height: 0.35,
  frontWheel: 0.27,
  rearWheel: 0.27,
  frontWheelW: 0.3,
  rearWheelW: 0.3,
  wing: 0,
  body: "none",
  nose: false,
  ...look,
});

export const KARTS: readonly KartDef[] = [
  { id: "chispa", name: "Chispa", style: "Kart clásico", stats: { speed: 3, accel: 3, handling: 3, weight: 3 }, forWho: "Equilibrado, el de empezar", look: L({}) },
  { id: "bolido", name: "Bólido", style: "Kart de carreras alargado", stats: { speed: 5, accel: 2, handling: 2, weight: 3 }, forWho: "Rectas largas", look: L({ length: 2.8, width: 1.15, height: 0.3, nose: true, wing: 1 }) },
  { id: "pulga", name: "Pulga", style: "Mini kart de ruedas gordas", stats: { speed: 2, accel: 5, handling: 4, weight: 1 }, forWho: "Circuitos técnicos", look: L({ length: 1.6, width: 1.1, frontWheel: 0.36, rearWheel: 0.4, frontWheelW: 0.4, rearWheelW: 0.45 }) },
  { id: "tanque", name: "Tanque", style: "Todoterreno cuadrado", stats: { speed: 3, accel: 2, handling: 2, weight: 5 }, forWho: "Empujar a los demás", look: L({ length: 2.3, width: 1.6, height: 0.5, frontWheel: 0.4, rearWheel: 0.4, frontWheelW: 0.4, rearWheelW: 0.4, body: "box" }) },
  { id: "centella", name: "Centella", style: "Deportivo bajo", stats: { speed: 4, accel: 3, handling: 3, weight: 2 }, forWho: "Rápido y manejable", look: L({ length: 2.5, width: 1.35, height: 0.22, nose: true, frontWheel: 0.24, rearWheel: 0.26 }) },
  { id: "mosquito", name: "Mosquito", style: "Kart-patinete muy ligero", stats: { speed: 2, accel: 4, handling: 5, weight: 1 }, forWho: "Precisión", look: L({ length: 1.7, width: 0.7, height: 0.22, frontWheel: 0.22, rearWheel: 0.22, frontWheelW: 0.2, rearWheelW: 0.2, body: "bars" }) },
  { id: "furgo", name: "Furgo", style: "Furgoneta de comida mini", stats: { speed: 4, accel: 1, handling: 2, weight: 5 }, forWho: "Pesado y veloz", look: L({ length: 2.6, width: 1.5, height: 0.45, frontWheel: 0.3, rearWheel: 0.3, body: "van" }) },
  { id: "flecha", name: "Flecha", style: "Kart con alerón enorme", stats: { speed: 5, accel: 1, handling: 3, weight: 3 }, forWho: "Expertos", look: L({ length: 2.5, width: 1.25, height: 0.28, nose: true, wing: 2 }) },
  { id: "grillo", name: "Grillo", style: "Buggy de playa", stats: { speed: 2, accel: 4, handling: 3, weight: 3 }, forWho: "Salidas y remontadas", look: L({ length: 2.1, width: 1.45, height: 0.4, frontWheel: 0.3, rearWheel: 0.38, rearWheelW: 0.42, body: "cage" }) },
  { id: "derrapin", name: "Derrapín", style: "Kart bajo con ruedas traseras anchas", stats: { speed: 3, accel: 3, handling: 4, weight: 2 }, forWho: "Extra: el turbo de derrape carga un 15 % más rápido", driftChargeMult: 1.15, look: L({ length: 2.3, height: 0.25, rearWheel: 0.32, rearWheelW: 0.6, nose: true }) },
];

export const DEFAULT_KART = KARTS[0]!.id;

export function findKart(id: unknown): KartDef | undefined {
  return KARTS.find((k) => k.id === id);
}

const clampStat = (n: number) => Math.max(1, Math.min(5, n));

/** Personaje + coche → estadísticas finales (siempre entre 1 y 5). Función pura. */
export function combineStats(character: Pick<CharacterDef, "weightClass">, kart: Pick<KartDef, "stats">): KartStats {
  const mod = WEIGHT_CLASS_MOD[character.weightClass];
  return {
    speed: clampStat(kart.stats.speed),
    accel: clampStat(kart.stats.accel + mod.accel),
    handling: clampStat(kart.stats.handling),
    weight: clampStat(kart.stats.weight + mod.weight),
  };
}

/** Estadísticas por ids (con valores por defecto si el id no existe, p. ej. un cliente antiguo). */
export function statsFor(characterId: unknown, kartId: unknown): KartStats {
  return combineStats(findCharacter(characterId) ?? findCharacter("toni")!, findKart(kartId) ?? KARTS[0]!);
}

/** Cuánto cambia cada estadística la simulación (por punto sobre o bajo el 3, el valor neutro). */
export const STAT_EFFECT = {
  /** Velocidad punta: ±3,5 % por punto. */
  speed: 0.035,
  /** Aceleración (tope y proporcional): ±10 % por punto. */
  accel: 0.1,
  /** Giro normal y derrapando: ±7 % por punto. */
  handling: 0.07,
};

/**
 * Ajusta las constantes del kart (`base`, normalmente KART) a unas estadísticas.
 * Devuelve un objeto nuevo: el panel de debug (F1) sigue cambiando `base` en vivo.
 */
export function deriveTuning(base: KartTuning, stats: KartStats, driftChargeMult = 1): KartTuning {
  const speed = 1 + (stats.speed - 3) * STAT_EFFECT.speed;
  const accel = 1 + (stats.accel - 3) * STAT_EFFECT.accel;
  const turn = 1 + (stats.handling - 3) * STAT_EFFECT.handling;
  return {
    ...base,
    maxSpeed: base.maxSpeed * speed,
    accelLimit: base.accelLimit * accel,
    accelRelative: base.accelRelative * accel,
    turnRate: base.turnRate * turn,
    driftTurnBase: base.driftTurnBase * turn,
    driftTurnRange: base.driftTurnRange * turn,
    driftChargeMult: base.driftChargeMult * driftChargeMult,
  };
}
