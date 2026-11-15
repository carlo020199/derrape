import { describe, expect, it } from "vitest";
import { bounceKart, collideKarts, createKart, driftLevel, giveBoost, hopHeight, stepKart, type KartInput } from "./kart";
import { closestPoint, collideKartWithTrack, createOvalTrack } from "./track";
import { KART, PHYSICS_DT } from "./tuning";

const GAS: KartInput = { steer: 0, throttle: true, brake: false, drift: false };

function run(s: ReturnType<typeof createKart>, input: KartInput, seconds: number) {
  for (let i = 0; i < Math.round(seconds / PHYSICS_DT); i++) stepKart(s, input, PHYSICS_DT);
}

describe("kart", () => {
  it("acelera hasta la velocidad punta y no la supera", () => {
    const s = createKart();
    let max = 0;
    for (let i = 0; i < 60 * 10; i++) {
      stepKart(s, GAS, PHYSICS_DT);
      max = Math.max(max, s.speed);
    }
    expect(s.speed).toBeCloseTo(KART.maxSpeed, 2);
    expect(max).toBeLessThanOrEqual(KART.maxSpeed + 1e-9);
  });

  it("frena y luego va marcha atrás sin pasar del límite", () => {
    const s = createKart();
    run(s, GAS, 3);
    run(s, { ...GAS, throttle: false, brake: true }, 6);
    expect(s.speed).toBeCloseTo(-KART.maxReverse, 5);
  });

  it("parado no gira", () => {
    const s = createKart();
    run(s, { ...GAS, throttle: false, steer: 1 }, 1);
    expect(s.heading).toBe(0);
  });

  it("aceleración en dos fases: arranque fuerte y final suave", () => {
    const s = createKart();
    run(s, GAS, 0.5);
    // Primera fase: aceleración al tope.
    expect(s.speed).toBeCloseTo(KART.accelLimit * 0.5, 0);
    run(s, GAS, 2.5);
    // A los 3 s ya casi en la punta, pero sin pasarse.
    expect(s.speed).toBeGreaterThan(KART.maxSpeed * 0.93);
    expect(s.speed).toBeLessThanOrEqual(KART.maxSpeed);
  });

  it("pulsar derrape sin girar solo hace un saltito", () => {
    const s = createKart();
    run(s, GAS, 4);
    stepKart(s, { ...GAS, drift: true }, PHYSICS_DT);
    expect(s.hopTime).toBeGreaterThan(0);
    expect(hopHeight(s)).toBeGreaterThanOrEqual(0);
    run(s, { ...GAS, drift: true }, KART.hopTime + 0.1);
    expect(s.hopTime).toBe(0);
    expect(s.driftDir).toBe(0);
  });

  it("el derrape empieza al aterrizar del salto, no antes", () => {
    const s = createKart();
    run(s, GAS, 4);
    const drifting: KartInput = { steer: -1, throttle: true, brake: false, drift: true };
    stepKart(s, drifting, PHYSICS_DT);
    expect(s.driftDir).toBe(0);
    run(s, drifting, KART.hopTime);
    expect(s.driftDir).toBe(1);
  });

  it("el derrape carga los niveles en orden y al soltar da turbo", () => {
    const s = createKart();
    run(s, GAS, 4);
    const drifting: KartInput = { steer: -1, throttle: true, brake: false, drift: true };
    const levels: number[] = [];
    for (let i = 0; i < 60 * 3.5; i++) {
      stepKart(s, drifting, PHYSICS_DT);
      levels.push(driftLevel(s));
    }
    expect(s.driftDir).toBe(1);
    // Nunca baja de nivel y pasa por 0, 1, 2, 3.
    for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);
    expect(new Set(levels)).toEqual(new Set([0, 1, 2, 3]));

    stepKart(s, GAS, PHYSICS_DT);
    expect(s.driftDir).toBe(0);
    expect(s.boostTime).toBeGreaterThan(KART.boostTime3 - 0.05);
    run(s, GAS, 0.5);
    expect(s.speed).toBeGreaterThan(KART.maxSpeed);
    expect(s.speed).toBeLessThanOrEqual(KART.maxSpeed * KART.boostSpeedMult + 1e-9);
  });

  it("girar hacia dentro carga más rápido que abrir el derrape", () => {
    const charge = (steer: number) => {
      const s = createKart();
      run(s, GAS, 4);
      run(s, { steer: -1, throttle: true, brake: false, drift: true }, KART.hopTime + 0.05);
      run(s, { steer, throttle: true, brake: false, drift: true }, 1);
      return s.driftCharge;
    };
    const inside = charge(-1); // derrape a la izquierda, girando a la izquierda
    const outside = charge(0.5);
    expect(inside / outside).toBeCloseTo(KART.driftChargeFast / KART.driftChargeSlow, 0);
  });

  it("soltar el derrape sin carga no da turbo", () => {
    const s = createKart();
    run(s, GAS, 4);
    run(s, { steer: 1, throttle: true, brake: false, drift: true }, 0.2);
    stepKart(s, GAS, PHYSICS_DT);
    expect(s.boostTime).toBe(0);
  });

  it("el turbo dura lo que toca y vuelve a la punta normal", () => {
    const s = createKart();
    run(s, GAS, 4);
    giveBoost(s, KART.boostTime2, KART.boostSpeedMult);
    run(s, GAS, KART.boostTime2 + 3);
    expect(s.boostTime).toBe(0);
    expect(s.speed).toBeCloseTo(KART.maxSpeed, 3);
  });
});

