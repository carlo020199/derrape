import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { archBarYaw } from "./themes";

describe("arco de salida", () => {
  it("cruza la pista en cualquier rumbo y no va a lo largo", () => {
    for (const h of [0, 0.4, 1.2, -0.8, Math.PI / 2, Math.PI, 2.4, -2.2]) {
      const yaw = archBarYaw(h);
      const alongBar = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const lateral = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
      const forward = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
      expect(alongBar.dot(lateral)).toBeGreaterThan(0.999);
      expect(Math.abs(alongBar.dot(forward))).toBeLessThan(0.02);
      // El giro anterior (rumbo + 90º) alineaba la barra con el sentido de la pista.
      const old = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), h + Math.PI / 2);
      expect(Math.abs(old.dot(forward))).toBeGreaterThan(0.99);
    }
  });
});
