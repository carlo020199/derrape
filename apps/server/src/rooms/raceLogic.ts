// Lógica de una sala de carrera, sin red (se testea sola). RaceRoom la conecta con Colyseus.
// El servidor manda en: sala, anfitrión, colores, cuenta atrás, vueltas, posiciones, resultados
// y objetos (cajas, qué objeto toca, aceite, cohetes, impactos y escudos).

import {
  CUP,
  DEFAULT_CHARACTER,
  DEFAULT_KART,
  DEFAULT_TRACK,
  KART,
  KART_COLORS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RACE,
  TRACK_CHOICE,
  buildTrackFromDef,
  closestPoint,
  createItemBoxes,
  createKart,
  createProgress,
  createRaceKart,
  findCharacter,
  findKart,
  findTrack,
  gridPose,
  normalizeName,
  pickRandomTrack,
  standings,
  stepItems,
  tracksInCup,
  updateProgress,
  useItem,
  type CountdownMessage,
  type CupStatus,
  type ItemAction,
  type ItemEvent,
  type ItemWorld,
  type ItemsSnapshot,
  type LapProgress,
  type LobbyMessage,
  type LobbyMode,
  type NetItemEvent,
  type NetKartState,
  type RaceKart,
  type ResultsMessage,
  type RoomPhase,
  type StatesMessage,
  type Track,
} from "@derrape/shared";

/** Segundos que se espera a los demás cuando alguien ya ha llegado a meta. */
export const FINISH_GRACE = 30;
/** Más rápido que esto (m/s) entre dos estados es un salto sospechoso: no cuenta para el progreso. */
const MAX_PLAUSIBLE_SPEED = KART.maxSpeed * 2;
/** Subpasos de la simulación de objetos por cada tick del servidor (para que los cohetes no se salten a nadie). */
const ITEM_SUBSTEPS = 3;
const ITEM_ACTIONS: readonly ItemAction[] = ["use", "forward", "back"];

interface Player {
  id: string;
  name: string;
  color: number;
  character: string;
  /** Id del coche elegido (no confundir con `kart`, el de la simulación). */
  kartId: string;
  connected: boolean;
  racing: boolean;
  state: NetKartState | null;
  progress: LapProgress;
  raceDistance: number;
  trackDistance: number | null;
  last: { x: number; z: number; t: number; respawns: number } | null;
  /** Su kart en la simulación de objetos del servidor (posición copiada de lo que manda el cliente). */
  kart: RaceKart | null;
}

export class RaceLogic {
  phase: RoomPhase = "lobby";
  trackId = DEFAULT_TRACK;
  mode: LobbyMode = "single";
  laps = RACE.laps;
  private players = new Map<string, Player>();
  private hostId: string | null = null;
  private track: Track | null = null;
  /** Momento de la salida (ms, reloj del servidor). */
  private goAt = 0;
  private firstFinishAt: number | null = null;
  private items: ItemWorld | null = null;
  private lastTick: number | null = null;
  /** Circuito elegido en el selector (puede ser cup-sol / random / id real). */
  private choiceId: string = DEFAULT_TRACK;
  private cupTracks: string[] = [];
  private cupIndex = 0;
  private cupScores = new Map<string, number>();

  constructor(
    readonly code: string,
    private readonly random: () => number = Math.random,
  ) {}

  get playerCount() {
    return this.players.size;
  }

  get host() {
    return this.hostId;
  }

