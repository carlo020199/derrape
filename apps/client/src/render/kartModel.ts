import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { driverOutlineMaterial, sharedVertexToon } from "./materials";
import {
  DEFAULT_CHARACTER,
  DEFAULT_KART,
  findCharacter,
  findKart,
  type CharacterDef,
  type KartDef,
  type KartLook,
} from "@derrape/shared";

// Coches y pilotos hechos con primitivas (originales, sin assets externos). Cada pieza se fusiona
// en UNA malla con color por vértice y las mallas se comparten entre karts iguales: un kart cuesta
// 2 llamadas de dibujo (coche + piloto) en vez de ~30.

export type Mood = "idle" | "celebrate" | "angry";

export interface KartModel {
  root: THREE.Group;
  /** Parte que se inclina/gira al derrapar (el root sigue el rumbo real). */
  body: THREE.Group;
  /** Posiciones locales de las ruedas traseras, para las chispas. */
  rearWheels: THREE.Vector3[];
  /** Burbuja del escudo (oculta si no hay escudo). */
  shield: THREE.Mesh;
  /** Cambia el gesto del piloto (celebrar, enfadado). `time` en segundos. */
  setMood(mood: Mood, time: number): void;
}

const shieldGeo = new THREE.SphereGeometry(1.7, 16, 12);
shieldGeo.userData.shared = true;
const shieldMat = new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.3, depthWrite: false });
shieldMat.userData.shared = true;
const partsMat = sharedVertexToon();
const outlineMat = driverOutlineMaterial();

const DARK = 0x222831;
const TYRE = 0x1b1b1b;
const METAL = 0x9aa5b1;

type Vec3 = [number, number, number];

/** Acumula piezas y las fusiona en una sola geometría con color por vértice. */
class Parts {
  private list: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(geo: THREE.BufferGeometry, color: number, pos: Vec3, rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
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

  box(w: number, h: number, d: number, color: number, pos: Vec3, rot?: Vec3) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, pos, rot);
  }

  ball(r: number, color: number, pos: Vec3, scale?: Vec3) {
    return this.add(new THREE.SphereGeometry(r, 10, 8), color, pos, [0, 0, 0], scale);
  }

  /** Media esfera (casco, gorra). */
  dome(r: number, color: number, pos: Vec3, scale?: Vec3) {
    return this.add(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, pos, [0, 0, 0], scale);
  }

  /** Cilindro con el eje en Y (usa `rot` para girarlo). */
  cyl(r: number, h: number, color: number, pos: Vec3, rot?: Vec3) {
    return this.add(new THREE.CylinderGeometry(r, r, h, 10), color, pos, rot);
  }

  torus(r: number, tube: number, color: number, pos: Vec3, rot?: Vec3) {
    return this.add(new THREE.TorusGeometry(r, tube, 6, 12), color, pos, rot);
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.list, false)!;
    for (const g of this.list) g.dispose();
    return merged;
  }
}

const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// --- Coche ---

