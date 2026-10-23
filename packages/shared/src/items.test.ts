import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import {
  createItemBoxes,
  createRaceKart,
  rollItem,
  stepItems,
  useItem,
  type ItemType,
  type ItemWorld,
  type RaceKart,
} from "./items";
import { createKart, stepKart, type KartInput } from "./kart";
import { collideKartWithTrack, pointAt } from "./track";
import pruebasDef from "./tracks/00-pruebas";
import { buildTrackFromDef } from "./tracks/types";

const track = buildTrackFromDef(pruebasDef);
import { ITEMS, KART, PHYSICS_DT } from "./tuning";

/** Generador determinista para tests. */
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function kartAt(id: number, distance: number, lateral = 0): RaceKart {
  const p = pointAt(track, distance, lateral);
  return createRaceKart(id, createKart(p.x, p.z, p.heading), track);
}

function world(karts: RaceKart[]): ItemWorld {
  return { track, karts, boxes: [], oils: [], rockets: [], random: seeded() };
}

const GAS: KartInput = { steer: 0, throttle: true, brake: false, drift: false };

/** Simula `seconds` con todos los karts conducidos por el bot. */
function simulate(w: ItemWorld, seconds: number, speedOf: (k: RaceKart) => number = () => 1) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / PHYSICS_DT); i++) {
    for (const k of w.karts) {
      const input = speedOf(k) === 0 ? { ...GAS, throttle: false } : botInput({ lane: 0, lookAhead: 10 }, k.state, track);
      stepKart(k.state, input, PHYSICS_DT, { ...KART, maxSpeed: KART.maxSpeed * speedOf(k) || 1 });
      collideKartWithTrack(k.state, track);
    }
    events.push(...stepItems(w, PHYSICS_DT));
  }
  return events;
}

describe("reparto de objetos", () => {
  function count(position: number): Record<ItemType, number> {
    const random = seeded(7);
    const c = { nitro: 0, oil: 0, rocket: 0, shield: 0 };
    for (let i = 0; i < 4000; i++) c[rollItem(position, 8, random)]++;
    return c;
  }

  it("el primero recibe más defensa y el último más ataque", () => {
    const first = count(1);
    const last = count(8);
    expect(first.oil).toBeGreaterThan(last.oil);
    expect(first.shield).toBeGreaterThan(last.shield);
    expect(last.rocket).toBeGreaterThan(first.rocket);
    expect(last.nitro).toBeGreaterThan(first.nitro);
  });

  it("todos los objetos pueden salir", () => {
    for (const n of Object.values(count(4))) expect(n).toBeGreaterThan(0);
  });
});

describe("cajas", () => {
  it("al pasar por una caja se recibe un objeto tras la ruleta y la caja reaparece", () => {
    const k = kartAt(0, 10);
    const w = world([k]);
    w.boxes = createItemBoxes(track, [30 / track.length], 1);
    k.state.speed = 15;
    const events = simulate(w, 2.5);
    expect(events.some((e) => e.type === "pickup")).toBe(true);
    expect(k.item).not.toBeNull();
    expect(k.rollTime).toBe(0);
    simulate(w, ITEMS.boxRespawn);
    expect(w.boxes[0]!.respawn).toBe(0);
  });

  it("no se puede usar durante la ruleta", () => {
    const k = kartAt(0, 10);
    k.item = "nitro";
    k.rollTime = 0.5;
    expect(useItem(world([k]), k, "use")).toBe(false);
    k.rollTime = 0;
    expect(useItem(world([k]), k, "use")).toBe(true);
    expect(k.item).toBeNull();
  });
});

describe("objetos", () => {
  it("nitro da turbo", () => {
    const k = kartAt(0, 10);
    k.item = "nitro";
    useItem(world([k]), k, "forward");
    expect(k.state.boostTime).toBe(ITEMS.nitroTime);
  });

  it("el escudo bloquea un golpe y se gasta", () => {
    const me = kartAt(0, 10);
    const w = world([me]);
    me.item = "shield";
    useItem(w, me, "use");
    w.oils.push({ x: me.state.x, z: me.state.z, owner: 99, safeTime: 0 });
    const events = simulate(w, 0.1, () => 0);
    expect(events.some((e) => e.type === "blocked")).toBe(true);
    expect(me.state.spinTime).toBe(0);
    expect(me.state.shieldTime).toBe(0);
  });

  it("el aceite soltado detrás hace trompear al que viene detrás, no al que lo suelta", () => {
    const leader = kartAt(0, 60);
    const follower = kartAt(1, 40);
    const w = world([leader, follower]);
    leader.item = "oil";
    useItem(w, leader, "back");
    expect(w.oils).toHaveLength(1);
    const events = simulate(w, 3, (k) => (k.id === 0 ? 0 : 1));
    expect(events).toContainEqual({ type: "hit", kart: 1, by: "oil" });
    expect(leader.state.spinTime).toBe(0);
  });

  it("el aceite lanzado adelante cae por delante", () => {
    const k = kartAt(0, 60);
    const w = world([k]);
    k.item = "oil";
    useItem(w, k, "forward");
    const oil = w.oils[0]!;
    const ahead = pointAt(track, 60 + ITEMS.oilThrowDistance);
    expect(Math.hypot(oil.x - ahead.x, oil.z - ahead.z)).toBeLessThan(1);
  });

  it("el cohete adelante persigue y golpea al de delante aunque vaya por otro carril", () => {
    const me = kartAt(0, 20, -4);
    const ahead = kartAt(1, 70, 4);
    const w = world([me, ahead]);
    me.item = "rocket";
    useItem(w, me, "forward");
    expect(w.rockets[0]!.target).toBe(1);
    const events = simulate(w, 4, () => 0);
    expect(events).toContainEqual({ type: "hit", kart: 1, by: "rocket" });
  });

  it("el cohete hacia atrás golpea al de detrás", () => {
    const me = kartAt(0, 80);
    const behind = kartAt(1, 50);
    const w = world([me, behind]);
    me.item = "rocket";
    useItem(w, me, "back");
    const events = simulate(w, 3, () => 0);
    expect(events).toContainEqual({ type: "hit", kart: 1, by: "rocket" });
  });

  it("tras el trompo se recupera el control", () => {
    const k = kartAt(0, 10);
    k.state.speed = 20;
    k.state.spinTime = 1;
    for (let i = 0; i < 60; i++) stepKart(k.state, GAS, PHYSICS_DT);
    expect(k.state.speed).toBeLessThan(20);
    expect(k.state.spinTime).toBe(0);
    for (let i = 0; i < 60; i++) stepKart(k.state, GAS, PHYSICS_DT);
    expect(k.state.speed).toBeGreaterThan(5);
  });
});

describe("piloto automático", () => {
  it("da una vuelta completa al circuito de pruebas sin atascarse", () => {
    const k = kartAt(0, 0);
    const w = world([k]);
    simulate(w, 60);
    expect(k.raceDistance).toBeGreaterThan(track.length);
  });
});
