import * as THREE from "three";
import { closestPoint, surfaceY, type ItemWorld } from "@derrape/shared";
import { toonMaterial } from "./materials";

// Dibuja cajas, manchas de aceite y cohetes. Las mallas se reutilizan (pool) para no crear objetos por frame.

function questionTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, "#ffd23f");
  grad.addColorStop(0.5, "#ff6b35");
  grad.addColorStop(1, "#b15cff");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#fff";
  g.font = "bold 46px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("?", 32, 35);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class Pool<T extends THREE.Object3D> {
  private items: T[] = [];
  constructor(private readonly parent: THREE.Object3D, private readonly make: () => T) {}
  /** Muestra `count` objetos y devuelve la lista para colocarlos. */
  show(count: number): T[] {
    while (this.items.length < count) {
      const o = this.make();
      this.parent.add(o);
      this.items.push(o);
    }
    this.items.forEach((o, i) => (o.visible = i < count));
    return this.items;
  }
}

export class ItemsView {
  readonly group = new THREE.Group();
  private boxes: THREE.Mesh[] = [];
  private oils: Pool<THREE.Mesh>;
  private rockets: Pool<THREE.Group>;
  private time = 0;

  constructor(world: ItemWorld) {
    const boxGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const boxMat = new THREE.MeshBasicMaterial({ map: questionTexture(), transparent: true, opacity: 0.9 });
    for (const b of world.boxes) {
      const m = new THREE.Mesh(boxGeo, boxMat);
      m.position.set(b.x, 1.1, b.z);
      this.group.add(m);
      this.boxes.push(m);
    }

    const oilGeo = new THREE.CircleGeometry(1.7, 20);
    const oilMat = new THREE.MeshBasicMaterial({ color: 0x15121f, transparent: true, opacity: 0.85 });
    this.oils = new Pool(this.group, () => {
      const m = new THREE.Mesh(oilGeo, oilMat);
      m.rotation.x = -Math.PI / 2;
      return m;
    });

    const bodyGeo = new THREE.ConeGeometry(0.35, 1.4, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = toonMaterial({ color: 0xd9362b });
    this.rockets = new Pool(this.group, () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bodyGeo, bodyMat));
      return g;
    });
  }

  private tails: THREE.Vector3[] = [];
  /** Cola de cada cohete, para la llama aditiva compartida. */
  flamePoints(): THREE.Vector3[] {
    return this.tails;
  }

  update(world: ItemWorld, dt: number) {
    this.time += dt;
    world.boxes.forEach((b, i) => {
      const m = this.boxes[i]!;
      m.visible = b.respawn === 0;
      m.rotation.set(0.4, this.time * 1.5 + i, 0.2);
      const c = closestPoint(world.track, b.x, b.z);
      const base = world.track.relief ? surfaceY(c) : 0;
      m.position.y = base + 1.1 + Math.sin(this.time * 2.5 + i) * 0.15;
    });

    const oils = this.oils.show(world.oils.length);
    world.oils.forEach((o, i) => {
      const c = closestPoint(world.track, o.x, o.z);
      const base = world.track.relief ? surfaceY(c) : 0;
      oils[i]!.position.set(o.x, base + 0.04, o.z);
    });

    const rockets = this.rockets.show(world.rockets.length);
    this.tails = [];
    world.rockets.forEach((r, i) => {
      const g = rockets[i]!;
      const dx = r.x - g.position.x;
      const dz = r.z - g.position.z;
      if (dx * dx + dz * dz > 1e-4) g.rotation.y = Math.atan2(dx, dz);
      const c = closestPoint(world.track, r.x, r.z);
      const base = world.track.relief ? surfaceY(c) : 0;
      g.position.set(r.x, base + 0.8, r.z);
      g.updateMatrixWorld();
      this.tails.push(new THREE.Vector3(0, 0.05, -0.95).applyMatrix4(g.matrixWorld));
    });
  }
}
