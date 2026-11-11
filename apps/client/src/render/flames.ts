import * as THREE from "three";
import { PALETTE } from "./materials";

// Llamas y chispas en UNA malla instanciada: quads que miran a la cámara,
// mezcla aditiva, sin escribir profundidad y sin bloom.

const MAX = 480;

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,0.65)");
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

  /** Quita las llamas del fotograma anterior y se queda con las chispas vivas. */
  begin() {
    if (this.slots.length === 0) return;
    const keep: Slot[] = [];
    for (const s of this.slots) if (s.spark && s.life > 0) keep.push(s);
    this.slots = keep;
  }

  flame(at: THREE.Vector3, hex: number, size: number) {
    if (this.slots.length >= MAX) return;
    this.slots.push({ x: at.x, y: at.y, z: at.z, hex, size, life: 0, spark: false, vx: 0, vy: 0, vz: 0 });
  }

  spark(at: THREE.Vector3, hex: number, count = 1, speed = 4) {
    for (let k = 0; k < count && this.slots.length < MAX; k++) {
      this.slots.push({
        x: at.x,
        y: at.y,
        z: at.z,
        hex,
        size: 0.1 + Math.random() * 0.08,
        life: 0.32 * (0.65 + Math.random() * 0.5),
        spark: true,
        vx: (Math.random() - 0.5) * speed,
        vy: speed * 0.35 + Math.random() * speed * 0.4,
        vz: (Math.random() - 0.5) * speed,
      });
    }
  }

  end(dt: number) {
    const mesh = this.mesh;
    let n = 0;
    for (const s of this.slots) {
      if (s.spark) {
        s.life -= dt;
        if (s.life <= 0) continue;
        s.vy -= 12 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
      }
      if (n >= MAX) break;
      this.dummy.position.set(s.x, s.y, s.z);
      this.dummy.scale.setScalar(Math.max(0.001, s.size));
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(n, this.dummy.matrix);
      mesh.setColorAt(n, this.color.setHex(s.hex));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

/** Escape: naranja en reposo, espectral al derrapar cargado o con turbo. */
export function paintExhaust(fire: Fire, at: THREE.Vector3, mode: "idle" | "drift" | "boost", time: number, grow = 1) {
  const pulse = (0.86 + Math.sin(time * 22 + at.x * 3) * 0.14) * grow;
  if (mode === "idle") {
    fire.flame(at, PALETTE.llama, 0.2 * pulse);
    fire.flame(at, PALETTE.brasa, 0.35 * pulse);
  } else if (mode === "drift") {
    fire.flame(at, PALETTE.espectro, 0.42 * pulse);
    fire.flame(at, PALETTE.anima, 0.7 * pulse);
  } else {
    fire.flame(at, PALETTE.espectro, 0.62 * pulse);
    fire.flame(at, PALETTE.anima, 1 * pulse);
  }
}
