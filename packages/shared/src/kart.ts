// Simulación arcade de un kart a paso fijo. Sin Three.js: se ejecuta igual en cliente, servidor y tests.
// El comportamiento imita a los juegos de karts de referencia; ver docs/FISICAS.md.

import type { Surface } from "./track";
import { ITEMS, KART, SURFACE, type KartTuning } from "./tuning";

export interface KartInput {
  /** -1 (izquierda) .. 1 (derecha). */
  steer: number;
  throttle: boolean;
  /** Frenar y, parado, marcha atrás. */
  brake: boolean;
  /** Botón/gesto de derrape mantenido. Al pulsarlo, el kart da un saltito. */
  drift: boolean;
  /**
   * Lado del derrape pedido por un gesto (-1 izquierda, 1 derecha, como `steer`).
   * Si viene, el derrape empieza al aterrizar aunque el giro esté centrado.
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
  /** Carga acumulada del mini-turbo (unidades: ver tuning). */
  driftCharge: number;
  /** Tiempo de salto restante (s). Al aterrizar empieza el derrape si se sigue pidiendo. */
  hopTime: number;
  /** Si el derrape estaba pulsado el paso anterior (para detectar la pulsación). */
  driftHeld: boolean;
  /** Turbo restante (s) y su fuerza (multiplicador de velocidad punta). */
  boostTime: number;
  boostMult: number;
  /** Trompo restante (s): sin control y frenando. */
  spinTime: number;
  /** Escudo restante (s). */
  shieldTime: number;
  /** Superficie bajo las ruedas (la pone quien conoce la pista antes de cada paso). */
  surface: Surface;
}

export const NO_INPUT: KartInput = { steer: 0, throttle: false, brake: false, drift: false };

export function createKart(x = 0, z = 0, heading = 0): KartState {
  return {
    x,
    z,
    heading,
    speed: 0,
    driftDir: 0,
    driftCharge: 0,
    hopTime: 0,
    driftHeld: false,
    boostTime: 0,
    boostMult: 1,
    spinTime: 0,
    shieldTime: 0,
    surface: "road",
  };
}

/** Nivel de chispas (0–3) según la carga del derrape. */
export function driftLevel(s: KartState, t: KartTuning = KART): number {
  if (s.driftDir === 0) return 0;
  if (s.driftCharge >= t.driftLevel3) return 3;
  if (s.driftCharge >= t.driftLevel2) return 2;
  if (s.driftCharge >= t.driftLevel1) return 1;
  return 0;
}

/** Altura del salto (m) para dibujarlo. */
export function hopHeight(s: KartState, t: KartTuning = KART): number {
  if (s.hopTime <= 0) return 0;
  const u = 1 - s.hopTime / t.hopTime; // 0..1
  return 4 * t.hopHeight * u * (1 - u);
}

/** Da un turbo: dura al menos `time` s y se queda con la fuerza mayor. */
export function giveBoost(s: KartState, time: number, mult: number): void {
  if (time <= 0) return;
  s.boostMult = s.boostTime > 0 ? Math.max(s.boostMult, mult) : mult;
  s.boostTime = Math.max(s.boostTime, time);
}

