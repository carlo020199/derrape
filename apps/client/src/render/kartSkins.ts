import * as THREE from "three";
import type { KartLook } from "@derrape/shared";
import { Parts } from "./parts";
import { PALETTE } from "./materials";

// Los dos coches del Release 1: «Hueso» (el kart blanco de Lía) y «Medianoche» (el oscuro de Calavera Chispas).
// Colores fijos de la paleta de Dalí (el color de jugador no los tiñe). +Z es delante.

const { noche: NOCHE, hueso: HUESO, huesoSombra: HUESO_SOMBRA, sombra: SOMBRA, ciruela: CIRUELA, brasa: BRASA, llama: LLAMA, anima: ANIMA, animaProfunda: ANIMA_PROF } = PALETTE;
/** Neumático: derivado de Noche. */
const TYRE = 0x141018;
const half = Math.PI / 2;

export interface BuiltKartSkin {
  geo: THREE.BufferGeometry;
  /** Piezas emisivas (faros, pilotos traseros): material sin luz. */
  glow: THREE.BufferGeometry | null;
  seat: THREE.Vector3;
  rear: THREE.Vector3[];
  exhausts: THREE.Vector3[];
  /** Faros delanteros: reciben un halo aditivo. */
  lamps: THREE.Vector3[];
}

/** Rueda gorda: neumático ensanchado, llanta con tapa y tuercas. El diámetro ronda 0,55 veces la altura del kart. */
function wheel(p: Parts, r: number, w: number, x: number, z: number, rim: number) {
  const sign = Math.sign(x || 1);
  const tube = r * 0.36;
  p.add(new THREE.TorusGeometry(r * 0.66, tube, 8, 14), TYRE, [x, r, z], [0, half, 0], [1, 1, w / (2 * tube)]);
  p.add(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w * 0.56, 12), rim, [x + sign * w * 0.18, r, z], [0, 0, half]);
  p.add(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w * 0.64, 6), NOCHE, [x + sign * w * 0.18, r, z], [0, 0, half]);
  p.add(new THREE.SphereGeometry(r * 0.2, 6, 4), HUESO, [x + sign * w * 0.47, r, z], [0, 0, 0], [0.4, 1, 1]);
}

/** Escape cilíndrico apuntando hacia atrás; devuelve la boca (donde nace la llama). */
function exhaust(p: Parts, x: number, y: number, z: number, color: number, tiltDeg = 22, len = 0.5): THREE.Vector3 {
  const tilt = -half + (tiltDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(tilt, 0, 0));
  const mouth = new THREE.Vector3(x, y, z);
  const c = mouth.clone().addScaledVector(dir, -len * 0.5);
  p.add(new THREE.CylinderGeometry(0.085, 0.13, len, 9), color, [c.x, c.y, c.z], [tilt, 0, 0]);
  p.add(new THREE.TorusGeometry(0.095, 0.022, 4, 10), NOCHE, [mouth.x, mouth.y, mouth.z], [tilt + half, 0, 0]);
  return mouth;
}

function seatAndWheel(p: Parts, seatY: number, seatZ: number, back: number) {
  // Asiento en Sombra: respaldo y cojín redondeados.
  p.rounded(0.66, 0.2, 0.52, SOMBRA, [0, seatY - 0.08, seatZ], undefined, 0.09);
  p.rounded(0.66, 0.62, 0.18, SOMBRA, [0, seatY + 0.26, seatZ - 0.27], [-0.18, 0, 0], 0.09);
  // Volante en Noche con cubo en Ánima.
  const wy = seatY + 0.3;
  const wz = seatZ + 0.62 + back;
  p.add(new THREE.TorusGeometry(0.19, 0.036, 6, 14), NOCHE, [0, wy, wz], [-0.95, 0, 0]);
  p.add(new THREE.BoxGeometry(0.1, 0.1, 0.1), ANIMA, [0, wy, wz], [-0.95, 0, 0]);
  p.capsule(0.03, 0.34, NOCHE, [0, wy - 0.15, wz - 0.12], [-0.7, 0, 0], undefined, 5);
}

