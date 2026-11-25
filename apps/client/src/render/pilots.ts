import * as THREE from "three";
import { Parts, mix, type Vec3 } from "./parts";
import { PALETTE } from "./materials";

// Los dos pilotos del Release 1, chibi-calavera «amables, no de miedo»: Lía Brasas y Calavera Chispas.
// Cabeza ≈ 48 % de la altura sentado. Cuerpo, cabeza, brazos y mechones son mallas separadas
// para poder animar el giro, los brazos del «¡yuju!» y la coleta.

const { noche: NOCHE, hueso: HUESO, huesoSombra: HUESO_SOMBRA, sombra: SOMBRA, ciruela: CIRUELA, brasa: BRASA, llama: LLAMA, anima: ANIMA, animaProfunda: ANIMA_PROF, espectro: ESPECTRO } = PALETTE;
/** Sombra de la coleta: cian oscuro derivado de Espectro. */
const ESPECTRO_SOMBRA = 0x1fa896;

export interface PilotArm {
  geo: THREE.BufferGeometry;
  /** Hombro en el espacio del piloto. La malla cuelga hacia −Y desde aquí. */
  pivot: THREE.Vector3;
}

export interface PilotStrand {
  geo: THREE.BufferGeometry;
  /** Raíz en el espacio de la cabeza. La malla cuelga hacia −Y. */
  pivot: THREE.Vector3;
  /** Inclinación base hacia atrás (rad) y desfase del vaivén. */
  base: number;
  yaw: number;
  phase: number;
  /** Punta, para las chispas. */
  tip: THREE.Vector3;
}

export interface BuiltPilot {
  body: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  /** Ojos emisivos (sin luz), con color por vértice. */
  eyes: THREE.BufferGeometry;
  headPos: THREE.Vector3;
  arms: PilotArm[];
  strands: PilotStrand[];
  /** Chispas espectrales en la punta de los mechones (se anclan a cada mechón). */
  sparkles: boolean;
  /** Brillo de los ojos: 1 = Lía (100 %), 0,6 = Calavera Chispas. */
  eyeGlow: number;
  /** Altura del cráneo y del piloto sentado (m): la cabeza debe medir el 45-50 % (Dalí C8). */
  proportions: { skull: number; seated: number };
}

function proportions(body: THREE.BufferGeometry, headY: number, r: number, sy: number) {
  body.computeBoundingBox();
  return { skull: 2 * r * sy, seated: headY + r * sy - body.boundingBox!.min.y };
}

interface SkullOpts {
  r: number;
  scale: Vec3;
  socket: number;
  teeth: 4 | 5;
  /** Dientes en bloques separados por ranuras Noche (Chispas) o pequeños (Lía). */
  blocky: boolean;
}

/**
 * Calavera de frente: cráneo redondeado con mandíbula integrada, cuencas grandes (22-25 % del ancho),
 * nariz de corazón invertido hundida en Hueso sombra y sonrisa con dientes cuadrados.
 */
