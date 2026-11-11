import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Fire, paintExhaust } from "./flames";

const g = globalThis as { document?: unknown };
if (!g.document) {
  g.document = {
    createElement() {
      return {
        width: 64,
        height: 64,
        getContext() {
          const grad = { addColorStop() {} };
          return {
            fillStyle: "",
            createRadialGradient: () => grad,
            fillRect() {},
          };
        },
      };
    },
  };
}

describe("fuego aditivo", () => {
  it("llamas y chispas comparten una sola malla", () => {
    const scene = new THREE.Scene();
    const fire = new Fire(scene);
    const at = new THREE.Vector3(0, 0.4, -1);
    fire.begin();
    const dir = new THREE.Vector3(0, 0.2, -1).normalize();
    paintExhaust(fire, at, dir, 1.2, "idle", 0);
    fire.spark(at, 0xffb423, 4);
    fire.end(0.016);
    expect(scene.children.filter((o) => (o as THREE.InstancedMesh).isInstancedMesh)).toHaveLength(1);
    expect(fire.mesh.count).toBe(12);
    const mat = fire.mesh.material as THREE.MeshBasicMaterial;
    expect(mat.blending).toBe(THREE.AdditiveBlending);
    expect(mat.depthWrite).toBe(false);

    fire.begin();
    paintExhaust(fire, at, dir, 2.4, "boost", 0.2);
    fire.end(0.5);
    // El turbo sigue siendo la misma malla; las chispas de antes ya se apagaron.
    expect(fire.mesh.count).toBe(10);
    expect(scene.children).toHaveLength(1);
  });
});