describe("pista", () => {
  const track = createOvalTrack();

  it("el rebote contra el borde no atraviesa la pista", () => {
    // Acelerar recto hacia fuera desde varios puntos y comprobar que nunca sale.
    for (const p of track.points.filter((_, i) => i % 7 === 0)) {
      const s = createKart(p.x, p.z, Math.atan2(p.x, p.z)); // mirando hacia fuera del óvalo
      s.speed = KART.maxSpeed * KART.boostSpeedMult;
      for (let i = 0; i < 60 * 3; i++) {
        stepKart(s, GAS, PHYSICS_DT);
        collideKartWithTrack(s, track);
        const c = closestPoint(track, s.x, s.z);
        expect(Math.abs(c.lateral)).toBeLessThanOrEqual(track.width / 2 - KART.radius + 1e-6);
      }
    }
  });

  it("chocar de frente frena más que rozar", () => {
    // Borde con normal hacia -Z; un kart va hacia +Z (de frente) y otro casi en paralelo.
    const frontal = createKart(0, 0, 0);
    const scrape = createKart(0, 0, Math.PI / 2 - 0.1);
    frontal.speed = scrape.speed = 20;
    bounceKart(frontal, 0, -1, 0.1);
    bounceKart(scrape, 0, -1, 0.1);
    expect(frontal.speed).toBeLessThan(scrape.speed);
    expect(frontal.speed).toBeGreaterThan(0);
  });
});

describe("choques entre karts", () => {
  it("separa a los dos y frena al que embiste por detrás", () => {
    const front = createKart(0, 1, 0);
    const back = createKart(0, 0, 0);
    front.speed = 15;
    back.speed = 25;
    expect(collideKarts(back, front)).toBe(true);
    expect(Math.hypot(front.x - back.x, front.z - back.z)).toBeGreaterThanOrEqual(KART.radius * 2);
    expect(back.speed).toBeLessThan(25);
    expect(front.speed).toBe(15); // al de delante no se le frena
  });

  it("si no se tocan no pasa nada", () => {
    const a = createKart(0, 0, 0);
    const b = createKart(5, 0, 0);
    expect(collideKarts(a, b)).toBe(false);
  });

  it("en red solo se mueve el propio kart", () => {
    const me = createKart(0.5, 0, 0);
    const other = createKart(0, 0, 0);
    collideKarts(me, other, false);
    expect(other.x).toBe(0);
    expect(me.x).toBeGreaterThan(0.5);
  });
});

