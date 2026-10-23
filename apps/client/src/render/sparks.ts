import * as THREE from "three";

// Chispas de derrape: un pool fijo de puntos (sin crear objetos por frame).
const MAX = 160;
export const SPARK_COLORS = [0x000000, 0x4cc9f0, 0xff9f1c, 0xb15cff];

export class Sparks {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private col = new Float32Array(MAX * 3);
  private next = 0;
  private tmp = new THREE.Color();

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, depthWrite: false }),
    );
    this.points.frustumCulled = false;
  }

  emit(at: THREE.Vector3, level: number, count: number) {
    this.tmp.setHex(SPARK_COLORS[level] ?? 0xffffff);
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([(Math.random() - 0.5) * 4, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 4], i * 3);
      this.col.set([this.tmp.r, this.tmp.g, this.tmp.b], i * 3);
      this.life[i] = 0.25 + Math.random() * 0.15;
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i]! <= 0) {
        this.pos[i * 3 + 1] = -100; // fuera de la vista
        continue;
      }
      this.life[i]! -= dt;
      this.vel[i * 3 + 1]! -= 12 * dt;
      for (let a = 0; a < 3; a++) this.pos[i * 3 + a]! += this.vel[i * 3 + a]! * dt;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    this.points.geometry.attributes.color!.needsUpdate = true;
  }
}
