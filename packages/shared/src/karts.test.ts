import { describe, expect, it } from "vitest";
import { CHARACTERS, WEIGHT_CLASS_MOD, findCharacter } from "./characters";
import { KARTS, combineStats, deriveTuning, findKart, statsFor } from "./karts";
import { collideKarts, createKart, stepKart } from "./kart";
import { KART } from "./tuning";

describe("catálogo", () => {
  it("hay 5 personajes y 10 coches con ids únicos", () => {
    expect(CHARACTERS).toHaveLength(5);
    expect(KARTS).toHaveLength(10);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(5);
    expect(new Set(KARTS.map((k) => k.id)).size).toBe(10);
  });

  it("las estadísticas de cada coche van de 1 a 5 y suman 12", () => {
    for (const k of KARTS) {
      const v = Object.values(k.stats);
      expect(v.every((n) => n >= 1 && n <= 5)).toBe(true);
      expect(v.reduce((a, b) => a + b, 0), k.name).toBe(12);
    }
  });

  it("Derrapín carga el turbo un 15 % más rápido y es el único con extra", () => {
    expect(findKart("derrapin")?.driftChargeMult).toBe(1.15);
    expect(KARTS.filter((k) => k.driftChargeMult !== undefined)).toHaveLength(1);
  });

  it("las clases de peso son 2 ligeros, 2 medios y 1 pesado", () => {
    const n = (c: string) => CHARACTERS.filter((x) => x.weightClass === c).length;
    expect([n("light"), n("medium"), n("heavy")]).toEqual([2, 2, 1]);
  });
});

describe("combineStats", () => {
  const chispa = findKart("chispa")!;
  it("medio no cambia nada", () => {
    expect(combineStats({ weightClass: "medium" }, chispa)).toEqual(chispa.stats);
  });
  it("ligero: peso −1 y aceleración +1; pesado al revés", () => {
    expect(combineStats({ weightClass: "light" }, chispa)).toEqual({ speed: 3, accel: 4, handling: 3, weight: 2 });
    expect(combineStats({ weightClass: "heavy" }, chispa)).toEqual({ speed: 3, accel: 2, handling: 3, weight: 4 });
  });
  it("se limita a 1–5", () => {
    const pulga = findKart("pulga")!; // acel 5, peso 1
    expect(combineStats({ weightClass: "light" }, pulga)).toMatchObject({ accel: 5, weight: 1 });
    const furgo = findKart("furgo")!; // acel 1, peso 5
    expect(combineStats({ weightClass: "heavy" }, furgo)).toMatchObject({ accel: 1, weight: 5 });
  });
  it("todas las combinaciones quedan entre 1 y 5", () => {
    for (const c of CHARACTERS)
      for (const k of KARTS)
        for (const n of Object.values(combineStats(c, k))) expect(n >= 1 && n <= 5).toBe(true);
    expect(WEIGHT_CLASS_MOD.medium).toEqual({ weight: 0, accel: 0 });
  });
  it("statsFor tolera ids desconocidos", () => {
    expect(statsFor("nadie", "nada")).toEqual(combineStats(findCharacter("toni")!, KARTS[0]!));
  });
});

describe("deriveTuning", () => {
  it("con todo a 3 deja la base igual", () => {
    expect(deriveTuning(KART, { speed: 3, accel: 3, handling: 3, weight: 3 })).toEqual(KART);
  });
  it("más velocidad, aceleración y manejo = mejores constantes", () => {
    const hi = deriveTuning(KART, { speed: 5, accel: 5, handling: 5, weight: 3 });
    const lo = deriveTuning(KART, { speed: 1, accel: 1, handling: 1, weight: 3 });
    expect(hi.maxSpeed).toBeGreaterThan(lo.maxSpeed);
    expect(hi.accelLimit).toBeGreaterThan(lo.accelLimit);
    expect(hi.turnRate).toBeGreaterThan(lo.turnRate);
  });
  it("no toca el objeto base", () => {
    const before = KART.maxSpeed;
    deriveTuning(KART, { speed: 5, accel: 5, handling: 5, weight: 5 }, 1.15);
    expect(KART.maxSpeed).toBe(before);
  });
  it("el extra multiplica la carga del derrape", () => {
    expect(deriveTuning(KART, statsFor("toni", "derrapin"), 1.15).driftChargeMult).toBeCloseTo(1.15);
  });
  it("el Bólido llega más lejos que la Pulga, pero la Pulga arranca antes", () => {
    const run = (kart: string, seconds: number) => {
      const t = deriveTuning(KART, statsFor("toni", kart));
      const s = createKart();
      for (let i = 0; i < seconds * 60; i++) stepKart(s, { steer: 0, throttle: true, brake: false, drift: false }, 1 / 60, t);
      return s;
    };
    expect(run("bolido", 15).speed).toBeGreaterThan(run("pulga", 15).speed);
    expect(run("pulga", 1).z).toBeGreaterThan(run("bolido", 1).z);
  });
});

describe("peso en los choques", () => {
  const head = (mass: number, z: number, heading: number) => ({ ...createKart(0, z, heading), speed: 20, mass });

  it("con el mismo peso se apartan igual", () => {
    const a = head(3, 0, 0);
    const b = head(3, 1, Math.PI);
    collideKarts(a, b);
    expect(Math.abs(a.z - 0)).toBeCloseTo(Math.abs(b.z - 1));
  });

  it("el ligero se aparta más y pierde más velocidad que el pesado", () => {
    const light = head(1, 0, 0);
    const heavy = head(5, 1, Math.PI);
    collideKarts(light, heavy);
    expect(Math.abs(light.z)).toBeGreaterThan(Math.abs(heavy.z - 1));
    expect(light.speed).toBeLessThan(heavy.speed);
  });
});
