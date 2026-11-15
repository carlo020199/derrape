// Sonido original con Web Audio (sin archivos). Se desbloquea con el primer toque/clic.

let ctx: AudioContext | null = null;
let unlocked = false;
let muted = false;

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

/** Llamar desde el primer gesto del usuario (menú, tocar, etc.). */
export async function unlockAudio(): Promise<void> {
  const c = ac();
  if (!c) return;
  if (c.state === "suspended") await c.resume().catch(() => undefined);
  unlocked = c.state === "running";
}

export function setMuted(value: boolean) {
  muted = value;
}

function beep(freq: number, dur: number, type: OscillatorType = "square", gain = 0.04, slide = 0) {
  const c = ac();
  if (!c || !unlocked) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  countdown: (n: number) => beep(n <= 0 ? 880 : 440, n <= 0 ? 0.25 : 0.12, "triangle", 0.05),
  boost: () => beep(220, 0.2, "sawtooth", 0.035, 400),
  pickup: () => beep(660, 0.08, "square", 0.03, 200),
  hit: () => beep(110, 0.25, "sawtooth", 0.05, -60),
  finish: () => {
    beep(523, 0.12, "triangle", 0.04);
    setTimeout(() => beep(659, 0.12, "triangle", 0.04), 100);
    setTimeout(() => beep(784, 0.2, "triangle", 0.045), 200);
  },
  drift: (level: number) => {
    if (level <= 0) return;
    beep(180 + level * 40, 0.04, "sawtooth", 0.015);
  },
};
