import { describe, expect, it } from "vitest";
import { buildTrackFromDef, findTrack, isPadType, surfaceAt, closestPoint, type Track } from "@derrape/shared";
import { CELL_LENGTH, CELL_WIDTH, groundBoostCells, padColor } from "./groundBoost";

async function desvan(): Promise<Track> {
  return buildTrackFromDef(await findTrack("desvan-de-las-maravillas")!.load());
}

describe("turbos de suelo: celdas", () => {
  it("los circuitos sin turbos nuevos no generan celdas", async () => {
    const t = buildTrackFromDef(await findTrack("laguna-de-las-animas")!.load());
    expect(groundBoostCells(t)).toHaveLength(0);
  });

  it("el Desván genera celdas azules y naranjas, de un tamaño razonable (1 malla)", async () => {
    const cells = groundBoostCells(await desvan());
    expect(cells.some((c) => c.color === "blue")).toBe(true);
    expect(cells.some((c) => c.color === "orange")).toBe(true);
    expect(cells.length).toBeGreaterThan(60);
    expect(cells.length).toBeLessThan(400);
  });

  it("el color sale del tipo de zona", () => {
    expect(padColor("boostBlue")).toBe("blue");
    expect(padColor("boostBlueNarrow")).toBe("blue");
    expect(padColor("boostOrange")).toBe("orange");
    expect(padColor("boostOrangeNarrow")).toBe("orange");
    expect(padColor("boostTri")).toBe("tri");
  });

  it("el raíl triturbo se pinta con celdas propias, una columna de 2 m de ancho y 50 m de largo", async () => {
    const tri = groundBoostCells(await desvan()).filter((c) => c.color === "tri");
    expect(tri).toHaveLength(Math.round(50 / CELL_LENGTH));
    for (const cell of tri) {
      const [a, b] = cell.corners;
      expect(Math.hypot(a![0] - b![0], a![2] - b![2])).toBeCloseTo(2, 1);
    }
  });

  it("el centro de cada celda cae sobre la superficie de turbo del mismo color", async () => {
    const track = await desvan();
    for (const cell of groundBoostCells(track)) {
      const x = cell.corners.reduce((a, p) => a + p[0], 0) / 4;
      const z = cell.corners.reduce((a, p) => a + p[2], 0) / 4;
      const surface = surfaceAt(track, closestPoint(track, x, z));
      expect(isPadType(surface), surface).toBe(true);
      expect(padColor(surface as never)).toBe(cell.color);
    }
  });

  it("las celdas miden ≈ CELL_LENGTH × ≤ CELL_WIDTH", async () => {
    for (const cell of groundBoostCells(await desvan())) {
      const [a, b, c] = cell.corners;
      const w = Math.hypot(a![0] - b![0], a![2] - b![2]);
      const l = Math.hypot(b![0] - c![0], b![2] - c![2]);
      expect(w).toBeLessThanOrEqual(CELL_WIDTH * 1.4);
      expect(l).toBeLessThanOrEqual(CELL_LENGTH * 1.6);
      expect(l).toBeGreaterThan(CELL_LENGTH * 0.4);
    }
  });
});