function buildKartGeometry(look: KartLook, color: number): { geo: THREE.BufferGeometry; seat: THREE.Vector3; rear: THREE.Vector3[] } {
  const p = new Parts();
  const { length: len, width: wid, height: hgt } = look;
  const wheelTop = Math.max(look.frontWheel, look.rearWheel);
  const y0 = wheelTop * 0.9 + hgt / 2; // altura del centro del chasis
  const top = y0 + hgt / 2;
  const light = mix(color, 0xffffff, 0.35);
  const half = Math.PI / 2;

  // Chasis y parachoques
  if (look.body === "bars") p.box(look.width * 0.9, hgt, len, color, [0, y0, 0]);
  else p.box(wid, hgt, len, color, [0, y0, 0]);
  p.box(wid + 0.1, 0.12, 0.3, DARK, [0, y0 + 0.05, len / 2 + 0.05]);
  if (look.nose) {
    p.box(wid * 0.55, hgt * 0.8, len * 0.28, light, [0, y0 - 0.02, len / 2 + 0.2]);
    p.box(wid * 0.9, 0.06, 0.28, DARK, [0, y0 - hgt / 2, len / 2 + 0.2]);
  }

  // Ruedas
  const fz = len * 0.33;
  const rz = -len * 0.33;
  const wheel = (r: number, w: number, x: number, z: number) => {
    p.cyl(r, w, TYRE, [x, r, z], [0, 0, half]);
    p.cyl(r * 0.5, w + 0.02, METAL, [x, r, z], [0, 0, half]);
  };
  const fx = wid / 2 + look.frontWheelW / 2 - 0.05;
  const rx = wid / 2 + look.rearWheelW / 2 - 0.05;
  if (look.body === "bars") {
    // Patinete: ruedas en el eje central.
    p.cyl(look.frontWheel, look.frontWheelW, TYRE, [0, look.frontWheel, fz], [0, 0, half]);
    p.cyl(look.rearWheel, look.rearWheelW, TYRE, [0, look.rearWheel, rz], [0, 0, half]);
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
      p.box(wid * 0.92, 0.35, len * 0.36, light, [0, top + 0.17, len * 0.28]); // capó
      for (const s of [-1, 1]) p.box(0.08, 0.9, 0.08, DARK, [s * wid * 0.4, seatY + 0.45, seatZ - 0.45]);
      p.box(wid * 0.85, 0.08, 0.1, DARK, [0, seatY + 0.9, seatZ - 0.45]);
      break;
    }
    case "van": {
      seatZ = len * 0.18;
      p.box(wid * 0.96, 1.15, len * 0.5, light, [0, top + 0.57, -len * 0.2]); // caja de la furgo
      p.box(wid * 1.0, 0.1, len * 0.52, color, [0, top + 1.18, -len * 0.2]); // toldo
      p.box(wid * 0.7, 0.4, 0.05, DARK, [0, top + 0.7, len * 0.05 + 0.02]); // ventanilla de servicio
      p.box(wid * 0.9, 0.25, len * 0.22, color, [0, top + 0.12, len * 0.38]); // morro
      break;
    }
    case "cage": {
      for (const sx of [-1, 1]) {
        p.cyl(0.04, 1.0, DARK, [sx * wid * 0.42, seatY + 0.5, seatZ + 0.45]);
        p.cyl(0.04, 1.0, DARK, [sx * wid * 0.42, seatY + 0.5, seatZ - 0.5]);
        p.cyl(0.04, 0.95, DARK, [sx * wid * 0.42, seatY + 1.0, seatZ - 0.02], [half, 0, 0]);
      }
      p.cyl(0.04, wid * 0.84, DARK, [0, seatY + 1.0, seatZ - 0.5], [0, 0, half]);
      break;
    }
    case "bars": {
      p.cyl(0.04, 0.9, METAL, [0, top + 0.45, fz]);
      p.cyl(0.04, 0.7, DARK, [0, top + 0.9, fz], [0, 0, half]);
      seatZ = -len * 0.12;
      break;
    }
    default:
      break;
  }

  // Asiento y volante
  p.box(0.8, 0.12, 0.7, DARK, [0, seatY, seatZ]);
  p.box(0.8, 0.5, 0.12, DARK, [0, seatY + 0.28, seatZ - 0.32]);
  if (look.body !== "bars") p.torus(0.17, 0.035, DARK, [0, seatY + 0.55, seatZ + 0.62], [-0.9, 0, 0]);

  // Alerón
  if (look.wing > 0) {
    const big = look.wing === 2;
    const wy = top + (big ? 0.85 : 0.5);
    const ww = wid * (big ? 1.3 : 1.0);
    const wz = -len / 2 - 0.05;
    p.box(ww, 0.08, big ? 0.5 : 0.35, color === DARK ? METAL : light, [0, wy, wz]);
    for (const s of [-1, 1]) {
      p.box(0.08, big ? 0.45 : 0.3, 0.1, DARK, [s * wid * 0.3, wy - (big ? 0.22 : 0.15), wz]);
      if (big) p.box(0.06, 0.3, 0.55, color, [s * ww * 0.5, wy + 0.08, wz]);
    }
  }

  return {
    geo: p.build(),
    seat: new THREE.Vector3(0, seatY + 0.08, seatZ),
    rear:
      look.body === "bars"
        ? [new THREE.Vector3(0, 0.1, rz - look.rearWheel)]
        : [new THREE.Vector3(-rx, 0.1, rz - look.rearWheel), new THREE.Vector3(rx, 0.1, rz - look.rearWheel)],
  };
}

