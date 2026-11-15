import * as THREE from "three";
import { closestPoint, pointAt, type ThemeId, type Track, type TrackDef } from "@derrape/shared";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GlowPoints, PAL, toon } from "./look";
import { leftNormals, type TrackColors } from "./trackMesh";

// Kits de tema: colores del entorno y decoración reutilizable, de noche y con luces. Todo con primitivas
// (original, sin assets externos), sombreado toon e InstancedMesh para que 8 karts + decorado vayan a 60 fps en móvil.

export interface ThemeKit {
  /** Color del horizonte (y de la niebla). */
  sky: number;
  /** Color del cielo en lo alto y del resplandor a ras de horizonte. */
  skyTop: number;
  glow: number;
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

const lit = (color = 0xffffff) => toon(color);
const unlit = (color = 0xffffff) => new THREE.MeshBasicMaterial({ color });
const pick = <T,>(list: readonly T[], r: number) => list[Math.floor(r * list.length)]!;

/** Noche violeta común a los temas. */
const NIGHT = { sky: 0x3d2f6e, skyTop: 0x120c2a, glow: 0x8a55b8 };

// --- Arco de salida (común a todos los temas): postes de hueso con braseros ---
function startArch(scene: THREE.Object3D, track: Track, glows: GlowPoints) {
  const p = pointAt(track, 0);
  const half = p.width / 2 + track.verge * 0.5;
  const nx = Math.cos(p.heading);
  const nz = -Math.sin(p.heading);
  const bone = lit(PAL.hueso);
  const fire = unlit(PAL.brasa);
  for (const side of [-1, 1]) {
    const x = p.x + nx * half * side;
    const z = p.z + nz * half * side;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 6, 10), bone);
    post.position.set(x, p.y + 3, z);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 9), bone);
    skull.position.set(x, p.y + 6.9, z);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 8), fire);
    flame.position.set(x, p.y + 8, z);
    scene.add(post, skull, flame);
    glows.add(x, p.y + 8, z, PAL.brasa);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.6, 1.2, 0.5), lit(PAL.animaProf));
  bar.position.set(p.x, p.y + 6, p.z);
  bar.rotation.y = p.heading;
  scene.add(bar);
}

/** Lucecitas de ascua sobre los dos muros, a lo largo de toda la pista. */
function roadLights(scene: THREE.Object3D, track: Track, every = 3) {
  const left = leftNormals(track);
  const dots = new Batch(new THREE.SphereGeometry(0.16, 8, 6), unlit());
  track.points.forEach((p, i) => {
    if (i % every !== 0) return;
    const off = p.w / 2 + track.verge;
    const color = (i / every) % 2 === 0 ? PAL.llama : PAL.brasa;
    for (const side of [-1, 1]) dots.add(p.x + left[i]!.x * off * side, p.y + 0.95, p.z + left[i]!.z * off * side, 0, 1, 1, 1, color);
  });
  dots.build(scene);
}

// --- Tema de pruebas ---
const pruebas: ThemeKit = {
  ...NIGHT,
  fog: [70, 260],
  ground: 0x2a2145,
  track: { road: 0x3b3454, curbA: PAL.hueso, curbB: PAL.brasa, verge: 0x352a58, wall: PAL.animaProf, groundY: -0.2 },
  decorate(scene, track) {
    const glows = new GlowPoints(7);
    roadLights(scene, track);
    startArch(scene, track, glows);
    glows.build(scene);
  },
};

// --- Tema puerto, de noche: casas con ventanas encendidas, árboles morados, lápidas y laguna espectral ---
const WALLS = [0x54427c, 0x614a86, 0x47396f, 0x6a4f7c, 0x4d4a86];
const ROOFS = [0x241b3d, PAL.animaProf, 0x8a2f4a, 0x2f2452];
const CROWNS = [PAL.animaProf, 0x7d4fe0, 0x4b2f9a, 0x8b5cf0];
const BOATS = [PAL.hueso, PAL.anima, PAL.brasa, PAL.llama, PAL.huesoSombra];
const STONES = [0x9a93b5, 0x857da3, PAL.huesoSombra];

