import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { toonGradientMap } from "./materials";

describe("material toon", () => {
  it("usa un degradado de 3 tonos con filtro nearest", () => {
    const tex = toonGradientMap();
    expect(tex.image.width).toBe(3);
    expect(tex.image.height).toBe(1);
    expect(tex.magFilter).toBe(THREE.NearestFilter);
    expect(tex.minFilter).toBe(THREE.NearestFilter);
    expect(tex.generateMipmaps).toBe(false);
    const data = tex.image.data as Uint8Array;
    expect([...data]).toEqual([Math.round(0.45 * 255), Math.round(0.75 * 255), 255]);
    expect(toonGradientMap()).toBe(tex);
  });
});
