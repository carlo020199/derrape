// Medidas de suavidad de una pista, muestreada con `pointAt` cada `step` metros.
// Las usan el test (trackSmoothness.test.ts) y scripts/medir-pista.ts.

import { pointAt, roadFrameAt, roadNormal, type Track } from "./track";

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

/** Una muestra cada `step` metros con las magnitudes que se miden. */
export interface SmoothnessSample {
  d: number;
  grade: number;
  gradeChange: number;
  /** Radio de valle (m) si en esta muestra la pendiente crece; Infinity si no. */
  sagRadius: number;
  bank: number;
  bankRate: number;
  bankAccel: number;
  normalJump: number;
}

export function smoothnessSeries(track: Track, step = 0.5): SmoothnessSample[] {
  const count = Math.ceil(track.length / step);
  // Paso real un poco menor para cerrar la vuelta sin un último hueco más corto.
  const h = track.length / count;
  const s = Array.from({ length: count }, (_, i) => pointAt(track, i * h));
  const grade = (i: number) => {
    const a = s[i % count]!;
    const b = s[(i + 1) % count]!;
    return (b.y - a.y) / (Math.hypot(b.x - a.x, b.z - a.z) || h);
  };
  const rate = (i: number) => (s[(i + 1) % count]!.bank - s[i % count]!.bank) / h;
  const normals = s.map((_, i) => {
    const f = roadFrameAt(track, i * h);
    const n = roadNormal(f.heading, f.grade, f.bank);
    return [n.x, n.y, n.z] as const;
  });
  // Salto de la normal entre muestras a 1 m.
  const hop = Math.max(1, Math.round(1 / h));
  return s.map((p, i) => {
    const g0 = grade(i);
    const dg = (grade(i + 1) - g0) / h;
    const n0 = normals[i]!;
    const n1 = normals[(i + hop) % count]!;
    const dot = Math.min(1, Math.max(-1, n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]));
    return {
      d: i * h,
      grade: g0,
      gradeChange: dg,
      sagRadius: dg > 1e-4 ? (1 + g0 * g0) ** 1.5 / dg : Infinity,
      bank: p.bank,
      bankRate: rate(i),
      bankAccel: (rate(i + 1) - rate(i)) / h,
      normalJump: Math.acos(dot) / DEG / (hop * h),
    };
  });
}

export function measureSmoothness(track: Track, step = 0.5): Smoothness {
  const at = { grade: 0, gradeChange: 0, sag: 0, bank: 0, bankRate: 0, bankAccel: 0, normal: 0 };
  const m = { grade: 0, gradeChange: 0, bank: 0, bankRate: 0, bankAccel: 0, normal: 0, sag: Infinity };
  for (const q of smoothnessSeries(track, step)) {
    const peak = (key: "grade" | "gradeChange" | "bank" | "bankRate" | "bankAccel" | "normal", v: number) => {
      if (Math.abs(v) > m[key]) [m[key], at[key]] = [Math.abs(v), q.d];
    };
    peak("grade", q.grade);
    peak("gradeChange", q.gradeChange);
    peak("bank", q.bank);
    peak("bankRate", q.bankRate);
    peak("bankAccel", q.bankAccel);
    peak("normal", q.normalJump);
    if (q.sagRadius < m.sag) [m.sag, at.sag] = [q.sagRadius, q.d];
  }
  return {
    maxGrade: m.grade,
    maxGradeChange: m.gradeChange,
    minSagRadius: m.sag,
    maxBank: m.bank,
    maxBankRate: m.bankRate,
    maxBankAccel: m.bankAccel,
    maxNormalJump: m.normal,
    at,
  };
}
