import { Room, type Client } from "colyseus";
import { MAX_PLAYERS } from "@derrape/shared";

// Sala de carrera. De momento vacía: se rellena en la Fase 4.
export class RaceRoom extends Room {
  override maxClients = MAX_PLAYERS;

  override onCreate() {
    console.log(`[race] sala creada ${this.roomId}`);
  }

  override onJoin(client: Client) {
    console.log(`[race] ${client.sessionId} entra`);
  }

  override onLeave(client: Client) {
    console.log(`[race] ${client.sessionId} sale`);
  }
}