  addPlayer(id: string, name: unknown, preferredColor?: number, character?: unknown, kart?: unknown): void {
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
      character: findCharacter(character)?.id ?? DEFAULT_CHARACTER,
      kartId: findKart(kart)?.id ?? DEFAULT_KART,
      connected: true,
      racing: false,
      state: null,
      progress: createProgress(),
      raceDistance: 0,
      trackDistance: null,
      last: null,
      kart: null,
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
  setProfile(id: string, name?: unknown, color?: unknown, character?: unknown, kart?: unknown): string | null {
    const p = this.players.get(id);
    if (!p) return "No estás en la sala.";
    if (this.phase !== "lobby" && p.racing && (character !== undefined || kart !== undefined)) return "No se puede cambiar de coche en plena carrera.";
    if (character !== undefined) {
      if (!findCharacter(character)) return "Ese personaje no existe.";
      p.character = character as string;
    }
    if (kart !== undefined) {
      if (!findKart(kart)) return "Ese coche no existe.";
      p.kartId = kart as string;
    }
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
    if (typeof trackId !== "string") return "Ese circuito no existe.";
    // En mitad de una copa el circuito lo marca el servidor.
    if (this.mode.startsWith("cup") && this.cupTracks.length > 0 && this.cupIndex > 0 && this.cupIndex < this.cupTracks.length) {
      return "Termina la copa o elige otra cosa al acabar.";
    }
    if (trackId === TRACK_CHOICE.random) {
      this.mode = "random";
      this.choiceId = trackId;
      this.cupTracks = [];
      this.cupIndex = 0;
      this.cupScores.clear();
      this.trackId = pickRandomTrack(this.random);
      return null;
    }
    if (trackId === TRACK_CHOICE.cupSol || trackId === TRACK_CHOICE.cupLuna) {
      const cup = trackId === TRACK_CHOICE.cupSol ? "sol" : "luna";
      const list = tracksInCup(cup);
      if (list.length === 0) return "Esa copa no tiene circuitos.";
      this.mode = trackId as LobbyMode;
      this.choiceId = trackId;
      this.cupTracks = list.map((t) => t.id);
      this.cupIndex = 0;
      this.cupScores.clear();
      this.trackId = this.cupTracks[0]!;
      return null;
    }
    if (!findTrack(trackId)) return "Ese circuito no existe.";
    this.mode = "single";
    this.choiceId = trackId;
    this.cupTracks = [];
    this.cupIndex = 0;
    this.cupScores.clear();
    this.trackId = trackId;
    return null;
  }

  /** El anfitrión empieza la carrera: cuenta atrás y parrilla. */
  async startRace(id: string, now: number): Promise<CountdownMessage | string> {
    if (id !== this.hostId) return "Solo el anfitrión puede empezar.";
    if (this.phase !== "lobby") return "La carrera ya ha empezado.";
    const ready = [...this.players.values()].filter((p) => p.connected);
    if (ready.length < MIN_PLAYERS) return `Hacen falta al menos ${MIN_PLAYERS} jugadores.`;

    if (this.mode === "random") this.trackId = pickRandomTrack(this.random);
    if (this.mode.startsWith("cup") && this.cupTracks.length > 0) {
      this.trackId = this.cupTracks[Math.min(this.cupIndex, this.cupTracks.length - 1)]!;
    }

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
      p.kart = null;
    }
    // Hasta que manden su primer estado, cada uno cuenta desde su sitio en la parrilla
    // (si no, alguien sin conexión parecería ir por delante de los que ya corren).
    ready.forEach((p, slot) => {
      const pose = gridPose(this.track!, slot);
      const d = closestPoint(this.track!, pose.x, pose.z).distance;
      p.trackDistance = d;
      p.raceDistance = d > this.track!.length / 2 ? d - this.track!.length : d;
      p.kart = createRaceKart(slot, createKart(pose.x, pose.z, pose.heading), this.track!);
    });
    this.items = {
      track: this.track,
      karts: ready.map((p) => p.kart!),
      boxes: createItemBoxes(this.track, def.itemRows, 4),
      oils: [],
      rockets: [],
      random: this.random,
    };
    this.lastTick = null;
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
    if (p.kart) {
      const k = p.kart.state;
      k.x = s.x;
      k.z = s.z;
      k.heading = s.heading;
      k.speed = s.speed;
    }
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

  /** El jugador usa su objeto. Devuelve los eventos (vacío si no tenía nada que usar). */
  useItem(id: string, action: unknown): NetItemEvent[] {
    const p = this.players.get(id);
    if (this.phase !== "racing" || !this.items || !p?.kart || p.progress.finishTime !== null) return [];
    if (!ITEM_ACTIONS.includes(action as ItemAction)) return [];
    const events: ItemEvent[] = [];
    useItem(this.items, p.kart, action as ItemAction, events);
    return this.toNetEvents(events);
  }

  /**
   * Avanza el reloj de la sala: cuenta atrás, objetos y fin de carrera.
   * Devuelve los resultados cuando la carrera termina y los eventos de objetos de este tick.
   */
  tick(now: number): { results: ResultsMessage | null; events: NetItemEvent[] } {
    if (this.phase === "countdown" && now >= this.goAt) this.phase = "racing";
    if (this.phase !== "racing") return { results: null, events: [] };

    const events = this.stepItems(now);

    const racing = [...this.players.values()].filter((p) => p.racing);
    const stillRunning = racing.filter((p) => p.connected && p.progress.finishTime === null);
    const graceOver = this.firstFinishAt !== null && now - this.firstFinishAt >= FINISH_GRACE * 1000;
    if (racing.length > 0 && stillRunning.length > 0 && !graceOver) return { results: null, events };

    const results = this.ranking().map((p, i) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      position: i + 1,
      time: p.progress.finishTime,
    }));
    this.phase = "lobby";
    for (const p of this.players.values()) {
      p.racing = false;
      p.kart = null;
    }
    this.track = null;
    this.items = null;

