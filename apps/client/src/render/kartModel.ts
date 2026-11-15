import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  DEFAULT_CHARACTER,
  DEFAULT_KART,
  findCharacter,
  findKart,
  type CharacterDef,
  type KartDef,
  type KartLook,
} from "@derrape/shared";
import { PAL, glowTexture, outlineMaterial, toon } from "./look";

// Coches y pilotos hechos con primitivas redondeadas (originales, sin assets externos): karts de
// juguete con parachoques de hueso y pilotos cabezones tipo calavera. Cada conjunto se fusiona en
// UNA malla con color por vértice y las mallas se comparten entre karts iguales. Lo que brilla
// (faros, ojos, llamas) va en una malla aparte sin iluminar. Solo los pilotos llevan contorno.

export type Mood = "idle" | "celebrate" | "angry";

export interface KartModel {
  root: THREE.Group;
  /** Parte que se inclina/gira al derrapar (el root sigue el rumbo real). */
  body: THREE.Group;
  /** Posiciones locales (de `body`) de las ruedas traseras, para las chispas. */
  rearWheels: THREE.Vector3[];
  /** Bocas de los escapes (locales de `body`), para el fuego. */
  exhausts: THREE.Vector3[];
  /** Centro de la cabeza del piloto (local de `body`), para los retratos. */
  head: THREE.Vector3;
  /** Coronilla del piloto si le arde la cabeza (local de `body`). */
  headFlame: THREE.Vector3 | null;
  /** Burbuja del escudo (oculta si no hay escudo). */
  shield: THREE.Mesh;
  /** Sombra redonda (hija de `root`): quien dibuja la baja al suelo durante los saltos. */
  shadow: THREE.Mesh;
  /** Cambia el gesto del piloto (celebrar, enfadado). `time` en segundos. */
  setMood(mood: Mood, time: number): void;
}

const shieldGeo = new THREE.SphereGeometry(1.7, 16, 12);
const shieldMat = new THREE.MeshBasicMaterial({ color: PAL.espectro, transparent: true, opacity: 0.28, depthWrite: false });
const partsMat = toon(0xffffff, true);
const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const lineMat = outlineMaterial(0.028);
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x07050f, map: glowTexture(), transparent: true, opacity: 0.7, depthWrite: false });

const DARK = 0x241d38;
const TYRE = 0x18141f;
const METAL = 0x8f88a8;
const RIM = 0xff8a2a;
const BONE = PAL.hueso;
const SOCKET = 0x1a1326;

type Vec3 = [number, number, number];
const HALF = Math.PI / 2;

/** Acumula piezas y las fusiona en una sola geometría con color por vértice. */
class Parts {
  private list: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(source: THREE.BufferGeometry, color: number, pos: Vec3, rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    // Las cajas redondeadas no llevan índice: se pasa todo a "sin índice" para poder fusionar.
    const geo = source.index ? source.toNonIndexed() : source;
    if (geo !== source) source.dispose();
    this.m.compose(new THREE.Vector3(...pos), this.q.setFromEuler(this.e.set(...rot)), new THREE.Vector3(...scale));
    geo.applyMatrix4(this.m);
    const c = new THREE.Color(color);
    const n = geo.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.list.push(geo);
    return this;
  }

  /** Caja de cantos redondos. */
  rbox(w: number, h: number, d: number, color: number, pos: Vec3, rot?: Vec3, round = 0.38) {
    return this.add(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * round), color, pos, rot);
  }

  ball(r: number, color: number, pos: Vec3, scale?: Vec3) {
    return this.add(new THREE.SphereGeometry(r, 14, 10), color, pos, [0, 0, 0], scale);
  }

  /** Media esfera (pelo, gorro). */
  dome(r: number, color: number, pos: Vec3, rot?: Vec3, scale?: Vec3) {
    return this.add(new THREE.SphereGeometry(r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), color, pos, rot, scale);
  }

  /** Cilindro con el eje en Y (usa `rot` para girarlo). `rTop` distinto = tronco de cono. */
  cyl(r: number, h: number, color: number, pos: Vec3, rot?: Vec3, segments = 12, rTop = r) {
    return this.add(new THREE.CylinderGeometry(rTop, r, h, segments), color, pos, rot);
  }

  cone(r: number, h: number, color: number, pos: Vec3, rot?: Vec3) {
    return this.add(new THREE.ConeGeometry(r, h, 8), color, pos, rot);
  }

  torus(r: number, tube: number, color: number, pos: Vec3, rot?: Vec3) {
    return this.add(new THREE.TorusGeometry(r, tube, 6, 16), color, pos, rot);
  }

  build(): THREE.BufferGeometry | null {
    if (this.list.length === 0) return null;
    const merged = mergeGeometries(this.list, false)!;
    for (const g of this.list) g.dispose();
    return merged;
  }
}