function skullHead(p: Parts, o: SkullOpts) {
  const { r, scale: sc, socket } = o;
  const [sx, sy, sz] = sc;
  p.add(new THREE.SphereGeometry(r, 22, 14), HUESO, [0, 0, 0], [0, 0, 0], sc);
  // Mandíbula y pómulos integrados.
  p.add(new THREE.SphereGeometry(r * 0.62, 12, 8), HUESO, [0, -r * 0.5 * sy, r * 0.28 * sz], [0, 0, 0], [sx * 1.15, sy * 0.72, sz * 0.9]);
  for (const s of [-1, 1] as const) {
    p.add(new THREE.SphereGeometry(r * 0.22, 6, 4), HUESO, [s * r * 0.5 * sx, -r * 0.16 * sy, r * 0.7 * sz]);
  }
  // Cuencas (Noche) con borde en Hueso sombra.
  const ex = r * 0.36 * sx;
  const ey = r * 0.1 * sy;
  const ez = r * 0.8 * sz;
  for (const s of [-1, 1] as const) {
    p.add(new THREE.SphereGeometry(r * socket * 1.08, 10, 8), HUESO_SOMBRA, [s * ex, ey, ez - r * 0.03], [0, 0, 0], [1, 1.12, 0.6]);
    p.add(new THREE.SphereGeometry(r * socket, 10, 8), NOCHE, [s * ex, ey, ez + r * 0.015], [0, 0, 0], [1, 1.12, 0.62]);
  }
  // Nariz: corazón invertido (dos lóbulos y una punta hacia abajo), hundida, en Hueso sombra.
  const ny = -r * 0.1 * sy;
  const nz = r * 0.94 * sz;
  p.add(new THREE.SphereGeometry(r * 0.075, 6, 4), HUESO_SOMBRA, [-r * 0.07 * sx, ny + r * 0.04, nz]);
  p.add(new THREE.SphereGeometry(r * 0.075, 6, 4), HUESO_SOMBRA, [r * 0.07 * sx, ny + r * 0.04, nz]);
  p.add(new THREE.ConeGeometry(r * 0.095, r * 0.16, 4), HUESO_SOMBRA, [0, ny - r * 0.06, nz], [Math.PI, 0, 0]);
  // Boca: ranura Noche y dientes cuadrados siguiendo una sonrisa. Todo se apoya en la superficie real
  // (cráneo o mandíbula, la que sobresalga) para que los dientes de los extremos no queden enterrados.
  const my = -r * 0.45 * sy;
  const jawY = -r * 0.5 * sy;
  const jawZ = r * 0.28 * sz;
  const surfZ = (x: number, y: number) => {
    const cx = x / (r * sx);
    const cy = y / (r * sy);
    const cranium = r * sz * Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy));
    const jx = x / (r * 0.62 * sx * 1.15);
    const jy = (y - jawY) / (r * 0.62 * sy * 0.72);
    const jaw = jawZ + r * 0.62 * sz * 0.9 * Math.sqrt(Math.max(0, 1 - jx * jx - jy * jy));
    return Math.max(cranium, jaw);
  };
  const n = o.teeth;
  const tw = o.blocky ? r * 0.17 : r * 0.13;
  const th = o.blocky ? r * 0.22 : r * 0.17;
  const span = o.blocky ? r * 0.22 : r * 0.17;
  const slabW = n * span + r * 0.06;
  const slabH = th * (o.blocky ? 1.5 : 1.15);
  p.add(new THREE.BoxGeometry(slabW, slabH, r * 0.08), NOCHE, [0, my - th * 0.15, surfZ(slabW * 0.3, my) - r * 0.01]);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * span;
    const ty = my + Math.abs(x) * 0.17;
    p.add(new THREE.BoxGeometry(tw, th, r * 0.09), HUESO, [x * sx, ty, surfZ(Math.abs(x) + tw / 2, ty) + r * 0.04]);
  }
}

/** Ojos emisivos: Lía = Llama con pupila Brasa; Chispas = destello pequeño en Ánima. */
function eyes(r: number, sc: Vec3, socket: number, mode: "lia" | "chispas"): THREE.BufferGeometry {
  const p = new Parts();
  const ex = r * 0.36 * sc[0];
  const ey = r * 0.1 * sc[1];
  const ez = r * 0.8 * sc[2];
  for (const s of [-1, 1] as const) {
    if (mode === "lia") {
      p.add(new THREE.SphereGeometry(r * socket * 0.8, 8, 6), LLAMA, [s * ex, ey, ez + r * 0.1], [0, 0, 0], [1, 1.1, 0.6]);
      p.add(new THREE.SphereGeometry(r * socket * 0.4, 6, 4), BRASA, [s * ex, ey - r * 0.005, ez + r * 0.17], [0, 0, 0], [1, 1.1, 0.6]);
    } else {
      p.add(new THREE.SphereGeometry(r * socket * 0.24, 6, 4), mix(NOCHE, ANIMA, 0.6), [s * ex + s * r * 0.045, ey + r * 0.07, ez + r * 0.14], [0, 0, 0], [1, 1.1, 0.5]);
    }
  }
  return p.build();
}

/** Brazo colgando de −Y: manga o hueso, codo, mano de 4 dedos rechonchos. */
function arm(sleeve: number, hand: number, bone: boolean): THREE.BufferGeometry {
  const p = new Parts();
  const rad = bone ? 0.055 : 0.078;
  p.capsule(rad, 0.17, sleeve, [0, -0.13, 0], [0, 0, 0], undefined, 6);
  p.ball(rad * 1.2, bone ? HUESO : mix(sleeve, SOMBRA, 0.4), [0, -0.27, 0.005], undefined, [6, 4]);
  p.capsule(rad * 0.95, 0.14, sleeve, [0, -0.39, 0.02], [-0.18, 0, 0], undefined, 6);
  if (!bone) p.torus(rad * 1.05, 0.02, HUESO, [0, -0.47, 0.03], [half(), 0, 0]);
  p.ball(0.095, hand, [0, -0.54, 0.04], [1, 0.9, 1], [8, 6]);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.045;
    p.capsule(0.028, 0.035, hand, [x, -0.6, 0.07], [0.5, 0, 0], undefined, 4);
  }
  p.capsule(0.03, 0.04, hand, [-0.09, -0.54, 0.07], [0.3, 0, 0.9], undefined, 4);
  return p.build();
}

