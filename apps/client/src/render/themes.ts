import * as THREE from "three";
import { closestPoint, pointAt, type ThemeId, type Track, type TrackDef } from "@derrape/shared";
import { PALETTE, sharedVertexToon, toonMaterial } from "./materials";
import { decorateAnimas } from "./animas";
import { dressTrack, unitSoft } from "./props";
import { leftNormals, type TrackColors } from "./trackMesh";

// Kits de tema: colores del entorno y decoración reutilizable. Todo con primitivas low-poly
// (original, sin assets externos) e InstancedMesh para que 8 karts + decorado vayan a 60 fps en móvil.

export interface ThemeKit {
  /** Color del cenit. */
  sky: number;
  /** Horizonte y color de la niebla. */
  horizon: number;
  /** Distancias de la niebla (cerca, lejos), en metros. */
  fog: [number, number];
  ground: number;
  track: TrackColors;
  decorate(scene: THREE.Object3D, track: Track, def: TrackDef): void;
}

/** Generador aleatorio con semilla: la decoración sale siempre igual. */
function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Lado interior del circuito (-1 o 1, como `lateral`), según el sentido en que se recorre. */
function interiorSide(track: Track): number {
  let area = 0;
  const pts = track.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    area += a.x * b.z - b.x * a.z;
  }
  return area > 0 ? -1 : 1;
}

/** Junta muchas copias de una pieza en una sola malla. */
class Batch {
  private matrices: THREE.Matrix4[] = [];
  private colors: THREE.Color[] = [];
  constructor(private readonly geo: THREE.BufferGeometry, private readonly mat: THREE.Material) {}
  add(x: number, y: number, z: number, rotY = 0, sx = 1, sy = 1, sz = 1, color?: number) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(sx, sy, sz),
    );
    this.matrices.push(m);
    this.colors.push(new THREE.Color(color ?? 0xffffff));
  }
  build(parent: THREE.Object3D) {
    if (this.matrices.length === 0) return;
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, this.matrices.length);
    this.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, this.colors[i]!);
    });
    parent.add(mesh);
  }
}

/** ¿Está libre este punto (lejos de cualquier tramo de pista)? */
function clearOfTrack(track: Track, x: number, z: number, margin: number) {
  const c = closestPoint(track, x, z);
  return Math.abs(c.lateral) > c.width / 2 + track.verge + margin;
}

function pointInPolygon(x: number, z: number, poly: { x: number; z: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

const toon = (color = 0xffffff) => toonMaterial({ color });

const HUESO = 0xf3e7d3;
const ASCUA = 0xd9362b;
const SOMBRA = 0x2e2547;
/** Un poco más lejos que 45–190, para que las siluetas a contraluz se lean. */
const NIEBLA: [number, number] = [68, 240];

/**
 * Giro de la barra del arco. La caja es ancha en X y, con `rotation.y = heading`,
 * ese eje queda en (cos h, 0, −sin h): la normal lateral de la pista, de poste a poste.
 * Sumar π/2 la ponía a lo largo del trazado y se veía como una cuña negra en el cielo.
 */
export function archBarYaw(heading: number): number {
  return heading;
}

// --- Arco de salida (común a todos los temas) ---
function startArch(scene: THREE.Object3D, track: Track, color: number) {
  const p = pointAt(track, 0);
  const half = p.width / 2 + track.verge * 0.5;
  const nx = Math.cos(p.heading);
  const nz = -Math.sin(p.heading);
  const mat = toon(color);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 5.2, 1, 6), mat);
    post.position.set(p.x + nx * half * side, p.y + 3, p.z + nz * half * side);
    scene.add(post);
  }
  // Cápsula ~30 % más fina que la caja de 1,2 m, con el canto de abajo en Sombra.
  const bar = new THREE.Mesh(archBarGeometry(half * 2 + 0.6), sharedVertexToon());
  bar.position.set(p.x, p.y + 6, p.z);
  bar.rotation.y = archBarYaw(p.heading);
  scene.add(bar);
}

