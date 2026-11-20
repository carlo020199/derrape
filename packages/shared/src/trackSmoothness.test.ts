import { describe, expect, it } from "vitest";
import { TRACKS } from "./tracks";
import { buildTrackFromDef } from "./tracks/types";
import { maxBankRate, pointAt, roadFrameAt, roadNormal, smoothTrack } from "./track";
import { measureSmoothness } from "./trackSmoothness";

// Criterios de la fase «pista supersmooth», muestreando cada 0,5 m con pointAt.
const LIMITS = {
  grade: 0.22,
  gradeChange: 0.015, // 1,5 puntos de pendiente por metro
  sagRadius: 40,
  bank: 30,
  bankRate: 1.5,
  bankAccel: 0.15,
  normalJump: 3,
};

describe("suavidad de las 12 pistas", () => {
  for (const entry of TRACKS) {
    it(`${entry.name} cumple los criterios de suavidad`, async () => {
      const track = buildTrackFromDef(await entry.load());
      const m = measureSmoothness(track);
      expect(m.maxGrade).toBeLessThanOrEqual(LIMITS.grade);
      expect(m.maxGradeChange).toBeLessThanOrEqual(LIMITS.gradeChange);
      expect(m.minSagRadius).toBeGreaterThanOrEqual(LIMITS.sagRadius);
      expect(m.maxBank).toBeLessThanOrEqual(LIMITS.bank);
      expect(m.maxBankRate).toBeLessThanOrEqual(LIMITS.bankRate);
      expect(m.maxBankAccel).toBeLessThanOrEqual(LIMITS.bankAccel);
      expect(m.maxNormalJump).toBeLessThanOrEqual(LIMITS.normalJump);
      // Comprobación entre nodos (lo que hacía capBankRate): sin saltos de peralte por encima del límite.
      expect(maxBankRate(track)).toBeLessThanOrEqual(LIMITS.bankRate);
    });
  }
});

describe("splines de altura y peralte", () => {
  const control = [
    { x: 0, z: 0, y: 0, bank: 0 },
    { x: 14, z: 0, y: 0, bank: 0 },
    { x: 75, z: 0, y: 8, bank: 25 },
    { x: 100, z: 60, y: 8, bank: 25 },
    { x: 40, z: 90, y: 0, bank: 0 },
    { x: -20, z: 50, y: 0, bank: 0 },
  ];

  it("la altura y el peralte pasan por los puntos de control", () => {
    const track = smoothTrack(control, 12, 3);
    for (const c of control) {
      let best = Infinity;
      let y = 0;
      let bank = 0;
      for (let d = 0; d < track.length; d += 0.25) {
        const p = pointAt(track, d);
        const dist = Math.hypot(p.x - c.x, p.z - c.z);
        if (dist < best) [best, y, bank] = [dist, p.y, p.bank];
      }
      expect(Math.abs(y - c.y)).toBeLessThan(0.35);
      expect(Math.abs(bank - c.bank)).toBeLessThan(1.5);
    }
  });

  it("con puntos muy desiguales la altura rebasa poco los puntos de control (< 15 % del escalón)", () => {
    const track = smoothTrack(control, 12, 3);
    let hi = -Infinity;
    let lo = Infinity;
    for (let d = 0; d < track.length; d += 0.5) {
      const y = pointAt(track, d).y;
      hi = Math.max(hi, y);
      lo = Math.min(lo, y);
    }
    expect(hi).toBeLessThan(8 + 1.2);
    expect(lo).toBeGreaterThan(-1.2);
  });

  it("el peralte no tiene escalones de pendiente en los puntos de control", () => {
    const track = smoothTrack(control, 12, 3);
    let worst = 0;
    let prev = pointAt(track, 0).bank;
    let prevRate = 0;
    for (let d = 0.25; d < track.length; d += 0.25) {
      const b = pointAt(track, d).bank;
      const rate = (b - prev) / 0.25;
      if (d > 1) worst = Math.max(worst, Math.abs(rate - prevRate) / 0.25);
      prev = b;
      prevRate = rate;
    }
    expect(worst).toBeLessThan(0.5);
  });
});

describe("normal analítica de la calzada", () => {
  it("en llano es vertical y con peralte se inclina hacia el interior", () => {
    const flat = roadNormal(0.7, 0, 0);
    expect(flat.y).toBeCloseTo(1, 6);
    // Rumbo +z, peralte + (se levanta el borde derecho): la normal se inclina hacia la izquierda (+x).
    const banked = roadNormal(0, 0, 30);
    expect(banked.x).toBeGreaterThan(0);
    expect(Math.atan2(banked.x, banked.y) * (180 / Math.PI)).toBeCloseTo(30, 3);
    expect(Math.hypot(banked.x, banked.y, banked.z)).toBeCloseTo(1, 6);
  });

  it("con cuesta arriba la normal se inclina hacia atrás", () => {
    const n = roadNormal(0, 0.2, 0);
    expect(n.z).toBeLessThan(0);
  });

  it("el rumbo filtrado de roadFrameAt no salta en los nodos de la polilínea", async () => {
    const track = buildTrackFromDef(await TRACKS[11]!.load());
    let worst = 0;
    let prev = roadFrameAt(track, 0).heading;
    for (let d = 0.5; d < track.length; d += 0.5) {
      let dh = roadFrameAt(track, d).heading - prev;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      worst = Math.max(worst, Math.abs(dh));
      prev = roadFrameAt(track, d).heading;
    }
    // 0,5 m de avance: menos de 3° de giro incluso en la horquilla de ~7 m de radio (≈ 4°/0,5 m sin filtrar).
    expect((worst * 180) / Math.PI).toBeLessThan(5);
  });
});
