import * as THREE from "three";
import { closestPoint, pointAt, type ThemeId, type Track, type TrackDef } from "@derrape/shared";
import { leftNormals, type TrackColors } from "./trackMesh";

// Kits de tema: colores del entorno y decoración reutilizable. Todo con primitivas low-poly
// (original, sin assets externos) e InstancedMesh para que 8 karts + decorado vayan a 60 fps en móvil.

export interface ThemeKit {
  sky: number;
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

const lambert = (color = 0xffffff) => new THREE.MeshLambertMaterial({ color });

// --- Arco de salida (común a todos los temas) ---
function startArch(scene: THREE.Object3D, track: Track, color: number) {
  const p = pointAt(track, 0);
  const half = p.width / 2 + track.verge * 0.5;
  const nx = Math.cos(p.heading);
  const nz = -Math.sin(p.heading);
  const mat = lambert(color);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), mat);
    post.position.set(p.x + nx * half * side, p.y + 3, p.z + nz * half * side);
    scene.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.6, 1.2, 0.5), lambert(0x1b1f3a));
  bar.position.set(p.x, p.y + 6, p.z);
  bar.rotation.y = p.heading + Math.PI / 2;
  scene.add(bar);
}

// --- Tema de pruebas ---
const pruebas: ThemeKit = {
  sky: 0x8fd3ff,
  fog: [80, 260],
  ground: 0x6cbf4a,
  track: { road: 0x4a4e5a, curbA: 0xe8e8e8, curbB: 0xd6402f, verge: 0x5fae3f, wall: 0x2e86de, groundY: -0.2 },
  decorate(scene, track) {
    startArch(scene, track, 0xff6b35);
  },
};

// --- Tema puerto mediterráneo ---
const WALLS = [0xfaf7ef, 0xf3ead2, 0xf6e1c3, 0xe9f1f4, 0xf7d9c4];
const ROOFS = [0xc8553d, 0xb5462f, 0xd06b4a];
const BOATS = [0xffffff, 0x2e86de, 0xe63946, 0xffd23f, 0x2a9d8f];

const puerto: ThemeKit = {
  sky: 0x9ad7ff,
  fog: [90, 300],
  ground: 0xe6d3a3,
  track: { road: 0x55585f, curbA: 0xf4f1e8, curbB: 0xc8553d, verge: 0xd9c38f, wall: 0xf2efe6, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const inner = interiorSide(track);
    const left = leftNormals(track);

    // Piezas reutilizables.
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const roof = new THREE.ConeGeometry(0.75, 1, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 0.5, 0);
    const trunk = new THREE.CylinderGeometry(0.15, 0.22, 1, 6);
    trunk.translate(0, 0.5, 0);
    const leaves = new THREE.IcosahedronGeometry(1, 0);
    const hull = new THREE.BoxGeometry(1, 0.6, 2.6);
    const sail = new THREE.ConeGeometry(0.9, 3, 3);
    sail.translate(0, 1.5, 0);

    const houses = new Batch(box, lambert());
    const roofs = new Batch(roof, lambert());
    const trunks = new Batch(trunk, lambert(0x8b5e3c));
    const palms = new Batch(leaves, lambert(0x3f8f3a));
    const lamps = new Batch(box, lambert(0x2b2d42));
    const hulls = new Batch(hull, lambert());
    const sails = new Batch(sail, lambert(0xfdfdfd));

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
      const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: 0x2a8fbd }));
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
    const seaMat = new THREE.MeshLambertMaterial({ color: 0x1f7fb5 });
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
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 2, 8), lambert(0x8d8a80));
      rock.position.set(m.x, 0.6, m.z);
      const tower = new THREE.Group();
      const stripes = 5;
      for (let s = 0; s < stripes; s++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2 - s * 0.2, 2.4 - s * 0.2, 3.2, 10),
          lambert(s % 2 === 0 ? 0xffffff : 0xd62828),
        );
        seg.position.y = 1.6 + s * 3.2;
        tower.add(seg);
      }
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
      lamp.position.y = stripes * 3.2 + 0.8;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.6, 8), lambert(0x1b1f3a));
      cap.position.y = stripes * 3.2 + 2.4;
      tower.add(lamp, cap);
      tower.position.set(m.x, 1.6, m.z);
      scene.add(rock, tower);
    }

    for (const b of [houses, roofs, trunks, palms, lamps, hulls, sails]) b.build(scene);
    startArch(scene, track, 0x2a9d8f);
  },
};

export const THEMES: Record<ThemeId, ThemeKit> = { pruebas, puerto };