/** Barra del arco: cápsula en Hueso con el canto inferior en Sombra. Una sola malla. */
function archBarGeometry(length: number): THREE.BufferGeometry {
  const radius = 0.42;
  const straight = Math.max(0.3, length - radius * 2);
  const geo = new THREE.CapsuleGeometry(radius, straight, 3, 8);
  geo.rotateZ(Math.PI / 2);
  const pos = geo.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const bone = new THREE.Color(HUESO);
  const sombra = new THREE.Color(SOMBRA);
  for (let i = 0; i < pos.count; i++) {
    const c = pos.getY(i) < -radius * 0.45 ? sombra : bone;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Marcas planas de turbo sobre la pista (sin tocar trackMesh). */
function boostPadMarkers(scene: THREE.Object3D, track: Track, color = 0xffe066) {
  const pad = new THREE.BoxGeometry(1, 1, 1);
  pad.translate(0, 0.5, 0);
  const batch = new Batch(pad, toon());
  for (const z of track.zones) {
    if (z.type !== "boostPad") continue;
    const end = z.to < z.from ? z.to + track.length : z.to;
    for (let d = z.from; d < end; d += 2.5) {
      const p = pointAt(track, d % track.length);
      batch.add(p.x, p.y + 0.02, p.z, p.heading, p.width * 0.55, 0.04, 2.2, color);
    }
  }
  batch.build(scene);
}

// --- Tema de pruebas ---
const pruebas: ThemeKit = {
  sky: 0x2b2547,
  horizon: 0x3a3160,
  fog: NIEBLA,
  ground: 0x3b3552,
  track: { road: 0x2a2633, curbA: HUESO, curbB: 0x3ff2c8, verge: 0x322c48, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track) {
    startArch(scene, track, 0x3ff2c8);
  },
};

// --- Tema puerto mediterráneo ---
const WALLS = [0x2a3144, 0x32283f, 0x3a3048, 0x243044, 0x3a2a32];
const ROOFS = [0x6a3030, 0x4a2840, 0x5a3828];
const BOATS = [0xf3e7d3, 0x2e2547, 0xff6a1f, 0x1e1830, 0x3ff2c8];

const puerto: ThemeKit = {
  sky: 0x1f3550,
  horizon: 0x2d4a6b,
  fog: NIEBLA,
  ground: 0x3a3a4e,
  track: { road: 0x2b2d3a, curbA: HUESO, curbB: 0xffb423, verge: 0x2e2e40, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const inner = interiorSide(track);
    const left = leftNormals(track);

    // Piezas reutilizables.
    const box = unitSoft();
    const roof = new THREE.ConeGeometry(0.75, 1, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 0.5, 0);
    const trunk = new THREE.CylinderGeometry(0.15, 0.22, 1, 6);
    trunk.translate(0, 0.5, 0);
    const leaves = new THREE.IcosahedronGeometry(1, 0);
    const hull = new THREE.BoxGeometry(1, 0.6, 2.6);
    const sail = new THREE.ConeGeometry(0.9, 3, 3);
    sail.translate(0, 1.5, 0);

    const houses = new Batch(box, toon());
    const roofs = new Batch(roof, toon());
    const trunks = new Batch(trunk, toon(0x8b5e3c));
    const palms = new Batch(leaves, toon(0x3f8f3a));
    const lamps = new Batch(box, toon(0x2b2d42));
    const hulls = new Batch(hull, toon());
    const sails = new Batch(sail, toon(0xfdfdfd));

    // Recorrer la pista colocando decoración a los lados.
    const pts = track.points;
    const edge = (i: number) => pts[i]!.w / 2 + track.verge;
    for (let i = 0; i < pts.length; i += 4) {
      const p = pts[i]!;
      const l = left[i]!;
      const heading = Math.atan2(-l.z, l.x) + Math.PI / 2;

      // Exterior: casas encaladas con tejado de teja, a veces palmeras.
      const outerSide = -inner;
      if (rand() < 0.75) {
        const w = 4 + rand() * 5;
        const h = 3 + rand() * 6;
        const d = 4 + rand() * 4;
        const off = edge(i) + 3 + d / 2 + rand() * 3;
        const x = p.x + l.x * off * outerSide;
        const z = p.z + l.z * off * outerSide;
        if (clearOfTrack(track, x, z, 2 + Math.max(w, d) / 2)) {
          const wall = WALLS[Math.floor(rand() * WALLS.length)]!;
          houses.add(x, p.y - 0.2, z, heading, w, h, d, wall);
          roofs.add(x, p.y - 0.2 + h, z, heading, w, 1.6 + rand(), d, ROOFS[Math.floor(rand() * ROOFS.length)]!);
        }
      } else {
        const off = edge(i) + 2.5;
        const x = p.x + l.x * off * outerSide;
        const z = p.z + l.z * off * outerSide;
        if (clearOfTrack(track, x, z, 1.5)) {
          const h = 5 + rand() * 3;
          trunks.add(x, p.y - 0.2, z, 0, 1, h, 1);
          palms.add(x, p.y + h - 0.2, z, rand() * 3, 2.4, 0.7, 2.4);
        }
      }

      // Interior (lado del puerto): farolas cada cierto tramo.
      if (i % 12 === 0) {
        const off = edge(i) + 1.2;
        const x = p.x + l.x * off * inner;
        const z = p.z + l.z * off * inner;
        if (clearOfTrack(track, x, z, 0.5)) {
          lamps.add(x, p.y - 0.2, z, 0, 0.25, 5, 0.25);
          lamps.add(x, p.y + 4.6, z, 0, 0.6, 0.4, 0.6, 0xffe08a);
        }
      }
    }

    // Dársena: agua dentro del circuito, con barcos.
    if (def.landmarks?.some((m) => m.kind === "darsena")) {
      const poly = pts
        .filter((_, i) => i % 2 === 0)
        .map((p, k) => {
          const l = left[k * 2]!;
          const off = (p.w / 2 + track.verge + 6) * inner;
          return { x: p.x + l.x * off, z: p.z + l.z * off };
        });
      const shape = new THREE.Shape(poly.map((q) => new THREE.Vector2(q.x, -q.z)));
      const water = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: 0x2bd9b5, transparent: true, opacity: 0.72 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = -0.1;
      scene.add(water);

      const xs = poly.map((q) => q.x);
      const zs = poly.map((q) => q.z);
      const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      let placed = 0;
      for (let tries = 0; tries < 400 && placed < 14; tries++) {
        const x = minX + rand() * (maxX - minX);
        const z = minZ + rand() * (maxZ - minZ);
        if (!pointInPolygon(x, z, poly) || !clearOfTrack(track, x, z, 10)) continue;
        const rot = rand() * Math.PI * 2;
        const size = 1 + rand() * 1.2;
        hulls.add(x, 0, z, rot, size * 1.3, size, size * 1.3, BOATS[Math.floor(rand() * BOATS.length)]!);
        if (rand() < 0.5) sails.add(x, 0.3, z, rot, size * 0.5, size, size * 0.15);
        placed++;
      }
    }

    // Mar abierto al norte y al este, más allá del espigón.
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const maxX = Math.max(...xs) + track.width / 2 + track.verge + 8;
    const maxZ = Math.max(...zs) + track.width / 2 + track.verge + 8;
    const seaMat = toonMaterial({ color: 0x0e2030 });
    const north = new THREE.Mesh(new THREE.PlaneGeometry(1600, 800), seaMat);
    north.rotation.x = -Math.PI / 2;
    north.position.set(0, -0.1, maxZ + 400);
    const east = new THREE.Mesh(new THREE.PlaneGeometry(800, 1600), seaMat);
    east.rotation.x = -Math.PI / 2;
    east.position.set(maxX + 400, -0.1, 0);
    scene.add(north, east);

    // Faro sobre una roca.
    for (const m of def.landmarks ?? []) {
      if (m.kind !== "faro") continue;
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 2, 8), toon(0x2a2838));
      rock.position.set(m.x, 0.6, m.z);
      const tower = new THREE.Group();
      const stripes = 5;
      for (let s = 0; s < stripes; s++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2 - s * 0.2, 2.4 - s * 0.2, 3.2, 10),
          toon(s % 2 === 0 ? PALETTE.hueso : PALETTE.sombra),
        );
        seg.position.y = 1.6 + s * 3.2;
        tower.add(seg);
      }
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 8), new THREE.MeshBasicMaterial({ color: PALETTE.espectro }));
      lamp.position.y = stripes * 3.2 + 0.8;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.6, 8), toon(PALETTE.noche));
      cap.position.y = stripes * 3.2 + 2.4;
      tower.add(lamp, cap);
      tower.position.set(m.x, 1.6, m.z);
      scene.add(rock, tower);
    }

    for (const b of [houses, roofs, trunks, palms, lamps, hulls, sails]) b.build(scene);
    startArch(scene, track, 0xffb423);
  },
};

