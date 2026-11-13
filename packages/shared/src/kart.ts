// Simulación arcade de un kart a paso fijo. Sin Three.js: se ejecuta igual en cliente, servidor y tests.
// El comportamiento imita a los juegos de karts de referencia; ver docs/FISICAS.md.

import type { Surface } from "./track";
import { BANK, ITEMS, KART, RAMP, SLOPE, SURFACE, type KartTuning, type RampSize } from "./tuning";

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
  /** Deslizar hacia arriba en el aire: mini-turbo al aterrizar. */
  trick?: boolean;
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
  /** Duración total del salto en curso (para la curva de altura: derrape o rampa). */
  hopTotal: number;
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
  /** Peso (1–5, estadística del coche): el más pesado empuja más en los choques y pierde menos velocidad. */
  mass: number;
  /**
   * Altura absoluta del vuelo (m). En el suelo no se usa: se dibuja la superficie.
   * `airborne` distingue un salto de estar apoyado.
   */
  y: number;
  /** Velocidad vertical (m/s). Positiva hacia arriba. */
  vy: number;
  airborne: boolean;
  /** Seno de la pendiente en el rumbo. 0 = llano (lo escribe la pista). */
  grade: number;
  /** Peralte en grados. + = curva a la izquierda. 0 = sin peralte. */
  bank: number;
  /** Metros que suma el lomo de una rampa S/M/L antes del labio. */
  climb: number;
  /** Altura de la superficie bajo el kart (m). */
  groundY: number;
  rampSize: RampSize | null;
  /** Rampa que originó el vuelo, para el truco al aterrizar. */
  flightRamp: RampSize | null;
  /** El piloto pidió el truco durante este salto. */
  trick: boolean;
  /** El último choque fue contra el muro exterior de un peralte. */
  outsideWall: boolean;
  /** Distancia de pista del paso anterior, para saber cuándo se pisa un labio. -1 = aún no. */
  along: number;
  /**
   * Tope de velocidad por agarre en la curva que viene (m/s).
   * 0 = sin tope (circuitos sin relieve, y cualquier kart que no pase por la pista).
   */
  gripCap: number;
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
    hopTotal: 0,
    driftHeld: false,
    boostTime: 0,
    boostMult: 1,
    spinTime: 0,
    shieldTime: 0,
    surface: "road",
    mass: 3,
    y: 0,
    vy: 0,
    airborne: false,
    grade: 0,
    bank: 0,
    climb: 0,
    groundY: 0,
    rampSize: null,
    flightRamp: null,
    trick: false,
    outsideWall: false,
    along: -1,
    gripCap: 0,
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
  const total = s.hopTotal > 0 ? s.hopTotal : t.hopTime;
  const height = total > t.hopTime + 0.05 ? SURFACE.rampHopHeight : t.hopHeight;
  const u = 1 - s.hopTime / total; // 0..1
  return 4 * height * Math.max(0, u) * (1 - Math.max(0, Math.min(1, u)));
}

