import * as THREE from "three";
import { closestPoint, type ThemeId, type Track } from "@derrape/shared";
import { PALETTE, toonMaterial } from "./materials";
import { leftNormals } from "./trackMesh";

// Props redondeados de fantasía oscura. Una malla instanciada por forma
// (esfera, cápsula, cristal, farol) para no multiplicar llamadas de dibujo.

type Kind = "tomb" | "pumpkin" | "tree" | "skull" | "lantern" | "fence" | "cactus" | "crystal" | "rock" | "umbrella";

const MIX: Record<ThemeId, { kinds: Kind[]; spectral: boolean; leaf: number }> = {
  pruebas: { kinds: ["tomb", "fence", "skull", "pumpkin", "lantern"], spectral: true, leaf: 0x243028 },
  puerto: { kinds: ["lantern", "fence", "skull", "tomb"], spectral: true, leaf: 0x1e3344 },
  playa: { kinds: ["umbrella", "skull", "pumpkin", "rock"], spectral: false, leaf: 0x3a3050 },
  mercado: { kinds: ["lantern", "pumpkin", "tomb", "lantern", "skull"], spectral: false, leaf: 0x3a2438 },
  vinedos: { kinds: ["tree", "pumpkin", "fence", "skull"], spectral: false, leaf: 0x4a2458 },
  feria: { kinds: ["lantern", "pumpkin", "skull", "umbrella"], spectral: false, leaf: 0x3a1848 },
  estacion: { kinds: ["lantern", "tomb", "fence", "skull"], spectral: true, leaf: 0x2a3038 },
  nieve: { kinds: ["tree", "crystal", "skull", "fence"], spectral: true, leaf: 0x2c3c58 },
  canon: { kinds: ["cactus", "rock", "skull", "tomb"], spectral: false, leaf: 0x5a3028 },
  volcan: { kinds: ["rock", "skull", "lantern", "cactus"], spectral: false, leaf: 0x2a1814 },
  neon: { kinds: ["lantern", "skull", "fence", "crystal"], spectral: true, leaf: 0x241430 },
  animas: { kinds: ["lantern", "skull", "tomb", "pumpkin"], spectral: true, leaf: 0x9b6bff },
};

function sharedGeo(g: THREE.BufferGeometry) {
  g.userData.shared = true;
  return g;
}

const sphere = sharedGeo(new THREE.SphereGeometry(0.5, 6, 5));
const capsule = sharedGeo(new THREE.CapsuleGeometry(0.32, 0.45, 1, 5));
const crystal = sharedGeo(new THREE.OctahedronGeometry(0.45, 0));
const umbrella = sharedGeo(new THREE.ConeGeometry(0.7, 0.55, 8));
umbrella.translate(0, 0.3, 0);

class TintBatch {
  private matrices: THREE.Matrix4[] = [];
  private colors: THREE.Color[] = [];
  constructor(
    private geo: THREE.BufferGeometry,
    private mat: THREE.Material,
  ) {}
  add(x: number, y: number, z: number, rotY: number, sx: number, sy: number, sz: number, color: number) {
    this.matrices.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
        new THREE.Vector3(sx, sy, sz),
      ),
    );
    this.colors.push(new THREE.Color(color));
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

function clearOfTrack(track: Track, x: number, z: number) {
  const c = closestPoint(track, x, z);
  return Math.abs(c.lateral) > c.width / 2 + track.verge + 0.45;
}

/** Cápsula con la base en el suelo y aproximadamente 1×1×1 antes de escalar. */
export function unitSoft(): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(0.32, 0.36, 1, 5);
  g.scale(1 / 0.64, 1, 1 / 0.64);
  g.translate(0, 0.5, 0);
  return g;
}

/**
 * Reparte el kit del tema por el borde de la pista.
 * Identidad (puerto, nieve, neón…) la siguen dando los colores y los landmarks;
 * aquí van las piezas comunes redondeadas.
 */