// --- Tema playa ---
const UMBRELLA = [0x1e1830, 0xf3e7d3, 0xff6a1f, 0x9b6bff, 0x2e2547];

const playa: ThemeKit = {
  sky: 0x4a2f5c,
  horizon: 0x6b4370,
  fog: NIEBLA,
  ground: 0xc9a06b,
  track: { road: 0x3a3040, curbA: HUESO, curbB: 0xff7a4d, verge: 0xa88858, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();
    const pole = new THREE.CylinderGeometry(0.08, 0.1, 1, 6);
    pole.translate(0, 0.5, 0);
    const cone = new THREE.ConeGeometry(1, 1, 8);
    cone.translate(0, 0.5, 0);
    const bush = new THREE.IcosahedronGeometry(1, 0);

    const dunes = new Batch(cone, toon());
    const poles = new Batch(pole, toon(0x8b5e3c));
    const tops = new Batch(cone, toon());
    const shrubs = new Batch(bush, toon(0x6a9a3e));
    const rocks = new Batch(box, toon(0xa89f8c));

    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i]!;
      const l = left[i]!;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        if (rand() < 0.55) {
          const off = edge + 4 + rand() * 8;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (!clearOfTrack(track, x, z, 2)) continue;
          const s = 2.5 + rand() * 4;
          dunes.add(x, p.y - 0.3, z, rand() * 6, s, 1.2 + rand() * 1.5, s, 0xe2c98a);
        }
        if (i % 9 === 0 && rand() < 0.7) {
          const off = edge + 2 + rand() * 3;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 1)) shrubs.add(x, p.y, z, 0, 1.2, 0.8, 1.2);
        }
        if (i % 15 === 0 && rand() < 0.4) {
          const off = edge + 1.5;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 0.6)) rocks.add(x, p.y - 0.1, z, rand(), 1.2, 0.6, 0.9);
        }
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind !== "sombrilla") continue;
      const scale = m.scale ?? 1;
      for (let k = 0; k < 5; k++) {
        const ox = (rand() - 0.5) * 14 * scale;
        const oz = (rand() - 0.5) * 14 * scale;
        const x = m.x + ox;
        const z = m.z + oz;
        if (!clearOfTrack(track, x, z, 2)) continue;
        const h = 3.2 * scale;
        poles.add(x, 0, z, 0, 1, h, 1);
        tops.add(x, h * 0.85, z, rand() * 3, 2.2 * scale, 1.1 * scale, 2.2 * scale, UMBRELLA[k % UMBRELLA.length]!);
      }
    }

    // Franja de mar al sur.
    const zs = pts.map((p) => p.z);
    const minZ = Math.min(...zs) - track.width / 2 - track.verge - 10;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 600), toon(0x1a2040));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.15, minZ - 280);
    scene.add(sea);

    for (const b of [dunes, poles, tops, shrubs, rocks]) b.build(scene);
    startArch(scene, track, 0xff7a4d);
  },
};