// --- Piloto (origen = el asiento; +Z = delante) ---

function buildDriverGeometry(c: CharacterDef): THREE.BufferGeometry {
  const p = new Parts();
  const half = Math.PI / 2;
  const arms = (color: number, y = 0.6, w = 0.16) => {
    for (const s of [-1, 1]) p.box(w, w, 0.5, color, [s * 0.32, y, 0.3], [0.25, s * -0.15, 0]);
  };

  switch (c.look) {
    case "mechanic": {
      p.box(0.52, 0.55, 0.36, c.color, [0, 0.4, 0]); // mono azul
      arms(c.color);
      p.ball(0.27, c.skin, [0, 0.93, 0]);
      p.dome(0.29, 0x5b3a29, [0, 0.95, -0.03], [1, 0.95, 1]); // pelo
      p.ball(0.1, 0x5b3a29, [0, 0.95, -0.32]); // coleta
      p.torus(0.27, 0.045, c.accent, [0, 1.05, 0.02], [half, 0, 0]); // pañuelo en la frente
      p.box(0.1, 0.62, 0.06, METAL, [-0.18, 0.55, -0.26], [0, 0, 0.35]); // llave inglesa
      p.ball(0.09, METAL, [-0.3, 0.87, -0.26]);
      break;
    }
    case "robot": {
      p.ball(0.36, c.color, [0, 0.36, 0], [1, 0.9, 1]);
      arms(c.skin, 0.5, 0.13);
      p.box(0.62, 0.5, 0.5, c.color, [0, 0.95, 0]);
      p.box(0.5, 0.34, 0.05, 0x10202c, [0, 0.95, 0.26]); // pantalla
      p.box(0.1, 0.1, 0.06, c.accent, [-0.12, 0.98, 0.29]); // ojos
      p.box(0.1, 0.1, 0.06, c.accent, [0.12, 0.98, 0.29]);
      p.box(0.2, 0.04, 0.06, c.accent, [0, 0.86, 0.29]); // boca
      p.cyl(0.025, 0.3, METAL, [0, 1.35, 0]); // antena
      p.ball(0.07, 0xe63946, [0, 1.52, 0]);
      for (const s of [-1, 1]) p.cyl(0.08, 0.1, c.skin, [s * 0.36, 0.95, 0], [0, 0, half]);
      break;
    }
    case "courier": {
      p.box(0.52, 0.55, 0.36, c.color, [0, 0.4, 0]);
      arms(c.color);
      p.ball(0.27, c.skin, [0, 0.93, 0]);
      p.dome(0.29, c.accent, [0, 0.97, 0]); // gorra
      p.box(0.34, 0.04, 0.26, c.accent, [0, 0.99, 0.3]); // visera
      p.box(0.62, 0.62, 0.4, c.accent, [0, 0.56, -0.38]); // mochila térmica
      p.box(0.64, 0.12, 0.42, c.color, [0, 0.62, -0.38]);
      break;
    }
    case "bulldog": {
      p.box(0.56, 0.55, 0.38, c.color, [0, 0.4, 0]);
      arms(c.color, 0.6, 0.18);
      p.ball(0.3, c.skin, [0, 0.95, 0], [1.2, 0.95, 1.05]); // cabeza ancha
      p.box(0.32, 0.2, 0.22, mix(c.skin, 0xffffff, 0.3), [0, 0.86, 0.3]); // hocico
      p.ball(0.06, DARK, [0, 0.92, 0.42]); // nariz
      for (const s of [-1, 1]) {
        p.box(0.1, 0.26, 0.16, 0x7a5a3a, [s * 0.36, 0.98, -0.02], [0, 0, s * 0.3]); // orejas
        p.cyl(0.09, 0.05, DARK, [s * 0.14, 1.02, 0.27], [half, 0, 0]); // gafas de aviador
        p.cyl(0.07, 0.06, 0x4cc9f0, [s * 0.14, 1.02, 0.28], [half, 0, 0]);
      }
      p.box(0.46, 0.04, 0.05, DARK, [0, 1.02, 0.2]); // puente de las gafas
      p.torus(0.27, 0.08, c.accent, [0, 0.7, 0], [half, 0, 0]); // bufanda
      p.box(0.14, 0.05, 0.5, c.accent, [0.12, 0.66, -0.4], [0.2, 0, 0]); // cola de la bufanda
      break;
    }
    case "granny": {
      p.box(0.64, 0.6, 0.42, c.color, [0, 0.42, 0]);
      arms(c.color, 0.62, 0.18);
      p.ball(0.28, c.skin, [0, 0.98, 0]);
      p.ball(0.12, 0xe8e8e8, [0, 1.05, -0.3]); // moño
      p.dome(0.32, c.accent, [0, 1.0, 0], [1, 0.9, 1.05]); // casco vintage
      p.torus(0.31, 0.03, DARK, [0, 1.0, 0], [half, 0, 0]);
      p.box(0.5, 0.1, 0.07, DARK, [0, 0.98, 0.26]); // gafas de sol
      p.box(0.14, 0.04, 0.12, mix(c.accent, 0x000000, 0.2), [0, 1.04, 0.31]);
      break;
    }
  }
  return p.build();
}

