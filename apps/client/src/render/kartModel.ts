import * as THREE from "three";
import { Parts, mix, type Vec3 } from "./parts";
import { buildHuesoKart, buildMedianocheKart, type BuiltKartSkin } from "./kartSkins";
import { buildChispas, buildLia, type BuiltPilot } from "./pilots";
import { PALETTE, driverOutlineMaterial, sharedBoneToon, sharedVertexToon } from "./materials";
import {
  DEFAULT_CHARACTER,
  DEFAULT_KART,
  findCharacter,
  findKart,
  type CharacterDef,
  type CharacterLook,
  type KartDef,
  type KartLook,
} from "@derrape/shared";

// Pilotos chibi-calavera y karts redondeados, hechos con primitivas (sin assets).
// El coche es una malla; el piloto son cuerpo + cabeza, cada uno con contorno por escala.
// Las llamas no van en la malla: cuelgan de anclas que lee `flames.ts`.

export type Mood = "idle" | "celebrate" | "angry";

export interface KartModel {
  root: THREE.Group;
  /** Parte que se inclina al derrapar (el root sigue el rumbo real). */
  body: THREE.Group;
  /** Posiciones locales de las ruedas traseras, para las chispas. */
  rearWheels: THREE.Vector3[];
  /** Bocas de escape, en el chasis. */
  exhausts: THREE.Object3D[];
  /** Faros delanteros (Medianoche): reciben un halo aditivo. */
  lamps: THREE.Object3D[];
  /** Llamas del piloto (coleta, melena, antena, bufanda, farol). */
  ornaments: THREE.Object3D[];
  /** Esas llamas son espectrales aunque el escape vaya en naranja. */
  ornamentSpectral: boolean;
  /** Centro de la cabeza, para las chispas del enfado. */
  head: THREE.Object3D;
  shield: THREE.Mesh;
  /** Largo del coche, para el tamaño de la llama. */
  flameLength: number;
  mood: Mood;
  /** Cerca de la cámara. Lejos se cambia al modelo barato. */
  readonly detail: boolean;
  setDetail(near: boolean): void;
  setMood(mood: Mood, time: number): void;
  /**
   * Animación por fotograma: el cuerpo se inclina al girar (±12°), la cabeza mira hacia el giro,
   * la coleta se balancea y hay un rebote de 0,1 s al recibir turbo.
   */
  animate(heading: number, dt: number, boosting: boolean, time: number): void;
  setOutline(on: boolean): void;
}

const shieldGeo = new THREE.SphereGeometry(1.7, 12, 8);
shieldGeo.userData.shared = true;
const shieldMat = new THREE.MeshBasicMaterial({ color: 0x3ff2c8, transparent: true, opacity: 0.28, depthWrite: false });
shieldMat.userData.shared = true;
const partsMat = sharedVertexToon();
const boneMat = sharedBoneToon();
const outlineMat = driverOutlineMaterial();

const { noche: NOCHE, hueso: HUESO, marfil: MARFIL, brasa: BRASA, llama: LLAMA, sombra: SOMBRA, ciruela: CIRUELA } = PALETTE;
const TYRE = 0x16141f;

interface BuiltKart {
  geo: THREE.BufferGeometry;
  /** Piezas emisivas (faros y pilotos) y anclas de los faros. */
  glow?: THREE.BufferGeometry | null;
  lamps?: THREE.Vector3[];
  seat: THREE.Vector3;
  rear: THREE.Vector3[];
  exhausts: THREE.Vector3[];
}

interface BuiltDriver {
  body: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  pupils: THREE.BufferGeometry;
  headPos: THREE.Vector3;
  /** Adornos en el espacio de la cabeza (origen = centro de la calavera). */
  ornaments: THREE.Vector3[];
  spectral: boolean;
  pupil: number;
}

// --- Coche ---

function emblem(p: Parts, pos: Vec3) {
  p.ball(0.11, HUESO, pos, [1, 1, 0.45], [5, 4]);
  p.ball(0.028, NOCHE, [pos[0] - 0.038, pos[1] + 0.02, pos[2] + 0.04], undefined, [4, 3]);
  p.ball(0.028, NOCHE, [pos[0] + 0.038, pos[1] + 0.02, pos[2] + 0.04], undefined, [4, 3]);
}

