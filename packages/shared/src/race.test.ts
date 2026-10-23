import { describe, expect, it } from "vitest";
import { botInput } from "./bot";
import { createKart, stepKart, type KartInput } from "./kart";
import {
  applyStart,
  checkpointCount,
  createProgress,
  formatTime,
  needsRespawn,
  respawnKart,
  startResult,
  updateProgress,
} from "./race";
import { collideKartWithTrack, gridPose, surfaceAt } from "./track";
import paseo from "./tracks/01-paseo-del-puerto";
import { buildTrackFromDef } from "./tracks/types";
import { KART, PHYSICS_DT, RACE, SURFACE } from "./tuning";

const track = buildTrackFromDef(paseo);
const n = checkpointCount(track);
const at = (sector: number) => ((sector + 0.5) / n) * track.length;
const GAS: KartInput = { steer: 0, throttle: true, brake: false, drift: false };

describe("vueltas y checkpoints", () => {
  it("cruzar la salida empieza la vuelta 1 y cada vuelta completa suma una", () => {
    const p = createProgress();
    updateProgress(p, track, track.length - 5, 0, 3); // parrilla, detrás de la meta
    expect(p.lap).toBe(0);
    updateProgress(p, track, at(0), 0.5, 3);
    expect(p.lap).toBe(1);
    for (let s = 1; s < n; s++) updateProgress(p, track, at(s), 1 + s, 3);
    expect(updateProgress(p, track, at(0), 70, 3)).toBe("lap");
    expect(p.lap).toBe(2);
    expect(p.lapTimes).toEqual([70]);
  });

  it("no se puede atajar saltándose checkpoints", () => {
    const p = createProgress();
    updateProgress(p, track, at(0), 0, 3);
    updateProgress(p, track, at(1), 1, 3);
    // Salto directo al final de la vuelta.
    updateProgress(p, track, at(n - 1), 2, 3);
    updateProgress(p, track, at(0), 3, 3);
    expect(p.lap).toBe(1);
  });

  it("ir marcha atrás por la meta no suma vueltas", () => {
    const p = createProgress();
    updateProgress(p, track, at(0), 0, 3);
    for (let i = 0; i < 5; i++) {
      updateProgress(p, track, at(n - 1), i, 3);
      updateProgress(p, track, at(0), i + 0.5, 3);
    }
    expect(p.lap).toBe(1);
  });

  it("termina al completar las vueltas", () => {
    const p = createProgress();
    updateProgress(p, track, at(0), 0, 2);
    let last = null;
    for (let lap = 0; lap < 2; lap++) {
      for (let s = 1; s < n; s++) updateProgress(p, track, at(s), lap * 60 + s, 2);
      last = updateProgress(p, track, at(0), (lap + 1) * 60, 2);
    }
    expect(last).toBe("finish");
    expect(p.finishTime).toBe(120);
    expect(p.lapTimes).toHaveLength(2);
  });

  it("un piloto automático completa 3 vueltas del Paseo del Puerto en un tiempo razonable", () => {
    const pose = gridPose(track, 0);
    const s = createKart(pose.x, pose.z, pose.heading);
    const p = createProgress();
    let time = 0;
    while (p.finishTime === null && time < 400) {
      stepKart(s, botInput({ lane: 0, lookAhead: 12 }, s, track), PHYSICS_DT);
      const c = collideKartWithTrack(s, track);
      s.surface = surfaceAt(track, c);
      time += PHYSICS_DT;
      updateProgress(p, track, c.distance, time, 3);
      if (needsRespawn(s, p, PHYSICS_DT)) respawnKart(s, p, track);
    }
    expect(p.finishTime).not.toBeNull();
    // Sin derrapes ni turbos: algo más lento que una vuelta buena (60–75 s).
    for (const lap of p.lapTimes) {
      expect(lap).toBeGreaterThan(55);
      expect(lap).toBeLessThan(90);
    }
  });
});

describe("reaparecer", () => {
  it("si te atascas, reapareces en el último checkpoint mirando hacia delante", () => {
    const p = createProgress();
    p.respawnDistance = at(3);
    const s = createKart(9999, 9999, 2);
    let respawn = false;
    for (let i = 0; i < 60 * RACE.stuckTime + 2 && !respawn; i++) respawn = needsRespawn(s, p, PHYSICS_DT);
    expect(respawn).toBe(true);
    respawnKart(s, p, track);
    const c = collideKartWithTrack(s, track);
    expect(Math.abs(c.lateral)).toBeLessThan(0.5);
    expect(s.speed).toBe(0);
  });
});

describe("salida con turbo", () => {
  it("al salir el 2 = turbo largo; antes = se cala; tarde = turbo corto o nada", () => {
    expect(startResult(null)).toBe("normal");
    expect(startResult(0.5)).toBe("stall");
    expect(startResult(1.1)).toBe("perfect");
    expect(startResult(1.8)).toBe("good");
    expect(startResult(2.8)).toBe("normal");
    const s = createKart();
    expect(applyStart(s, "perfect")).toBe(0);
    expect(s.boostTime).toBe(RACE.startPerfectBoost);
    expect(applyStart(createKart(), "stall")).toBe(RACE.startStallTime);
  });
});

describe("superficies", () => {
  function topSpeedOn(surface: "road" | "offroad" | "slow") {
    const s = createKart();
    s.surface = surface;
    for (let i = 0; i < 60 * 6; i++) stepKart(s, GAS, PHYSICS_DT);
    return s.speed;
  }

  it("fuera de pista y en arena se va más lento", () => {
    expect(topSpeedOn("offroad")).toBeCloseTo(KART.maxSpeed * SURFACE.offroadSpeedMult, 1);
    expect(topSpeedOn("slow")).toBeCloseTo(KART.maxSpeed * SURFACE.slowSpeedMult, 1);
  });

  it("un turbo ignora el terreno", () => {
    const s = createKart();
    s.surface = "offroad";
    s.speed = KART.maxSpeed;
    s.boostTime = 1;
    s.boostMult = KART.boostSpeedMult;
    stepKart(s, GAS, PHYSICS_DT);
    expect(s.speed).toBeGreaterThan(KART.maxSpeed);
  });

  it("en hielo se gira menos", () => {
    const turn = (surface: "road" | "lowGrip") => {
      const s = createKart();
      s.speed = 20;
      s.surface = surface;
      for (let i = 0; i < 30; i++) stepKart(s, { ...GAS, steer: -1 }, PHYSICS_DT);
      return s.heading;
    };
    expect(turn("lowGrip")).toBeLessThan(turn("road") * 0.7);
  });

  it("un panel de turbo acelera", () => {
    const s = createKart();
    s.speed = 20;
    s.surface = "boostPad";
    stepKart(s, GAS, PHYSICS_DT);
    expect(s.boostTime).toBeGreaterThan(0);
    expect(s.boostMult).toBe(SURFACE.boostPadMult);
  });

  it("el arcén está fuera del asfalto pero dentro de los muros", () => {
    const pose = gridPose(track, 0);
    const s = createKart(pose.x, pose.z, pose.heading);
    const c = collideKartWithTrack(s, track);
    expect(surfaceAt(track, { ...c, lateral: 0 })).toBe("road");
    expect(surfaceAt(track, { ...c, lateral: track.width / 2 + 2 })).toBe("offroad");
  });
});

describe("tiempos", () => {
  it("formato m:ss.cc", () => {
    expect(formatTime(65.321)).toBe("1:05.32");
    expect(formatTime(9.5)).toBe("0:09.50");
  });
});