const puerto: ThemeKit = {
  ...NIGHT,
  fog: [70, 290],
  ground: 0x2b2146,
  track: { road: 0x3a3352, curbA: PAL.hueso, curbB: PAL.animaProf, verge: 0x40336a, wall: PAL.huesoSombra, groundY: -0.2 },
  decorate(scene, track, def) {
    const rand = seeded(def.seed);
    const inner = interiorSide(track);
    const left = leftNormals(track);

    // Piezas reutilizables (redondeadas).
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const roof = new THREE.ConeGeometry(0.75, 1, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 0.5, 0);
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 1, 7);
    trunk.translate(0, 0.5, 0);
    const blob = new THREE.IcosahedronGeometry(1, 1);
    const stone = new RoundedBoxGeometry(1, 1.4, 0.32, 2, 0.15);
    stone.translate(0, 0.6, 0);
    const pumpkin = new THREE.SphereGeometry(0.55, 10, 8);
    pumpkin.scale(1, 0.78, 1);
    pumpkin.translate(0, 0.4, 0);
    const hull = new RoundedBoxGeometry(1, 0.6, 2.6, 2, 0.25);
    const sail = new THREE.ConeGeometry(0.9, 3, 3);
    sail.translate(0, 1.5, 0);

    const houses = new Batch(box, lit());
    const roofs = new Batch(roof, lit());
    const windows = new Batch(box, unlit());
    const trunks = new Batch(trunk, lit(0x2a1f3d));
    const crowns = new Batch(blob, lit());
    const stones = new Batch(stone, lit());
    const pumpkins = new Batch(pumpkin, lit(PAL.brasa));
    const posts = new Batch(box, lit(0x1a1428));
    const lanterns = new Batch(box, unlit());
    const hulls = new Batch(hull, lit());
    const sails = new Batch(sail, lit(PAL.hueso));
    const glows = new GlowPoints(6);
    const wisps = new GlowPoints(2.2);

    // Recorrer la pista colocando decoración a los lados.
    const pts = track.points;
    const edge = (i: number) => pts[i]!.w / 2 + track.verge;
    for (let i = 0; i < pts.length; i += 4) {
      const p = pts[i]!;
      const l = left[i]!;
      const heading = Math.atan2(-l.z, l.x) + Math.PI / 2;
      const y = p.y - 0.2;
      const outerSide = -inner;
      const kind = rand();

      if (kind < 0.6) {
        // Casas con tejado puntiagudo y ventanas encendidas hacia la pista.
        const w = 4 + rand() * 5;
        const h = 3.5 + rand() * 6;
        const d = 4 + rand() * 4;
        const off = edge(i) + 3 + d / 2 + rand() * 3;
        const x = p.x + l.x * off * outerSide;
        const z = p.z + l.z * off * outerSide;
        if (clearOfTrack(track, x, z, 2 + Math.max(w, d) / 2)) {
          houses.add(x, y, z, heading, w, h, d, pick(WALLS, rand()));
          roofs.add(x, y + h, z, heading, w * 1.08, 2.2 + rand() * 1.6, d * 1.08, pick(ROOFS, rand()));
          // La cara que mira a la pista está a d/2 en la dirección de la normal.
          const fx = x - l.x * (d / 2 + 0.04) * outerSide;
          const fz = z - l.z * (d / 2 + 0.04) * outerSide;
          const lightColor = rand() < 0.75 ? PAL.llama : PAL.espectro;
          for (const s of [-1, 1]) {
            if (rand() < 0.25) continue;
            const wx = fx + l.z * s * w * 0.24;
            const wz = fz - l.x * s * w * 0.24;
            const wy = y + h * (0.35 + rand() * 0.3);
            windows.add(wx, wy, wz, heading, 0.9, 1.2, 0.12, lightColor);
            glows.add(wx, wy + 0.6, wz, lightColor, 0.35);
          }
        }
      } else if (kind < 0.82) {
        // Árbol morado de copa redonda.
        const off = edge(i) + 2.8 + rand() * 2;
        const x = p.x + l.x * off * outerSide;
        const z = p.z + l.z * off * outerSide;
        if (clearOfTrack(track, x, z, 1.5)) {
          const h = 3.5 + rand() * 2.5;
          const r = 1.9 + rand() * 0.9;
          trunks.add(x, y, z, 0, 1.4, h, 1.4);
          crowns.add(x, y + h + r * 0.5, z, rand() * 3, r, r * 0.85, r, pick(CROWNS, rand()));
          crowns.add(x + r * 0.6, y + h, z + r * 0.3, rand() * 3, r * 0.6, r * 0.55, r * 0.6, pick(CROWNS, rand()));
        }
      } else {
        // Rinconcito de cementerio: lápidas torcidas y una calabaza.
        const base = edge(i) + 2.2;
        for (let k = 0; k < 3; k++) {
          const off = base + rand() * 3.5;
          const along = (k - 1) * 1.7 + rand() * 0.6;
          const x = p.x + l.x * off * outerSide + l.z * along;
          const z = p.z + l.z * off * outerSide - l.x * along;
          if (!clearOfTrack(track, x, z, 1)) continue;
          if (k === 1) {
            pumpkins.add(x, y, z, rand() * 6, 1, 1, 1);
            glows.add(x, y + 0.5, z, PAL.brasa, 0.4);
          } else {
            const s = 0.9 + rand() * 0.6;
            stones.add(x, y, z, heading + (rand() - 0.5) * 0.7, s, s, s, pick(STONES, rand()));
          }
        }
      }

      // Faroles a los dos lados, alternando.
      if (i % 12 === 0) {
        const side = (i / 12) % 2 === 0 ? inner : outerSide;
        const off = edge(i) + 1.2;
        const x = p.x + l.x * off * side;
        const z = p.z + l.z * off * side;
        if (clearOfTrack(track, x, z, 0.5)) {
          posts.add(x, y, z, 0, 0.22, 4.4, 0.22);
          posts.add(x, y + 5.1, z, 0, 0.8, 0.14, 0.8);
          lanterns.add(x, y + 4.4, z, 0, 0.6, 0.7, 0.6, PAL.llama);
          glows.add(x, y + 4.8, z, PAL.brasa);
        }
      }
    }

    // Dársena: laguna espectral dentro del circuito, con barcas y fuegos fatuos.
    if (def.landmarks?.some((m) => m.kind === "darsena")) {
      const poly = pts
        .filter((_, i) => i % 2 === 0)
        .map((p, k) => {
          const l = left[k * 2]!;
          const off = (p.w / 2 + track.verge + 6) * inner;
          return { x: p.x + l.x * off, z: p.z + l.z * off };
        });
      const shape = new THREE.Shape(poly.map((q) => new THREE.Vector2(q.x, -q.z)));
      const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), unlit(0x1a9c8c));
      water.rotation.x = -Math.PI / 2;
      water.position.y = -0.1;
      scene.add(water);

      const xs = poly.map((q) => q.x);
      const zs = poly.map((q) => q.z);
      const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      let placed = 0;
      for (let tries = 0; tries < 600 && placed < 44; tries++) {
        const x = minX + rand() * (maxX - minX);
        const z = minZ + rand() * (maxZ - minZ);
        if (!pointInPolygon(x, z, poly) || !clearOfTrack(track, x, z, 10)) continue;
        if (placed < 14) {
          const rot = rand() * Math.PI * 2;
          const size = 1 + rand() * 1.2;
          hulls.add(x, 0, z, rot, size * 1.3, size, size * 1.3, pick(BOATS, rand()));
          if (rand() < 0.5) sails.add(x, 0.3, z, rot, size * 0.5, size, size * 0.15);
        } else {
          wisps.add(x, 0.6 + rand() * 1.6, z, rand() < 0.8 ? PAL.espectro : PAL.anima, 0.5 + rand() * 0.5);
        }
        placed++;
      }
    }

    // Mar abierto al norte y al este, más allá del espigón.
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const maxX = Math.max(...xs) + track.width / 2 + track.verge + 8;
    const maxZ = Math.max(...zs) + track.width / 2 + track.verge + 8;
    const seaMat = new THREE.MeshLambertMaterial({ color: 0x1b2458 });
    const north = new THREE.Mesh(new THREE.PlaneGeometry(1600, 800), seaMat);
    north.rotation.x = -Math.PI / 2;
    north.position.set(0, -0.1, maxZ + 400);
    const east = new THREE.Mesh(new THREE.PlaneGeometry(800, 1600), seaMat);
    east.rotation.x = -Math.PI / 2;
    east.position.set(maxX + 400, -0.1, 0);
    scene.add(north, east);

    // Faro sobre una roca: franjas de hueso y morado, con luz espectral.
    for (const m of def.landmarks ?? []) {
      if (m.kind !== "faro") continue;
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 2, 10), lit(0x5b4e7a));
      rock.position.set(m.x, 0.6, m.z);
      const tower = new THREE.Group();
      const stripes = 5;
      for (let s = 0; s < stripes; s++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2 - s * 0.2, 2.4 - s * 0.2, 3.2, 12),
          lit(s % 2 === 0 ? PAL.hueso : PAL.animaProf),
        );
        seg.position.y = 1.6 + s * 3.2;
        tower.add(seg);
      }
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 10), unlit(PAL.espectro));
      lamp.position.y = stripes * 3.2 + 0.8;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.6, 10), lit(PAL.ciruela));
      cap.position.y = stripes * 3.2 + 2.4;
      tower.add(lamp, cap);
      tower.position.set(m.x, 1.6, m.z);
      scene.add(rock, tower);
      const beacon = new GlowPoints(22);
      beacon.add(m.x, 1.6 + stripes * 3.2 + 0.8, m.z, PAL.espectro);
      beacon.build(scene);
    }

    for (const b of [houses, roofs, windows, trunks, crowns, stones, pumpkins, posts, lanterns, hulls, sails]) b.build(scene);
    roadLights(scene, track);
    startArch(scene, track, glows);
    glows.build(scene);
    wisps.build(scene);
  },
};

export const THEMES: Record<ThemeId, ThemeKit> = { pruebas, puerto };