export function dressTrack(scene: THREE.Object3D, track: Track, theme: ThemeId) {
  const recipe = MIX[theme];
  const soft = new TintBatch(sphere, toonMaterial({ color: 0xffffff }));
  const posts = new TintBatch(capsule, toonMaterial({ color: 0xffffff }));
  const ice = new TintBatch(crystal, toonMaterial({ color: 0xffffff }));
  const shades = new TintBatch(umbrella, toonMaterial({ color: 0xffffff }));
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const glow = new TintBatch(sphere, glowMat);
  const left = leftNormals(track);
  const pts = track.points;
  const flame = recipe.spectral ? PALETTE.espectro : PALETTE.llama;
  let n = 0;

  const place = (kind: Kind, x: number, y: number, z: number, rot: number) => {
    if (kind === "tomb") posts.add(x, y, z, rot, 1.45, 2.3, 0.7, PALETTE.hueso);
    else if (kind === "pumpkin") {
      soft.add(x, y + 0.45, z, rot, 1.2, 1, 1.2, 0xe07a2f);
      posts.add(x, y + 0.7, z, rot, 0.12, 0.35, 0.12, 0x3a5a28);
    } else if (kind === "tree") {
      posts.add(x, y, z, rot + 0.4, 0.28, 2.4, 0.28, 0x3a2a22);
      posts.add(x + 0.15, y + 0.4, z, rot - 0.8, 0.18, 1.6, 0.18, 0x2e221c);
      soft.add(x, y + 2.15, z, rot, 1.35, 1.05, 1.25, recipe.leaf);
      if (theme === "nieve") soft.add(x, y + 2.55, z, rot, 0.7, 0.45, 0.7, 0xe7eef8);
    } else if (kind === "skull") {
      soft.add(x, y + 0.55, z, rot, 0.95, 0.88, 0.85, PALETTE.hueso);
      soft.add(x - 0.18, y + 0.7, z + 0.28, rot, 0.16, 0.2, 0.1, PALETTE.sombra);
      soft.add(x + 0.18, y + 0.7, z + 0.28, rot, 0.16, 0.2, 0.1, PALETTE.sombra);
    } else if (kind === "lantern") {
      posts.add(x, y, z, rot, 0.14, 2.6, 0.14, PALETTE.marfil);
      glow.add(x, y + 2.45, z, rot, 0.42, 0.5, 0.42, flame);
    } else if (kind === "fence") {
      posts.add(x, y, z, rot, 0.16, 1.15, 0.16, PALETTE.hueso);
      soft.add(x, y + 1.15, z, rot, 0.32, 0.3, 0.3, PALETTE.hueso);
    } else if (kind === "cactus") {
      posts.add(x, y, z, rot, 0.38, 1.8, 0.38, 0x2f6a4a);
      posts.add(x + 0.28, y + 0.7, z, rot, 0.22, 0.7, 0.22, 0x3a7a55);
    } else if (kind === "crystal") ice.add(x, y + 0.55, z, rot, 0.7, 1.5, 0.7, recipe.spectral ? PALETTE.espectro : PALETTE.anima);
    else if (kind === "rock") soft.add(x, y + 0.4, z, rot, 1.3, 0.8, 1.1, theme === "canon" ? 0x8a4030 : PALETTE.sombra);
    else if (kind === "umbrella") {
      posts.add(x, y, z, rot, 0.08, 2.2, 0.08, PALETTE.marfil);
      shades.add(x, y + 2.15, z, rot, 1.5, 1, 1.5, n % 2 === 0 ? PALETTE.ciruela : PALETTE.hueso);
    }
  };

  const nearKind = (i: number): Kind => {
    const cycle: Kind[] = ["tomb", "pumpkin", "skull", "fence"];
    return recipe.kinds.includes("cactus") ? (i % 2 === 0 ? "cactus" : "skull") : cycle[i % cycle.length]!;
  };
  // Faroles cada ~24 m (8 puntos × 3 m) a los dos lados, y piezas grandes en el arcén cercano.
  for (let i = 0; i < pts.length; i += 8) {
    const p = pts[i]!;
    const l = left[i]!;
    const rot = Math.atan2(l.x, l.z);
    for (const side of [-1, 1] as const) {
      const edge = p.w / 2 + track.verge + 1.15;
      const x = p.x + l.x * edge * side;
      const z = p.z + l.z * edge * side;
      if (!clearOfTrack(track, x, z)) continue;
      place("lantern", x, p.y, z, rot);
      if (side === 1 || i % 16 === 0) {
        const kx = p.x + l.x * (edge + 1.6) * side;
        const kz = p.z + l.z * (edge + 1.6) * side;
        if (clearOfTrack(track, kx, kz)) place(nearKind(n), kx, p.y, kz, rot);
      }
      n++;
    }
    // Ventanas emisivas en el lado exterior, para que la noche tenga puntos de luz.
    if (i % 16 === 0) {
      const edge = p.w / 2 + track.verge + 6;
      const x = p.x + l.x * edge;
      const z = p.z + l.z * edge;
      if (clearOfTrack(track, x, z)) glow.add(x, p.y + 2.4, z, rot, 0.55, 0.9, 0.12, PALETTE.llama);
    }
  }

  for (const b of [soft, posts, ice, shades, glow]) b.build(scene);
}
