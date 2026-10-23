import { describe, expect, it } from "vitest";
import type { NetKartState } from "@derrape/shared";
import { ItemsBuffer, ServerClock, SnapshotBuffer } from "./interpolation";

const s = (x: number, extra: Partial<NetKartState> = {}): NetKartState => ({
  x,
  z: 0,
  heading: Math.PI / 2, // mirando a +x
  speed: 20,
  driftDir: 0,
  driftLevel: 0,
  hop: 0,
  boosting: false,
  spinning: false,
  shield: false,
  respawns: 0,
  ...extra,
});

describe("interpolación", () => {
  it("mezcla las dos instantáneas que rodean el instante pedido", () => {
    const b = new SnapshotBuffer();
    b.push(1000, s(0));
    b.push(1050, s(1));
    expect(b.sample(1025)!.x).toBeCloseTo(0.5);
  });

  it("ignora instantáneas desordenadas", () => {
    const b = new SnapshotBuffer();
    b.push(1000, s(0));
    b.push(1100, s(2));
    b.push(1050, s(99)); // llega tarde
    expect(b.sample(1050)!.x).toBeCloseTo(1);
  });

  it("extrapola un poco si faltan datos y luego se para", () => {
    const b = new SnapshotBuffer();
    b.push(1000, s(0));
    expect(b.sample(1100)!.x).toBeCloseTo(2); // 20 m/s × 0,1 s
    expect(b.sample(5000)!.x).toBeCloseTo(4); // tope de 200 ms
  });

  it("al reaparecer salta en vez de deslizarse por el mapa", () => {
    const b = new SnapshotBuffer();
    b.push(1000, s(0));
    b.push(1050, s(500, { respawns: 1 }));
    expect(b.sample(1010)!.x).toBe(500);
  });

  it("el ángulo se interpola por el camino corto", () => {
    const b = new SnapshotBuffer();
    b.push(0, s(0, { heading: Math.PI - 0.1 }));
    b.push(100, s(0, { heading: -Math.PI + 0.1 }));
    expect(Math.abs(b.sample(50)!.heading)).toBeCloseTo(Math.PI, 3);
  });
});

describe("reloj del servidor", () => {
  it("se ajusta rápido hacia delante y despacio hacia atrás", () => {
    const c = new ServerClock();
    expect(c.now(0)).toBeNull();
    c.sample(10_000, 0);
    expect(c.now(0)).toBe(10_000);
    c.sample(10_100, 0); // paquete que llegó antes de lo esperado
    expect(c.now(0)).toBeGreaterThan(10_040);
    const before = c.now(0)!;
    c.sample(9_000, 0); // paquete muy retrasado
    expect(before - c.now(0)!).toBeLessThan(30);
  });
});

describe("objetos interpolados", () => {
  const snap = (rockets: { id: number; x: number }[], hidden: number[] = []) => ({
    hiddenBoxes: hidden,
    oils: [],
    rockets: rockets.map((r) => ({ ...r, z: 0 })),
  });

  it("los cohetes se mueven suaves entre instantáneas", () => {
    const b = new ItemsBuffer();
    b.push(1000, snap([{ id: 1, x: 0 }]));
    b.push(1050, snap([{ id: 1, x: 2 }]));
    expect(b.sample(1025)!.rockets[0]!.x).toBeCloseTo(1);
  });

  it("un cohete que explota desaparece y uno nuevo no se ve antes de tiempo", () => {
    const b = new ItemsBuffer();
    b.push(1000, snap([{ id: 1, x: 0 }]));
    b.push(1050, snap([{ id: 2, x: 5 }]));
    expect(b.sample(1025)!.rockets).toEqual([]);
    expect(b.sample(1050)!.rockets.map((r) => r.id)).toEqual([2]);
  });

  it("las cajas ocultas son las de la instantánea de ese momento", () => {
    const b = new ItemsBuffer();
    b.push(1000, snap([], [3]));
    b.push(1050, snap([], []));
    expect(b.sample(1010)!.hiddenBoxes).toEqual([3]);
    expect(b.sample(1060)!.hiddenBoxes).toEqual([]);
  });
});