// --- Tema mercado ---
const AWNINGS = [0xd9362b, 0x1e1830, 0xff6a1f, 0x6b3fd6, 0x9b6bff];
const STALL = [0x2e2547, 0x1e1830, 0x3a3044];

const mercado: ThemeKit = {
  sky: 0x3a2342,
  horizon: 0x553060,
  fog: NIEBLA,
  ground: 0x4a3a44,
  track: { road: 0x2e2834, curbA: HUESO, curbB: 0xff5a7a, verge: 0x3a2e36, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();
    const roof = new THREE.BoxGeometry(1, 0.15, 1);
    roof.translate(0, 0.5, 0);

    const stalls = new Batch(box, toon());
    const awnings = new Batch(roof, toon());
    const crates = new Batch(box, toon());

    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i]!;
      const l = left[i]!;
      const heading = Math.atan2(-l.z, l.x) + Math.PI / 2;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        if (rand() > 0.7) continue;
        const w = 2.5 + rand() * 2;
        const d = 2 + rand() * 2;
        const h = 2.2 + rand() * 1.2;
        const off = edge + 1.8 + d / 2;
        const x = p.x + l.x * off * side;
        const z = p.z + l.z * off * side;
        if (!clearOfTrack(track, x, z, 1.5)) continue;
        stalls.add(x, p.y - 0.15, z, heading, w, h, d, STALL[Math.floor(rand() * STALL.length)]!);
        awnings.add(x, p.y - 0.15 + h, z, heading, w * 1.15, 1, d * 1.1, AWNINGS[Math.floor(rand() * AWNINGS.length)]!);
        if (rand() < 0.45) {
          crates.add(x + Math.cos(heading) * 1.4, p.y - 0.1, z + Math.sin(heading) * 1.4, heading, 0.7, 0.7, 0.7, 0x8d6e4c);
        }
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind !== "plaza") continue;
      // Plaza: toldos en círculo alrededor del centro.
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const r = 10 + (k % 3);
        const x = m.x + Math.cos(a) * r;
        const z = m.z + Math.sin(a) * r;
        if (!clearOfTrack(track, x, z, 2)) continue;
        stalls.add(x, 0, z, a, 3.5, 2.4, 3, STALL[k % STALL.length]!);
        awnings.add(x, 2.4, z, a, 4.2, 1, 3.4, AWNINGS[k % AWNINGS.length]!);
      }
      const fountain = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 1.2, 10), toon(0xb0bec5));
      fountain.position.set(m.x, 0.4, m.z);
      scene.add(fountain);
    }

    for (const b of [stalls, awnings, crates]) b.build(scene);
    startArch(scene, track, 0xff5a7a);
  },
};

// --- Tema viñedos ---
const vinedos: ThemeKit = {
  sky: 0x3b1f3a,
  horizon: 0x57304f,
  fog: NIEBLA,
  ground: 0x3e4a2b,
  track: { road: 0x2e2a30, curbA: HUESO, curbB: 0xe04e8a, verge: 0x323c22, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();
    const post = new THREE.CylinderGeometry(0.06, 0.08, 1, 5);
    post.translate(0, 0.5, 0);
    const leaf = new THREE.IcosahedronGeometry(1, 0);
    const roof = new THREE.ConeGeometry(0.75, 1, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 0.5, 0);

    const vines = new Batch(leaf, toon(0x5a3470));
    const posts = new Batch(post, toon(0x6b4f2a));
    const walls = new Batch(box, toon());
    const roofs = new Batch(roof, toon(0x722f37));
    const cypress = new Batch(leaf, toon(0x1f4d2c));

    for (let i = 0; i < pts.length; i += 2) {
      const p = pts[i]!;
      const l = left[i]!;
      const heading = Math.atan2(-l.z, l.x) + Math.PI / 2;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        // Hileras de viña.
        for (let row = 0; row < 3; row++) {
          const off = edge + 2.5 + row * 2.2;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (!clearOfTrack(track, x, z, 0.8)) continue;
          posts.add(x, p.y - 0.15, z, 0, 1, 1.6, 1);
          vines.add(x, p.y + 1.1, z, heading, 1.4, 0.7, 0.5);
        }
        if (i % 14 === 0 && rand() < 0.5) {
          const off = edge + 12;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 1.5)) cypress.add(x, p.y, z, 0, 1.2, 5 + rand() * 3, 1.2);
        }
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind !== "bodega") continue;
      const s = m.scale ?? 1;
      const rot = m.rotation ?? 0;
      walls.add(m.x, 0, m.z, rot, 14 * s, 5 * s, 9 * s, 0x3a2840);
      roofs.add(m.x, 5 * s, m.z, rot, 15 * s, 3 * s, 10 * s);
      // Torre lateral.
      walls.add(m.x + 8 * s, 0, m.z - 3 * s, rot, 4 * s, 9 * s, 4 * s, 0x2e2038);
      roofs.add(m.x + 8 * s, 9 * s, m.z - 3 * s, rot, 5 * s, 2.5 * s, 5 * s);
    }

    for (const b of [posts, vines, walls, roofs, cypress]) b.build(scene);
    startArch(scene, track, 0xe04e8a);
  },
};

