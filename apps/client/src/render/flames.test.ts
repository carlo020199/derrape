import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { PALETTE } from "./materials";
import { Fire, TINT_COLORS, boostTint, paintExhaust } from "./flames";

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
    expect(fire.mesh.count).toBe(13); // 9 de llama en reposo + 4 chispas
    const mat = fire.mesh.material as THREE.MeshBasicMaterial;
    expect(mat.blending).toBe(THREE.AdditiveBlending);
    expect(mat.depthWrite).toBe(false);

    fire.begin();
    paintExhaust(fire, at, dir, 2.4, "boost", 0.2);
    fire.end(0.5);
    // El turbo sigue siendo la misma malla; las chispas de antes ya se apagaron.
    expect(fire.mesh.count).toBe(12);
    expect(scene.children).toHaveLength(1);
  });

  it("el color de la llama sigue al turbo: el raíl manda sobre el naranja y este sobre el azul", () => {
    expect(boostTint({ triTime: 0.5, boostMult: 3 })).toBe("tri");
    expect(boostTint({ triTime: 0.5, boostMult: 1.75 })).toBe("tri");
    expect(boostTint({ triTime: 0, boostMult: 1.75 })).toBe("orange");
    expect(boostTint({ triTime: 0, boostMult: 1.5 })).toBe("blue"); // turbo azul y aterrizaje de rampa
    expect(boostTint({ triTime: 0, boostMult: 1.3 })).toBe("blue"); // nitro y salida
    expect(boostTint({ triTime: 0, boostMult: 1 })).toBe("blue");
  });

  it("las llamas de turbo tienen colores distintos y el triturbo es más largo", () => {
    expect(TINT_COLORS.orange.mid).toBe(PALETTE.brasa);
    expect(TINT_COLORS.blue.mid).toBe(PALETTE.espectro);
    expect(TINT_COLORS.tri.core).toBe(PALETTE.texto);
    const scene = new THREE.Scene();
    const fire = new Fire(scene);
    const at = new THREE.Vector3(0, 0.4, -1);
    const dir = new THREE.Vector3(0, 0.2, -1).normalize();
    const count = (tint: "blue" | "orange" | "tri") => {
      fire.begin();
      paintExhaust(fire, at, dir, 2.4, "boost", 0.2, 0, tint);
      fire.end(0.5);
      return fire.mesh.count;
    };
    expect(count("blue")).toBe(12);
    expect(count("orange")).toBe(12);
    expect(count("tri")).toBe(15);
  });
});
