// Jugador falso para probar el multijugador sin un segundo móvil.
//
//   npx tsx scripts/jugador-falso.ts CODIGO [nombre] [servidor]
//
// Se une a la sala, espera a que el anfitrión empiece y da vueltas al circuito mandando su
// estado 20 veces por segundo, como haría un amigo de verdad (sin derrapes ni objetos).

import { Client } from "colyseus.js";
import {
  KART,
  MSG,
  NET_SEND_HZ,
  PHYSICS_DT,
  ROOM_RACE,
  SERVER_PORT,
  botInput,
  buildTrackFromDef,
  collideKartWithTrack,
  createKart,
  findTrack,
  gridPose,
  normalizeRoomCode,
  stepKart,
  surfaceAt,
  type CountdownMessage,
  type NetKartState,
  type Track,
} from "@derrape/shared";

const code = normalizeRoomCode(process.argv[2] ?? "");
const name = process.argv[3] ?? "Robotín";
const endpoint = process.argv[4] ?? `ws://localhost:${SERVER_PORT}`;
if (!code) {
  console.error("Uso: npx tsx scripts/jugador-falso.ts CODIGO [nombre] [servidor]");
  process.exit(1);
}

const room = await new Client(endpoint).joinById(code, { name, color: 6 });
console.log(`${name} está en la sala ${code}. Esperando a que el anfitrión empiece…`);

let timer: ReturnType<typeof setInterval> | null = null;
for (const type of [MSG.lobby, MSG.states, MSG.error]) room.onMessage(type, () => {});
room.onMessage(MSG.results, () => {
  console.log("Carrera terminada. Esperando a la siguiente…");
  if (timer) clearInterval(timer);
});

room.onMessage(MSG.countdown, async (m: CountdownMessage) => {
  const track: Track = buildTrackFromDef(await findTrack(m.trackId)!.load());
  const slot = Math.max(0, m.grid.indexOf(room.sessionId));
  const pose = gridPose(track, slot);
  const s = createKart(pose.x, pose.z, pose.heading);
  const lane = (slot % 2 === 0 ? 1 : -1) * 2;
  const tuning = { ...KART, maxSpeed: KART.maxSpeed * 0.92 };
  let clock = 0;
  console.log(`¡Carrera en ${m.trackId}! Saliendo desde la posición ${slot + 1}.`);

  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    // Varios pasos de física por envío, como el bucle del juego.
    for (let i = 0; i < Math.round(1 / NET_SEND_HZ / PHYSICS_DT); i++) {
      clock += PHYSICS_DT;
      if (clock < m.seconds) continue; // parado en la cuenta atrás
      stepKart(s, botInput({ lane, lookAhead: 12 }, s, track), PHYSICS_DT, tuning);
      s.surface = surfaceAt(track, collideKartWithTrack(s, track, tuning));
    }
    const state: NetKartState = {
      x: s.x,
      z: s.z,
      heading: s.heading,
      speed: s.speed,
      driftDir: 0,
      driftLevel: 0,
      hop: 0,
      boosting: s.boostTime > 0,
      spinning: false,
      shield: false,
      respawns: 0,
    };
    room.send(MSG.state, state);
  }, 1000 / NET_SEND_HZ);
});

process.on("SIGINT", async () => {
  await room.leave();
  process.exit(0);
});