// --- Tema feria ---
const TENTS = [0xff6a1f, 0xffb423, 0x3ff2c8, 0x9b6bff, 0xf3e7d3];

const feria: ThemeKit = {
  sky: 0x2a1e4f,
  horizon: 0x3e2d6e,
  fog: NIEBLA,
  ground: 0x33284a,
  track: { road: 0x272236, curbA: HUESO, curbB: 0xff5fa2, verge: 0x281e3c, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();
    const cone = new THREE.ConeGeometry(0.75, 1, 4);
    cone.translate(0, 0.5, 0);
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    cyl.translate(0, 0.5, 0);

    const booths = new Batch(box, toon());
    const roofs = new Batch(cone, toon());
    const poles = new Batch(cyl, toon(0xf8f7f4));
    const lights = new Batch(box, toon());

    for (let i = 0; i < pts.length; i += 4) {
      const p = pts[i]!;
      const l = left[i]!;
      const heading = Math.atan2(-l.z, l.x) + Math.PI / 2;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        if (rand() < 0.65) {
          const off = edge + 3 + rand() * 2;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (!clearOfTrack(track, x, z, 1.5)) continue;
          const color = TENTS[Math.floor(rand() * TENTS.length)]!;
          booths.add(x, p.y - 0.15, z, heading, 3, 2.5, 3, color);
          roofs.add(x, p.y + 2.3, z, heading, 3.4, 1.8, 3.4, color);
        }
        if (i % 8 === 0) {
          const off = edge + 1.1;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 0.4)) {
            poles.add(x, p.y - 0.2, z, 0, 0.25, 4.5, 0.25);
            lights.add(x, p.y + 4, z, 0, 0.5, 0.5, 0.5, TENTS[Math.floor(rand() * TENTS.length)]!);
          }
        }
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind === "noria") {
        // Noria: aro + cabinas.
        const rim = new THREE.Mesh(new THREE.TorusGeometry(12, 0.6, 6, 24), toon(PALETTE.hueso));
        rim.position.set(m.x, 14, m.z);
        rim.rotation.y = Math.PI / 2;
        scene.add(rim);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 8), toon(PALETTE.sombra));
        hub.position.set(m.x, 14, m.z);
        hub.rotation.z = Math.PI / 2;
        scene.add(hub);
        const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 14, 1, 5), toon(PALETTE.hueso));
        legL.position.set(m.x - 4, 8, m.z);
        legL.rotation.z = 0.35;
        const legR = legL.clone();
        legR.position.set(m.x + 4, 8, m.z);
        legR.rotation.z = -0.35;
        scene.add(legL, legR);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const cx = m.x;
          const cy = 14 + Math.sin(a) * 12;
          const cz = m.z + Math.cos(a) * 12;
          booths.add(cx, cy - 1, cz, 0, 2, 2, 2, TENTS[k % TENTS.length]!);
        }
      }
      if (m.kind === "tienda") {
        booths.add(m.x, 0, m.z, m.rotation ?? 0, 8, 4, 8, 0xff4d6d);
        roofs.add(m.x, 4, m.z, m.rotation ?? 0, 9, 4, 9, 0xffd60a);
      }
    }

    boostPadMarkers(scene, track, 0x80ffdb);
    for (const b of [booths, roofs, poles, lights]) b.build(scene);
    startArch(scene, track, 0xff5fa2);
  },
};

