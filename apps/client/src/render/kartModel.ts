import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PALETTE, driverOutlineMaterial, sharedVertexToon } from "./materials";
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
  /** Llamas del piloto (coleta, melena, antena, bufanda, farol). */
  ornaments: THREE.Object3D[];
  /** Esas llamas son espectrales aunque el escape vaya en naranja. */
  ornamentSpectral: boolean;
  /** Centro de la cabeza, para las chispas del enfado. */
  head: THREE.Object3D;
  shield: THREE.Mesh;
  mood: Mood;
  setMood(mood: Mood, time: number): void;
  setOutline(on: boolean): void;
}

const shieldGeo = new THREE.SphereGeometry(1.7, 12, 8);
shieldGeo.userData.shared = true;
const shieldMat = new THREE.MeshBasicMaterial({ color: 0x3ff2c8, transparent: true, opacity: 0.28, depthWrite: false });
shieldMat.userData.shared = true;
const partsMat = sharedVertexToon();
const outlineMat = driverOutlineMaterial();

const { noche: NOCHE, hueso: HUESO, huesoSombra: HUESO_S, marfil: MARFIL, brasa: BRASA, llama: LLAMA, sombra: SOMBRA, ciruela: CIRUELA } = PALETTE;
const TYRE = 0x16141f;

type Vec3 = [number, number, number];

/** Acumula piezas y las fusiona en una sola geometría con color por vértice. */
class Parts {
  private list: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(geo: THREE.BufferGeometry, color: number, pos: Vec3, rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    if (src !== geo) geo.dispose();
    this.m.compose(new THREE.Vector3(...pos), this.q.setFromEuler(this.e.set(...rot)), new THREE.Vector3(...scale));
    src.applyMatrix4(this.m);
    const c = new THREE.Color(color);
    const n = src.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    src.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.list.push(src);
    return this;
  }

  ball(r: number, color: number, pos: Vec3, scale?: Vec3, seg: [number, number] = [6, 5]) {
    return this.add(new THREE.SphereGeometry(r, seg[0], seg[1]), color, pos, [0, 0, 0], scale);
  }

  dome(r: number, color: number, pos: Vec3, scale?: Vec3) {
    return this.add(new THREE.SphereGeometry(r, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), color, pos, [0, 0, 0], scale);
  }

  capsule(radius: number, length: number, color: number, pos: Vec3, rot?: Vec3, scale?: Vec3) {
    return this.add(new THREE.CapsuleGeometry(radius, length, 1, 5), color, pos, rot, scale);
  }

  cyl(rTop: number, rBot: number, h: number, color: number, pos: Vec3, rot?: Vec3) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, 6), color, pos, rot);
  }

  torus(r: number, tube: number, color: number, pos: Vec3, rot?: Vec3, arc = Math.PI * 2) {
    return this.add(new THREE.TorusGeometry(r, tube, 3, 8, arc), color, pos, rot);
  }

  cone(r: number, h: number, color: number, pos: Vec3, rot?: Vec3) {
    const g = new THREE.ConeGeometry(r, h, 5);
    g.translate(0, h / 2, 0);
    return this.add(g, color, pos, rot);
  }

  rounded(w: number, h: number, d: number, color: number, pos: Vec3, rot?: Vec3, radius = 0.1) {
    const rad = Math.min(radius, w / 2, h / 2, d / 2);
    return this.add(new RoundedBoxGeometry(w, h, d, 1, Math.max(0.02, rad)), color, pos, rot);
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.list, false);
    for (const g of this.list) g.dispose();
    if (!merged) throw new Error("no se pudo fusionar la malla");
    merged.computeVertexNormals();
    return merged;
  }
}

const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

interface BuiltKart {
  geo: THREE.BufferGeometry;
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
  const p = new Parts();
  const { length: len, width: wid, height: hgt } = look;
  const y0 = Math.max(look.frontWheel, look.rearWheel) * 0.9 + hgt / 2;
  const top = y0 + hgt / 2;
  const light = mix(color, HUESO, 0.35);
  const dark = mix(color, NOCHE, 0.55);
  const half = Math.PI / 2;

