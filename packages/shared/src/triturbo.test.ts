import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { createItemBoxes, createRaceKart, distanceToSegment, stepItems, type ItemWorld } from "./items";
import { createKart, giveBoost, isBoosting, stepKart, type KartInput } from "./kart";
import { createProgress, needsRespawn, respawnKart, updateProgress } from "./race";
import { closestPoint, gridPose, pointAt, stepKartOnTrack, surfaceAt, type Track } from "./track";
import pruebasDef from "./tracks/00-pruebas";
import { findTrack } from "./tracks/index";
import { buildTrackFromDef } from "./tracks/types";
import { ITEMS, KART, MAX_PLAUSIBLE_SPEED, PADS, PHYSICS_DT, TOP_SPEED, TRI_RAIL } from "./tuning";

const GAS: KartInput = { steer: 0, throttle: true, brake: false, drift: false };
/** Medio ancho del kart (m): el kart mide ±0,9 (ver KART_RADIUS en track/render). */
const KART_HALF_WIDTH = 0.9;

async function desvan(): Promise<Track> {
  return buildTrackFromDef(await findTrack("desvan-de-las-maravillas")!.load());
}

/** Kart en el centro de la pista, `lead` m antes de `rail` y con `speed` m/s. */
function approach(track: Track, rail: { from: number }, lead: number, lateral: number, speed: number) {
  const start = pointAt(track, rail.from - lead, lateral);
  const s = createKart(start.x, start.z, start.heading);
  s.speed = speed;
  return s;
}

describe("raíl triturbo: datos", () => {
  it("hay un raíl del ancho de un kart (franja de ±halfWidth) y cabe exactamente un kart", async () => {
    const track = await desvan();
    const rails = track.zones.filter((z) => z.type === "boostTri");
    expect(rails).toHaveLength(1);
    const rail = rails[0]!;
    expect(rail.lateralMin).toBe(-TRI_RAIL.halfWidth);
    expect(rail.lateralMax).toBe(TRI_RAIL.halfWidth);
    // «Exactamente del ancho de un kart»: algo más que el kart (2 × 0,9) y bastante menos que un turbo de franja (≥ 3 m).
    expect(rail.lateralMax - rail.lateralMin).toBeGreaterThanOrEqual(2 * KART_HALF_WIDTH);
    expect(rail.lateralMax - rail.lateralMin).toBeLessThan(3);
    expect(rail.to - rail.from).toBeGreaterThanOrEqual(40);
  });

  it("va en recta larga, lejos de otros turbos, rampas y cajas, y detrás de la parrilla", async () => {
    const track = await desvan();
    const def = await findTrack("desvan-de-las-maravillas")!.load();
    const rail = track.zones.find((z) => z.type === "boostTri")!;
    // Recta: el rumbo no cambia en todo el raíl.
    const h0 = pointAt(track, rail.from).heading;
    const h1 = pointAt(track, rail.to).heading;
    expect(Math.abs(h1 - h0)).toBeLessThan(0.05);
    // Nada más en la franja de 20 m antes y 20 m después del raíl, salvo un turbo que lo centre (≥ 20 m antes).
    for (const z of track.zones) {
      if (z === rail) continue;
      const clear = z.to < rail.from - 20 || z.from > rail.to + 20;
      expect(clear, `${z.type} en ${z.from}–${z.to}`).toBe(true);
    }
    // Ninguna fila de cajas dentro del raíl ni a menos de 15 m.
    for (const f of def.itemRows) {
      const d = f * track.length;
      expect(d < rail.from - 15 || d > rail.to + 15, `caja en ${d.toFixed(0)}`).toBe(true);
    }
    // La parrilla puede caer dentro del tramo, pero sale a ±3 m del eje: fuera de la franja del raíl.
    for (let slot = 0; slot < 8; slot++) {
      const g = gridPose(track, slot);
      const c = closestPoint(track, g.x, g.z);
      expect(surfaceAt(track, c), `parrilla ${slot}`).not.toBe("boostTri");
    }
  });

  it("la pista devuelve boostTri en la franja y asfalto un palmo fuera", async () => {
    const track = await desvan();
    const rail = track.zones.find((z) => z.type === "boostTri")!;
    const d = (rail.from + rail.to) / 2;
    const at = (lateral: number) => {
      const q = pointAt(track, d, lateral);
      return surfaceAt(track, closestPoint(track, q.x, q.z));
    };
    expect(at(0)).toBe("boostTri");
    expect(at(0.9)).toBe("boostTri");
    expect(at(1.3)).toBe("road");
    expect(at(-1.3)).toBe("road");
  });
});

