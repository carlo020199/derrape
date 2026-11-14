// Medidas de suavidad de una pista, muestreada con `pointAt` cada `step` metros.
// Las usan el test (trackSmoothness.test.ts) y scripts/medir-pista.ts.

import { pointAt, type Track } from "./track";

export interface Smoothness {
  /** Pendiente máxima |dy/ds| (fracción, 0,22 = 22 %). */
  maxGrade: number;
  /** Mayor cambio de pendiente por metro |d²y/ds²| (fracción/m; 0,015 = 1,5 puntos/m). */
  maxGradeChange: number;
  /** Radio de curva vertical mínimo en un valle (m). Infinity si no hay valles marcados. */
  minSagRadius: number;
  /** Peralte máximo (°). */
  maxBank: number;
  /** Mayor |d(peralte)/ds| (°/m). */
  maxBankRate: number;
  /** Mayor |d²(peralte)/ds²| (°/m²). */
  maxBankAccel: number;
  /** Mayor salto de la normal de la calzada entre muestras, en grados por metro. */
  maxNormalJump: number;
  /** Distancia (m) donde ocurre cada máximo, para saber qué tramo mirar. */
  at: { grade: number; gradeChange: number; sag: number; bank: number; bankRate: number; bankAccel: number; normal: number };
}

const DEG = Math.PI / 180;

/** Normal de la calzada en el eje de un punto, a partir de la pendiente, el rumbo y el peralte. */
function normalAt(grade: number, heading: number, bankDeg: number): [number, number, number] {
  const tx = Math.sin(heading);
  const tz = Math.cos(heading);
  // Tangente (por metro horizontal) y vector lateral izquierdo inclinado por el peralte.
  const T: [number, number, number] = [tx, grade, tz];
  const tb = Math.tan(bankDeg * DEG);
  const L: [number, number, number] = [tz, -tb, -tx];
  // Hacia arriba: L × T (con rumbo 0, T = +z y L = +x → +y).
  const n: [number, number, number] = [
    L[1] * T[2] - L[2] * T[1],
    L[2] * T[0] - L[0] * T[2],
    L[0] * T[1] - L[1] * T[0],
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return n[1] < 0 ? [-n[0] / len, -n[1] / len, -n[2] / len] : [n[0] / len, n[1] / len, n[2] / len];
}

export function measureSmoothness(track: Track, step = 0.5): Smoothness {
  const count = Math.floor(track.length / step);
  const s = Array.from({ length: count }, (_, i) => pointAt(track, i * step));
  const at = { grade: 0, gradeChange: 0, sag: 0, bank: 0, bankRate: 0, bankAccel: 0, normal: 0 };
  let maxGrade = 0;
  let maxGradeChange = 0;
  let minSag = Infinity;
  let maxBank = 0;
  let maxBankRate = 0;
  let maxBankAccel = 0;
  let maxNormal = 0;
  const grade = (i: number) => {
    const a = s[i % count]!;
    const b = s[(i + 1) % count]!;
    return (b.y - a.y) / (Math.hypot(b.x - a.x, b.z - a.z) || step);
  };
  const rate = (i: number) => (s[(i + 1) % count]!.bank - s[i % count]!.bank) / step;
  const normals = s.map((p, i) => normalAt(grade(i), p.heading, p.bank));
  for (let i = 0; i < count; i++) {
    const d = i * step;
    const g0 = grade(i);
    const g1 = grade(i + 1);
    const dg = (g1 - g0) / step;
    if (Math.abs(g0) > maxGrade) [maxGrade, at.grade] = [Math.abs(g0), d];
    if (Math.abs(dg) > maxGradeChange) [maxGradeChange, at.gradeChange] = [Math.abs(dg), d];
    if (dg > 1e-4) {
      const radius = (1 + g0 * g0) ** 1.5 / dg;
      if (radius < minSag) [minSag, at.sag] = [radius, d];
    }
    const b = Math.abs(s[i]!.bank);
    if (b > maxBank) [maxBank, at.bank] = [b, d];
    const r0 = rate(i);
    if (Math.abs(r0) > maxBankRate) [maxBankRate, at.bankRate] = [Math.abs(r0), d];
    const acc = (rate(i + 1) - r0) / step;
    if (Math.abs(acc) > maxBankAccel) [maxBankAccel, at.bankAccel] = [Math.abs(acc), d];
    // Salto de la normal entre muestras a 1 m (dos pasos de `step`).
    const hop = Math.max(1, Math.round(1 / step));
    const n0 = normals[i]!;
    const n1 = normals[(i + hop) % count]!;
    const dot = Math.min(1, Math.max(-1, n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]));
    const jump = Math.acos(dot) / DEG / (hop * step);
    if (jump > maxNormal) [maxNormal, at.normal] = [jump, d];
  }
  return {
    maxGrade,
    maxGradeChange,
    minSagRadius: minSag,
    maxBank,
    maxBankRate,
    maxBankAccel,
    maxNormalJump: maxNormal,
    at,
  };
}