  // Carrocería baja. El morro, si lo hay, es una media esfera aplastada.
  if (look.skin === "coffin") {
    p.capsule(hgt * 0.72, len * 0.42, color, [0, y0, 0], [half, 0, 0], [wid / (hgt * 1.5), 0.7, 1]);
  } else if (look.skin === "pumpkin") {
    const r = Math.min(wid, len) * 0.46;
      p.ball(r, color, [0, y0 + 0.02, 0], [1, 0.7, 1.08], [7, 5]);
    for (let i = 0; i < 5; i++) {
      p.torus(r * 0.86, 0.016, dark, [0, y0 + 0.02, 0], [(i / 5) * Math.PI, half, 0]);
    }
  } else if (look.skin === "broom") {
    p.capsule(0.055, len * 0.92, MARFIL, [0, y0 + 0.05, 0.05], [half, 0, 0]);
    p.capsule(0.045, 0.55, color, [0, y0 + 0.42, len * 0.28], [0.4, 0, 0]);
  } else {
    p.rounded(wid, hgt, len * 0.9, color, [0, y0, 0], undefined, 0.12);
  }

  const nosed = look.skin === "classic" || look.skin === "bat" || look.skin === "horns" || look.skin === "scythe" || look.skin === "tomb";
  if (nosed) {
    p.add(new THREE.SphereGeometry(wid * 0.26, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), light, [0, y0 - hgt * 0.05, len * 0.4], [half, 0, 0], [1, 0.6, 0.78]);
    emblem(p, [0, y0 + hgt * 0.15, len * 0.46]);
  }