const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// --- Coche ---

interface KartGeometry {
  geo: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
  seat: THREE.Vector3;
  rear: THREE.Vector3[];
  exhausts: THREE.Vector3[];
  /** Largo y ancho totales, para la sombra. */
  size: [number, number];
}

function buildKartGeometry(look: KartLook, color: number): KartGeometry {
  const p = new Parts();
  const g = new Parts();
  const { length: len, width: wid, height: hgt } = look;
  const bars = look.body === "bars";
  const van = look.body === "van";
  const wheelTop = Math.max(look.frontWheel, look.rearWheel);
  const H = hgt + 0.14; // chasis gordito
  const y0 = wheelTop * 0.9 + hgt / 2; // altura del centro del chasis
  const top = y0 + H / 2;
  const cw = bars ? wid * 0.9 : wid;
  const light = mix(color, BONE, 0.45);

  // Chasis y parachoques de hueso
  p.rbox(cw, H, len, color, [0, y0, 0]);
  p.rbox(cw + 0.16, 0.2, 0.3, BONE, [0, y0 - 0.03, len / 2 + 0.02]);
  p.rbox(cw + 0.1, 0.16, 0.24, DARK, [0, y0 - 0.03, -len / 2 - 0.02]);
  let front = len / 2 + 0.17;
  if (look.nose) {
    p.rbox(wid * 0.6, H * 0.85, len * 0.3, light, [0, y0 - 0.02, len / 2 + 0.18]);
    front = len / 2 + 0.18 + len * 0.15;
  }
  if (!bars) {
    // Faros y calavera en el morro.
    for (const s of [-1, 1]) g.ball(0.085, PAL.llama, [s * cw * 0.36, y0 + 0.01, len / 2 + 0.16]);
    p.ball(0.15, BONE, [0, y0 + 0.07, front - 0.02], [1, 0.95, 0.75]);
    p.rbox(0.15, 0.08, 0.1, BONE, [0, y0 - 0.06, front + 0.02]);
    for (const s of [-1, 1]) p.ball(0.042, SOCKET, [s * 0.058, y0 + 0.08, front + 0.075], [1, 1.2, 0.6]);
  }

  // Ruedas: neumático, llanta naranja, tapacubos de hueso y guardabarros
  const fz = len * 0.33;
  const rz = -len * 0.33;
  const wheel = (r: number, w: number, x: number, z: number) => {
    p.cyl(r, w, TYRE, [x, r, z], [0, 0, HALF], 16);
    p.cyl(r * 0.62, w + 0.04, RIM, [x, r, z], [0, 0, HALF], 12);
    p.cyl(r * 0.26, w + 0.07, BONE, [x, r, z], [0, 0, HALF], 8);
    if (!bars) p.rbox(w + 0.1, 0.09, r * 1.7, BONE, [x, r * 2 + 0.05, z]);
  };
  const fx = wid / 2 + look.frontWheelW / 2 - 0.05;
  const rx = wid / 2 + look.rearWheelW / 2 - 0.05;
  if (bars) {
    // Patinete: ruedas en el eje central.
    wheel(look.frontWheel, look.frontWheelW, 0, fz);
    wheel(look.rearWheel, look.rearWheelW, 0, rz);
  } else {
    wheel(look.frontWheel, look.frontWheelW, -fx, fz);
    wheel(look.frontWheel, look.frontWheelW, fx, fz);
    wheel(look.rearWheel, look.rearWheelW, -rx, rz);
    wheel(look.rearWheel, look.rearWheelW, rx, rz);
  }

  // Carrocería extra y posición del asiento
  let seatZ = -len * 0.1;
  const seatY = top + 0.05;
  switch (look.body) {
    case "box": {
      p.rbox(wid * 0.92, 0.36, len * 0.36, light, [0, top + 0.14, len * 0.28]); // capó
      for (const s of [-1, 1]) p.cyl(0.05, 0.9, DARK, [s * wid * 0.4, seatY + 0.45, seatZ - 0.45]);
      p.cyl(0.05, wid * 0.85, DARK, [0, seatY + 0.9, seatZ - 0.45], [0, 0, HALF]);
      break;
    }
    case "van": {
      seatZ = len * 0.18;
      p.rbox(wid * 0.96, 1.15, len * 0.5, light, [0, top + 0.55, -len * 0.2], undefined, 0.2); // caja de la furgo
      p.rbox(wid * 1.02, 0.14, len * 0.54, color, [0, top + 1.16, -len * 0.2]); // toldo
      p.rbox(wid * 0.7, 0.4, 0.06, DARK, [0, top + 0.7, len * 0.05 + 0.02]); // ventanilla de servicio
      p.rbox(wid * 0.9, 0.28, len * 0.22, color, [0, top + 0.1, len * 0.38]); // morro
      g.ball(0.07, PAL.espectro, [0, top + 1.32, -len * 0.2]); // farolillo del techo
      break;
    }
    case "cage": {
      for (const sx of [-1, 1]) {
        p.cyl(0.045, 1.0, DARK, [sx * wid * 0.42, seatY + 0.5, seatZ + 0.45]);
        p.cyl(0.045, 1.0, DARK, [sx * wid * 0.42, seatY + 0.5, seatZ - 0.5]);
        p.cyl(0.045, 0.95, DARK, [sx * wid * 0.42, seatY + 1.0, seatZ - 0.02], [HALF, 0, 0]);
      }
      p.cyl(0.045, wid * 0.84, DARK, [0, seatY + 1.0, seatZ - 0.5], [0, 0, HALF]);
      break;
    }
    case "bars": {
      p.cyl(0.045, 0.9, METAL, [0, top + 0.45, fz]);
      p.cyl(0.045, 0.7, DARK, [0, top + 0.9, fz], [0, 0, HALF]);
      seatZ = -len * 0.12;
      break;
    }
    default:
      break;
  }

  // Asiento y volante
  p.rbox(0.8, 0.14, 0.7, DARK, [0, seatY, seatZ]);
  p.rbox(0.8, 0.5, 0.14, DARK, [0, seatY + 0.28, seatZ - 0.32]);
  if (!bars) p.torus(0.17, 0.04, DARK, [0, seatY + 0.55, seatZ + 0.62], [-0.9, 0, 0]);

  // Escapes: tubos hacia atrás y arriba, con la boca de hueso
  const exX = bars ? [0] : van ? [-cw * 0.38, cw * 0.38] : [-cw * 0.27, cw * 0.27];
  const exY = van ? y0 + 0.14 : top + 0.08;
  const exZ = -len / 2 + (van ? -0.02 : 0.14);
  const tilt = -1.0;
  const ay = Math.cos(tilt);
  const az = Math.sin(tilt);
  const exhausts = exX.map((x) => {
    p.cyl(0.085, 0.5, METAL, [x, exY, exZ], [tilt, 0, 0], 10);
    p.cyl(0.105, 0.09, BONE, [x, exY + ay * 0.24, exZ + az * 0.24], [tilt, 0, 0], 10);
    g.cyl(0.07, 0.03, PAL.brasa, [x, exY + ay * 0.29, exZ + az * 0.29], [tilt, 0, 0], 10);
    return new THREE.Vector3(x, exY + ay * 0.34, exZ + az * 0.34);
  });

  // Alerón
  if (look.wing > 0) {
    const big = look.wing === 2;
    const wy = top + (big ? 0.85 : 0.5);
    const ww = wid * (big ? 1.3 : 1.0);
    const wz = -len / 2 - 0.05;
    p.rbox(ww, 0.1, big ? 0.5 : 0.35, light, [0, wy, wz]);
    for (const s of [-1, 1]) {
      p.rbox(0.08, big ? 0.45 : 0.3, 0.1, DARK, [s * wid * 0.3, wy - (big ? 0.22 : 0.15), wz]);
      if (big) p.rbox(0.07, 0.3, 0.55, color, [s * ww * 0.5, wy + 0.08, wz]);
    }
  }

  return {
    geo: p.build()!,
    glow: g.build(),
    seat: new THREE.Vector3(0, seatY + 0.08, seatZ),
    rear: bars
      ? [new THREE.Vector3(0, 0.1, rz - look.rearWheel)]
      : [new THREE.Vector3(-rx, 0.1, rz - look.rearWheel), new THREE.Vector3(rx, 0.1, rz - look.rearWheel)],
    exhausts,
    size: [len + 0.9, (bars ? wid : wid + look.rearWheelW * 2) + 0.7],
  };
}