function half() {
  return Math.PI / 2;
}

/** Mechón: dos cápsulas cónicas que cuelgan de −Y. */
function strand(len: number, thick: number, c1: number, c2: number): { geo: THREE.BufferGeometry; tip: THREE.Vector3 } {
  const p = new Parts();
  p.capsule(thick, len * 0.5, c1, [0, -len * 0.3, 0], undefined, undefined, 6);
  p.capsule(thick * 0.72, len * 0.4, c2, [0, -len * 0.75, -0.02], [0.18, 0, 0], undefined, 6);
  p.ball(thick * 0.55, c2, [0, -len * 1.02, -0.05], undefined, [6, 4]);
  return { geo: p.build(), tip: new THREE.Vector3(0, -len * 1.05, -0.05) };
}

/** Lía Brasas: coleta Espectro, diadema Ánima prof., sudadera Ciruela y Sombra con cordones de Hueso. */
export function buildLia(): BuiltPilot {
  const body = new Parts();
  const head = new Parts();
  const r = 0.42;
  const sc: Vec3 = [1, 0.92, 0.95];
  const socket = 0.235;
  const hy = 1.08;

  // Sudadera de capucha (Ciruela con bajo y bolsillo en Sombra), pantalón en Sombra, cuello de hueso.
  body.capsule(0.245, 0.3, CIRUELA, [0, 0.5, -0.02], undefined, [1.08, 1, 1], 10);
  body.capsule(0.255, 0.07, SOMBRA, [0, 0.27, -0.01], undefined, [1.08, 1, 1], 10);
  body.rounded(0.3, 0.13, 0.1, SOMBRA, [0, 0.4, 0.2], [-0.25, 0, 0], 0.05);
  body.torus(0.22, 0.085, CIRUELA, [0, 0.77, -0.07], [1.25, 0, 0]);
  body.ball(0.17, CIRUELA, [0, 0.74, -0.2], [1.2, 1, 0.9], [8, 6]);
  for (const s of [-1, 1] as const) {
    body.capsule(0.014, 0.12, HUESO, [s * 0.06, 0.66, 0.235], [0.1, 0, s * 0.08], undefined, 5);
    body.ball(0.025, HUESO, [s * 0.065, 0.58, 0.24], undefined, [5, 4]);
    // Piernas en Sombra hacia los pedales, con bota.
    body.capsule(0.095, 0.4, SOMBRA, [s * 0.14, 0.2, 0.28], [half() - 0.2, 0, 0], undefined, 8);
    body.ball(0.11, mix(SOMBRA, NOCHE, 0.4), [s * 0.14, 0.14, 0.52], [1, 0.8, 1.25], [8, 6]);
  }
  body.capsule(0.07, 0.06, HUESO, [0, 0.83, 0.02], undefined, undefined, 8);
  // Cadera hundida en el asiento (queda oculta): da la altura sentado que fija la proporción de la cabeza.
  body.ball(0.17, SOMBRA, [0, -0.03, 0], [1.3, 1, 1.2], [8, 6]);

  skullHead(head, { r, scale: sc, socket, teeth: 5, blocky: false });
  // Pelo: casquete Espectro, flequillo en dos mechones, mechones laterales y diadema Ánima prof.
  head.add(new THREE.SphereGeometry(r * 1.045, 16, 9, 0, Math.PI * 2, 0, 1.72), ESPECTRO, [0, r * 0.03, -r * 0.05], [-0.34, 0, 0], [1, 0.95, 1.02]);
  for (const s of [-1, 1] as const) {
    head.capsule(0.095, 0.22, ESPECTRO, [s * 0.15, r * 0.7, r * 0.78], [1.15, 0, s * 0.55], undefined, 8);
    head.capsule(0.07, 0.22, ESPECTRO_SOMBRA, [s * r * 0.97, -r * 0.05, -r * 0.05], [0, 0, s * 0.1], undefined, 7);
  }
  head.torus(r * 0.99, 0.048, ANIMA_PROF, [0, r * 0.3, -r * 0.03], [half() - 0.28, 0, 0]);
  // Raíz de la coleta: nudo voluminoso y lazo.
  head.ball(0.22, ESPECTRO, [0, r * 1.42, -r * 0.62], [1.1, 1, 1.05], [8, 6]);
  head.ball(0.17, ESPECTRO_SOMBRA, [0, r * 1.25, -r * 0.84], [1, 1, 1], [8, 6]);
  head.ball(0.15, ESPECTRO, [0, r * 1.62, -r * 0.46], [1, 1, 1], [8, 6]);
  head.torus(0.17, 0.035, ANIMA_PROF, [0, r * 1.3, -r * 0.7], [0.8, 0, 0]);

  const strands: PilotStrand[] = [];
  const specs: [number, number, number, number][] = [
    [-0.45, 1.15, 0.5, 0.0],
    [0.0, 1.0, 0.56, 1.7],
    [0.45, 1.15, 0.5, 3.1],
    [0.18, 0.82, 0.4, 4.4],
  ];
  for (const [yaw, base, len, phase] of specs) {
    const s = strand(len, 0.085, ESPECTRO, ESPECTRO_SOMBRA);
    strands.push({ geo: s.geo, pivot: new THREE.Vector3(Math.sin(yaw) * 0.1, r * 1.38, -r * 0.7), base, yaw, phase, tip: s.tip });
  }

  const arms: PilotArm[] = [-1, 1].map((s) => ({ geo: arm(CIRUELA, HUESO, false), pivot: new THREE.Vector3(s * 0.3, 0.66, 0.03) }));

  const bodyGeo = body.build();
  return {
    body: bodyGeo,
    head: head.build(),
    eyes: eyes(r, sc, socket, "lia"),
    headPos: new THREE.Vector3(0, hy, 0.02),
    arms,
    strands,
    sparkles: true,
    eyeGlow: 1,
    proportions: proportions(bodyGeo, hy, r, sc[1]),
  };
}

