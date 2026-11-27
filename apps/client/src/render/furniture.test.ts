import { describe, expect, it } from "vitest";
import { buildTrackFromDef, findTrack } from "@derrape/shared";
import { FURNITURE, furnitureMesh } from "./furniture";
import { PALETTE } from "./materials";

describe("rampas-mueble: malla", () => {
  it("el Desván genera una sola malla barata; la Laguna (sin landBoost) ninguna", async () => {
    const desvan = buildTrackFromDef(await findTrack("desvan-de-las-maravillas")!.load());
    const mesh = furnitureMesh(desvan)!;
    expect(mesh).not.toBeNull();
    const tris = mesh.geometry.getAttribute("position").count / 3;
    expect(tris).toBeGreaterThan(500);
    expect(tris).toBeLessThan(6000);
    const laguna = buildTrackFromDef(await findTrack("laguna-de-las-animas")!.load());
    expect(furnitureMesh(laguna)).toBeNull();
  });

  it("ningún mueble usa los colores de los turbos (Brasa, Llama, Espectro)", async () => {
    const mesh = furnitureMesh(buildTrackFromDef(await findTrack("desvan-de-las-maravillas")!.load()))!;
    const col = mesh.geometry.getAttribute("color");
    const prohibidos = [PALETTE.brasa, PALETTE.llama, PALETTE.espectro].map((h) => [(h >> 16) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]);
    for (let i = 0; i < col.count; i += 3) {
      for (const p of prohibidos) {
        const d = Math.hypot(col.getX(i) - p[0]!, col.getY(i) - p[1]!, col.getZ(i) - p[2]!);
        expect(d).toBeGreaterThan(0.2);
      }
    }
    expect(Object.values(FURNITURE)).not.toContain(PALETTE.brasa);
  });

  it("la cuña acaba a la altura del labio de la física (S 0,6 m, M 1,5 m)", async () => {
    const mesh = furnitureMesh(buildTrackFromDef(await findTrack("desvan-de-las-maravillas")!.load()))!;
    mesh.geometry.computeBoundingBox();
    expect(mesh.geometry.boundingBox!.max.y).toBeGreaterThan(1.5);
  });
});
