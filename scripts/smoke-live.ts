// Humo contra el despliegue público (Render): lobby, carrera, objetos, reconexión.
//
//   npx tsx scripts/smoke-live.ts [wss://servidor]

import { Client, type Room } from "colyseus.js";
import {
  MSG,
  ROOM_RACE,
  type CountdownMessage,
  type ItemEventsMessage,
  type LobbyMessage,
  type StatesMessage,
} from "@derrape/shared";

const endpoint = process.argv[2] ?? process.env.SMOKE_SERVER ?? "wss://derrape-servidor.onrender.com";
const http = endpoint.replace(/^ws/, "http");

async function wake() {
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    try {
      const r = await fetch(`${http}/health`);
      if (r.ok) {
        console.log("health", await r.json());
        return;
      }
    } catch {
      /* despertando */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("servidor no despierta");
}

function once<T>(room: Room, type: string, ms = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${type}`)), ms);
    room.onMessage(type, (m: T) => {
      clearTimeout(t);
      resolve(m);
    });
  });
}

await wake();
const client = new Client(endpoint);

// 1) Crear sala + invitado
const host = await client.create(ROOM_RACE, { name: "QA-Host", color: 0, character: "lia", kart: "chispa" });
const lobby = await once<LobbyMessage>(host, MSG.lobby);
console.log("crear sala", lobby.code, "jugadores", lobby.players.length);

const guest = await client.joinById(lobby.code, { name: "QA-Guest", color: 2, character: "toni", kart: "bolido" });
const lobby2 = await once<LobbyMessage>(guest, MSG.lobby);
console.log("unirse", lobby2.players.map((p) => p.name).join(", "));

host.send(MSG.setTrack, { trackId: "paseo-del-puerto" });
await new Promise((r) => setTimeout(r, 200));

// 2) Empezar carrera
const cdP = once<CountdownMessage>(host, MSG.countdown);
host.send(MSG.start);
const cd = await cdP;
console.log("carrera", cd.trackId, "grid", cd.grid.length);

// 3) Estados e intento de objeto
let sawStates = 0;
let sawItems = false;
host.onMessage(MSG.states, (m: StatesMessage) => {
  sawStates++;
  if (m.items && (m.items.oils.length > 0 || m.items.rockets.length > 0 || m.items.hiddenBoxes.length > 0)) sawItems = true;
});
guest.onMessage(MSG.itemEvents, (m: ItemEventsMessage) => {
  if (m.events.length) sawItems = true;
});

const blank = {
  x: 0,
  z: -50,
  heading: 0,
  speed: 12,
  driftDir: 0,
  driftLevel: 0,
  hop: 0,
  boosting: false,
  spinning: false,
  shield: false,
  respawns: 0,
};
for (let i = 0; i < 40; i++) {
  host.send(MSG.state, { ...blank, z: -50 + i * 2, speed: 18 });
  guest.send(MSG.state, { ...blank, z: -52 + i * 2, x: 3, speed: 16 });
  await new Promise((r) => setTimeout(r, 50));
}
console.log("estados recibidos", sawStates);

// 4) Reconexión: el invitado se va y vuelve a entrar a la misma sala (nuevo sessionId).
await guest.leave(true);
await new Promise((r) => setTimeout(r, 800));
const guest2 = await client.joinById(lobby.code, { name: "QA-Guest", color: 2, character: "toni", kart: "bolido" });
const lobby3 = await once<LobbyMessage>(guest2, MSG.lobby);
const connected = lobby3.players.filter((p) => p.connected);
console.log(
  "reentrada",
  connected.map((p) => p.name).join(", "),
  "n=",
  connected.length,
);

await guest2.leave(true);
await host.leave(true);

if (sawStates < 1) throw new Error("no llegaron estados");
if (connected.length < 2) throw new Error("tras reentrar no hay 2 conectados");
console.log("smoke live OK", endpoint);
console.log("web", "https://derrape.onrender.com/");
process.exit(0);
