import * as THREE from "three";
import { PAL, glowTexture } from "./look";

// Chispas de derrape y fuego de los escapes: dos pools fijos de puntos aditivos
// (sin crear objetos por frame; 2 llamadas de dibujo para todos los karts).

/** Color de las chispas por nivel de turbo: espectro → brasa → ánima. */
export const SPARK_COLORS = [0x000000, PAL.espectro, PAL.brasa, PAL.anima];

class Pool {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private base: Float32Array;
  private col: Float32Array;
  private life: Float32Array;
  private span: Float32Array;
  private next = 0;
  private tmp = new THREE.Color();

  constructor(
    private readonly max: number,
    size: number,
    private readonly gravity: number,
  ) {
    this.pos = new Float32Array(max * 3).fill(-100);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.span = new Float32Array(max).fill(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size,
        map: glowTexture(),
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, life: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.tmp.setHex(color);
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.base.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
    this.life[i] = this.span[i] = life;
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      const o = i * 3;
      if (this.life[i]! <= 0) {
        this.pos[o + 1] = -100; // fuera de la vista
        continue;
      }
      this.life[i]! -= dt;
      this.vel[o + 1]! -= this.gravity * dt;
      // Aditivo: apagar el color es desvanecer la partícula.
      const k = Math.max(0, this.life[i]! / this.span[i]!);
      for (let a = 0; a < 3; a++) {
        this.pos[o + a]! += this.vel[o + a]! * dt;
        this.col[o + a] = this.base[o + a]! * k;
      }
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    this.points.geometry.attributes.color!.needsUpdate = true;
  }
}

/** Lo que hace falta de un kart para echarle fuego. */
export interface FlameSource {
  body: THREE.Object3D;
  exhausts: THREE.Vector3[];
  headFlame: THREE.Vector3 | null;
}

const FIRE = [PAL.llama, PAL.brasa, PAL.brasa, PAL.ascua];
const rnd = (n: number) => (Math.random() - 0.5) * n;

export class Sparks {
  readonly group = new THREE.Group();
  private sparks = new Pool(200, 0.4, 12);
  private flames = new Pool(640, 0.6, -2.5);
  private tmp = new THREE.Vector3();

  constructor() {
    this.group.add(this.flames.points, this.sparks.points);
  }

  /** Chispas de derrape en un punto (el color depende del nivel de turbo). */
  emit(at: THREE.Vector3, level: number, count: number) {
    const color = SPARK_COLORS[level] ?? 0xffffff;
    for (let k = 0; k < count; k++) {
      this.sparks.emit(at.x, at.y, at.z, rnd(4), 1.5 + Math.random() * 2.5, rnd(4), color, 0.25 + Math.random() * 0.15);
    }
  }

  /**
   * Fuego por los escapes (y por la cabeza, si el piloto arde). `heading` = rumbo del kart;
   * `power` 0 = ralentí, 1 = corriendo, 2 = turbo (más largo y con puntas espectrales).
   */
  exhaust(src: FlameSource, heading: number, power: number) {
    const bx = -Math.sin(heading);
    const bz = -Math.cos(heading);
    const push = 1.2 + power * 2.2;
    const n = power >= 2 ? 3 : 1;
    // Al ralentí, la mitad de llamitas.
    if (power < 1 && Math.random() < 0.5) return;
    for (const e of src.exhausts) {
      src.body.localToWorld(this.tmp.copy(e));
      for (let k = 0; k < n; k++) {
        const color = power >= 2 && Math.random() < 0.3 ? PAL.espectro : FIRE[Math.floor(Math.random() * FIRE.length)]!;
        this.flames.emit(
          this.tmp.x + rnd(0.08),
          this.tmp.y + rnd(0.08),
          this.tmp.z + rnd(0.08),
          bx * push + rnd(0.8),
          0.9 + Math.random() * 0.8,
          bz * push + rnd(0.8),
          color,
          0.14 + power * 0.07 + Math.random() * 0.1,
        );
      }
    }
    if (src.headFlame) {
      src.body.localToWorld(this.tmp.copy(src.headFlame));
      this.flames.emit(
        this.tmp.x + rnd(0.3),
        this.tmp.y + rnd(0.1),
        this.tmp.z + rnd(0.3),
        bx * 0.6 + rnd(0.3),
        1.4 + Math.random(),
        bz * 0.6 + rnd(0.3),
        FIRE[Math.floor(Math.random() * 3)]!,
        0.3 + Math.random() * 0.15,
      );
    }
  }

  update(dt: number) {
    this.sparks.update(dt);
    this.flames.update(dt);
  }
}
