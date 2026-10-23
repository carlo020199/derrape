// Simulación arcade de un kart a paso fijo. Sin Three.js: se ejecuta igual en cliente, servidor y tests.

import { KART, type KartTuning } from "./tuning";

export interface KartInput {
  /** -1 (izquierda) .. 1 (derecha). */
  steer: number;
  throttle: boolean;
  /** Frenar y, parado, marcha atrás. */
  brake: boolean;
  drift: boolean;
  /**
   * Lado del derrape pedido por un gesto (-1 izquierda, 1 derecha, como `steer`).
   * Si viene, el derrape empieza aunque el giro esté centrado.
   */
  driftSide?: number;
}

export interface KartState {
  x: number;
  z: number;
  /** Rumbo en radianes. 0 = mirando a +Z. Positivo = giro a la izquierda. */
  heading: number;
  /** Velocidad a lo largo del rumbo (m/s). Negativa = marcha atrás. */
  speed: number;
  /** 0 = no derrapa, -1 / 1 = derrapando hacia la derecha / izquierda. */
  driftDir: number;
  /** Carga acumulada del derrape (s ponderados). */
  driftCharge: number;
  /** Turbo restante (s). */
  boostTime: number;
}

export const NO_INPUT: KartInput = { steer: 0, throttle: false, brake: false, drift: false };

export function createKart(x = 0, z = 0, heading = 0): KartState {
  return { x, z, heading, speed: 0, driftDir: 0, driftCharge: 0, boostTime: 0 };
}

/** Nivel de chispas (0–3) según la carga del derrape. */
export function driftLevel(s: KartState, t: KartTuning = KART): number {
  if (s.driftDir === 0) return 0;
  if (s.driftCharge >= t.driftLevel3) return 3;
  if (s.driftCharge >= t.driftLevel2) return 2;
  if (s.driftCharge >= t.driftLevel1) return 1;
  return 0;
}

function boostForLevel(level: number, t: KartTuning): number {
  return level === 3 ? t.boostTime3 : level === 2 ? t.boostTime2 : level === 1 ? t.boostTime1 : 0;
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

/** Avanza la simulación un paso de `dt` segundos. Modifica `s`. */
export function stepKart(s: KartState, input: KartInput, dt: number, t: KartTuning = KART): void {
  const steer = Math.max(-1, Math.min(1, input.steer));

  // --- Derrape: empezar, mantener, soltar ---
  if (s.driftDir === 0) {
    const side = input.driftSide || (Math.abs(steer) > 0.3 ? steer : 0);
    if (input.drift && side !== 0 && s.speed >= t.driftMinSpeed) {
      // Girar a la izquierda (steer < 0) es rumbo positivo.
      s.driftDir = side < 0 ? 1 : -1;
      s.driftCharge = 0;
    }
  } else if (!input.drift || s.speed < t.driftMinSpeed * 0.6) {
    const boost = s.speed >= t.driftMinSpeed * 0.6 ? boostForLevel(driftLevel(s, t), t) : 0;
    s.boostTime = Math.max(s.boostTime, boost);
    s.driftDir = 0;
    s.driftCharge = 0;
  }

  // --- Velocidad ---
  const boosting = s.boostTime > 0;
  const topSpeed = boosting ? t.maxSpeed * t.boostSpeedMult : t.maxSpeed * (s.driftDir !== 0 ? 1 - t.driftSpeedLoss : 1);

  if (boosting) {
    s.speed = approach(s.speed, topSpeed, t.boostAccel * dt);
    s.boostTime = Math.max(0, s.boostTime - dt);
  } else if (input.brake) {
    if (s.speed > 0.5) s.speed = Math.max(0, s.speed - t.brake * dt);
    else s.speed = approach(s.speed, -t.maxReverse, t.reverseAccel * dt);
  } else if (input.throttle) {
    if (s.speed < 0) s.speed = Math.min(0, s.speed + t.brake * dt);
    else s.speed = approach(s.speed, topSpeed, t.accel * dt);
  } else {
    s.speed = approach(s.speed, 0, t.coastDrag * dt);
  }
  // Tras acabar el turbo, volver suavemente a la velocidad punta normal.
  if (!boosting && s.speed > topSpeed) s.speed = approach(s.speed, topSpeed, t.coastDrag * 2 * dt);

  // --- Giro ---
  let turn: number;
  if (s.driftDir !== 0) {
    // steer a favor del derrape lo cierra; en contra lo abre.
    const tight = -steer * s.driftDir; // -1..1
    turn = s.driftDir * (t.driftTurnBase + t.driftTurnRange * tight);
    s.driftCharge += dt * (1 + t.driftChargeTightBonus * Math.max(0, tight));
  } else {
    const abs = Math.abs(s.speed);
    const low = Math.min(1, abs / t.turnFullSpeed);
    const high = 1 - (1 - t.turnAtTopSpeed) * Math.min(1, abs / t.maxSpeed);
    turn = -steer * t.turnRate * low * high * Math.sign(s.speed);
  }
  s.heading += turn * dt;

  // --- Posición ---
  s.x += Math.sin(s.heading) * s.speed * dt;
  s.z += Math.cos(s.heading) * s.speed * dt;
}

/**
 * Rebote contra un borde. `nx, nz` = normal unitaria del borde apuntando hacia dentro de la pista;
 * `push` = cuánto hay que mover el kart para sacarlo del borde.
 */
export function bounceKart(s: KartState, nx: number, nz: number, push: number, t: KartTuning = KART): void {
  s.x += nx * push;
  s.z += nz * push;

  const vx = Math.sin(s.heading) * s.speed;
  const vz = Math.cos(s.heading) * s.speed;
  const into = vx * nx + vz * nz;
  if (into >= 0) return; // ya se aleja del borde

  // Fracción de la velocidad que va contra el muro: 1 = de frente, 0 = rozando.
  const frontal = Math.min(1, -into / Math.max(Math.abs(s.speed), 1e-6));
  const keep = t.wallScrapeKeep + (t.wallBounceKeep - t.wallScrapeKeep) * frontal;

  // Quitar la componente hacia el muro y dejar un pequeño rebote.
  const rvx = vx - into * nx * 1.3;
  const rvz = vz - into * nz * 1.3;
  const len = Math.hypot(rvx, rvz);
  const newSpeed = Math.abs(s.speed) * keep;
  if (len > 1e-6) {
    const dir = Math.sign(s.speed) || 1;
    s.heading = Math.atan2(rvx * dir, rvz * dir);
  }
  s.speed = newSpeed * (Math.sign(s.speed) || 1);
  // Chocar corta el derrape sin dar turbo.
  if (frontal > 0.5) {
    s.driftDir = 0;
    s.driftCharge = 0;
  }
}