/** «Hueso»: carrocería blanca redondeada, morro de calavera, dos escapes de hueso sombra y un hueso cruzado. */
export function buildHuesoKart(look: KartLook): BuiltKartSkin {
  const p = new Parts();
  const { length: len, width: wid } = look;
  const fz = len * 0.33;
  const rz = -len * 0.33;

  // Carrocería: cuerpo, faldón en Hueso sombra y aletas sobre las ruedas traseras.
  p.rounded(wid * 0.8, 0.46, len * 0.74, HUESO, [0, 0.52, -0.02], undefined, 0.2);
  p.rounded(wid * 0.86, 0.14, len * 0.8, HUESO_SOMBRA, [0, 0.3, -0.02], undefined, 0.06);
  for (const s of [-1, 1] as const) {
    p.rounded(0.3, 0.3, 0.8, HUESO, [s * (wid * 0.4 + 0.02), 0.58, rz + 0.05], undefined, 0.13);
    p.rounded(0.24, 0.24, 0.62, HUESO, [s * (wid * 0.4), 0.55, fz + 0.1], undefined, 0.1);
  }

  // Morro de calavera: cráneo, cuencas en Noche, nariz y dientes.
  p.add(new THREE.SphereGeometry(0.44, 14, 10), HUESO, [0, 0.58, fz + 0.4], [0, 0, 0], [1.12, 0.78, 0.95]);
  for (const s of [-1, 1] as const) {
    p.add(new THREE.SphereGeometry(0.12, 8, 6), NOCHE, [s * 0.2, 0.66, fz + 0.76], [0, 0, 0], [1, 1.2, 0.45]);
    p.add(new THREE.SphereGeometry(0.035, 5, 4), HUESO, [s * 0.2, 0.64, fz + 0.8], [0, 0, 0], [1, 1, 0.5]);
  }
  p.add(new THREE.ConeGeometry(0.06, 0.1, 3), NOCHE, [0, 0.55, fz + 0.82], [Math.PI, 0, 0]);
  p.rounded(0.62, 0.1, 0.16, HUESO_SOMBRA, [0, 0.42, fz + 0.72], undefined, 0.04);
  for (let i = 0; i < 4; i++) p.rounded(0.1, 0.12, 0.12, HUESO, [-0.21 + i * 0.14, 0.41, fz + 0.8], undefined, 0.03);

  const seatY = 0.8;
  const seatZ = -0.12;
  seatAndWheel(p, seatY, seatZ, 0);

  // Hueso cruzado decorativo detrás del asiento.
  for (const s of [-1, 1] as const) {
    p.capsule(0.045, 0.52, HUESO, [0, 1.22, rz - 0.12], [0, 0, s * 0.8], undefined, 6);
    p.ball(0.07, HUESO, [s * 0.19, 1.43, rz - 0.12], undefined, [6, 4]);
    p.ball(0.07, HUESO, [s * 0.19, 1.01, rz - 0.12], undefined, [6, 4]);
  }

  const fx = wid / 2 + look.frontWheelW / 2 - 0.12;
  const rx = wid / 2 + look.rearWheelW / 2 - 0.12;
  wheel(p, look.frontWheel, look.frontWheelW, -fx, fz, HUESO_SOMBRA);
  wheel(p, look.frontWheel, look.frontWheelW, fx, fz, HUESO_SOMBRA);
  wheel(p, look.rearWheel, look.rearWheelW, -rx, rz, HUESO_SOMBRA);
  wheel(p, look.rearWheel, look.rearWheelW, rx, rz, HUESO_SOMBRA);

  // Dos escapes traseros en Hueso sombra.
  const exhausts = [exhaust(p, -0.3, 0.7, -len * 0.5 - 0.05, HUESO_SOMBRA), exhaust(p, 0.3, 0.7, -len * 0.5 - 0.05, HUESO_SOMBRA)];

  return {
    geo: p.build(),
    glow: null,
    seat: new THREE.Vector3(0, seatY + 0.04, seatZ),
    rear: [new THREE.Vector3(-rx, 0.08, rz - look.rearWheel * 0.2), new THREE.Vector3(rx, 0.08, rz - look.rearWheel * 0.2)],
    exhausts,
    lamps: [],
  };
}