function buildKartGeometry(look: KartLook, color: number): BuiltKart {
  if (look.skin === "hueso") return buildHuesoKart(look) satisfies BuiltKartSkin;
  if (look.skin === "medianoche") return buildMedianocheKart(look);
  const p = new Parts();
  const { length: len, width: wid, height: hgt } = look;
  const y0 = Math.max(look.frontWheel, look.rearWheel) * 0.9 + hgt / 2;
  const light = mix(color, HUESO, 0.35);
  const dark = mix(color, NOCHE, 0.55);
  const half = Math.PI / 2;

  // Carrocería más alta y con bisel grande: el chasis de datos es bajo y se leía como una losa.
  const bodyH = Math.max(hgt * 1.65, 0.5);
  const yBody = Math.max(look.frontWheel, look.rearWheel) * 0.62 + bodyH * 0.28;
  if (look.skin === "coffin") {
    p.capsule(bodyH * 0.42, len * 0.38, color, [0, yBody, 0], [half, 0, 0], [wid / (bodyH * 0.9), 0.72, 1]);
  } else if (look.skin === "pumpkin") {
    const r = Math.min(wid, len) * 0.48;
    p.ball(r, color, [0, yBody, 0], [1, 0.78, 1.08], [8, 6]);
    for (let i = 0; i < 3; i++) {
      p.torus(r * 0.9, 0.02, dark, [0, yBody, 0], [(i / 3) * Math.PI, half, 0]);
    }
  } else if (look.skin === "broom") {
    p.capsule(0.055, len * 0.92, MARFIL, [0, yBody, 0.05], [half, 0, 0]);
    p.capsule(0.045, 0.55, color, [0, yBody + 0.38, len * 0.28], [0.4, 0, 0]);
  } else {
    p.rounded(wid * 0.98, bodyH, len * 0.84, color, [0, yBody, 0.02], undefined, Math.min(0.22, bodyH * 0.46));
  }

  const nosed = look.skin === "classic" || look.skin === "bat" || look.skin === "horns" || look.skin === "scythe" || look.skin === "tomb";
  if (nosed) {
    p.add(new THREE.SphereGeometry(wid * 0.28, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), light, [0, yBody, len * 0.4], [half, 0, 0], [1, 0.62, 0.8]);
    emblem(p, [0, yBody + bodyH * 0.12, len * 0.48]);
  }

  // Ruedas 1,3 veces más anchas. El radio de apoyo no cambia: solo el dibujo.
  const fz = len * 0.33;
  const rz = -len * 0.33;
  const hub = look.skin === "tomb" || look.skin === "churro" ? HUESO : look.skin === "pumpkin" ? LLAMA : BRASA;
  const wheel = (r: number, w: number, x: number, z: number) => {
    const fat = w * 1.3;
    const sign = Math.sign(x || 1);
    const xw = x + sign * w * 0.16;
    p.add(new THREE.TorusGeometry(r * 0.72, Math.min(r * 0.36, fat * 0.42), 3, 6), TYRE, [xw, r, z], [0, half, 0]);
    p.cyl(r * 0.4, r * 0.4, fat * 0.28, hub, [xw, r, z], [0, 0, half]);
    p.ball(r * 0.24, HUESO, [xw + sign * fat * 0.16, r, z], [0.36, 1, 1], [5, 3]);
  };
  const fx = wid / 2 + look.frontWheelW / 2 - 0.05;
  const rx = wid / 2 + look.rearWheelW / 2 - 0.05;
  if (look.skin === "broom") {
    wheel(look.frontWheel, look.frontWheelW, 0, fz);
    wheel(look.rearWheel, look.rearWheelW, 0, rz);
  } else {
    wheel(look.frontWheel, look.frontWheelW, -fx, fz);
    wheel(look.frontWheel, look.frontWheelW, fx, fz);
    wheel(look.rearWheel, look.rearWheelW, -rx, rz);
    wheel(look.rearWheel, look.rearWheelW, rx, rz);
  }

  let seatZ = -len * 0.08;
  const seatY = yBody + bodyH * 0.42;
  switch (look.skin) {
    case "tomb": {
      p.ball(0.28, HUESO, [0, yBody + bodyH * 0.2, len * 0.46], [wid * 1.1, 0.9, 0.28], [6, 4]);
      break;
    }
    case "bat": {
      for (const s of [-1, 1] as const) {
        p.ball(0.28, dark, [s * wid * 0.55, y0 + 0.05, 0.05], [1.3, 0.18, 0.85], [6, 4]);
      }
      break;
    }
    case "broom": {
      for (let i = -3; i <= 3; i++) {
        p.cone(0.05, 0.32, LLAMA, [i * 0.07, y0 + 0.02, -len * 0.42], [half + i * 0.12, 0, 0]);
      }
      seatZ = -len * 0.05;
      break;
    }
    case "churro": {
      seatZ = len * 0.12;
      p.capsule(0.36, len * 0.22, light, [0, yBody + bodyH * 0.45, -len * 0.14], [half, 0, 0], [wid * 1.1, 0.8, 1]);
      p.capsule(0.045, len * 0.28, CIRUELA, [0, yBody + bodyH * 0.85, -len * 0.14], [half, 0, 0], [wid * 6, 1, 1]);
      break;
    }
    case "scythe": {
      p.add(new THREE.TorusGeometry(wid * 0.85, 0.07, 3, 10, Math.PI * 1.15), HUESO, [0, yBody + bodyH * 0.5 + 0.35, -len * 0.15], [0.4, 0, 0]);
      break;
    }
    case "ribs": {
      for (let i = 0; i < 3; i++) {
        p.torus(wid * 0.42, 0.035, HUESO, [0, seatY + 0.35, seatZ - 0.15 + i * 0.18], [half, 0, 0], Math.PI);
      }
      break;
    }
    case "horns": {
      p.cone(0.07, 0.22, HUESO, [-0.16, y0 + hgt * 0.45, len * 0.28], [-0.5, 0, 0.3]);
      p.cone(0.07, 0.22, HUESO, [0.16, y0 + hgt * 0.45, len * 0.28], [-0.5, 0, -0.3]);
      break;
    }
    default:
      break;
  }

  p.capsule(0.12, 0.22, NOCHE, [0, seatY, seatZ], [half, 0, 0], [1.4, 0.55, 1]);

  if (look.wing > 0 && look.skin !== "scythe") {
    const big = look.wing === 2;
    const wy = yBody + bodyH * 0.5 + (big ? 0.35 : 0.18);
    const wz = -len * 0.42;
    p.capsule(0.05, wid * (big ? 0.7 : 0.45), light, [0, wy, wz], [0, 0, half], [1, 0.7, big ? 2.2 : 1.6]);
  }

  // Escapes: 4 en los pesados, pareja central en Derrapín, 2 en el resto.
  const exhausts: THREE.Vector3[] = [];
  const tilt = -Math.PI / 2 + (25 * Math.PI) / 180;
  const dir = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(tilt, 0, 0));
  const addExhaust = (x: number, y: number, z: number) => {
    const mouth = new THREE.Vector3(x, y, z);
    const center = mouth.clone().addScaledVector(dir, -0.28);
    p.cyl(0.09, 0.15, 0.7, MARFIL, [center.x, center.y, center.z], [tilt, 0, 0]);
    exhausts.push(mouth);
  };
  const ey = yBody + 0.06;
  const ez = -len * 0.58;
  if (look.skin === "tomb" || look.skin === "churro") {
    addExhaust(-wid * 0.32, ey, ez);
    addExhaust(-wid * 0.12, ey + 0.04, ez - 0.02);
    addExhaust(wid * 0.12, ey + 0.04, ez - 0.02);
    addExhaust(wid * 0.32, ey, ez);
  } else if (look.skin === "horns") {
    addExhaust(-0.1, ey, ez);
    addExhaust(0.1, ey, ez);
  } else if (look.skin === "broom") {
    addExhaust(0, ey, -len * 0.5);
  } else {
    const spread = look.skin === "pumpkin" ? 0.18 : wid * 0.28;
    addExhaust(-spread, ey, ez);
    addExhaust(spread, ey, ez);
  }

  const rear =
    look.skin === "broom"
      ? [new THREE.Vector3(0, 0.08, rz - look.rearWheel * 0.3)]
      : [new THREE.Vector3(-rx, 0.08, rz - look.rearWheel * 0.2), new THREE.Vector3(rx, 0.08, rz - look.rearWheel * 0.2)];

  return { geo: p.build(), seat: new THREE.Vector3(0, seatY + 0.06, seatZ), rear, exhausts };
}