describe("contravolante", () => {
  /** Kart ya derrapando hacia la izquierda (rumbo positivo), a velocidad punta. */
  function drifting(): ReturnType<typeof createKart> {
    const s = createKart();
    run(s, GAS, 4);
    run(s, { steer: -1, throttle: true, brake: false, drift: true }, KART.hopTime + 0.05);
    expect(s.driftDir).toBe(1);
    return s;
  }
  const hold = (steer: number): KartInput => ({ steer, throttle: true, brake: false, drift: true });
  /** Giro (rad/s) en régimen con ese input. */
  function turnRate(steer: number): number {
    const s = drifting();
    run(s, hold(steer), 1);
    const h = s.heading;
    run(s, hold(steer), 0.5);
    return (s.heading - h) / 0.5;
  }

  it("cerrar gira más que neutro y abrir gira menos", () => {
    const close = turnRate(-1);
    const neutral = turnRate(0);
    const open = turnRate(1);
    expect(close).toBeGreaterThan(neutral);
    expect(neutral).toBeGreaterThan(open);
    expect(neutral).toBeCloseTo(KART.driftTurnBase, 1);
  });

  it("contravolantear a tope no invierte el lado del derrape", () => {
    const s = drifting();
    run(s, hold(1), 2);
    expect(s.driftDir).toBe(1);
    expect(turnRate(1)).toBeGreaterThan(0);
    expect(KART.driftTurnBase).toBeGreaterThan(KART.driftTurnOpen);
  });

  it("funciona igual con el derrape a la derecha (simétrico)", () => {
    const s = createKart();
    run(s, GAS, 4);
    run(s, hold(1), KART.hopTime + 0.05);
    expect(s.driftDir).toBe(-1);
    run(s, hold(1), 1);
    const h = s.heading;
    run(s, hold(1), 0.5);
    const close = (s.heading - h) / 0.5;
    run(s, hold(-1), 1);
    const h2 = s.heading;
    run(s, hold(-1), 0.5);
    const open = (s.heading - h2) / 0.5;
    expect(close).toBeLessThan(open); // rumbo negativo = derecha: cerrar es más negativo
    expect(open).toBeLessThan(0);
  });

  it("el giro se suaviza: no salta de golpe de cerrar a abrir", () => {
    const s = drifting();
    run(s, hold(-1), 1);
    stepKart(s, hold(1), PHYSICS_DT);
    expect(s.driftSteer).toBeGreaterThan(-1 + KART.driftSteerRate * PHYSICS_DT - 1e-9);
    expect(s.driftSteer).toBeLessThan(-0.5);
  });

  it("el contravolante no pierde la carga del mini-turbo", () => {
    const s = drifting();
    run(s, hold(1), 3);
    // Abriendo todo el rato se carga a la tasa lenta, pero se carga.
    expect(s.driftCharge).toBeGreaterThan(KART.driftLevel1);
    expect(s.driftCharge).toBeLessThan(KART.driftChargeFast * 3);
    expect(s.driftDir).toBe(1);
  });

  it("alternar cerrar y abrir carga más rápido que mantener un lado", () => {
    const steady = drifting();
    run(steady, hold(-1), 2);
    const zig = drifting();
    for (let i = 0; i < 4; i++) {
      run(zig, hold(-1), 0.5);
      run(zig, hold(1), 0.5);
    }
    // Distinto tiempo (2 s vs 4 s): comparar por segundo.
    const steadyRate = steady.driftCharge / 2;
    const zigRate = zig.driftCharge / 4;
    // Sin bonus, la mitad del tiempo cerrando y la mitad abriendo cargaría a la media de ambas tasas.
    const noBonus = (KART.driftChargeFast + KART.driftChargeSlow) / 2;
    expect(zigRate).toBeGreaterThan(noBonus);
    expect(steadyRate).toBeCloseTo(KART.driftChargeFast, -2);
  });

  it("al terminar el derrape se reinicia el estado del contravolante", () => {
    const s = drifting();
    run(s, hold(1), 0.5);
    run(s, GAS, 0.1);
    expect(s.driftDir).toBe(0);
    expect(s.driftSteer).toBe(0);
    expect(s.driftZigzag).toBe(0);
  });
});