/** «Medianoche»: Sombra y Ciruela con laterales de Hueso, banda Brasa, faros Llama y pilotos Brasa. */
export function buildMedianocheKart(look: KartLook): BuiltKartSkin {
  const p = new Parts();
  const g = new Parts();
  const { length: len, width: wid } = look;
  const fz = len * 0.33;
  const rz = -len * 0.33;

  // Cuerpo en Sombra, capó en Ciruela y laterales de Hueso con una banda Brasa.
  p.rounded(wid * 0.82, 0.44, len * 0.8, SOMBRA, [0, 0.5, 0], undefined, 0.19);
  p.rounded(wid * 0.64, 0.2, len * 0.38, CIRUELA, [0, 0.76, fz * 0.9], undefined, 0.09);
  p.rounded(wid * 0.9, 0.12, len * 0.84, CIRUELA, [0, 0.28, 0], undefined, 0.05);
  for (const s of [-1, 1] as const) {
    p.rounded(0.09, 0.26, 1.15, HUESO, [s * (wid * 0.41 + 0.01), 0.5, -0.1], undefined, 0.04);
    p.rounded(0.1, 0.07, 1.3, BRASA, [s * (wid * 0.41 + 0.03), 0.64, -0.12], undefined, 0.03);
  }
  p.rounded(wid * 0.6, 0.07, 0.1, BRASA, [0, 0.66, fz + 0.66], undefined, 0.03);
  // Morro redondeado y paragolpes de hueso.
  p.add(new THREE.SphereGeometry(0.4, 12, 8), SOMBRA, [0, 0.5, fz + 0.52], [0, 0, 0], [1.3, 0.8, 0.9]);
  p.rounded(wid * 0.6, 0.09, 0.14, HUESO, [0, 0.36, fz + 0.9], undefined, 0.04);

  // Faros redondos emisivos (Llama) con aro en Noche; pilotos traseros en Brasa.
  const lamps: THREE.Vector3[] = [];
  for (const s of [-1, 1] as const) {
    const lx = s * 0.4;
    p.add(new THREE.TorusGeometry(0.16, 0.035, 6, 14), NOCHE, [lx, 0.56, fz + 0.86]);
    g.add(new THREE.SphereGeometry(0.14, 10, 8), LLAMA, [lx, 0.56, fz + 0.88], [0, 0, 0], [1, 1, 0.55]);
    lamps.push(new THREE.Vector3(lx, 0.56, fz + 1.0));
    g.rounded(0.2, 0.09, 0.05, BRASA, [s * 0.42, 0.6, rz - 0.62], undefined, 0.02);
  }

  const seatY = 0.78;
  const seatZ = -0.15;
  seatAndWheel(p, seatY, seatZ, 0);
  // Arco antivuelco y alerón en Ciruela.
  p.add(new THREE.TorusGeometry(0.34, 0.035, 5, 12, Math.PI), NOCHE, [0, seatY + 0.15, seatZ - 0.42], [0, 0, 0]);
  p.rounded(wid * 0.78, 0.06, 0.3, CIRUELA, [0, 1.0, rz - 0.38], [0.08, 0, 0], 0.025);
  for (const s of [-1, 1] as const) p.rounded(0.05, 0.3, 0.07, NOCHE, [s * 0.34, 0.86, rz - 0.38], undefined, 0.02);

  const fx = wid / 2 + look.frontWheelW / 2 - 0.12;
  const rx = wid / 2 + look.rearWheelW / 2 - 0.12;
  wheel(p, look.frontWheel, look.frontWheelW, -fx, fz, ANIMA_PROF);
  wheel(p, look.frontWheel, look.frontWheelW, fx, fz, ANIMA_PROF);
  wheel(p, look.rearWheel, look.rearWheelW, -rx, rz, ANIMA_PROF);
  wheel(p, look.rearWheel, look.rearWheelW, rx, rz, ANIMA_PROF);

  // Escapes laterales en Hueso sombra (casi horizontales).
  const sideExhaust = (x: number): THREE.Vector3 => {
    const mouth = new THREE.Vector3(x, 0.42, rz - 0.52);
    p.add(new THREE.CylinderGeometry(0.075, 0.115, 0.6, 9), HUESO_SOMBRA, [x, 0.42, rz - 0.22], [-half + 0.08, 0, 0]);
    p.add(new THREE.TorusGeometry(0.085, 0.02, 4, 10), NOCHE, [mouth.x, mouth.y, mouth.z], [0.08, 0, 0]);
    return mouth;
  };
  const exhausts = [sideExhaust(-wid * 0.44), sideExhaust(wid * 0.44)];

  const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return {
    geo: p.build(),
    glow: g.build(),
    seat: vec(0, seatY + 0.04, seatZ),
    rear: [vec(-rx, 0.08, rz - look.rearWheel * 0.2), vec(rx, 0.08, rz - look.rearWheel * 0.2)],
    exhausts,
    lamps,
  };
}