function boostForLevel(level: number, t: KartTuning): number {
  return level === 3 ? t.boostTime3 : level === 2 ? t.boostTime2 : level === 1 ? t.boostTime1 : 0;
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

function endDrift(s: KartState, t: KartTuning, withBoost: boolean) {
  if (withBoost) giveBoost(s, boostForLevel(driftLevel(s, t), t), t.boostSpeedMult);
  s.driftDir = 0;
  s.driftCharge = 0;
}

/** Avanza la simulación un paso de `dt` segundos. Modifica `s`. */
export function stepKart(s: KartState, input: KartInput, dt: number, t: KartTuning = KART): void {
  s.shieldTime = Math.max(0, s.shieldTime - dt);
  const pressed = input.drift && !s.driftHeld;
  s.driftHeld = input.drift;

  // --- Trompo: sin control, frenando ---
  if (s.spinTime > 0) {
    s.spinTime = Math.max(0, s.spinTime - dt);
    s.driftDir = 0;
    s.driftCharge = 0;
    s.hopTime = 0;
    s.boostTime = 0;
    s.speed = approach(s.speed, 0, ITEMS.spinDecel * dt);
    s.x += Math.sin(s.heading) * s.speed * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
    return;
  }

  const steer = Math.max(-1, Math.min(1, input.steer));
  const icy = s.surface === "lowGrip";
  if (s.surface === "boostPad") giveBoost(s, SURFACE.boostPadTime, SURFACE.boostPadMult);

  // --- Salto y derrape ---
  // Pulsar derrape = saltito. Al aterrizar, si se sigue pulsando y hay dirección, empieza el derrape.
  if (s.driftDir === 0) {
    if (pressed && s.hopTime === 0 && s.speed > 0) s.hopTime = t.hopTime;
    if (s.hopTime > 0) {
      s.hopTime = Math.max(0, s.hopTime - dt);
      if (s.hopTime === 0) {
        const side = input.driftSide || (Math.abs(steer) > 0.3 ? steer : 0);
        if (input.drift && side !== 0 && s.speed >= t.driftMinSpeed) {
          // Girar a la izquierda (steer < 0) es rumbo positivo.
          s.driftDir = side < 0 ? 1 : -1;
          s.driftCharge = 0;
        }
      }
    }
  } else if (!input.drift || s.speed < t.driftMinSpeed * 0.6) {
    endDrift(s, t, s.speed >= t.driftMinSpeed * 0.6);
  }

  // --- Velocidad ---
  const boosting = s.boostTime > 0;
  const terrain = s.surface === "offroad" ? SURFACE.offroadSpeedMult : s.surface === "slow" ? SURFACE.slowSpeedMult : 1;
  const normalTop = t.maxSpeed * terrain * (s.driftDir !== 0 ? 1 - t.driftSpeedLoss : 1);
  const topSpeed = boosting ? t.maxSpeed * s.boostMult : normalTop;

  if (boosting) {
    s.speed = approach(s.speed, topSpeed, t.boostAccel * dt);
    s.boostTime = Math.max(0, s.boostTime - dt);
    if (s.boostTime === 0) s.boostMult = 1;
  } else if (input.brake) {
    if (s.speed > 0.5) s.speed = Math.max(0, s.speed - t.brake * dt);
    else s.speed = approach(s.speed, -t.maxReverse, t.reverseAccel * dt);
  } else if (input.throttle) {
    if (s.speed < 0) s.speed = Math.min(0, s.speed + t.brake * dt);
    else if (s.speed < topSpeed) {
      // Dos fases: tope absoluto al arrancar; proporcional a lo que falta cerca de la punta.
      const gain = Math.min(t.accelLimit, t.accelRelative * (topSpeed - s.speed)) * (icy ? SURFACE.lowGripAccelMult : 1);
      s.speed = Math.min(topSpeed, s.speed + gain * dt);
    }
  } else {
    s.speed = approach(s.speed, 0, t.coastDrag * dt);
  }
  // Tras acabar el turbo, volver suavemente a la velocidad punta normal.
  if (!boosting && s.speed > topSpeed) {
    const decel = terrain < 1 ? SURFACE.roughDecel : t.coastDrag * 2;
    s.speed = approach(s.speed, topSpeed, decel * dt);
  }

  // --- Giro ---
  let turn: number;
  if (s.driftDir !== 0) {
    // steer a favor del derrape lo cierra; en contra lo abre.
    const inside = -steer * s.driftDir; // -1..1
    turn = s.driftDir * (t.driftTurnBase + t.driftTurnRange * inside);
    const rate = inside >= t.driftInsideThreshold ? t.driftChargeFast : t.driftChargeSlow;
    if (s.hopTime === 0) s.driftCharge += rate * t.driftChargeMult * dt;
  } else {
    const abs = Math.abs(s.speed);
    const low = Math.min(1, abs / t.turnFullSpeed);
    const high = 1 - (1 - t.turnAtTopSpeed) * Math.min(1, abs / t.maxSpeed);
    turn = -steer * t.turnRate * low * high * Math.sign(s.speed);
  }
  s.heading += turn * (icy ? SURFACE.lowGripTurnMult : 1) * dt;

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
  // Chocar de frente corta el derrape sin dar turbo.
  if (frontal > 0.5) endDrift(s, t, false);
}

/**
 * Choque entre dos karts (esferas). Los separa y frena un poco al que embiste.
 * Con `moveB = false` solo se mueve `a` (en red, cada cliente corrige solo su propio kart).
 * Devuelve true si han chocado.
 */
export function collideKarts(a: KartState, b: KartState, moveB = true, t: KartTuning = KART): boolean {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const dist = Math.hypot(dx, dz);
  const min = t.radius * 2;
  if (dist >= min) return false;
  // Normal de b hacia a (si están en el mismo punto, hacia la izquierda de a).
  const nx = dist > 1e-6 ? dx / dist : Math.cos(a.heading);
  const nz = dist > 1e-6 ? dz / dist : -Math.sin(a.heading);
  const overlap = min - dist + t.bumpPush;
  const share = moveB ? 0.5 : 1;
  a.x += nx * overlap * share;
  a.z += nz * overlap * share;
  if (moveB) {
    b.x -= nx * overlap * share;
    b.z -= nz * overlap * share;
  }
  // Frena al que va hacia el otro, según lo de frente que sea el golpe.
  const slow = (k: KartState, sx: number, sz: number) => {
    const into = (Math.sin(k.heading) * sx + Math.cos(k.heading) * sz) * Math.sign(k.speed);
    if (into <= 0) return;
    k.speed *= 1 - (1 - t.bumpSpeedKeep) * Math.min(1, into);
  };
  slow(a, -nx, -nz);
  if (moveB) slow(b, nx, nz);
  return true;
}