describe("raíl triturbo: ×3", () => {
  it("el ×3 son 78 m/s (punta ×3) y el servidor lo tolera con margen", () => {
    expect(PADS.boostTri.mult).toBe(3);
    expect(TOP_SPEED).toBeCloseTo(78, 6);
    expect(MAX_PLAUSIBLE_SPEED).toBeGreaterThan(TOP_SPEED * 1.1);
    // Antes era maxSpeed·2 = 52 m/s: habría descartado el progreso de quien usa el raíl.
    expect(MAX_PLAUSIBLE_SPEED).toBeGreaterThan(KART.maxSpeed * 2);
  });

  it("al rodar sobre el raíl se llega a 78 m/s, y ningún otro turbo alarga el ×3", () => {
    const s = createKart();
    s.speed = KART.maxSpeed;
    for (let i = 0; i < 60 * 3; i++) {
      s.surface = "boostTri";
      stepKart(s, GAS, PHYSICS_DT);
    }
    expect(s.speed).toBeCloseTo(78, 3);
    expect(isBoosting(s)).toBe(true);
    // Un naranja encima no cambia la punta ni mantiene el ×3 vivo cuando se acaba el raíl.
    giveBoost(s, 3, 1.75);
    s.surface = "road";
    for (let i = 0; i < 60 * PADS.boostTri.time + 2; i++) stepKart(s, GAS, PHYSICS_DT);
    expect(s.triTime).toBe(0);
    expect(s.speed).toBeLessThan(78);
  });

  it("un kart centrado que llega a 26 m/s entra, acelera a ≈78 m/s y sale; descentrado 1,6 m no recibe nada", async () => {
    const track = await desvan();
    const rail = track.zones.find((z) => z.type === "boostTri")!;
    const peak = (lateral: number) => {
      const s = approach(track, rail, 30, lateral, 26);
      // Sin turbo previo: se parte de más allá del naranja de franja (que acaba 67 m antes del raíl).
      let max = 0;
      for (let i = 0; i < 60 * 3; i++) {
        stepKartOnTrack(s, botInput({ lane: lateral, lookAhead: 12 }, s, track), PHYSICS_DT, track);
        max = Math.max(max, s.speed);
      }
      return max;
    };
    expect(peak(0)).toBeGreaterThan(76);
    expect(peak(0)).toBeLessThanOrEqual(78.01);
    expect(peak(1.6)).toBeLessThan(KART.maxSpeed * 1.05);
  });

  it("al salir la inercia no es eterna: de 78 a la punta normal en ≈4 s y < 230 m (con coastDrag·2 serían 5,1 s y ≈290 m)", () => {
    const s = createKart();
    s.speed = 78;
    s.triTime = PADS.boostTri.time;
    let t = 0;
    let dist = 0;
    while (s.speed > KART.maxSpeed + 0.01 && t < 10) {
      stepKart(s, GAS, PHYSICS_DT);
      dist += s.speed * PHYSICS_DT;
      t += PHYSICS_DT;
    }
    // 0,8 s a ×3, frenada a TRI_RAIL.decel hasta la punta del naranja (45,5) y de ahí la normal (coastDrag·2).
    expect(t).toBeLessThan(4.3);
    expect(dist).toBeLessThan(230);
    expect(s.speed).toBeCloseTo(KART.maxSpeed, 1);
  });

  it("el trompo y reaparecer cancelan el ×3", () => {
    const s = createKart();
    s.surface = "boostTri";
    stepKart(s, GAS, PHYSICS_DT);
    expect(s.triTime).toBeGreaterThan(0);
    s.spinTime = 1;
    stepKart(s, GAS, PHYSICS_DT);
    expect(s.triTime).toBe(0);
    expect(isBoosting(s)).toBe(false);
  });
});

describe("raíl triturbo: el piloto automático", () => {
  it("el bot entra al raíl por el centro, llega a ≈78 m/s y completa la vuelta sin reaparecer", async () => {
    const track = await desvan();
    const rail = track.zones.find((z) => z.type === "boostTri")!;
    const pose = pointAt(track, 0);
    const s = createKart(pose.x, pose.z, pose.heading);
    s.speed = 12;
    const p = createProgress();
    let time = 0;
    let respawns = 0;
    let topInRail = 0;
    let maxLateral = 0;
    while (p.finishTime === null && time < 150) {
      const c = stepKartOnTrack(s, botInput({ lane: 0, lookAhead: 12 }, s, track), PHYSICS_DT, track);
      time += PHYSICS_DT;
      if (c.distance > rail.from && c.distance < rail.to) {
        topInRail = Math.max(topInRail, s.speed);
        maxLateral = Math.max(maxLateral, Math.abs(c.lateral));
      }
      updateProgress(p, track, c.distance, time, 1);
      if (needsRespawn(s, p, PHYSICS_DT)) {
        respawnKart(s, p, track);
        respawns++;
      }
    }
    expect(p.finishTime).not.toBeNull();
    expect(respawns).toBe(0);
    expect(topInRail).toBeGreaterThan(70);
    expect(maxLateral).toBeLessThan(TRI_RAIL.halfWidth + 0.5);
  });
});

