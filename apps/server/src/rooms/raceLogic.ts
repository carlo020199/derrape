// Lógica de una sala de carrera, sin red (se testea sola). RaceRoom la conecta con Colyseus.
// El servidor manda en: sala, anfitrión, colores, cuenta atrás, vueltas, posiciones y resultados.

import {
  DEFAULT_TRACK,
  KART,
  KART_COLORS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RACE,
  buildTrackFromDef,
  closestPoint,
  createProgress,
  findTrack,
  gridPose,
  normalizeName,
  standings,
  updateProgress,
  type CountdownMessage,
  type LapProgress,
  type LobbyMessage,
  type NetKartState,
  type ResultsMessage,
  type RoomPhase,
  type StatesMessage,
  type Track,
} from "@derrape/shared";

/** Segundos que se espera a los demás cuando alguien ya ha llegado a meta. */
export const FINISH_GRACE = 30;
/** Más rápido que esto (m/s) entre dos estados es un salto sospechoso: no cuenta para el progreso. */
const MAX_PLAUSIBLE_SPEED = KART.maxSpeed * 2;

interface Player {
  id: string;
  name: string;
  color: number;
  connected: boolean;
  racing: boolean;
  state: NetKartState | null;
  progress: LapProgress;
  raceDistance: number;
  trackDistance: number | null;
  last: { x: number; z: number; t: number; respawns: number } | null;
}

export class RaceLogic {
  phase: RoomPhase = "lobby";
  trackId = DEFAULT_TRACK;
  laps = RACE.laps;
  private players = new Map<string, Player>();
  private hostId: string | null = null;
  private track: Track | null = null;
  /** Momento de la salida (ms, reloj del servidor). */
  private goAt = 0;
  private firstFinishAt: number | null = null;

  constructor(readonly code: string) {}

  get playerCount() {
    return this.players.size;
  }

  get host() {
    return this.hostId;
  }

  addPlayer(id: string, name: unknown, preferredColor?: number): void {
    if (this.players.size >= MAX_PLAYERS) throw new Error("La sala está llena.");
    const taken = new Set([...this.players.values()].map((p) => p.color));
    const color =
      preferredColor !== undefined && preferredColor in KART_COLORS && !taken.has(preferredColor)
        ? preferredColor
        : KART_COLORS.findIndex((_, i) => !taken.has(i));
    this.players.set(id, {
      id,
      name: normalizeName(name),
      color,
      connected: true,
      racing: false,
      state: null,
      progress: createProgress(),
      raceDistance: 0,
      trackDistance: null,
      last: null,
    });
    this.hostId ??= id;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    if (this.hostId === id) this.hostId = this.firstConnected()?.id ?? this.players.keys().next().value ?? null;
  }

  setConnected(id: string, connected: boolean): void {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = connected;
    // Si el anfitrión se cae, manda el siguiente que siga conectado.
    if (!connected && this.hostId === id) this.hostId = this.firstConnected()?.id ?? id;
  }

  private firstConnected() {
    return [...this.players.values()].find((p) => p.connected);
  }

  /** Cambia nombre y/o color. Devuelve un error legible o null. */
  setProfile(id: string, name?: unknown, color?: unknown): string | null {
    const p = this.players.get(id);
    if (!p) return "No estás en la sala.";
    if (name !== undefined) p.name = normalizeName(name);
    if (color !== undefined) {
      if (typeof color !== "number" || !(color in KART_COLORS)) return "Color no válido.";
      if ([...this.players.values()].some((o) => o !== p && o.color === color)) return "Ese color ya lo tiene otro jugador.";
      p.color = color;
    }
    return null;
  }

  setTrack(id: string, trackId: unknown): string | null {
    if (id !== this.hostId) return "Solo el anfitrión elige el circuito.";
    if (this.phase !== "lobby") return "La carrera ya ha empezado.";
    if (typeof trackId !== "string" || !findTrack(trackId)) return "Ese circuito no existe.";
    this.trackId = trackId;
    return null;
  }