function startHop(s: KartState, duration: number) {
  s.hopTime = duration;
  s.hopTotal = duration;
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
    s.hopTotal = 0;
    s.boostTime = 0;
    s.speed = approach(s.speed, 0, ITEMS.spinDecel * dt);
    if (s.airborne) fly(s, dt);
    s.x += Math.sin(s.heading) * s.speed * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
    return;
  }

  const steer = Math.max(-1, Math.min(1, input.steer));
  const icy = s.surface === "lowGrip";
  if (s.surface === "boostPad") giveBoost(s, SURFACE.boostPadTime, SURFACE.boostPadMult);
  // Rampa sin tamaño: salto de duración fija. Con tamaño, el vuelo lo dispara la pista en el labio.
  if (
    s.surface === "ramp" &&
    !s.rampSize &&
    !s.airborne &&
    s.hopTime === 0 &&
    s.speed >= SURFACE.rampMinSpeed &&
    s.driftDir === 0
  ) {
    startHop(s, SURFACE.rampHopTime);
  }
  if (s.airborne && input.trick) s.trick = true;

  // --- Salto y derrape ---
  // Pulsar derrape = saltito. Al aterrizar, si se sigue pulsando y hay dirección, empieza el derrape.
  if (s.driftDir === 0) {
    if (pressed && s.hopTime === 0 && s.speed > 0 && !s.airborne) startHop(s, t.hopTime);
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
  // Cuesta: solo si la pista ha escrito una pendiente. En llano (grade 0) no cambia la punta.
  if (!s.airborne && s.grade !== 0) {
    const accel = Math.max(-SLOPE.maxAccel, Math.min(SLOPE.maxAccel, -SLOPE.k * SLOPE.gGame * s.grade));
    s.speed += accel * dt;
    if (!boosting && s.speed > topSpeed) s.speed = approach(s.speed, topSpeed, t.coastDrag * 2 * dt);
  }
  // Curva sin peralte suficiente: hay que soltar. El turbo no se recorta.
  if (!s.airborne && !boosting && s.gripCap > 0 && s.speed > s.gripCap) {
    s.speed = approach(s.speed, s.gripCap, t.brake * dt);
  }

  // --- Giro ---
  let turn: number;
  if (s.driftDir !== 0) {
    // steer a favor del derrape lo cierra; en contra lo abre.
    const inside = -steer * s.driftDir; // -1..1
    turn = s.driftDir * (t.driftTurnBase + t.driftTurnRange * inside);
    const rate = inside >= t.driftInsideThreshold ? t.driftChargeFast : t.driftChargeSlow;
    const banked = Math.abs(s.bank) >= BANK.driftFrom ? BANK.driftCharge : 1;
    if (s.hopTime === 0 && !s.airborne) s.driftCharge += rate * t.driftChargeMult * banked * dt;
  } else {
    const abs = Math.abs(s.speed);
    const low = Math.min(1, abs / t.turnFullSpeed);
    const high = 1 - (1 - t.turnAtTopSpeed) * Math.min(1, abs / t.maxSpeed);
    turn = -steer * t.turnRate * low * high * Math.sign(s.speed);
  }
  if (!s.airborne && s.bank !== 0 && turn !== 0 && Math.sign(turn) === Math.sign(s.bank)) {
    turn *= 1 + BANK.turnBonus * Math.sin(Math.abs((s.bank * Math.PI) / 180));
  }
  const air = s.airborne ? RAMP.airTurn : 1;
  s.heading += turn * (icy ? SURFACE.lowGripTurnMult : 1) * air * dt;

  if (s.airborne) fly(s, dt);

  // --- Posición ---
  s.x += Math.sin(s.heading) * s.speed * dt;
  s.z += Math.cos(s.heading) * s.speed * dt;
  // Parado en un peralte, el kart resbala hacia el borde bajo. Con bank 0 no se mueve.
  if (!s.airborne && s.bank !== 0 && Math.abs(s.speed) < BANK.slideSpeed) {
    const push = SLOPE.gGame * Math.sin((s.bank * Math.PI) / 180) * BANK.slide * dt;
    s.x += Math.cos(s.heading) * push;
    s.z += -Math.sin(s.heading) * push;
  }
}

function fly(s: KartState, dt: number) {
  s.vy -= RAMP.gGame * dt;
  s.y += s.vy * dt;
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
  let keep = t.wallScrapeKeep + (t.wallBounceKeep - t.wallScrapeKeep) * frontal;
  // El peralte recoge: el muro exterior frena la mitad. Sin peralte, `outsideWall` queda a false.
  if (s.outsideWall) keep = 1 - (1 - keep) * 0.5;

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
  // El más ligero se aparta más. Con pesos iguales: mitad cada uno (o todo uno si solo se mueve `a`).
  const total = a.mass + b.mass;
  const shareA = moveB ? b.mass / total : Math.min(1.5, (2 * b.mass) / total);
  const shareB = a.mass / total;
  a.x += nx * overlap * shareA;
  a.z += nz * overlap * shareA;
  if (moveB) {
    b.x -= nx * overlap * shareB;
    b.z -= nz * overlap * shareB;
  }
  // Frena al que va hacia el otro, según lo de frente que sea el golpe y lo ligero que sea frente al otro.
  const slow = (k: KartState, other: KartState, sx: number, sz: number) => {
    const into = (Math.sin(k.heading) * sx + Math.cos(k.heading) * sz) * Math.sign(k.speed);
    if (into <= 0) return;
    const ratio = Math.max(0.5, Math.min(2, other.mass / k.mass));
    k.speed *= 1 - Math.min(1, (1 - t.bumpSpeedKeep) * Math.min(1, into) * ratio);
  };
  slow(a, b, -nx, -nz);
  if (moveB) slow(b, a, nx, nz);
  return true;
}