// --- Tema estación ---
const estacion: ThemeKit = {
  sky: 0x26303d,
  horizon: 0x3a4757,
  fog: NIEBLA,
  ground: 0x3a3b44,
  track: { road: 0x2a2c33, curbA: HUESO, curbB: 0x9ef0ff, verge: 0x2e2f36, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();
    const cyl = new THREE.CylinderGeometry(0.15, 0.15, 1, 6);
    cyl.translate(0, 0.5, 0);

    const buildings = new Batch(box, toon());
    const roofs = new Batch(box, toon(0x3d3d3d));
    const rails = new Batch(box, toon(0x2b2b2b));
    const sleepers = new Batch(box, toon(0x6b4f2a));
    const cars = new Batch(box, toonMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
    const lamps = new Batch(cyl, toon(0x444444));

    for (let i = 0; i < pts.length; i += 4) {
      const p = pts[i]!;
      const l = left[i]!;
      const heading = Math.atan2(-l.z, l.x) + Math.PI / 2;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        if (rand() < 0.5) {
          const w = 5 + rand() * 6;
          const h = 4 + rand() * 5;
          const d = 4 + rand() * 4;
          const off = edge + 4 + d / 2;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (!clearOfTrack(track, x, z, 2 + Math.max(w, d) / 2)) continue;
          buildings.add(x, p.y - 0.2, z, heading, w, h, d, rand() < 0.5 ? 0xc5b9a0 : 0x9aa0a6);
          roofs.add(x, p.y - 0.2 + h, z, heading, w * 1.05, 0.5, d * 1.05);
        }
        if (i % 10 === 0) {
          const off = edge + 1.2;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 0.4)) {
            lamps.add(x, p.y - 0.2, z, 0, 1, 5, 1);
            buildings.add(x, p.y + 4.6, z, 0, 0.5, 0.4, 0.5, 0xffe08a);
          }
        }
      }
    }

    // Vías junto a los hazards (pasos a nivel) + vagones sencillos.
    for (const h of track.hazards) {
      const mid = (h.from + (h.to < h.from ? h.to + track.length : h.to)) / 2;
      const p = pointAt(track, mid % track.length);
      const nx = Math.cos(p.heading);
      const nz = -Math.sin(p.heading);
      for (const lat of [-1, 1] as const) {
        const lx = -nz * lat;
        const lz = nx * lat;
        for (let t = -8; t <= 8; t += 1.5) {
          const x = p.x + nx * t + lx * (p.width / 2 + track.verge + 3);
          const z = p.z + nz * t + lz * (p.width / 2 + track.verge + 3);
          sleepers.add(x, p.y - 0.05, z, p.heading, 2.2, 0.15, 0.35);
        }
        for (const railOff of [-0.7, 0.7]) {
          for (let t = -8; t <= 8; t += 2) {
            const x = p.x + nx * t + lx * (p.width / 2 + track.verge + 3) + (-nz) * railOff;
            const z = p.z + nz * t + lz * (p.width / 2 + track.verge + 3) + nx * railOff;
            rails.add(x, p.y + 0.05, z, p.heading, 0.12, 0.12, 2);
          }
        }
        // Vagones aparcados cerca del cruce.
        const bx = p.x + lx * (p.width / 2 + track.verge + 3) - nx * 12;
        const bz = p.z + lz * (p.width / 2 + track.verge + 3) - nz * 12;
        cars.add(bx, p.y, bz, p.heading, 2.6, 2.4, 8, lat > 0 ? PALETTE.espectro : PALETTE.anima);
        cars.add(bx + nx * 9, p.y, bz + nz * 9, p.heading, 2.6, 2.4, 8, PALETTE.hueso);
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind !== "estacion") continue;
      const s = m.scale ?? 1;
      buildings.add(m.x, 0, m.z, m.rotation ?? 0, 18 * s, 7 * s, 10 * s, 0xd6cfc2);
      roofs.add(m.x, 7 * s, m.z, m.rotation ?? 0, 19 * s, 0.8 * s, 11 * s);
      // Marquesina.
      buildings.add(m.x, 4.5 * s, m.z + 7 * s, m.rotation ?? 0, 16 * s, 0.3 * s, 4 * s, 0xadb5bd);
      for (let k = -2; k <= 2; k++) {
        lamps.add(m.x + k * 3.5 * s, 0, m.z + 7 * s, 0, 1, 4.5 * s, 1);
      }
    }

    for (const b of [buildings, roofs, rails, sleepers, cars, lamps]) b.build(scene);
    startArch(scene, track, 0x9ef0ff);
  },
};

// --- Tema nieve ---
const nieve: ThemeKit = {
  sky: 0x33406a,
  horizon: 0x56659a,
  fog: NIEBLA,
  ground: 0xdde6f5,
  track: { road: 0x3a3f55, curbA: HUESO, curbB: ASCUA, verge: 0xc5d0e4, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();
    const trunk = new THREE.CylinderGeometry(0.2, 0.28, 1, 6);
    trunk.translate(0, 0.5, 0);
    const pine = new THREE.SphereGeometry(0.85, 6, 5);
    pine.translate(0, 1, 0);
    const roof = new THREE.ConeGeometry(0.75, 1, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 0.5, 0);

    const trunks = new Batch(trunk, toon(0x5c4030));
    const pines = new Batch(pine, toon(0x1f4d3a));
    const snowcaps = new Batch(pine, toon(0xf5fbff));
    const cabins = new Batch(box, toon(0x8b5a2b));
    const roofs = new Batch(roof, toon(0xffffff));
    const rocks = new Batch(box, toon(0x9aa4b0));

    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i]!;
      const l = left[i]!;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        if (rand() < 0.7) {
          const off = edge + 3 + rand() * 10;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (!clearOfTrack(track, x, z, 1.5)) continue;
          const h = 3 + rand() * 5;
          trunks.add(x, p.y - 0.2, z, 0, 1, h * 0.45, 1);
          pines.add(x, p.y + h * 0.2, z, 0, 2 + rand(), h * 0.7, 2 + rand());
          snowcaps.add(x, p.y + h * 0.55, z, 0, 1.2, h * 0.25, 1.2);
        }
        if (i % 12 === 0 && rand() < 0.4) {
          const off = edge + 1.5;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 0.6)) rocks.add(x, p.y - 0.1, z, rand(), 1.4, 0.8, 1.1);
        }
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind !== "cabanas") continue;
      for (let k = 0; k < 4; k++) {
        const ox = (k % 2) * 10 - 5;
        const oz = Math.floor(k / 2) * 12 - 6;
        const x = m.x + ox;
        const z = m.z + oz;
        if (!clearOfTrack(track, x, z, 3)) continue;
        cabins.add(x, 0, z, 0.2 * k, 6, 3.5, 5, 0x8b5a2b);
        roofs.add(x, 3.5, z, 0.2 * k, 7, 2.5, 6);
      }
    }

    for (const b of [trunks, pines, snowcaps, cabins, roofs, rocks]) b.build(scene);
    startArch(scene, track, 0x7fe7ff);
  },
};

// --- Tema cañón ---
const ROCK = [0xc45c26, 0xa3471c, 0xd9793a, 0x8d3b16];

