import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { TRACKS, buildTrackFromDef, closestPoint, pointAt, surfaceNormal, surfaceY } from "@derrape/shared";
import { CAM_Y_STEP_MAX, ChaseCamera, ROLL_RATE_MAX, softFloor, type CameraCue } from "./chaseCamera";

describe("cámara de persecución", () => {
  it("softFloor es continuo, nunca baja del suelo y no cambia nada lejos de él", () => {
    expect(softFloor(5, 1)).toBe(5);
    expect(softFloor(-3, 1)).toBe(1);
    let prev = softFloor(-1, 0);
    for (let y = -1; y <= 1; y += 0.01) {
      const v = softFloor(y, 0);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Math.abs(v - prev)).toBeLessThan(0.02);
      prev = v;
    }
  });

  it("en una vuelta a Ánimas a ~25 m/s el alabeo va a ≤ 25 °/s y la altura salta ≤ 0,15 m por fotograma", async () => {
    const track = buildTrackFromDef(await TRACKS[11]!.load());
    const cam = new THREE.PerspectiveCamera(66, 390 / 844, 0.1, 260);
    const chase = new ChaseCamera(cam);
    const dt = 1 / 60;
    const speed = 25;
    const floorAt = (x: number, z: number) => {
      const c = closestPoint(track, x, z);
      return surfaceY(c);
    };
    let prevRoll: number | null = null;
    let prevY: number | null = null;
    let worstRate = 0;
    let worstY = 0;
    for (let d = 0, frame = 0; d < track.length; d += speed * dt, frame++) {
      const p = pointAt(track, d);
      const c = closestPoint(track, p.x, p.z);
      const cue: CameraCue = {
        relief: true,
        bankDeg: p.bank,
        airborne: false,
        groundY: p.y,
        bigJump: false,
        floorAt,
        normal: surfaceNormal(track, c),
      };
      chase.update(p.x, p.y, p.z, p.heading, 1, dt, cue);
      const roll = (chase as unknown as { rollDeg: number }).rollDeg;
      if (frame > 5) {
        worstRate = Math.max(worstRate, Math.abs(roll - prevRoll!) / dt);
        worstY = Math.max(worstY, Math.abs(cam.position.y - prevY!));
      }
      prevRoll = roll;
      prevY = cam.position.y;
    }
    expect(worstRate).toBeLessThanOrEqual(ROLL_RATE_MAX + 1e-6);
    expect(worstY).toBeLessThanOrEqual(CAM_Y_STEP_MAX + 1e-6);
  });
});