// --- Piloto ---

/**
 * Calavera que se lee de frente: cráneo liso, cuencas grandes, nariz en corazón
 * invertido, mentón y sonrisa con dientes. Las pupilas van en otra malla (emisivas).
 */
function skull(p: Parts, r: number, scale: Vec3 = [1, 1, 1]) {
  p.ball(r, HUESO, [0, 0, 0], scale, [20, 14]);
  const sx = scale[0];
  const sy = scale[1];
  const sz = scale[2];
  const eyeX = r * 0.34 * sx;
  const eyeY = r * 0.06 * sy;
  // ~28 % del ancho de la cara. El ovalo sale hacia delante para no quedar dentro del cráneo.
  const socketR = r * 0.23 * sx;
  const eyeZ = r * 0.8 * sz;
  for (const s of [-1, 1] as const) {
    p.ball(socketR, SOMBRA, [s * eyeX, eyeY, eyeZ], [1.15, 1.35, 0.62], [6, 5]);
  }
  // Nariz: corazón invertido (dos lóbulos y una punta hacia abajo), en sombra.
  const ny = -r * 0.02 * sy;
  const nz = r * 0.96 * sz;
  p.ball(r * 0.07, SOMBRA, [-r * 0.065 * sx, ny + r * 0.045, nz], undefined, [4, 3]);
  p.ball(r * 0.07, SOMBRA, [r * 0.065 * sx, ny + r * 0.045, nz], undefined, [4, 3]);
  p.cone(r * 0.07, r * 0.13, SOMBRA, [0, ny - r * 0.04, nz], [Math.PI, 0, 0]);
  // Sonrisa en arco: el centro baja y las comisuras suben, sobre la curva de la cara.
  const mouthY = -r * 0.3 * sy;
  const mouthZ = r * 0.8 * sz;
  p.torus(r * 0.2, r * 0.03, SOMBRA, [0, mouthY, mouthZ], [0.2, 0, Math.PI], Math.PI * 0.85);
  for (let i = 0; i < 4; i++) {
    const a = -0.95 + (i / 3) * 1.9;
    const bow = Math.cos(a);
    p.ball(
      r * 0.035,
      HUESO,
      [Math.sin(a) * r * 0.18 * sx, mouthY - bow * r * 0.08 * sy, mouthZ + bow * r * 0.05 * sz],
      [0.7, 1.25, 0.5],
      [4, 3],
    );
  }
}