/** Calavera Chispas: calavera grande y redonda sin pelo, costillas en Hueso sobre torso Sombra, guantes Brasa. */
export function buildChispas(): BuiltPilot {
  const body = new Parts();
  const head = new Parts();
  const r = 0.44;
  const sc: Vec3 = [1.02, 0.95, 0.98];
  const socket = 0.26;
  const hy = 1.08;

  // Torso en Sombra con tres arcos de costilla en Hueso y espina.
  body.capsule(0.255, 0.3, SOMBRA, [0, 0.48, -0.02], undefined, [1.05, 1, 1], 10);
  body.capsule(0.265, 0.07, CIRUELA, [0, 0.26, -0.01], undefined, [1.05, 1, 1], 10);
  for (let i = 0; i < 3; i++) {
    body.add(new THREE.TorusGeometry(0.25 - i * 0.012, 0.03, 5, 14, Math.PI * 1.1), HUESO, [0, 0.38 + i * 0.12, -0.01], [half(), 0, -Math.PI * 0.05 + Math.PI * 0 ], [1.06, 1, 0.9]);
  }
  body.capsule(0.03, 0.34, HUESO, [0, 0.5, 0.265], undefined, undefined, 5);
  for (const s of [-1, 1] as const) {
    body.ball(0.085, HUESO, [s * 0.31, 0.68, 0.0], undefined, [8, 6]);
    body.capsule(0.095, 0.4, SOMBRA, [s * 0.14, 0.2, 0.28], [half() - 0.2, 0, 0], undefined, 8);
    body.ball(0.11, NOCHE, [s * 0.14, 0.14, 0.52], [1, 0.8, 1.25], [8, 6]);
  }
  body.capsule(0.07, 0.08, HUESO, [0, 0.84, 0.02], undefined, undefined, 8);
  body.ball(0.05, HUESO, [0, 0.76, 0.05], undefined, [6, 4]);
  body.ball(0.16, SOMBRA, [0, -0.09, 0], [1.3, 1, 1.2], [8, 6]);

  skullHead(head, { r, scale: sc, socket, teeth: 5, blocky: true });

  const arms: PilotArm[] = [-1, 1].map((s) => ({ geo: arm(HUESO, BRASA, true), pivot: new THREE.Vector3(s * 0.32, 0.67, 0.03) }));

  const bodyGeo = body.build();
  return {
    body: bodyGeo,
    head: head.build(),
    eyes: eyes(r, sc, socket, "chispas"),
    headPos: new THREE.Vector3(0, hy, 0.02),
    arms,
    strands: [],
    sparkles: false,
    eyeGlow: 0.6,
    proportions: proportions(bodyGeo, hy, r, sc[1]),
  };
}
