// Prueba de integración: servidor real + clientes Colyseus reales por WebSocket.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, type Room } from "colyseus.js";
import type { Server } from "colyseus";
import {
  MSG,
  ROOM_RACE,
  type CountdownMessage,
  type LobbyMessage,
  type NetKartState,
  type StatesMessage,
} from "@derrape/shared";
import { startServer } from "../server";

const PORT = 2600 + Math.floor(Math.random() * 300);
let server: Server;

beforeAll(async () => {
  server = await startServer(PORT);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
});

const endpoint = `ws://localhost:${PORT}`;

/** Espera al siguiente mensaje de un tipo que cumpla `check`. */
function next<T>(room: Room, type: string, check: (m: T) => boolean = () => true, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`sin mensaje "${type}"`)), ms);
    const off = room.onMessage(type, (m: T) => {
      if (!check(m)) return;
      clearTimeout(timer);
      off();
      resolve(m);
    });
  });
}

const state = (x: number): NetKartState => ({
  x,
  z: 0,
  heading: 0,
  speed: 0,
  driftDir: 0,
  driftLevel: 0,
  hop: 0,
  boosting: false,
  spinning: false,
  shield: false,
  respawns: 0,
});

describe("sala de carrera por red", () => {
  it("/health responde", async () => {
    const res = await fetch(`http://localhost:${PORT}/health`);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("crear con código, unirse, empezar e intercambiar estados", async () => {
    const ana = await new Client(endpoint).create(ROOM_RACE, { name: "Ana" });
    ana.onMessage(MSG.states, () => {});
    expect(ana.roomId).toMatch(/^[A-Z]{4}$/);

    const lobbyWithTwo = next<LobbyMessage>(ana, MSG.lobby, (m) => m.players.length === 2);
    const beto = await new Client(endpoint).joinById(ana.roomId, { name: "Beto" });
    beto.onMessage(MSG.lobby, () => {});
    const lobby = await lobbyWithTwo;
    expect(lobby.code).toBe(ana.roomId);
    expect(lobby.players.map((p) => p.name)).toEqual(["Ana", "Beto"]);
    expect(lobby.players[0]!.host).toBe(true);

    // Beto no puede empezar; Ana sí.
    const error = next<{ message: string }>(beto, MSG.error);
    beto.send(MSG.start);
    expect((await error).message).toMatch(/anfitrión/);

    const countdownB = next<CountdownMessage>(beto, MSG.countdown);
    ana.send(MSG.start);
    expect((await countdownB).grid).toEqual([ana.sessionId, beto.sessionId]);

    // Los estados de uno le llegan al otro.
    ana.send(MSG.state, state(1));
    beto.send(MSG.state, state(2));
    const states = await next<StatesMessage>(beto, MSG.states, (m) => m.karts.length === 2);
    expect(states.karts.find((k) => k.id === ana.sessionId)!.s.x).toBe(1);

    await beto.leave();
    await ana.leave();
  });

  it("unirse a un código que no existe falla", async () => {
    await expect(new Client(endpoint).joinById("ZZZZ", { name: "X" })).rejects.toBeTruthy();
  });

  it("quien pierde la conexión puede volver a su sitio", async () => {
    const ana = await new Client(endpoint).create(ROOM_RACE, { name: "Ana" });
    const betoClient = new Client(endpoint);
    const beto = await betoClient.joinById(ana.roomId, { name: "Beto" });
    beto.onMessage(MSG.lobby, () => {});
    const token = beto.reconnectionToken;

    const disconnected = next<LobbyMessage>(ana, MSG.lobby, (m) => m.players.some((p) => !p.connected));
    await beto.leave(false); // corte sin despedirse (como al cerrar la app)
    expect((await disconnected).players.length).toBe(2);

    const reconnected = next<LobbyMessage>(ana, MSG.lobby, (m) => m.players.every((p) => p.connected));
    const back = await new Client(endpoint).reconnect(token);
    back.onMessage(MSG.lobby, () => {});
    expect(back.sessionId).toBe(beto.sessionId);
    expect((await reconnected).players.map((p) => p.name)).toEqual(["Ana", "Beto"]);

    await back.leave();
    await ana.leave();
  });
});