function pupils(r: number, scale: Vec3 = [1, 1, 1]): THREE.BufferGeometry {
  const p = new Parts();
  const eyeX = r * 0.34 * scale[0];
  const eyeY = r * 0.06 * scale[1];
  const eyeZ = r * 0.98 * scale[2];
  for (const s of [-1, 1] as const) p.ball(r * 0.1, 0xffffff, [s * eyeX, eyeY, eyeZ], [1, 1.25, 0.6], [5, 4]);
  return p.build();
}

function buildDriver(c: CharacterDef): BuiltDriver {
  const body = new Parts();
  const head = new Parts();
  const ornaments: THREE.Vector3[] = [];
  let spectral = false;
  let pupil: number = LLAMA;
  let headR = 0.42;
  let headY = 1.08;
  const arm = (x: number, color: number) => {
    body.capsule(0.07, 0.22, color, [x * 0.32, 0.58, 0.16], [0.7, 0, x * -0.35], undefined, 4);
    body.ball(0.09, HUESO, [x * 0.46, 0.4, 0.34], undefined, [4, 3]);
  };

  switch (c.look as CharacterLook) {
    case "mechanic": {
      body.capsule(0.22, 0.34, c.color, [0, 0.46, 0]);
      arm(-1, c.color);
      arm(1, c.color);
      body.capsule(0.04, 0.36, HUESO, [-0.26, 0.58, -0.2], [0.15, 0, 0.45]);
      skull(head, headR);
      head.torus(headR * 0.72, 0.035, c.color, [0, headR * 0.2, 0], [halfTurn(), 0, 0]);
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        ornaments.push(new THREE.Vector3(Math.sin(t * 0.9) * 0.06, headR * (0.15 + t * 1.05), -headR * (0.75 + t * 0.9)));
      }
      spectral = true;
      pupil = c.accent;
      break;
    }
    case "robot": {
      headR = 0.36;
      body.ball(0.34, c.color, [0, 0.4, 0], [1.15, 0.82, 1], [7, 5]);
      arm(-1, MARFIL);
      arm(1, MARFIL);
      skull(head, headR, [1.05, 0.95, 0.85]);
      head.cyl(0.02, 0.02, 0.28, MARFIL, [0, headR + 0.12, 0]);
      ornaments.push(new THREE.Vector3(0, headR + 0.32, 0));
      spectral = true;
      pupil = c.accent;
      break;
    }
    case "courier": {
      body.capsule(0.22, 0.32, SOMBRA, [0, 0.46, 0]);
      arm(-1, SOMBRA);
      arm(1, SOMBRA);
      body.capsule(0.16, 0.22, c.color, [0, 0.5, -0.32], [halfTurn(), 0, 0], [1.35, 0.85, 1]);
      skull(head, headR);
      head.dome(headR * 0.92, c.accent, [0, headR * 0.15, -0.02]);
      head.ball(headR * 0.2, c.accent, [0, headR * 0.08, headR * 0.72], [2.2, 0.28, 1.15], [5, 3]);
      break;
    }
    case "bulldog": {
      body.capsule(0.24, 0.3, c.color, [0, 0.46, 0.02], undefined, [1.15, 1, 1.05]);
      arm(-1, c.color);
      arm(1, c.color);
      body.torus(0.28, 0.04, NOCHE, [0, 0.62, 0.04], [halfTurn(), 0, 0]);
      const wide: Vec3 = [1.25, 0.95, 1.05];
      skull(head, headR, wide);
      head.torus(0.18, 0.018, NOCHE, [0, 0.06, headR * 0.72], [halfTurn(), 0, 0]);
      pupil = c.accent;
      break;
    }
    case "granny": {
      body.capsule(0.24, 0.32, c.color, [0, 0.48, 0]);
      arm(-1, c.color);
      arm(1, c.color);
      skull(head, headR);
      head.dome(headR * 1.02, MARFIL, [0, 0.02, 0], [1, 0.85, 1.05]);
      head.torus(0.16, 0.016, NOCHE, [0, 0.02, headR * 0.7], [halfTurn(), 0, 0]);
      ornaments.push(new THREE.Vector3(-0.08, -0.15, -0.15), new THREE.Vector3(0.1, -0.28, -0.05));
      break;
    }
    case "mascot": {
      body.capsule(0.24, 0.34, c.color, [0, 0.48, 0]);
      arm(-1, c.color);
      arm(1, c.color);
      skull(head, headR);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.9 + (i / 6) * Math.PI * 1.8;
        ornaments.push(new THREE.Vector3(Math.sin(a) * headR * 0.92, headR * (0.42 + Math.cos(a * 0.5) * 0.2), -headR * 0.15 + Math.cos(a) * headR * 0.2));
      }
      break;
    }
    case "sheet": {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const y = t * 0.85;
        const wave = 0.2 + 0.06 * Math.sin(t * Math.PI) + (t < 0.18 ? Math.sin(i * 2.2) * 0.03 : 0);
        pts.push(new THREE.Vector2(wave * (1.05 - t * 0.25), y));
      }
      body.add(new THREE.LatheGeometry(pts, 8), c.color, [0, 0.08, 0]);
      headR = 0.34;
      headY = 0.95;
      skull(head, headR, [1, 0.92, 1]);
      body.cyl(0.06, 0.07, 0.16, MARFIL, [0.28, 0.42, 0.22]);
      body.ball(0.09, LLAMA, [0.28, 0.56, 0.22], undefined, [5, 4]);
      ornaments.push(new THREE.Vector3(0.28, 0.62 - headY, 0.22));
      spectral = true;
      pupil = c.accent;
      break;
    }
    case "dandy": {
      body.ball(0.32, c.color, [0, 0.5, 0], [1.05, 1.1, 0.9], [7, 5]);
      arm(-1, c.color);
      arm(1, c.color);
      body.ball(0.06, c.accent, [-0.07, 0.62, 0.28], [1, 0.7, 0.5], [4, 3]);
      body.ball(0.06, c.accent, [0.07, 0.62, 0.28], [1, 0.7, 0.5], [4, 3]);
      skull(head, headR);
      head.cyl(headR * 0.55, headR * 0.55, 0.22, NOCHE, [0, headR * 0.95, 0]);
      head.add(new THREE.CylinderGeometry(headR * 0.85, headR * 0.85, 0.035, 8), NOCHE, [0, headR * 0.72, 0]);
      headY = 1.12;
      break;
    }
  }

  const headScale: Vec3 = c.look === "bulldog" ? [1.25, 0.95, 1.05] : c.look === "robot" ? [1.05, 0.95, 0.85] : [1, 1, 1];
  return {
    body: body.build(),
    head: head.build(),
    pupils: pupils(headR, headScale),
    headPos: new THREE.Vector3(0, headY, 0.02),
    ornaments,
    spectral,
    pupil,
  };
}

