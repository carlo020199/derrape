import http from "node:http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { PHYSICS_HZ, ROOM_RACE } from "@derrape/shared";
import { RaceRoom } from "./rooms/RaceRoom";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.get("/health", (_req, res) => {
  res.json({ ok: true, physicsHz: PHYSICS_HZ });
});

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define(ROOM_RACE, RaceRoom);

gameServer.listen(PORT).then(() => {
  console.log(`Servidor Derrape en http://localhost:${PORT} (salud: /health)`);
});