    let cup: (CupStatus & { finished: boolean }) | undefined;
    if (this.mode.startsWith("cup") && this.cupTracks.length > 0) {
      for (const r of results) {
        const pts = CUP.points[r.position - 1] ?? 0;
        this.cupScores.set(r.id, (this.cupScores.get(r.id) ?? 0) + pts);
      }
      this.cupIndex += 1;
      const finished = this.cupIndex >= this.cupTracks.length;
      cup = { ...this.cupStatus()!, finished };
      if (!finished) this.trackId = this.cupTracks[this.cupIndex]!;
      else {
        this.mode = "single";
        this.choiceId = this.trackId;
        this.cupTracks = [];
        this.cupIndex = 0;
      }
    }
    return { results: { results, cup }, events };
  }

  private cupStatus(): CupStatus | null {
    if (!this.mode.startsWith("cup") || this.cupTracks.length === 0) return null;
    const name = this.mode === "cup-sol" ? "Copa Sol" : "Copa Luna";
    const scores = [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, color: p.color, points: this.cupScores.get(p.id) ?? 0 }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    return {
      name,
      race: Math.min(this.cupIndex + 1, this.cupTracks.length),
      total: this.cupTracks.length,
      scores,
    };
  }

  private stepItems(now: number): NetItemEvent[] {
    const world = this.items;
    if (!world) return [];
    const dt = Math.min(0.2, this.lastTick === null ? 0 : (now - this.lastTick) / 1000);
    this.lastTick = now;
    // El trompo y el escudo los lleva el servidor (los clientes solo los reflejan).
    for (const k of world.karts) {
      k.state.spinTime = Math.max(0, k.state.spinTime - dt);
      k.state.shieldTime = Math.max(0, k.state.shieldTime - dt);
    }
    const events: ItemEvent[] = [];
    for (let i = 0; i < ITEM_SUBSTEPS; i++) events.push(...stepItems(world, dt / ITEM_SUBSTEPS));
    return this.toNetEvents(events);
  }

  /** Los eventos de la simulación usan el número de parrilla; en red, el id del jugador. */
  private toNetEvents(events: ItemEvent[]): NetItemEvent[] {
    const bySlot = new Map([...this.players.values()].filter((p) => p.kart).map((p) => [p.kart!.id, p.id]));
    return events.map((e): NetItemEvent => {
      const kart = bySlot.get(e.kart) ?? "";
      if (e.type === "hit") return { type: "hit", kart, by: e.by, owner: bySlot.get(e.owner) };
      if (e.type === "use") return { type: "use", kart, item: e.item };
      return { type: e.type, kart };
    });
  }

  /** Para tests y depuración: el kart de un jugador en la simulación de objetos. */
  kartOf(id: string): RaceKart | null {
    return this.players.get(id)?.kart ?? null;
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
          item: p.kart?.item ?? null,
          rolling: (p.kart?.rollTime ?? 0) > 0,
        })),
      items: this.itemsSnapshot(),
    };
  }

  private itemsSnapshot(): ItemsSnapshot | undefined {
    const w = this.items;
    if (!w) return undefined;
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      hiddenBoxes: w.boxes.flatMap((b, i) => (b.respawn > 0 ? [i] : [])),
      oils: w.oils.map((o) => ({ id: o.id, x: r(o.x), z: r(o.z) })),
      rockets: w.rockets.map((k) => ({ id: k.id, x: r(k.x), z: r(k.z) })),
    };
  }

  lobby(): LobbyMessage {
    return {
      code: this.code,
      phase: this.phase,
      trackId: this.mode.startsWith("cup") && this.cupTracks.length > 0 ? this.choiceId : this.mode === "random" ? this.choiceId : this.trackId,
      mode: this.mode,
      cup: this.cupStatus(),
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        character: p.character,
        kart: p.kartId,
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
  const optional = (k: string) => o[k] === undefined || (typeof o[k] === "number" && Number.isFinite(o[k] as number));
  return (
    ["x", "z", "heading", "speed", "driftDir", "driftLevel", "hop", "respawns"].every(finite) &&
    optional("y") &&
    optional("vy") &&
    Math.abs(o.speed as number) < 200 &&
    Math.abs((o.y as number) ?? 0) < 500 &&
    Math.abs((o.vy as number) ?? 0) < 80
  );
}