function halfTurn() {
  return Math.PI / 2;
}

// --- Caché ---

const kartCache = new Map<string, BuiltKart>();
const driverCache = new Map<string, BuiltDriver>();
const pilotCache = new Map<string, BuiltPilot>();

function kartParts(def: KartDef, color: number) {
  const key = `${def.id}:${color}`;
  let v = kartCache.get(key);
  if (!v) {
    v = buildKartGeometry(def.look, color);
    v.geo.userData.shared = true;
    if (v.glow) v.glow.userData.shared = true;
    kartCache.set(key, v);
  }
  return v;
}

function driverParts(def: CharacterDef) {
  let g = driverCache.get(def.id);
  if (!g) {
    g = buildDriver(def);
    g.body.userData.shared = true;
    g.head.userData.shared = true;
    g.pupils.userData.shared = true;
    driverCache.set(def.id, g);
  }
  return g;
}

/** Los dos pilotos del Release 1 tienen su propio constructor (brazos y mechones animables). */
function pilotParts(def: CharacterDef): BuiltPilot | null {
  if (def.look !== "mechanic" && def.look !== "chispas") return null;
  let p = pilotCache.get(def.id);
  if (!p) {
    p = def.look === "mechanic" ? buildLia() : buildChispas();
    for (const g of [p.body, p.head, p.eyes, ...p.arms.map((a) => a.geo), ...p.strands.map((s) => s.geo)]) g.userData.shared = true;
    pilotCache.set(def.id, p);
  }
  return p;
}