  // Ruedas gordas: toro + llanta. El radio es el de los datos (no cambia el apoyo).
  const fz = len * 0.33;
  const rz = -len * 0.33;
  const hub = look.skin === "tomb" || look.skin === "churro" ? HUESO : look.skin === "pumpkin" ? LLAMA : BRASA;
  const wheel = (r: number, w: number, x: number, z: number) => {
    // Toros de pocos segmentos: una rueda gorda tiene que caber cuatro veces en el presupuesto.
    p.add(new THREE.TorusGeometry(r * 0.7, Math.min(r * 0.32, w * 0.45), 3, 6), TYRE, [x, r, z], [0, half, 0]);
    p.cyl(r * 0.48, r * 0.48, Math.max(0.08, w * 0.42), hub, [x, r, z], [0, 0, half]);
    const out = Math.sign(x || 1) * (w * 0.28 + 0.02);
    p.ball(r * 0.2, HUESO, [x + out, r, z], [0.4, 1, 1], [4, 3]);
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
  const seatY = top + 0.02;
  switch (look.skin) {
    case "tomb": {
      p.capsule(0.22, hgt * 0.7, HUESO, [0, y0 + hgt * 0.45, len * 0.4], undefined, [wid * 1.4, 1, 0.45]);
      p.capsule(0.07, wid * 0.8, HUESO, [0, y0 - hgt * 0.2, len * 0.5], [0, 0, half]);
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
      p.capsule(0.38, len * 0.28, light, [0, top + 0.42, -len * 0.16], [half, 0, 0], [wid * 1.15, 0.85, 1]);
      p.capsule(0.05, len * 0.4, CIRUELA, [0, top + 0.78, -len * 0.16], [half, 0, 0], [wid * 8, 1, 1]);
      p.capsule(0.035, len * 0.4, HUESO, [0, top + 0.88, -len * 0.16], [half, 0, 0], [wid * 8, 1, 1]);
      p.ball(0.09, LLAMA, [-wid * 0.28, top + 0.62, len * 0.02], undefined, [4, 3]);
      p.ball(0.09, LLAMA, [wid * 0.28, top + 0.62, len * 0.02], undefined, [4, 3]);
      break;
    }
    case "scythe": {
      p.add(new THREE.TorusGeometry(wid * 0.85, 0.07, 3, 10, Math.PI * 1.15), HUESO, [0, top + 0.55, -len * 0.15], [0.4, 0, 0]);
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

  p.capsule(0.14, 0.28, NOCHE, [0, seatY + 0.02, seatZ], [half, 0, 0], [1.5, 0.65, 1]);
  p.ball(0.14, NOCHE, [0, seatY + 0.16, seatZ - 0.16], [1.7, 1.1, 0.55], [5, 4]);
  if (look.skin !== "broom") p.torus(0.16, 0.028, NOCHE, [0, seatY + 0.42, seatZ + 0.42], [-0.9, 0, 0]);

  if (look.wing > 0 && look.skin !== "scythe") {
    const big = look.wing === 2;
    const wy = top + (big ? 0.55 : 0.32);
    const wz = -len * 0.42;
    p.capsule(0.05, wid * (big ? 0.7 : 0.45), light, [0, wy, wz], [0, 0, half], [1, 0.7, big ? 2.2 : 1.6]);
  }

  // Escapes: 4 en los pesados, pareja central en Derrapín, 2 en el resto.
  const exhausts: THREE.Vector3[] = [];
  const tilt = -Math.PI / 2 + (25 * Math.PI) / 180;
  const dir = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(tilt, 0, 0));
  const addExhaust = (x: number, y: number, z: number) => {
    const mouth = new THREE.Vector3(x, y, z);
    const center = mouth.clone().addScaledVector(dir, -0.22);
    // Boca abocinada (el toro aparte se comía el presupuesto en los de 4 escapes).
    p.cyl(0.11, 0.13, 0.48, MARFIL, [center.x, center.y, center.z], [tilt, 0, 0]);
    exhausts.push(mouth);
  };
  const ey = y0 + 0.02;
  const ez = -len * 0.46;
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

/** Calavera amable: cuencas, sonrisa de toro, nariz y mejillas. Las pupilas van aparte (emisivas). */
function skull(p: Parts, r: number, cheek: number, scale: Vec3 = [1, 1, 1]) {
  p.ball(r, HUESO, [0, 0, 0], scale, [6, 5]);
  const eyeX = r * 0.34 * scale[0];
  const eyeY = r * 0.08 * scale[1];
  const eyeZ = r * 0.72 * scale[2];
  for (const s of [-1, 1] as const) {
    p.ball(r * 0.3, NOCHE, [s * eyeX, eyeY, eyeZ], [1.05, 1.15, 0.55], [5, 4]);
    p.ball(r * 0.18, cheek, [s * r * 0.62 * scale[0], -r * 0.12, r * 0.48], [1, 0.75, 0.6], [4, 3]);
  }
  p.torus(r * 0.34, r * 0.04, HUESO_S, [0, -r * 0.28, r * 0.7], [0.2, 0, Math.PI], Math.PI);
  p.cone(r * 0.09, r * 0.16, HUESO_S, [0, -r * 0.02, r * 0.86], [Math.PI, 0, 0]);
}

function pupils(r: number, scale: Vec3 = [1, 1, 1]): THREE.BufferGeometry {
  const p = new Parts();
  const eyeX = r * 0.34 * scale[0];
  const eyeY = r * 0.08 * scale[1];
  const eyeZ = r * 0.86 * scale[2];
  for (const s of [-1, 1] as const) p.ball(r * 0.16, 0xffffff, [s * eyeX, eyeY, eyeZ], [1, 1.05, 0.7], [5, 4]);
  return p.build();
}

function buildDriver(c: CharacterDef): BuiltDriver {
  const body = new Parts();
  const head = new Parts();
  const ornaments: THREE.Vector3[] = [];
  let spectral = false;
  let pupil: number = LLAMA;
  let headR = 0.4;
  let headY = 1.05;
  const cheek = mix(HUESO, 0xe7a090, 0.35);
  const arm = (x: number, color: number) => {
    body.capsule(0.07, 0.22, color, [x * 0.32, 0.58, 0.16], [0.7, 0, x * -0.35]);
    body.ball(0.09, HUESO, [x * 0.46, 0.4, 0.34], undefined, [5, 4]);
  };

  switch (c.look as CharacterLook) {
    case "mechanic": {
      body.capsule(0.22, 0.34, c.color, [0, 0.46, 0]);
      arm(-1, c.color);
      arm(1, c.color);
      body.capsule(0.035, 0.42, HUESO, [-0.28, 0.55, -0.22], [0.2, 0, 0.5]);
      body.torus(0.09, 0.028, HUESO, [-0.34, 0.78, -0.2], [0.4, 0, 0.6]);
      skull(head, headR, cheek);
      head.torus(headR * 0.72, 0.035, c.color, [0, headR * 0.15, 0], [halfTurn(), 0, 0]);
      head.ball(0.07, c.accent, [0, headR * 0.15, -headR * 0.85], undefined, [5, 4]);
      ornaments.push(new THREE.Vector3(0.05, headR * 0.35, -headR * 1.15), new THREE.Vector3(-0.02, headR * 0.55, -headR * 1.35), new THREE.Vector3(0.08, headR * 0.15, -headR * 1.05));
      spectral = true;
      pupil = c.accent;
      break;
    }
    case "robot": {
      headR = 0.36;
      body.ball(0.34, c.color, [0, 0.4, 0], [1.15, 0.82, 1], [7, 5]);
      arm(-1, MARFIL);
      arm(1, MARFIL);
      skull(head, headR, cheek, [1.05, 0.95, 0.85]);
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
      skull(head, headR, cheek);
      head.dome(headR * 0.92, c.accent, [0, headR * 0.15, -0.02]);
      head.ball(headR * 0.2, c.accent, [0, headR * 0.08, headR * 0.72], [2.2, 0.28, 1.15], [5, 3]);
      break;
    }
    case "bulldog": {
      body.capsule(0.24, 0.3, c.color, [0, 0.46, 0.02], undefined, [1.15, 1, 1.05]);
      arm(-1, c.color);
      arm(1, c.color);
      body.torus(0.28, 0.045, NOCHE, [0, 0.62, 0.04], [halfTurn(), 0, 0]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        body.cone(0.035, 0.07, HUESO, [Math.cos(a) * 0.3, 0.62, Math.sin(a) * 0.12], [Math.PI / 2, 0, -a]);
      }
      const wide: Vec3 = [1.25, 0.95, 1.05];
      skull(head, headR, cheek, wide);
      for (const s of [-1, 1] as const) head.torus(0.09, 0.02, NOCHE, [s * 0.14, 0.06, headR * 0.7], [halfTurn(), 0, 0]);
      pupil = c.accent;
      break;
    }
    case "granny": {
      body.capsule(0.24, 0.32, c.color, [0, 0.48, 0]);
      arm(-1, c.color);
      arm(1, c.color);
      body.torus(0.26, 0.055, c.accent, [0, 0.7, 0.02], [halfTurn(), 0, 0]);
      skull(head, headR, cheek);
      head.dome(headR * 1.02, MARFIL, [0, 0.02, 0], [1, 0.85, 1.05]);
      for (const s of [-1, 1] as const) head.torus(0.09, 0.018, NOCHE, [s * 0.13, 0.02, headR * 0.72], [halfTurn(), 0, 0]);
      ornaments.push(new THREE.Vector3(-0.08, -0.15, -0.15), new THREE.Vector3(0.1, -0.28, -0.05));
      break;
    }
    case "mascot": {
      body.capsule(0.24, 0.34, c.color, [0, 0.48, 0]);
      arm(-1, c.color);
      arm(1, c.color);
      skull(head, headR, mix(HUESO, BRASA, 0.25));
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + (i / 4) * 1.8;
        ornaments.push(new THREE.Vector3(Math.sin(a) * headR * 0.85, headR * 0.55, -Math.cos(a) * headR * 0.35));
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
      skull(head, headR, c.accent, [1, 0.92, 1]);
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
      skull(head, headR, cheek);
      head.cyl(headR * 0.55, headR * 0.55, 0.22, NOCHE, [0, headR * 0.85, 0]);
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

function kartParts(def: KartDef, color: number) {
  const key = `${def.id}:${color}`;
  let v = kartCache.get(key);
  if (!v) {
    v = buildKartGeometry(def.look, color);
    v.geo.userData.shared = true;
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

/** Kiko es pequeño; Nonna y Don Osario, un poco más grandes. */
const DRIVER_SCALE: Record<string, number> = { kiko: 0.84, "nonna-pina": 1.06, "don-osario": 1.14, mimi: 0.96, brasa: 0.98 };

function pin(parent: THREE.Object3D, pos: THREE.Vector3) {
  const o = new THREE.Object3D();
  o.position.copy(pos);
  parent.add(o);
  return o;
}

function outlined(geo: THREE.BufferGeometry, parent: THREE.Object3D) {
  const shell = new THREE.Mesh(geo, outlineMat);
  shell.scale.setScalar(1.04);
  shell.name = "contorno";
  parent.add(shell);
  parent.add(new THREE.Mesh(geo, partsMat));
  return shell;
}

export function createKartModel(color: number = BRASA, characterId: string = DEFAULT_CHARACTER, kartId: string = DEFAULT_KART): KartModel {
  const character = findCharacter(characterId) ?? findCharacter(DEFAULT_CHARACTER)!;
  const kart = findKart(kartId) ?? findKart(DEFAULT_KART)!;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const parts = kartParts(kart, color);
  body.add(new THREE.Mesh(parts.geo, partsMat));
  const exhausts = parts.exhausts.map((pos) => pin(body, pos));

  const built = driverParts(character);
  const driver = new THREE.Group();
  driver.position.copy(parts.seat);
  driver.scale.setScalar(DRIVER_SCALE[character.id] ?? 1);
  if (character.look === "sheet") driver.position.y += 0.18;
  const shells: THREE.Mesh[] = [];
  const driverBody = new THREE.Group();
  shells.push(outlined(built.body, driverBody));
  driver.add(driverBody);

  const head = new THREE.Group();
  head.position.copy(built.headPos);
  shells.push(outlined(built.head, head));
  const pupilMat = new THREE.MeshBasicMaterial({ color: built.pupil });
  head.add(new THREE.Mesh(built.pupils, pupilMat));
  const ornaments = built.ornaments.map((pos) => pin(head, pos));
  driver.add(head);
  body.add(driver);

  const baseY = driver.position.y;
  const baseScale = driver.scale.x;
  let headScale = 1;
  let headVel = 0;
  let lastTime = 0;

  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.y = 0.9;
  shield.visible = false;
  root.add(shield);

  let mood: Mood = "idle";
  return {
    root,
    body,
    shield,
    rearWheels: parts.rear,
    exhausts,
    ornaments,
    ornamentSpectral: built.spectral,
    head,
    get mood() {
      return mood;
    },
    setOutline(on) {
      for (const s of shells) s.visible = on;
    },
    setMood(next, time) {
      mood = next;
      const dt = Math.min(0.05, Math.max(0, time - lastTime || 0));
      lastTime = time;
      const target = next === "celebrate" ? 1.1 : 1;
      headVel += ((target - headScale) * 46 - headVel * 9) * dt;
      headScale += headVel * dt;
      head.scale.set(1, headScale, 1);
      pupilMat.color.setHex(next === "angry" ? PALETTE.ascua : built.pupil);
      if (next === "celebrate") {
        driver.position.y = baseY + Math.abs(Math.sin(time * 8)) * 0.12;
        driver.rotation.set(0, Math.sin(time * 6) * 0.35, 0);
        driver.scale.set(baseScale, baseScale, baseScale);
      } else if (next === "angry") {
        driver.position.y = baseY;
        driver.rotation.set(0, 0, Math.sin(time * 42) * 0.08);
        driver.scale.setScalar(baseScale);
      } else if (driver.position.y !== baseY || driver.rotation.y !== 0) {
        driver.position.y = baseY;
        driver.rotation.set(0, 0, 0);
        driver.scale.setScalar(baseScale);
      }
    },
  };
}

/** Libera las mallas guardadas (al cerrar el juego o para depurar). */
export function disposeKartModelCache() {
  for (const v of kartCache.values()) v.geo.dispose();
  for (const g of driverCache.values()) {
    g.body.dispose();
    g.head.dispose();
    g.pupils.dispose();
  }
  kartCache.clear();
  driverCache.clear();
}

export function triangleCount(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  if (!pos) return 0;
  return geo.index ? geo.index.count / 3 : pos.count / 3;
}