  /** El anfitrión empieza la carrera: cuenta atrás y parrilla. */
  async startRace(id: string, now: number): Promise<CountdownMessage | string> {
    if (id !== this.hostId) return "Solo el anfitrión puede empezar.";
    if (this.phase !== "lobby") return "La carrera ya ha empezado.";
    const ready = [...this.players.values()].filter((p) => p.connected);
    if (ready.length < MIN_PLAYERS) return `Hacen falta al menos ${MIN_PLAYERS} jugadores.`;

    const def = await findTrack(this.trackId)!.load();
    this.track = buildTrackFromDef(def);
    this.laps = def.laps;
    for (const p of this.players.values()) {
      p.racing = p.connected;
      p.state = null;
      p.progress = createProgress();
      p.raceDistance = 0;
      p.trackDistance = null;
      p.last = null;
    }
    // Hasta que manden su primer estado, cada uno cuenta desde su sitio en la parrilla
    // (si no, alguien sin conexión parecería ir por delante de los que ya corren).
    ready.forEach((p, slot) => {
      const pose = gridPose(this.track!, slot);
      const d = closestPoint(this.track!, pose.x, pose.z).distance;
      p.trackDistance = d;
      p.raceDistance = d > this.track!.length / 2 ? d - this.track!.length : d;
    });
    this.phase = "countdown";
    this.goAt = now + RACE.countdown * 1000;
    this.firstFinishAt = null;
    return { trackId: this.trackId, laps: this.laps, seconds: RACE.countdown, grid: ready.map((p) => p.id) };
  }

  /**
   * Para quien vuelve a una carrera en marcha (recargó la página o cambió de app):
   * la cuenta atrás con el tiempo transcurrido y dónde estaba su kart. Null si no estaba corriendo.
   */
  resumeFor(id: string, now: number, grid: string[]): CountdownMessage | null {
    const p = this.players.get(id);
    if (!p || !p.racing || this.phase === "lobby") return null;
    return {
      trackId: this.trackId,
      laps: this.laps,
      seconds: RACE.countdown,
      grid,
      elapsed: RACE.countdown - (this.goAt - now) / 1000,
      resume: p.state ?? undefined,
    };
  }

  /** Estado que manda un cliente. Se valida lo básico antes de usarlo para el progreso. */
  onState(id: string, s: NetKartState, now: number): void {
    const p = this.players.get(id);
    if (!p || !p.racing || !isValidState(s)) return;
    p.state = s;
    if (this.phase !== "racing" || !this.track) return;

    const plausible =
      p.last === null ||
      s.respawns !== p.last.respawns ||
      Math.hypot(s.x - p.last.x, s.z - p.last.z) / Math.max((now - p.last.t) / 1000, 0.05) <= MAX_PLAUSIBLE_SPEED;
    p.last = { x: s.x, z: s.z, t: now, respawns: s.respawns };
    if (!plausible) return;

    const track = this.track;
    const d = closestPoint(track, s.x, s.z).distance;
    let delta = d - (p.trackDistance ?? d);
    if (delta > track.length / 2) delta -= track.length;
    if (delta < -track.length / 2) delta += track.length;
    p.raceDistance += delta;
    p.trackDistance = d;
    const event = updateProgress(p.progress, track, d, this.raceTime(now), this.laps);
    if (event === "finish") this.firstFinishAt ??= now;
  }

  raceTime(now: number) {
    return Math.max(0, (now - this.goAt) / 1000);
  }

  /** Avanza el reloj de la sala. Devuelve los resultados cuando la carrera termina. */
  tick(now: number): ResultsMessage | null {
    if (this.phase === "countdown" && now >= this.goAt) this.phase = "racing";
    if (this.phase !== "racing") return null;

    const racing = [...this.players.values()].filter((p) => p.racing);
    const stillRunning = racing.filter((p) => p.connected && p.progress.finishTime === null);
    const graceOver = this.firstFinishAt !== null && now - this.firstFinishAt >= FINISH_GRACE * 1000;
    if (racing.length > 0 && stillRunning.length > 0 && !graceOver) return null;

    const results = this.ranking().map((p, i) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      position: i + 1,
      time: p.progress.finishTime,
    }));
    this.phase = "lobby";
    for (const p of this.players.values()) p.racing = false;
    this.track = null;
    return { results };
  }

  private ranking() {
    return standings([...this.players.values()].filter((p) => p.racing));
  }

  snapshot(now: number): StatesMessage {
    const order = this.ranking();
    return {
      t: now,
      karts: order
        .filter((p) => p.state !== null)
        .map((p) => ({
          id: p.id,
          s: p.state!,
          lap: p.progress.lap,
          position: order.indexOf(p) + 1,
          finished: p.progress.finishTime !== null,
        })),
    };
  }

  lobby(): LobbyMessage {
    return {
      code: this.code,
      phase: this.phase,
      trackId: this.trackId,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        host: p.id === this.hostId,
        connected: p.connected,
        racing: p.racing,
      })),
    };
  }
}

function isValidState(s: unknown): s is NetKartState {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  const finite = (k: string) => typeof o[k] === "number" && Number.isFinite(o[k]);
  return ["x", "z", "heading", "speed", "driftDir", "driftLevel", "hop", "respawns"].every(finite) && Math.abs(o.speed as number) < 200;
}