const canon: ThemeKit = {
  sky: 0x5a2a2e,
  horizon: 0x7a3b37,
  fog: NIEBLA,
  ground: 0xb4553a,
  track: { road: 0x3a2a2a, curbA: HUESO, curbB: 0xff9a3d, verge: 0x8e4030, wall: SOMBRA, groundY: -0.4 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();
    const cyl = new THREE.CylinderGeometry(0.5, 0.7, 1, 6);
    cyl.translate(0, 0.5, 0);

    const mesas = new Batch(cyl, toon());
    const cactus = new Batch(box, toon(0x3a7d44));

    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i]!;
      const l = left[i]!;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        if (rand() < 0.6) {
          const off = edge + 5 + rand() * 12;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (!clearOfTrack(track, x, z, 3)) continue;
          const h = 4 + rand() * 14;
          const r = 2 + rand() * 4;
          mesas.add(x, p.y - 0.4, z, rand(), r, h, r, ROCK[Math.floor(rand() * ROCK.length)]!);
        }
        if (i % 11 === 0 && rand() < 0.5) {
          const off = edge + 2;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 0.5)) {
            cactus.add(x, p.y - 0.1, z, 0, 0.5, 2.5 + rand() * 2, 0.5);
            if (rand() < 0.5) cactus.add(x + 0.4, p.y + 1, z, 0, 0.35, 1.2, 0.35);
          }
        }
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind !== "arco") continue;
      const s = m.scale ?? 1;
      // Arco natural: dos pilares + dintel.
      const leftP = new THREE.Mesh(new THREE.CylinderGeometry(3 * s, 4 * s, 16 * s, 7), toon(0xb5451b));
      leftP.position.set(m.x - 7 * s, 8 * s, m.z);
      const rightP = new THREE.Mesh(new THREE.CylinderGeometry(3 * s, 4 * s, 16 * s, 7), toon(0xc45c26));
      rightP.position.set(m.x + 7 * s, 8 * s, m.z);
      scene.add(leftP, rightP);
      for (let k = 0; k < 5; k++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(7.5 * s, 0.38 * s, 4, 12, Math.PI), toon(PALETTE.hueso));
        rib.position.set(m.x, 14 * s, m.z + (k - 2) * 1.3 * s);
        rib.rotation.x = Math.PI / 2;
        scene.add(rib);
      }
    }

    for (const b of [mesas, cactus]) b.build(scene);
    startArch(scene, track, 0xff9a3d);
  },
};

// --- Tema volcán ---
const volcan: ThemeKit = {
  sky: 0x2a0f12,
  horizon: 0x4a1a17,
  fog: NIEBLA,
  ground: 0x3a2a2a,
  track: { road: 0x2a2020, curbA: HUESO, curbB: 0xff5a1f, verge: 0x2a1e1e, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();
    const trunk = new THREE.CylinderGeometry(0.2, 0.3, 1, 6);
    trunk.translate(0, 0.5, 0);
    const canopy = new THREE.IcosahedronGeometry(1, 0);
    const rock = new THREE.ConeGeometry(1, 1.5, 5);
    rock.translate(0, 0.75, 0);

    const trunks = new Batch(trunk, toon(0x4a3728));
    const leaves = new Batch(canopy, toon(0x1b5e20));
    const rocks = new Batch(rock, toon(0x4a4038));
    const lava = new Batch(box, new THREE.MeshBasicMaterial({ color: 0xffffff }));

    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i]!;
      const l = left[i]!;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        if (rand() < 0.55) {
          const off = edge + 3 + rand() * 8;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (!clearOfTrack(track, x, z, 1.5)) continue;
          const h = 4 + rand() * 6;
          trunks.add(x, p.y - 0.2, z, 0, 1, h, 1);
          leaves.add(x, p.y + h - 0.2, z, rand(), 3, 2, 3);
        }
        if (rand() < 0.35) {
          const off = edge + 2 + rand() * 4;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 1)) rocks.add(x, p.y - 0.2, z, rand(), 1.5 + rand(), 1 + rand(), 1.5 + rand());
        }
      }
    }

    // Manchas de lava en zonas fall/slow.
    for (const z of track.zones) {
      if (z.type !== "fall" && z.type !== "slow") continue;
      const end = z.to < z.from ? z.to + track.length : z.to;
      for (let d = z.from; d < end; d += 4) {
        const lat = (z.lateralMin + z.lateralMax) / 2;
        const p = pointAt(track, d % track.length, lat);
        lava.add(p.x, p.y - 0.05, p.z, p.heading, 4, 0.12, 3.5, PALETTE.brasa);
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind !== "volcan") continue;
      const s = m.scale ?? 1;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(28 * s, 40 * s, 8), toon(0x3e2723));
      cone.position.set(m.x, 20 * s, m.z);
      const crater = new THREE.Mesh(new THREE.CylinderGeometry(6 * s, 8 * s, 3 * s, 8), toon(0xff3d00));
      crater.position.set(m.x, 38 * s, m.z);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(4 * s, 4 * s, 1 * s, 8), new THREE.MeshBasicMaterial({ color: PALETTE.brasa }));
      glow.position.set(m.x, 39.5 * s, m.z);
      scene.add(cone, crater, glow);
    }

    for (const b of [trunks, leaves, rocks, lava]) b.build(scene);
    startArch(scene, track, 0xff5a1f);
  },
};

