import { describe, expect, it } from "vitest";
import { TOUCH } from "@derrape/shared";
import { FingerGesture } from "./gestures";

describe("gestos", () => {
  it("arrastrar a la derecha gira a la derecha, proporcional y con tope", () => {
    const g = new FingerGesture(100, 500, 0);
    g.move(100 + TOUCH.steerRange * 0.3, 500);
    expect(g.steer).toBeCloseTo(0.3);
    g.move(100 + TOUCH.steerRange * 3, 500);
    expect(g.steer).toBe(1);
  });

  it("la zona muerta ignora temblores del dedo", () => {
    const g = new FingerGesture(100, 500, 0);
    g.move(102, 500);
    expect(g.steer).toBe(0);
  });

  it("arrastrar lejos activa el derrape hacia ese lado", () => {
    const g = new FingerGesture(200, 500, 0);
    g.move(200 - TOUCH.steerRange * 0.4, 500);
    expect(g.driftSide).toBe(0);
    g.move(200 - TOUCH.steerRange * 0.7, 500);
    expect(g.driftSide).toBe(-1);
    // Mientras se mantiene el dedo, el derrape sigue aunque se enderece.
    g.move(200, 500);
    expect(g.driftSide).toBe(-1);
  });

  it("tras pasarse del rango, volver un poco ya endereza", () => {
    const g = new FingerGesture(100, 500, 0);
    g.move(100 + TOUCH.steerRange * 2, 500);
    g.move(100 + TOUCH.steerRange * 1.5, 500);
    expect(g.steer).toBeCloseTo(0.5);
  });

  it("toque rápido = usar objeto", () => {
    const g = new FingerGesture(100, 500, 0);
    g.move(104, 503);
    expect(g.release(120)).toBe("use");
  });

  it("deslizar arriba = adelante; abajo = atrás", () => {
    const up = new FingerGesture(100, 500, 0);
    up.move(110, 420);
    expect(up.release(200)).toBe("forward");
    const down = new FingerGesture(100, 500, 0);
    down.move(95, 580);
    expect(down.release(200)).toBe("back");
  });

  it("girar un rato no lanza nada", () => {
    const g = new FingerGesture(100, 500, 0);
    g.move(180, 520);
    expect(g.release(1500)).toBeNull();
    const slow = new FingerGesture(100, 500, 0);
    slow.move(100, 400);
    expect(slow.release(900)).toBeNull();
  });
});