// --- Piloto (origen = el asiento; +Z = delante). Cabezón: la cabeza manda. ---

/** Centro y radio de la cabeza. */
const HY = 0.84;
const R = 0.36;

interface DriverGeometry {
  geo: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
}

function buildDriverGeometry(c: CharacterDef): DriverGeometry {
  const p = new Parts();
  const g = new Parts();

  /** Cuerpo pequeño con los brazos al volante y manos de hueso. */
  const body = (color: number, w = 0.46) => {
    p.rbox(w, 0.46, 0.34, color, [0, 0.3, 0]);
    for (const s of [-1, 1]) {
      p.rbox(0.13, 0.13, 0.46, color, [s * 0.22, 0.45, 0.3], [0.05, s * -0.12, 0], 0.45);
      p.ball(0.08, c.skin, [s * 0.17, 0.46, 0.55]);
    }
  };

  /** Calavera simpática: cráneo, mandíbula, cuencas grandes con una chispa dentro. */
  const skull = (eye: number) => {
    p.ball(R, c.skin, [0, HY, 0], [1, 0.95, 1]);
    p.rbox(R * 1.0, R * 0.5, R * 0.75, c.skin, [0, HY - R * 0.75, R * 0.3]);
    for (const s of [-1, 1]) {
      p.ball(R * 0.27, SOCKET, [s * R * 0.4, HY - R * 0.02, R * 0.88], [1, 1.15, 0.5]);
      g.ball(R * 0.1, eye, [s * R * 0.4, HY - R * 0.04, R * 0.99]);
    }
    p.ball(R * 0.07, SOCKET, [0, HY - R * 0.36, R * 0.94], [1, 1.4, 0.5]);
    for (const i of [-1, 0, 1]) p.rbox(0.014, R * 0.3, 0.02, SOCKET, [i * R * 0.24, HY - R * 0.76, R * 0.68], undefined, 0.3);
  };

  switch (c.look) {
    case "mechanic": {
      const hair = c.accent;
      const hair2 = mix(c.accent, 0x0b5d58, 0.4);
      body(c.color);
      skull(PAL.llama);
      // Melena de fuego espectral: casquete echado hacia atrás, mechones y coleta.
      p.dome(R * 1.1, hair, [0, HY + 0.02, -0.05], [-0.5, 0, 0]);
      p.cone(0.13, 0.36, hair, [0.05, HY + R + 0.08, -0.08], [-0.35, 0, -0.2]);
      p.cone(0.1, 0.28, hair2, [-0.15, HY + R + 0.02, -0.02], [-0.2, 0, 0.5]);
      p.cone(0.1, 0.3, hair, [0.22, HY + R * 0.88, -0.1], [-0.3, 0, -0.7]);
      for (const s of [-1, 1]) p.ball(0.12, hair, [s * R * 0.98, HY - 0.14, 0.02], [0.7, 1.4, 0.9]);
      p.ball(0.18, hair, [0.02, HY + 0.08, -R - 0.1]);
      p.ball(0.15, hair2, [0.09, HY - 0.12, -R - 0.22]);
      p.ball(0.12, hair, [0.03, HY - 0.3, -R - 0.27]);
      p.cone(0.09, 0.24, hair2, [-0.03, HY - 0.46, -R - 0.27], [Math.PI + 0.3, 0, 0]);
      p.torus(R * 1.0, 0.045, PAL.animaProf, [0, HY + 0.15, 0], [HALF - 0.25, 0, 0]); // cinta
      p.rbox(0.09, 0.6, 0.06, METAL, [-0.2, 0.5, -0.24], [0, 0, 0.35]); // llave inglesa
      p.torus(0.09, 0.035, METAL, [-0.31, 0.8, -0.24]);
      break;
    }
    case "ghost": {
      const shade = c.skin;
      p.ball(0.42, c.color, [0, 0.78, 0]);
      p.cyl(0.46, 0.5, c.color, [0, 0.52, 0], undefined, 14, 0.42);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        p.ball(0.14, i % 2 ? shade : c.color, [Math.sin(a) * 0.35, 0.28, Math.cos(a) * 0.35]);
      }
      p.cone(0.1, 0.24, c.color, [0.04, 1.22, -0.1], [-0.6, 0, 0]); // rabito
      for (const s of [-1, 1]) {
        p.ball(0.075, SOCKET, [s * 0.15, 0.85, 0.37], [1, 1.45, 0.5]);
        p.ball(0.06, 0xff9fbe, [s * 0.28, 0.71, 0.31], [1, 0.7, 0.4]); // mofletes
        p.ball(0.11, c.color, [s * 0.36, 0.56, 0.24], [1, 1, 1.7]); // bracitos
      }
      p.ball(0.06, SOCKET, [0, 0.67, 0.4], [1.2, 0.9, 0.5]); // boca
      // Farol
      p.cyl(0.018, 0.26, DARK, [0.52, 0.82, 0.16]);
      p.cyl(0.1, 0.045, DARK, [0.52, 0.7, 0.16], undefined, 8);
      p.cyl(0.1, 0.045, DARK, [0.52, 0.47, 0.16], undefined, 8);
      g.cyl(0.08, 0.19, c.accent, [0.52, 0.585, 0.16], undefined, 8);
      break;
    }
    case "blaze": {
      body(c.color);
      p.torus(0.21, 0.075, PAL.animaProf, [0, 0.54, 0.02], [HALF, 0, 0]); // pañuelo
      skull(PAL.llama);
      // Cabeza en llamas (sin iluminar: es luz).
      g.ball(R * 0.92, PAL.brasa, [0, HY + R * 0.42, -0.04], [1, 0.55, 1]);
      g.cone(0.2, 0.52, PAL.brasa, [0, HY + R + 0.14, -0.06]);
      g.cone(0.13, 0.4, PAL.llama, [0, HY + R + 0.06, 0.04]);
      for (const s of [-1, 1]) {
        g.cone(0.13, 0.38, PAL.brasa, [s * 0.25, HY + R * 0.82, -0.04], [0, 0, -s * 0.55]);
        g.cone(0.08, 0.26, PAL.llama, [s * 0.13, HY + R * 0.98, 0.1], [0.2, 0, -s * 0.3]);
      }
      g.cone(0.15, 0.44, PAL.ascua, [0, HY + R * 0.75, -0.28], [-0.7, 0, 0]);
      break;
    }
    case "aviator": {
      const cap = mix(c.color, 0x000000, 0.2);
      body(c.color);
      p.torus(0.21, 0.08, c.accent, [0, 0.54, 0.02], [HALF, 0, 0]); // bufanda
      p.rbox(0.14, 0.06, 0.5, c.accent, [0.14, 0.5, -0.38], [0.25, 0, 0]);
      skull(PAL.espectro);
      p.dome(R * 1.08, cap, [0, HY + 0.02, -0.03], [-0.28, 0, 0]); // gorro de cuero
      for (const s of [-1, 1]) {
        p.rbox(0.1, 0.32, 0.26, cap, [s * R * 1.0, HY - 0.12, -0.04]); // orejeras
        p.cyl(0.11, 0.07, DARK, [s * 0.14, HY + 0.21, R * 0.86], [HALF - 0.38, 0, 0]); // gafas en la frente
        p.cyl(0.082, 0.08, PAL.llama, [s * 0.14, HY + 0.215, R * 0.87], [HALF - 0.38, 0, 0]);
      }
      p.torus(R * 1.07, 0.035, DARK, [0, HY + 0.19, -0.01], [HALF - 0.12, 0, 0]);
      break;
    }
    case "hooded": {
      const rim = mix(c.color, 0xffffff, 0.3);
      body(c.color, 0.56);
      skull(c.accent);
      p.ball(R * 1.2, c.color, [0, HY + 0.03, -0.16]); // capucha
      p.cone(0.17, 0.36, c.color, [0, HY + R * 0.95, -0.46], [-1.1, 0, 0]);
      p.torus(R * 0.98, 0.06, rim, [0, HY + 0.04, 0.1]);
      p.ball(0.07, PAL.llama, [0, 0.52, 0.19]); // broche
      break;
    }
  }
  return { geo: p.build()!, glow: g.build() };
}