describe("colisión por barrido: cajas y aceite a 78 m/s", () => {
  const track = buildTrackFromDef(pruebasDef);

  /** Mundo con UNA caja (o un aceite) en el centro de la pista a `at` m de meta y un kart que pasa a `speed`. */
  function pass(opts: { speed: number; hz: number; lateral?: number; kind?: "box" | "oil" }) {
    const box = createItemBoxes(track, [0], 1)[0]!;
    const c = pointAt(track, 150, opts.lateral ?? 0);
    box.x = c.x;
    box.z = c.z;
    const k = createRaceKart(1, createKart(pointAt(track, 100).x, pointAt(track, 100).z, pointAt(track, 100).heading), track);
    const w: ItemWorld = { track, karts: [k], boxes: [], oils: [], rockets: [], random: () => 0.5 };
    if (opts.kind === "oil") w.oils.push({ id: 1, x: c.x, z: c.z, owner: 99, safeTime: 0 } as ItemWorld["oils"][number]);
    else w.boxes.push(box);
    let picked = false;
    let minPoint = Infinity;
    const dt = 1 / opts.hz;
    let d = 100;
    // El primer paso fija la posición de partida del barrido (como el primer tick del servidor).
    stepItems(w, dt);
    for (let t = 0; t < 1.5; t += dt) {
      d += opts.speed * dt;
      const p = pointAt(track, d);
      k.state.x = p.x;
      k.state.z = p.z;
      minPoint = Math.min(minPoint, Math.hypot(p.x - c.x, p.z - c.z));
      const events = stepItems(w, dt);
      if (events.some((e) => e.type === (opts.kind === "oil" ? "hit" : "pickup"))) picked = true;
    }
    return { picked, minPoint, step: opts.speed * dt };
  }

  it("a 78 m/s y 20 Hz el kart avanza 3,9 m por mensaje: casi el diámetro de una caja, y la cuerda de un pase descentrado es menor", () => {
    const r = pass({ speed: 78, hz: 20 });
    expect(r.step).toBeCloseTo(3.9, 6);
    expect(r.step).toBeGreaterThan(1.9 * ITEMS.boxRadius);
    // Pasando a 1,5 m del centro la cuerda dentro del radio mide 2·√(2² − 1,5²) ≈ 2,6 m < 3,9 m: hay muestras que no la pisan.
    expect(2 * Math.sqrt(ITEMS.boxRadius ** 2 - 1.5 ** 2)).toBeLessThan(r.step);
  });

  it("recoge la caja de su trayectoria aunque ninguna posición caiga dentro del radio", () => {
    // Se prueba con varios desfases de la caja respecto a las muestras: siempre hay uno en que ningún punto cae dentro.
    let blind = 0;
    for (let off = 0; off < 3.9; off += 0.3) {
      const box = createItemBoxes(track, [0], 1)[0]!;
      const c = pointAt(track, 150 + off, 1.5);
      box.x = c.x;
      box.z = c.z;
      const k = createRaceKart(1, createKart(pointAt(track, 100).x, pointAt(track, 100).z, 0), track);
      const w: ItemWorld = { track, karts: [k], boxes: [box], oils: [], rockets: [], random: () => 0.5 };
      stepItems(w, 0.05);
      let picked = false;
      let minPoint = Infinity;
      let d = 100;
      for (let i = 0; i < 40; i++) {
        d += 78 * 0.05;
        const p = pointAt(track, d);
        k.state.x = p.x;
        k.state.z = p.z;
        minPoint = Math.min(minPoint, Math.hypot(p.x - c.x, p.z - c.z));
        if (stepItems(w, 0.05).some((e) => e.type === "pickup")) picked = true;
      }
      expect(picked, `desfase ${off.toFixed(1)}`).toBe(true);
      if (minPoint > ITEMS.boxRadius) blind++;
    }
    // Sin barrido, en estos desfases el kart no habría recogido la caja.
    expect(blind).toBeGreaterThan(0);
  });

  it("no la recoge si pasa fuera del radio (el barrido no ensancha la caja)", () => {
    const r = pass({ speed: 78, hz: 20, lateral: ITEMS.boxRadius + 1.5 });
    expect(r.picked).toBe(false);
  });

  it("el aceite también se pisa a 78 m/s", () => {
    expect(pass({ speed: 78, hz: 20, kind: "oil" }).picked).toBe(true);
  });

  it("un teletransporte (reaparecer) no barre las cajas del camino", () => {
    const box = createItemBoxes(track, [0], 1)[0]!;
    const mid = pointAt(track, 150);
    box.x = mid.x;
    box.z = mid.z;
    const a = pointAt(track, 100);
    const k = createRaceKart(1, createKart(a.x, a.z, a.heading), track);
    const w: ItemWorld = { track, karts: [k], boxes: [box], oils: [], rockets: [], random: () => 0.5 };
    stepItems(w, 0.05);
    const b = pointAt(track, 200);
    k.state.x = b.x;
    k.state.z = b.z;
    expect(stepItems(w, 0.05).some((e) => e.type === "pickup")).toBe(false);
  });

  it("distanceToSegment: extremos, interior y segmento degenerado", () => {
    expect(distanceToSegment(0, 1, -1, 0, 1, 0)).toBeCloseTo(1, 9);
    expect(distanceToSegment(3, 0, -1, 0, 1, 0)).toBeCloseTo(2, 9);
    expect(distanceToSegment(0, 2, 0, 0, 0, 0)).toBeCloseTo(2, 9);
  });
});
