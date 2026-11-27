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

/** Ráfaga de ruido filtrado (whoosh o golpe). `from`→`to`: frecuencia del filtro paso banda. */
function noise(dur: number, gain: number, from: number, to: number) {
  const c = ac();
  if (!c || !unlocked) return;
  const t0 = c.currentTime;
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t0);
}

const later = (ms: number, f: () => void) => setTimeout(f, ms);

export const sfx = {
  /** Turbo de suelo: azul = barrido corto y agudo; naranja = más grave y largo; triturbo = tres subidas y un brillo. */
  pad: (tint: "blue" | "orange" | "tri") => {
    if (tint === "blue") {
      beep(320, 0.22, "sawtooth", 0.03, 700);
      noise(0.25, 0.035, 600, 3200);
    } else if (tint === "orange") {
      beep(180, 0.38, "sawtooth", 0.04, 800);
      beep(360, 0.38, "square", 0.018, 900);
      noise(0.4, 0.05, 400, 2600);
    } else {
      for (let i = 0; i < 3; i++) later(i * 90, () => beep(300 + i * 160, 0.2, "sawtooth", 0.035, 900));
      later(280, () => beep(1320, 0.35, "triangle", 0.04, 600));
      noise(0.55, 0.06, 300, 4200);
    }
  },
  /** Aterrizaje: golpe grave y polvo; si hay turbo de rampa-mueble, un chirrido que sube. */
  landing: (boosted: boolean) => {
    beep(130, 0.2, "sine", 0.07, -80);
    noise(0.16, 0.05, 900, 200);
    if (boosted) later(60, () => beep(520, 0.18, "triangle", 0.035, 500));
  },
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
