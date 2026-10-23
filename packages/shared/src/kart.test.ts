import { describe, expect, it } from "vitest";
import { bounceKart, createKart, driftLevel, stepKart, type KartInput } from "./kart";
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
    expect(s.speed).toBeCloseTo(KART.maxSpeed, 5);
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

  it("el derrape carga los niveles en orden y al soltar da turbo", () => {
    const s = createKart();
    run(s, GAS, 4);
    const drifting: KartInput = { steer: -1, throttle: true, brake: false, drift: true };
    const levels: number[] = [];
    for (let i = 0; i < 60 * 3; i++) {
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
    s.boostTime = KART.boostTime2;
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
