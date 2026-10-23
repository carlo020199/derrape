import http from "node:http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { PHYSICS_HZ, ROOM_RACE } from "@derrape/shared";
import { RaceRoom } from "./rooms/RaceRoom";

/** Arranca el servidor de juego (HTTP + WebSocket) en `port`. */
export async function startServer(port: number) {
  const app = express();
  app.get("/health", (_req, res) => {
    res.json({ ok: true, physicsHz: PHYSICS_HZ });
  });

  const httpServer = http.createServer(app);
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
  gameServer.define(ROOM_RACE, RaceRoom);
  await gameServer.listen(port);
  return gameServer;
}