/** Kiko es pequeño; Nonna y Don Osario, un poco más grandes. */
const DRIVER_SCALE: Record<string, number> = { kiko: 0.84, "nonna-pina": 1.06, "don-osario": 1.14, mimi: 0.96, brasa: 0.98 };

function pin(parent: THREE.Object3D, pos: THREE.Vector3) {
  const o = new THREE.Object3D();
  o.position.copy(pos);
  parent.add(o);
  return o;
}

/** Color de la carrocería del modelo barato: el de la piel si tiene paleta propia, si no el del jugador. */
function lodBody(look: KartLook, color: number) {
  return look.skin === "hueso" ? HUESO : look.skin === "medianoche" ? SOMBRA : color;
}

function buildLod(look: KartLook, color: number, c: CharacterDef): { kart: THREE.BufferGeometry; driver: THREE.BufferGeometry } {
  const p = new Parts();
  const h = Math.max(look.height * 1.4, 0.42);
  const y = look.frontWheel * 0.7 + h * 0.2;
  const half = Math.PI / 2;
  p.rounded(look.width * 0.96, h, look.length * 0.8, lodBody(look, color), [0, y, 0], undefined, 0.14);
  if (look.skin === "medianoche") p.rounded(look.width * 0.5, 0.06, 0.1, BRASA, [0, y + h * 0.28, look.length * 0.37], undefined, 0.02);
  const wheel = (r: number, _w: number, x: number, z: number) => {
    p.add(new THREE.TorusGeometry(r * 0.72, r * 0.28, 3, 6), TYRE, [x, r, z], [0, half, 0]);
  };
  if (look.skin === "broom") {
    wheel(look.frontWheel, look.frontWheelW, 0, look.length * 0.3);
    wheel(look.rearWheel, look.rearWheelW, 0, -look.length * 0.3);
  } else {
    const fx = look.width / 2 + look.frontWheelW * 0.4;
    const rx = look.width / 2 + look.rearWheelW * 0.4;
    wheel(look.frontWheel, look.frontWheelW, -fx, look.length * 0.3);
    wheel(look.frontWheel, look.frontWheelW, fx, look.length * 0.3);
    wheel(look.rearWheel, look.rearWheelW, -rx, -look.length * 0.3);
    wheel(look.rearWheel, look.rearWheelW, rx, -look.length * 0.3);
  }
  const d = new Parts();
  d.capsule(0.2, 0.26, c.look === "mechanic" || c.look === "chispas" ? c.color : c.color, [0, 0.42, 0]);
  d.ball(0.38, HUESO, [0, 1.02, 0.02], undefined, [8, 6]);
  d.ball(0.09, c.look === "chispas" ? NOCHE : SOMBRA, [-0.12, 1.06, 0.32], [1.1, 1.3, 0.55], [5, 4]);
  d.ball(0.09, c.look === "chispas" ? NOCHE : SOMBRA, [0.12, 1.06, 0.32], [1.1, 1.3, 0.55], [5, 4]);
  // Lía: la coleta Espectro se reconoce incluso de lejos.
  if (c.look === "mechanic") d.ball(0.22, PALETTE.espectro, [0, 1.38, -0.28], [1, 1.2, 1], [6, 4]);
  return { kart: p.build(), driver: d.build() };
}

function outlined(geo: THREE.BufferGeometry, parent: THREE.Object3D) {
  const shell = new THREE.Mesh(geo, outlineMat);
  shell.scale.setScalar(1.04);
  shell.name = "contorno";
  parent.add(shell);
  parent.add(new THREE.Mesh(geo, boneMat));
  return shell;
}