// --- Tema neón / ciudad nocturna ---
const NEON = [0xff2d95, 0x00f5d4, 0xfee440, 0x9b5de5, 0x00bbf9];
const TOWER = [0x1a1d29, 0x222636, 0x2a2f42, 0x161821];

const neon: ThemeKit = {
  sky: 0x0e0b1f,
  horizon: 0x1c1638,
  fog: NIEBLA,
  ground: 0x1a1628,
  track: { road: 0x1e1a2a, curbA: HUESO, curbB: 0xff2d95, verge: 0x14111e, wall: SOMBRA, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const left = leftNormals(track);
    const pts = track.points;

    const box = unitSoft();

    const towers = new Batch(box, toon());
    const accents = new Batch(box, toon());
    const lamps = new Batch(box, toon());

    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i]!;
      const l = left[i]!;
      const heading = Math.atan2(-l.z, l.x) + Math.PI / 2;
      const edge = p.w / 2 + track.verge;
      for (const side of [-1, 1] as const) {
        if (rand() < 0.75) {
          const w = 4 + rand() * 6;
          const h = 8 + rand() * 28;
          const d = 4 + rand() * 6;
          const off = edge + 4 + d / 2 + rand() * 4;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (!clearOfTrack(track, x, z, 2 + Math.max(w, d) / 2)) continue;
          towers.add(x, p.y - 0.2, z, heading, w, h, d, TOWER[Math.floor(rand() * TOWER.length)]!);
          // Franja de neón en la cornisa.
          accents.add(x, p.y - 0.2 + h, z, heading, w * 1.02, 0.35, d * 1.02, NEON[Math.floor(rand() * NEON.length)]!);
          if (rand() < 0.4) {
            accents.add(x, p.y + h * 0.4, z + (d / 2 + 0.1) * Math.cos(heading), heading, w * 0.6, 1.2, 0.2, NEON[Math.floor(rand() * NEON.length)]!);
          }
        }
        if (i % 8 === 0) {
          const off = edge + 1.1;
          const x = p.x + l.x * off * side;
          const z = p.z + l.z * off * side;
          if (clearOfTrack(track, x, z, 0.4)) {
            lamps.add(x, p.y - 0.2, z, 0, 0.2, 5, 0.2, 0x333849);
            lamps.add(x, p.y + 4.6, z, 0, 0.55, 0.35, 0.55, NEON[Math.floor(rand() * NEON.length)]!);
          }
        }
      }
    }

    for (const m of def.landmarks ?? []) {
      if (m.kind !== "rascacielos") continue;
      const s = m.scale ?? 1;
      const h = 55 * s;
      towers.add(m.x, 0, m.z, m.rotation ?? 0, 10 * s, h, 10 * s, 0x1a1d29);
      accents.add(m.x, h, m.z, m.rotation ?? 0, 10.5 * s, 1.2 * s, 10.5 * s, 0xff2d95);
      towers.add(m.x + 8 * s, 0, m.z + 6 * s, 0.2, 7 * s, h * 0.7, 7 * s, 0x222636);
      accents.add(m.x + 8 * s, h * 0.7, m.z + 6 * s, 0.2, 7.4 * s, 0.8 * s, 7.4 * s, 0x00f5d4);
      // Antena.
      lamps.add(m.x, h, m.z, 0, 0.4 * s, 10 * s, 0.4 * s, 0x9b5de5);
    }

    boostPadMarkers(scene, track, 0x00f5d4);
    for (const b of [towers, accents, lamps]) b.build(scene);
    startArch(scene, track, 0xff2d95);
  },
};

function withDress(id: ThemeId, kit: ThemeKit): ThemeKit {
  return {
    ...kit,
    decorate(scene, track, def) {
      kit.decorate(scene, track, def);
      dressTrack(scene, track, id);
    },
  };
}

const animas: ThemeKit = {
  sky: 0x1a1430,
  horizon: 0x2c2350,
  // Un poco más lejos que 40 m: si no, el peralte de la siguiente curva se pierde en la niebla.
  fog: [50, 190],
  ground: 0x1a1430,
  track: {
    road: 0x3a3352,
    curbA: 0xf3e7d3,
    curbB: 0x3ff2c8,
    innerCurbA: 0xf3e7d3,
    innerCurbB: 0x1e1830,
    verge: 0x2a2338,
    wall: 0x2e2547,
    groundY: -8,
    curbWidth: 0.8,
    racingLine: 0x433b5e,
    centreDash: { color: 0xc8b597, opacity: 0.45, length: 3, period: 6 },
    animasAsphalt: true,
    bankEdge: true,
  },
  decorate(scene, track, def) {
    decorateAnimas(scene, track, def);
  },
};

export const THEMES: Record<ThemeId, ThemeKit> = {
  pruebas: withDress("pruebas", pruebas),
  puerto: withDress("puerto", puerto),
  playa: withDress("playa", playa),
  mercado: withDress("mercado", mercado),
  vinedos: withDress("vinedos", vinedos),
  feria: withDress("feria", feria),
  estacion: withDress("estacion", estacion),
  nieve: withDress("nieve", nieve),
  canon: withDress("canon", canon),
  volcan: withDress("volcan", volcan),
  neon: withDress("neon", neon),
  animas,
};
