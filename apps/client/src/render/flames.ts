import * as THREE from "three";
import { PALETTE } from "./materials";

// Llamas y chispas en UNA malla instanciada: quads que miran a la cámara,
// mezcla aditiva, sin escribir profundidad y sin bloom.

const MAX = 960;

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,0.7)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.28)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true;
  return tex;
}

let sharedTex: THREE.CanvasTexture | null = null;
function flameTexture() {
  return (sharedTex ??= radialTexture());
}

interface Slot {
  x: number;
  y: number;
  z: number;
  hex: number;
  size: number;
  life: number;
  maxLife: number;
  spark: boolean;
  vx: number;
  vy: number;
  vz: number;
}

export const TURBO_COLORS = [PALETTE.turbo1, PALETTE.turbo2, PALETTE.turbo3] as const;

export class Fire {
  readonly mesh: THREE.InstancedMesh;
  private slots: Slot[] = [];
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private cam = new THREE.Vector3();
  private karts: THREE.Vector3[] = [];
  private view = false;

  constructor(parent: THREE.Object3D) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: flameTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        /* glsl */ `
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sc = length(instanceMatrix[0].xyz);
          mvPosition.xy += position.xy * sc;
          gl_Position = projectionMatrix * mvPosition;
        `,
      );
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.name = "fuego";
    parent.add(this.mesh);
  }

  /** Cámara y karts de este fotograma, para apagar lo que flota delante del objetivo. */
  setView(camera: THREE.Vector3, karts: THREE.Vector3[]) {
    this.cam.copy(camera);
    this.karts = karts;
    this.view = true;
  }

  /** Quita las llamas del fotograma anterior y se queda con las chispas vivas. */
  begin() {
    if (this.slots.length === 0) return;
    const keep: Slot[] = [];
    for (const s of this.slots) if (s.spark && s.life > 0) keep.push(s);
    this.slots = keep;
  }

  flame(at: THREE.Vector3, hex: number, size: number) {
    if (this.slots.length >= MAX) return;
    this.slots.push({ x: at.x, y: at.y, z: at.z, hex, size, life: 0, maxLife: 0, spark: false, vx: 0, vy: 0, vz: 0 });
  }

  /** Chispa que ya nace con velocidad (la estela de la llama). */
  puff(at: THREE.Vector3, hex: number, vel: THREE.Vector3, size: number, life: number) {
    if (this.slots.length >= MAX) return;
    this.slots.push({
      x: at.x,
      y: at.y,
      z: at.z,
      hex,
      size,
      life: Math.min(0.25, life),
      maxLife: Math.min(0.25, life),
      spark: true,
      vx: vel.x,
      vy: vel.y,
      vz: vel.z,
    });
  }

  spark(at: THREE.Vector3, hex: number, count = 1, speed = 4) {
    for (let k = 0; k < count && this.slots.length < MAX; k++) {
      this.slots.push({
        x: at.x,
        y: at.y,
        z: at.z,
        hex,
        size: 0.08 + Math.random() * 0.05,
        life: 0.22,
        maxLife: 0.22,
        spark: true,
        vx: (Math.random() - 0.5) * speed,
        vy: speed * 0.35 + Math.random() * speed * 0.4,
        vz: (Math.random() - 0.5) * speed,
      });
    }
  }

  /**
   * 0 si el sprite está pegado al objetivo o en el hueco entre la cámara y el kart.
   * De ~2,6 m a ~3,4 m recupera el brillo. El tope 0,7 lo pone la textura.
   */
  private spriteFade(x: number, y: number, z: number) {
    if (!this.view) return 1;
    const dx = x - this.cam.x;
    const dy = y - this.cam.y;
    const dz = z - this.cam.z;
    const dCam = Math.hypot(dx, dy, dz);
    if (dCam < 2.2) return 0;
    const near = Math.min(1, (dCam - 2.2) / 0.9);
    let closest = Infinity;
    let closestCam = Infinity;
    for (const k of this.karts) {
      const dk = Math.hypot(x - k.x, y - k.y, z - k.z);
      if (dk < closest) {
        closest = dk;
        closestCam = Math.hypot(this.cam.x - k.x, this.cam.y - k.y, this.cam.z - k.z);
      }
    }
    // Solo el hueco delante del objetivo, lejos del kart más cercano. La llama del escape se queda.
    if (closest < Infinity && dCam + 0.25 < closestCam && closest > 2.4) return 0;
    return near;
  }

  end(dt: number) {
    const mesh = this.mesh;
    let n = 0;
    for (const s of this.slots) {
      let age = 1;
      if (s.spark) {
        s.life -= dt;
        if (s.life <= 0) continue;
        s.vy -= 5 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        age = s.maxLife > 0 ? s.life / s.maxLife : 0;
      }
      const fade = this.spriteFade(s.x, s.y, s.z) * age;
      if (fade < 0.04) continue;
      if (n >= MAX) break;
      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.scale.setScalar(Math.max(0.001, s.size * age));
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(n, this.dummy.matrix);
      this.color.setHex(s.hex).multiplyScalar(fade);
      mesh.setColorAt(n, this.color);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

const _side = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _puff = new THREE.Vector3();

/**
 * Llama pegada a la boca del escape, hacia atrás.
 * En reposo mide ~0,35 del largo del coche y los sprites son pequeños.
 * Con turbo llega a 1,2 y se queda translúcida (la textura tapa como mucho al 70 %).
 */
export function paintExhaust(
  fire: Fire,
  at: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  mode: "idle" | "drift" | "boost",
  time: number,
  dt = 0,
) {
  const boost = mode === "boost";
  const core = boost || mode === "drift" ? PALETTE.espectro : PALETTE.llama;
  const edge = boost || mode === "drift" ? PALETTE.anima : PALETTE.brasa;
  const n = boost ? 8 : 6;
  _side.set(dir.z, 0, -dir.x);
  if (_side.lengthSq() < 1e-4) _side.set(1, 0, 0);
  _side.normalize();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const flicker = 0.86 + Math.sin(time * 28 + i * 1.7 + at.x) * 0.14;
    const along = t * length * flicker;
    const spread = t * length * (boost ? 0.12 : 0.06);
    const ang = i * 1.8 + time * 7;
    _puff.copy(at).addScaledVector(dir, along);
    _puff.addScaledVector(_side, Math.cos(ang) * spread);
    _puff.addScaledVector(_up, Math.sin(ang) * spread * 0.25);
    const size = length * (boost ? 0.12 + t * 0.16 : 0.28 + t * 0.32) * flicker;
    fire.flame(_puff, t < 0.45 ? core : edge, size);
  }
  if (dt > 0 && Math.floor(time * 12) !== Math.floor((time - dt) * 12)) {
    _puff.copy(at).addScaledVector(dir, length * 0.55);
    _side.copy(dir).multiplyScalar(length * 0.6);
    fire.puff(_puff, edge, _side, length * (boost ? 0.12 : 0.07), 0.22);
  }
}

/** Melena o coleta: varios sprites del sistema de fuego, no geometría. */
export function paintHair(fire: Fire, at: THREE.Vector3, spectral: boolean, time: number, scale = 1) {
  const core = spectral ? PALETTE.espectro : PALETTE.llama;
  const edge = spectral ? PALETTE.anima : PALETTE.brasa;
  const flicker = 0.85 + Math.sin(time * 20 + at.y * 4) * 0.15;
  fire.flame(at, core, 0.14 * scale * flicker);
  fire.flame(at, edge, 0.24 * scale * flicker);
}
