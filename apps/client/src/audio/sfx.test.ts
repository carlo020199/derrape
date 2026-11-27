import { beforeAll, describe, expect, it, vi } from "vitest";

// AudioContext falso: cuenta osciladores y ráfagas de ruido para comprobar que cada SFX suena.
const made = { osc: 0, noise: 0 };
const node = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), value: 0 });
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  resume = async () => undefined;
  createOscillator() {
    made.osc++;
    return { ...node(), type: "sine", frequency: param() };
  }
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() {
    return { ...node(), type: "", Q: { value: 0 }, frequency: param() };
  }
  createBuffer(_c: number, frames: number) {
    return { getChannelData: () => new Float32Array(frames) };
  }
  createBufferSource() {
    made.noise++;
    return { ...node(), buffer: null };
  }
}

describe("sonidos de turbo y aterrizaje (WebAudio por código)", () => {
  let sfx: typeof import("./sfx").sfx;
  beforeAll(async () => {
    (globalThis as unknown as { window: unknown }).window = { AudioContext: FakeAudioContext };
    const mod = await import("./sfx");
    await mod.unlockAudio();
    sfx = mod.sfx;
  });

  it("cada turbo de suelo suena distinto: azul corto, naranja más rico, triturbo con ráfaga larga", () => {
    vi.useFakeTimers();
    const run = (f: () => void) => {
      made.osc = 0;
      made.noise = 0;
      f();
      vi.runAllTimers();
      return { ...made };
    };
    const blue = run(() => sfx.pad("blue"));
    const orange = run(() => sfx.pad("orange"));
    const tri = run(() => sfx.pad("tri"));
    expect(blue).toEqual({ osc: 1, noise: 1 });
    expect(orange).toEqual({ osc: 2, noise: 1 });
    expect(tri).toEqual({ osc: 4, noise: 1 }); // tres subidas escalonadas y el brillo final
    vi.useRealTimers();
  });

  it("el aterrizaje es un golpe con polvo y, con turbo de rampa, un chirrido que sube", () => {
    vi.useFakeTimers();
    made.osc = 0;
    made.noise = 0;
    sfx.landing(false);
    vi.runAllTimers();
    expect(made).toEqual({ osc: 1, noise: 1 });
    made.osc = 0;
    sfx.landing(true);
    vi.runAllTimers();
    expect(made.osc).toBe(2);
    vi.useRealTimers();
  });
});
