import * as THREE from "three";
import { closestPoint, surfaceNormal, surfaceY, type Track } from "@derrape/shared";
import { NOCHE } from "./materials";

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,0.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Una sola malla instanciada: un disco Noche al 45 % bajo cada kart, pegado a la pista. */
export class BlobShadows {
  readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly normal = new THREE.Vector3();

  constructor(parent: THREE.Object3D, count = 8) {
    const geo = new THREE.CircleGeometry(0.95, 16);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: NOCHE,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.count = count;
    parent.add(this.mesh);
  }

  update(track: Track, spots: { x: number; z: number; on: boolean }[]) {
    for (let i = 0; i < this.mesh.count; i++) {
      const s = spots[i];
      if (!s?.on) {
        this.dummy.position.set(0, -50, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.quaternion.identity();
      } else {
        const c = closestPoint(track, s.x, s.z);
        const n = surfaceNormal(track, c);
        this.normal.set(n.x, n.y, n.z);
        // El asfalto está 0,02 m sobre la calzada: +0,05 deja la sombra a +0,03.
        // Con peralte 0, surfaceY es c.y y la normal es la de la pendiente, como antes.
        this.dummy.position.set(s.x, surfaceY(c) + 0.05, s.z);
        this.dummy.scale.set(1.35, 1, 1.35);
        this.dummy.quaternion.setFromUnitVectors(this.up, this.normal);
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
