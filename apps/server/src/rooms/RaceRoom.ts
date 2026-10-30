import { Room, type Client } from "colyseus";
import {
  MAX_PLAYERS,
  MSG,
  NET_SEND_HZ,
  randomRoomCode,
  type CountdownMessage,
  type ItemEventsMessage,
  type JoinOptions,
  type NetItemEvent,
  type NetKartState,
  type ProfileMessage,
  type ResultsMessage,
  type UseItemMessage,
} from "@derrape/shared";
import { RaceLogic } from "./raceLogic";

/** Segundos que se guarda el sitio a quien pierde la conexión o cambia de app. */
export const RECONNECT_SECONDS = 30;

const activeCodes = new Set<string>();

// Sala de carrera: conecta los mensajes de Colyseus con RaceLogic. El id de la sala es el código
// de 4 letras, así que unirse es `joinById(código)`.
export class RaceRoom extends Room {
  override maxClients = MAX_PLAYERS;
  private logic!: RaceLogic;
  private grid: string[] = [];

  override onCreate() {
    let code: string;
    do code = randomRoomCode();
    while (activeCodes.has(code));
    activeCodes.add(code);
    this.roomId = code;
    this.logic = new RaceLogic(code);

    this.onMessage(MSG.profile, (client, m: ProfileMessage) => {
      this.reply(client, this.logic.setProfile(client.sessionId, m?.name, m?.color, m?.character, m?.kart));
      this.sendLobby();
    });
    this.onMessage(MSG.setTrack, (client, m: { trackId: string }) => {
      this.reply(client, this.logic.setTrack(client.sessionId, m?.trackId));
      this.sendLobby();
    });
    this.onMessage(MSG.start, async (client) => {
      const result = await this.logic.startRace(client.sessionId, Date.now());
      if (typeof result === "string") return this.reply(client, result);
      this.grid = result.grid;
      this.broadcast(MSG.countdown, result satisfies CountdownMessage);
      this.sendLobby();
    });
    this.onMessage(MSG.state, (client, s: NetKartState) => {
      this.logic.onState(client.sessionId, s, Date.now());
    });
    this.onMessage(MSG.useItem, (client, m: UseItemMessage) => {
      this.sendItemEvents(this.logic.useItem(client.sessionId, m?.action));
    });

    this.clock.setInterval(() => this.tick(), 1000 / NET_SEND_HZ);
    console.log(`[sala ${code}] creada`);
  }

  override onJoin(client: Client, options: JoinOptions) {
    this.logic.addPlayer(client.sessionId, options?.name, options?.color, options?.character, options?.kart);
    console.log(`[sala ${this.roomId}] entra ${client.sessionId} (${this.logic.playerCount})`);
    this.sendLobby();
  }

  override async onLeave(client: Client, consented: boolean) {
    const id = client.sessionId;
    this.logic.setConnected(id, false);
    this.sendLobby();
    if (!consented) {
      try {
        const back = await this.allowReconnection(client, RECONNECT_SECONDS);
        this.logic.setConnected(id, true);
        console.log(`[sala ${this.roomId}] vuelve ${id}`);
        // Primero la sala (el cliente necesita la lista de jugadores) y luego, si había carrera, volver a ella.
        this.sendLobby();
        const resume = this.logic.resumeFor(id, Date.now(), this.grid);
        if (resume) back.send(MSG.countdown, resume);
        return;
      } catch {
        // No volvió a tiempo.
      }
    }
    this.logic.removePlayer(id);
    console.log(`[sala ${this.roomId}] sale ${id} (${this.logic.playerCount})`);
    this.sendLobby();
  }

  override onDispose() {
    activeCodes.delete(this.roomId);
    console.log(`[sala ${this.roomId}] cerrada`);
  }

  private tick() {
    const now = Date.now();
    const before = this.logic.phase;
    if (before === "lobby") return;
    const { results, events } = this.logic.tick(now);
    this.sendItemEvents(events);
    if (results) this.broadcast(MSG.results, results satisfies ResultsMessage);
    else this.broadcast(MSG.states, this.logic.snapshot(now));
    if (this.logic.phase !== before) this.sendLobby();
  }

  private sendItemEvents(events: NetItemEvent[]) {
    if (events.length > 0) this.broadcast(MSG.itemEvents, { events } satisfies ItemEventsMessage);
  }

  private sendLobby() {
    this.broadcast(MSG.lobby, this.logic.lobby());
  }

  private reply(client: Client, error: string | null) {
    if (error) client.send(MSG.error, { message: error });
  }
}
