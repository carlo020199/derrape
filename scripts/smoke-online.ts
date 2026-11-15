// Humo de sala online (lobby → carrera → estados → resultados parciales).
// Sustituye la prueba con móviles cuando Render aún no está publicado.
//
//   npx tsx scripts/smoke-online.ts

import { Client } from "colyseus.js";
import {
  MSG,
  ROOM_RACE,
  SERVER_PORT,
  type CountdownMessage,
  type LobbyMessage,
  type StatesMessage,
} from "@derrape/shared";

const endpoint = process.env.SMOKE_SERVER ?? `ws://127.0.0.1:${SERVER_PORT}`;
const http = endpoint.replace(/^ws/, "http");

async function waitHealth(ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`${http}/health`);
      if (r.ok) return;
    } catch {
      /* reintentar */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("El servidor no responde en /health");
}

await waitHealth();
const client = new Client(endpoint);
const host = await client.create(ROOM_RACE, { name: "Humo", color: 0, character: "lia", kart: "chispa" });
const lobby1 = await new Promise<LobbyMessage>((resolve) => host.onMessage(MSG.lobby, resolve));
console.log("sala", lobby1.code, "modo", lobby1.mode);

host.send(MSG.setTrack, { trackId: "playa-dorada" });
await new Promise((r) => setTimeout(r, 100));

const guest = await client.joinById(lobby1.code, { name: "Invitado", color: 1, character: "kiko", kart: "pulga" });
await new Promise<LobbyMessage>((resolve) => guest.onMessage(MSG.lobby, resolve));

const countdown = new Promise<CountdownMessage>((resolve) => host.onMessage(MSG.countdown, resolve));
host.send(MSG.start);
const start = await countdown;
console.log("salida", start.trackId, "parrilla", start.grid.length);

const states = new Promise<StatesMessage>((resolve) => {
  host.onMessage(MSG.states, (m: StatesMessage) => {
    if (m.karts.length >= 1) resolve(m);
  });
});
// Empujar un estado mínimo para que el servidor publique.
host.send(MSG.state, {
  x: 0,
  z: 0,
  heading: 0,
  speed: 5,
  driftDir: 0,
  driftLevel: 0,
  hop: 0,
  boosting: false,
  spinning: false,
  shield: false,
  respawns: 0,
});
const snap = await Promise.race([states, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("sin estados")), 5000))]);
console.log("estados", snap.karts.length, "ok");

await guest.leave();
await host.leave();
console.log("smoke online OK");
process.exit(0);