let glowMat: THREE.MeshBasicMaterial | null = null;
/** Faros y pilotos: color puro de la paleta, sin luz (emisivo al 100 %). */
function sharedGlowMaterial() {
  if (!glowMat) {
    glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    glowMat.userData.shared = true;
  }
  return glowMat;
}

const wrapPi = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/** Inclinación del cuerpo en las curvas: ±12°. */
const LEAN_MAX = (12 * Math.PI) / 180;
/** Brazos agarrando el volante (rotación X desde colgar hacia abajo). */
const ARM_REST = -1.0;

export function createKartModel(color: number = BRASA, characterId: string = DEFAULT_CHARACTER, kartId: string = DEFAULT_KART): KartModel {
  const character = findCharacter(characterId) ?? findCharacter(DEFAULT_CHARACTER)!;
  const kart = findKart(kartId) ?? findKart(DEFAULT_KART)!;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const parts = kartParts(kart, color);
  const hiKart = new THREE.Mesh(parts.geo, partsMat);
  body.add(hiKart);
  const glowMesh = parts.glow ? new THREE.Mesh(parts.glow, sharedGlowMaterial()) : null;
  if (glowMesh) body.add(glowMesh);
  const exhausts = parts.exhausts.map((pos) => pin(body, pos));
  const lamps = (parts.lamps ?? []).map((pos) => pin(body, pos));
  const lod = buildLod(kart.look, color, character);
  lod.kart.userData.shared = false;
  lod.driver.userData.shared = false;
  const loKart = new THREE.Mesh(lod.kart, partsMat);
  loKart.name = "lejos";
  loKart.visible = false;
  body.add(loKart);

  const pilot = pilotParts(character);
  const built = pilot ? null : driverParts(character);
  const driver = new THREE.Group();
  driver.position.copy(parts.seat);
  driver.scale.setScalar(DRIVER_SCALE[character.id] ?? 1);
  if (character.look === "sheet") driver.position.y += 0.18;
  const shells: THREE.Mesh[] = [];
  const driverBody = new THREE.Group();
  const head = new THREE.Group();
  const eyeMat = new THREE.MeshBasicMaterial({ vertexColors: !!pilot, color: pilot ? 0xffffff : built!.pupil, toneMapped: false });
  const hiExtra: THREE.Object3D[] = [];
  const ornaments: THREE.Object3D[] = [];
  const armPivots: THREE.Group[] = [];
  const strandPivots: { g: THREE.Group; base: number; yaw: number; phase: number }[] = [];
  let ornamentSpectral = false;
  let eyes: THREE.Mesh;

  if (pilot) {
    shells.push(outlined(pilot.body, driverBody));
    head.position.copy(pilot.headPos);
    shells.push(outlined(pilot.head, head));
    eyes = new THREE.Mesh(pilot.eyes, eyeMat);
    head.add(eyes);
    pilot.arms.forEach((a, i) => {
      const g = new THREE.Group();
      g.position.copy(a.pivot);
      g.rotation.set(ARM_REST, 0, 0);
      shells.push(outlined(a.geo, g));
      driver.add(g);
      armPivots[i] = g;
      hiExtra.push(g);
    });
    for (const s of pilot.strands) {
      const g = new THREE.Group();
      g.position.copy(s.pivot);
      g.rotation.order = "YXZ";
      g.add(new THREE.Mesh(s.geo, boneMat));
      if (pilot.sparkles) ornaments.push(pin(g, s.tip));
      head.add(g);
      strandPivots.push({ g, base: s.base, yaw: s.yaw, phase: s.phase });
      hiExtra.push(g);
    }
    ornamentSpectral = pilot.sparkles;
  } else {
    const b = built!;
    shells.push(outlined(b.body, driverBody));
    head.position.copy(b.headPos);
    shells.push(outlined(b.head, head));
    eyes = new THREE.Mesh(b.pupils, eyeMat);
    head.add(eyes);
    for (const pos of b.ornaments) ornaments.push(pin(head, pos));
    ornamentSpectral = b.spectral;
  }
  driver.add(driverBody);
  driver.add(head);
  const loDriver = new THREE.Mesh(lod.driver, boneMat);
  loDriver.name = "lejos";
  loDriver.visible = false;
  loDriver.position.copy(driver.position);
  loDriver.scale.copy(driver.scale);
  body.add(driver);
  body.add(loDriver);

  const baseY = driver.position.y;
  const baseScale = driver.scale.x;
  let headScale = 1;
  let headVel = 0;
  let lastTime = 0;
  // Estado de la animación (ver `animate`).
  let lastHeading: number | null = null;
  let steer = 0;
  let armsUp = 0;
  let wasBoosting = false;
  let bounceT = 1;
  const baseEyeColor = eyeMat.color.getHex();

  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.y = 0.9;
  shield.visible = false;
  root.add(shield);

  let mood: Mood = "idle";
  let near = true;
  const hiBits: THREE.Object3D[] = [hiKart, driverBody, head, eyes, ...hiExtra];
  if (glowMesh) hiBits.push(glowMesh);
  return {
    root,
    body,
    shield,
    rearWheels: parts.rear,
    exhausts,
    lamps,
    ornaments,
    ornamentSpectral,
    head,
    flameLength: kart.look.length,
    get mood() {
      return mood;
    },
    get detail() {
      return near;
    },
    setDetail(on) {
      near = on;
      for (const o of hiBits) o.visible = on;
      if (!on) for (const s of shells) s.visible = false;
      loKart.visible = !on;
      loDriver.visible = !on;
    },
    setOutline(on) {
      for (const s of shells) s.visible = on && near;
    },
    animate(heading, dt, boosting, time) {
      if (dt > 0 && lastHeading !== null) {
        const target = THREE.MathUtils.clamp(wrapPi(heading - lastHeading) / dt / 1.4, -1, 1);
        steer += (target - steer) * Math.min(1, dt * 8);
      }
      lastHeading = heading;
      if (boosting && !wasBoosting) bounceT = 0;
      wasBoosting = boosting;
      bounceT = Math.min(1, bounceT + dt / 0.1);
      for (const s of strandPivots) s.g.rotation.set(s.base + Math.sin(time * 3.1 + s.phase) * 0.12 + (boosting ? 0.25 : 0), s.yaw, -steer * 0.5 + Math.sin(time * 2.3 + s.phase) * 0.06);
    },
    setMood(next, time) {
      mood = next;
      const dt = Math.min(0.05, Math.max(0, time - lastTime || 0));
      lastTime = time;
      const target = next === "celebrate" ? 1.1 : 1;
      headVel += ((target - headScale) * 46 - headVel * 9) * dt;
      headScale += headVel * dt;
      head.scale.set(1, headScale, 1);
      eyeMat.color.setHex(next === "angry" ? PALETTE.ascua : baseEyeColor);
      // Brazos: agarran el volante; al cruzar meta se levantan con un «¡yuju!».
      armsUp += ((next === "celebrate" ? 1 : 0) - armsUp) * Math.min(1, dt * 10);
      armPivots.forEach((g, i) => {
        const side = i === 0 ? -1 : 1;
        g.rotation.set(ARM_REST - 2.2 * armsUp + Math.sin(time * 12 + i * Math.PI) * 0.25 * armsUp, 0, side * (0.1 + 0.35 * armsUp));
      });
      const bounce = bounceT < 1 ? Math.sin(Math.PI * bounceT) * 0.08 : 0;
      head.rotation.y = steer * 0.4;
      if (next === "celebrate") {
        driver.position.y = baseY + Math.abs(Math.sin(time * 8)) * 0.12 + bounce;
        driver.rotation.set(0, Math.sin(time * 6) * 0.35, 0);
        driver.scale.set(baseScale, baseScale, baseScale);
      } else if (next === "angry") {
        driver.position.y = baseY + bounce;
        driver.rotation.set(0, 0, Math.sin(time * 42) * 0.08);
        driver.scale.setScalar(baseScale);
      } else {
        driver.position.y = baseY + bounce;
        driver.rotation.set(0, 0, steer * LEAN_MAX);
        driver.scale.setScalar(baseScale);
      }
    },
  };
}

/** Libera las mallas guardadas (al cerrar el juego o para depurar). */
export function disposeKartModelCache() {
  for (const v of kartCache.values()) {
    v.geo.dispose();
    v.glow?.dispose();
  }
  for (const g of driverCache.values()) {
    g.body.dispose();
    g.head.dispose();
    g.pupils.dispose();
  }
  for (const p of pilotCache.values()) {
    for (const g of [p.body, p.head, p.eyes, ...p.arms.map((a) => a.geo), ...p.strands.map((s) => s.geo)]) g.dispose();
  }
  kartCache.clear();
  driverCache.clear();
  pilotCache.clear();
}

export function triangleCount(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  if (!pos) return 0;
  return geo.index ? geo.index.count / 3 : pos.count / 3;
}