// --- Caché: una malla por coche+color y una por personaje ---

const kartCache = new Map<string, KartGeometry>();
const driverCache = new Map<string, DriverGeometry>();

function kartParts(def: KartDef, color: number) {
  const key = `${def.id}:${color}`;
  let v = kartCache.get(key);
  if (!v) kartCache.set(key, (v = buildKartGeometry(def.look, color)));
  return v;
}

function driverGeometry(def: CharacterDef) {
  let g = driverCache.get(def.id);
  if (!g) driverCache.set(def.id, (g = buildDriverGeometry(def)));
  return g;
}

/** Tamaño del piloto: Kiko es pequeño y Nonna Pina, algo más grande. */
const DRIVER_SCALE: Record<string, number> = { kiko: 0.9, "nonna-pina": 1.08 };

export function createKartModel(color = 0xff6b35, characterId: string = DEFAULT_CHARACTER, kartId: string = DEFAULT_KART): KartModel {
  const character = findCharacter(characterId) ?? findCharacter(DEFAULT_CHARACTER)!;
  const kart = findKart(kartId) ?? findKart(DEFAULT_KART)!;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const parts = kartParts(kart, color);
  body.add(new THREE.Mesh(parts.geo, partsMat));
  if (parts.glow) body.add(new THREE.Mesh(parts.glow, glowMat));

  // Sombra redonda bajo el kart (más barata que sombras de verdad).
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.scale.set(parts.size[1], 1, parts.size[0]);
  shadow.position.y = 0.07;
  root.add(shadow);

  const driver = new THREE.Group();
  const scale = DRIVER_SCALE[character.id] ?? 1;
  driver.position.copy(parts.seat);
  driver.scale.setScalar(scale);
  const pilot = driverGeometry(character);
  driver.add(new THREE.Mesh(pilot.geo, partsMat), new THREE.Mesh(pilot.geo, lineMat));
  if (pilot.glow) driver.add(new THREE.Mesh(pilot.glow, glowMat));
  body.add(driver);
  const baseY = driver.position.y;
  const baseScale = scale;
  const headFlame =
    character.look === "blaze" ? parts.seat.clone().add(new THREE.Vector3(0, (HY + R * 1.1) * scale, -0.05)) : null;

  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.y = 0.8;
  shield.visible = false;
  root.add(shield);

  let lastMood: Mood = "idle";
  return {
    root,
    body,
    shield,
    shadow,
    rearWheels: parts.rear,
    exhausts: parts.exhausts,
    head: parts.seat.clone().add(new THREE.Vector3(0, HY * scale, 0)),
    headFlame,
    setMood(mood, time) {
      if (mood === "celebrate") {
        driver.position.y = baseY + Math.abs(Math.sin(time * 8)) * 0.25;
        driver.rotation.set(0, Math.sin(time * 6) * 0.5, Math.sin(time * 5) * 0.12);
        driver.scale.setScalar(baseScale);
      } else if (mood === "angry") {
        driver.position.y = baseY;
        driver.rotation.set(0, 0, Math.sin(time * 45) * 0.14);
        driver.scale.setScalar(baseScale * 1.12);
      } else if (lastMood !== "idle") {
        driver.position.y = baseY;
        driver.rotation.set(0, 0, 0);
        driver.scale.setScalar(baseScale);
      }
      lastMood = mood;
    },
  };
}

/** Libera las mallas guardadas (al cerrar el juego o para depurar). */
export function disposeKartModelCache() {
  for (const v of [...kartCache.values(), ...driverCache.values()]) {
    v.geo.dispose();
    v.glow?.dispose();
  }
  kartCache.clear();
  driverCache.clear();
}