// --- Caché: una malla por coche+color y una por personaje ---

const kartCache = new Map<string, ReturnType<typeof buildKartGeometry>>();
const driverCache = new Map<string, THREE.BufferGeometry>();

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

function driverGeometry(def: CharacterDef) {
  let g = driverCache.get(def.id);
  if (!g) {
    g = buildDriverGeometry(def);
    g.userData.shared = true;
    driverCache.set(def.id, g);
  }
  return g;
}

/** Tamaño del piloto: Kiko es pequeño y Nonna Pina, algo más grande. */
const DRIVER_SCALE: Record<string, number> = { kiko: 0.85, "nonna-pina": 1.08 };

export function createKartModel(color = 0xff6b35, characterId: string = DEFAULT_CHARACTER, kartId: string = DEFAULT_KART): KartModel {
  const character = findCharacter(characterId) ?? findCharacter(DEFAULT_CHARACTER)!;
  const kart = findKart(kartId) ?? findKart(DEFAULT_KART)!;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const parts = kartParts(kart, color);
  body.add(new THREE.Mesh(parts.geo, partsMat));

  const driver = new THREE.Group();
  driver.position.copy(parts.seat);
  driver.scale.setScalar(DRIVER_SCALE[character.id] ?? 1);
  const driverGeo = driverGeometry(character);
  // Casco invertido solo en el piloto. Escalar 1,04 (en vez de empujar por la normal)
  // porque el piloto actual está hecho de cajas: empujar las caras abre grietas.
  const shell = new THREE.Mesh(driverGeo, outlineMat);
  shell.scale.setScalar(1.04);
  shell.name = "contorno";
  driver.add(shell);
  driver.add(new THREE.Mesh(driverGeo, partsMat));
  body.add(driver);
  const baseY = driver.position.y;
  const baseScale = driver.scale.x;

  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.y = 0.8;
  shield.visible = false;
  root.add(shield);

  let lastMood: Mood = "idle";
  return {
    root,
    body,
    shield,
    rearWheels: parts.rear,
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
  for (const v of kartCache.values()) v.geo.dispose();
  for (const g of driverCache.values()) g.dispose();
  kartCache.clear();
  driverCache.clear();
}
