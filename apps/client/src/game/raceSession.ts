// Una carrera: escena del circuito, karts, física a paso fijo, HUD y pantalla final.
// En solitario corre contra karts de prueba y con objetos. Online, los demás karts llegan por red
// (interpolados) y el servidor manda en vueltas, posiciones y resultados.

import * as THREE from "three";
import {
  KART,
  KART_COLORS,
  MSG,
  NET_SEND_HZ,
  PHYSICS_DT,
  RACE,
  ITEMS,
  applyStart,
  botInput,
  buildTrackFromDef,
  closestPoint,
  collideKarts,
  createItemBoxes,
  createKart,
  createProgress,
  createRaceKart,
  deriveTuning,
  driftLevel,
  findKart,
  formatTime,
  giveBoost,
  gridPose,
  hopHeight,
  needsRespawn,
  pointAt,
  respawnKart,
  standings,
  startResult,
  stepItems,
  stepKartOnTrack,
  statsFor,
  SURFACE,
  gradeAlong,
  hazardActiveAt,
  surfaceNormal,
  surfaceY,
  updateProgress,
  useItem,
  type BotDriver,
  type CountdownMessage,
  type ItemEvent,
  type ItemEventsMessage,
  type ItemType,
  type ItemWorld,
  type KartState,
  type KartStats,
  type LapProgress,
  type LobbyPlayer,
  type NetKartState,
  type RaceKart,
  type RaceResult,
  type ResultsMessage,
  type StatesMessage,
  type TrackDef,
} from "@derrape/shared";
import { sfx } from "../audio/sfx";
import { readInput } from "../input";
import { readKeyboard } from "../input/keyboard";
import { showTouchHint, takeItemAction, touch } from "../input/touch";
import { INTERP_DELAY, ItemsBuffer, SnapshotBuffer } from "../net/interpolation";
import type { Net } from "../net/net";
import { BlobShadows } from "../render/blobShadow";
import type { ChaseCamera } from "../render/chaseCamera";
import { ItemsView } from "../render/itemsView";
import { createKartModel, type KartModel } from "../render/kartModel";
import { PALETTE, toonMaterial } from "../render/materials";
import { Minimap } from "../render/minimap";
import { createGradientSky, createMoon, lighten } from "../render/sky";
import { createNameTag } from "../render/nameTag";
import { showDriverOutline, type AutoQuality } from "../render/quality";
import { Fire, TURBO_COLORS, paintExhaust, paintHair } from "../render/flames";
import { HIT_SPARK, NITRO_SPARK } from "../render/sparks";
import { THEMES } from "../render/themes";
import { createTrackMesh } from "../render/trackMesh";
import { ITEM_NAMES, updateHud, updateItemSlot, updatePosition } from "../ui/hud";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** Lo que comparten todas las carreras: renderer, cámara y elementos fijos de la pantalla. */
export interface GameView {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  chase: ChaseCamera;
  quality: AutoQuality;
  showFlash: (text: string) => void;
}

export interface OnlineRace {
  net: Net;
  myId: string;
  start: CountdownMessage;
  players: LobbyPlayer[];
}

/** Lo que eligió el jugador (en solitario; online viene de la sala). */
export interface PlayerLook {
  character: string;
  kart: string;
  color: number;
}

export interface SessionOptions {
  def: TrackDef;
  /** En solitario: personaje, coche y color del jugador. */
  look?: PlayerLook;
  online?: OnlineRace;
  /** Online: volver a la sala desde la pantalla final. */
  onExit?: () => void;
}

export interface RaceSession {
  setPaused(paused: boolean): void;
  /** Solo en solitario: empezar otra vez. */
  restart(): void;
  dispose(): void;
  /** Para depurar desde la consola: el estado del kart del jugador y las cajas. */
  debug(): {
    kart: KartState;
    boxes: { x: number; z: number }[];
    teleport: (distance: number, lateral?: number, speed?: number) => void;
    length: number;
    fly: (distance: number, speed?: number) => void;
  };
}

/** Kart que se simula en este móvil (el jugador y, en solitario, los de prueba). */
interface LocalRacer {
  name: string;
  race: RaceKart;
  progress: LapProgress;
  prev: KartState;
  model: KartModel;
  bot?: BotDriver;
  /** Estadísticas del personaje + coche y extra de carga del derrape. */
  stats: KartStats;
  driftMult: number;
  /** Constantes de este kart. Las del jugador se recalculan cada paso (así el panel F1 sigue funcionando). */
  tuning: typeof KART;
  driftVisual: number;
  spinVisual: number;
  y: number;
  bank: number;
  aim: THREE.Quaternion;
  aimReady: boolean;
  stall: number;
  wrongWay: number;
  respawns: number;
}

/** Kart de otro jugador, que llega por red. */
interface RemoteRacer {
  id: string;
  name: string;
  model: KartModel;
  buffer: SnapshotBuffer;
  /** Último estado dibujado (también sirve para los choques). */
  shown: KartState | null;
  y: number;
  bank: number;
  aim: THREE.Quaternion;
  aimReady: boolean;
  driftVisual: number;
  spinVisual: number;
  finished: boolean;
  stats: KartStats;
}

const BOT_SETUP = [
  { name: "Kiko", color: 0x2e86de, lane: 3, speed: 0.9, character: "kiko", kart: "pulga" },
  { name: "Tocho", color: 0x2ecc71, lane: -3, speed: 0.93, character: "tocho", kart: "tanque" },
  { name: "Nonna", color: 0x9b5de5, lane: 0, speed: 0.95, character: "nonna-pina", kart: "furgo" },
];

const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const aimEuler = new THREE.Euler(0, 0, 0, "YXZ");
const aimTarget = new THREE.Quaternion();

export function createRaceSession(view: GameView, opts: SessionOptions): RaceSession {
  const { renderer, camera, chase, quality, showFlash } = view;
  const { def, online } = opts;
  const track = buildTrackFromDef(def);
  const theme = THEMES[def.theme];
  const laps = online?.start.laps ?? def.laps;
  showTouchHint();

  // El cielo (radio 230) tiene que caber en el plano lejano. La niebla corta a 190.
  camera.far = 260;
  camera.updateProjectionMatrix();

  // --- Escena ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.horizon);
  scene.fog = new THREE.Fog(theme.horizon, theme.fog[0], theme.fog[1]);
  scene.add(new THREE.HemisphereLight(lighten(theme.sky, 0.55), theme.ground, 1.15));
  const moon = new THREE.DirectionalLight(0xcfc4ff, 1.05);
  moon.position.set(-50, 80, 30);
  scene.add(moon);
  const sky = createGradientSky(theme.sky, theme.horizon, 230);
  sky.add(createMoon());
  scene.add(sky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), toonMaterial({ color: theme.ground }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = theme.track.groundY;
  scene.add(ground);
  scene.add(createTrackMesh(track, theme.track));
  theme.decorate(scene, track, def);
  const blobs = new BlobShadows(scene);

  const minimap = new Minimap($<HTMLCanvasElement>("#minimap"));
  minimap.setTrack(track);
  $("#minimap").hidden = false;

  // --- Karts ---
  function makeLocal(
    slot: number,
    name: string,
    color: number,
    character: string,
    kartId: string,
    bot?: BotDriver,
    speed = 1,
  ): LocalRacer {
    const model = createKartModel(color, character, kartId);
    scene.add(model.root);
    const stats = statsFor(character, kartId);
    const driftMult = findKart(kartId)?.driftChargeMult ?? 1;
    const pose = gridPose(track, slot);
    const state = createKart(pose.x, pose.z, pose.heading);
    state.mass = stats.weight;
    const planted = closestPoint(track, state.x, state.z);
    return {
      name,
      race: createRaceKart(slot, state, track),
      progress: createProgress(),
      prev: { ...state },
      model,
      bot,
      stats,
      driftMult,
      // Los de prueba son algo más lentos. El jugador recalcula las suyas en vivo (panel F1).
      tuning: bot ? deriveTuning({ ...KART, maxSpeed: KART.maxSpeed * speed }, stats, driftMult) : deriveTuning(KART, stats, driftMult),
      driftVisual: 0,
      spinVisual: 0,
      y: surfaceY(planted),
      bank: planted.bank,
      aim: new THREE.Quaternion(),
      aimReady: false,
      stall: 0,
      wrongWay: 0,
      respawns: 0,
    };
  }

  const remotes: RemoteRacer[] = [];
  let player: LocalRacer;
  let locals: LocalRacer[];
  if (online) {
    const me = online.players.find((p) => p.id === online.myId);
    const slot = Math.max(0, online.start.grid.indexOf(online.myId));
    player = makeLocal(slot, me?.name ?? "Tú", KART_COLORS[me?.color ?? 0] ?? KART_COLORS[0], me?.character ?? "", me?.kart ?? "");
    locals = [player];
    for (const p of online.players) {
      if (p.id === online.myId || !online.start.grid.includes(p.id)) continue;
      const color = KART_COLORS[p.color] ?? KART_COLORS[0];
      const model = createKartModel(color, p.character, p.kart);
      model.root.add(createNameTag(p.name, color));
      model.root.visible = false; // hasta que llegue su primer estado
      scene.add(model.root);
      remotes.push({
        id: p.id,
        name: p.name,
        model,
        buffer: new SnapshotBuffer(),
        shown: null,
        y: 0,
        bank: 0,
        aim: new THREE.Quaternion(),
        aimReady: false,
        driftVisual: 0,
        spinVisual: 0,
        finished: false,
        stats: statsFor(p.character, p.kart),
      });
    }
  } else {
    const look = opts.look;
    player = makeLocal(0, "Tú", look?.color ?? KART_COLORS[0], look?.character ?? "", look?.kart ?? "");
    locals = [
      player,
      ...BOT_SETUP.map((b, i) =>
        makeLocal(i + 1, b.name, b.color, b.character, b.kart, { lane: b.lane, lookAhead: 12 }, b.speed),
      ),
    ];
  }
  const playerHex = `#${(online
    ? (KART_COLORS[online.players.find((p) => p.id === online.myId)?.color ?? 0] ?? KART_COLORS[0])
    : (opts.look?.color ?? KART_COLORS[0])
  )
    .toString(16)
    .padStart(6, "0")}`;

  // Objetos. En solitario se simulan aquí. Online los decide el servidor: este mundo solo sirve
  // para dibujar lo que llega por red (las cajas salen en los mismos sitios en todos los móviles).
  const world: ItemWorld = {
    track,
    karts: locals.map((r) => r.race),
    boxes: createItemBoxes(track, def.itemRows, 4),
    oils: [],
    rockets: [],
    random: Math.random,
  };
  const itemsView = new ItemsView(world);
  scene.add(itemsView.group);
  const fire = new Fire(scene);
  const flameAt = new THREE.Vector3();

  // --- Estado de la carrera ---
  let phase: "countdown" | "racing" | "finished" = "countdown";
  let countdown = 0;
  let raceTime = 0;
  let holdFrom: number | null = null;
  let lastCount = -1;
  let resultsShown = false;
  let paused = false;
  let sendTimer = 0;
  /** Online: lo último que dice el servidor de mí. */
  let serverMe: { lap: number; position: number; item: ItemType | null; rolling: boolean } | null = null;
  const itemsBuffer = new ItemsBuffer();

  const lapLabel = $<HTMLDivElement>("#lap");
  const timeLabel = $<HTMLDivElement>("#race-time");
  const countdownEl = $<HTMLDivElement>("#countdown");
  const wrongWayEl = $<HTMLDivElement>("#wrong-way");
  const fpsLabel = $<HTMLDivElement>("#fps");

  function resetLocals() {
    locals.forEach((r) => {
      const slot = online ? Math.max(0, online.start.grid.indexOf(online.myId)) : locals.indexOf(r);
      const pose = gridPose(track, slot);
      const s = createKart(pose.x, pose.z, pose.heading);
      s.mass = r.stats.weight;
      r.race = createRaceKart(r.race.id, s, track);
      r.progress = createProgress();
      r.prev = { ...s };
      r.stall = 0;
      r.wrongWay = 0;
      r.respawns = 0;
      r.aimReady = false;
      if (r === player) r.bot = undefined;
    });
    world.karts = locals.map((r) => r.race);
    world.boxes = createItemBoxes(track, def.itemRows, 4);
    world.oils = [];
    world.rockets = [];
    phase = "countdown";
    countdown = 0;
    raceTime = 0;
    holdFrom = null;
    lastCount = -1;
    resultsShown = false;
    $("#results").hidden = true;
    chase.snap();
  }
  resetLocals();

  // Volver a una carrera ya empezada (tras recargar o un corte largo).
  if (online?.start.elapsed !== undefined) {
    countdown = online.start.elapsed;
    if (countdown >= RACE.countdown) {
      phase = "racing";
      raceTime = countdown - RACE.countdown;
      const r = online.start.resume;
      if (r) {
        const s = player.race.state;
        Object.assign(s, { x: r.x, z: r.z, heading: r.heading, speed: r.speed });
        Object.assign(player.prev, s);
        player.respawns = r.respawns;
        const c = closestPoint(track, s.x, s.z);
        player.progress.respawnDistance = c.distance;
      }
    }
  }

  /** Racers locales ordenados por posición (en solitario). */
  const ranking = () =>
    standings(locals.map((r) => ({ r, progress: r.progress, raceDistance: r.race.raceDistance }))).map((x) => x.r);

  function onItemEvents(events: ItemEvent[]) {
    const at = new THREE.Vector3(player.race.state.x, player.y + 0.5, player.race.state.z);
    for (const e of events) {
      if (e.kart === player.race.id) {
        if (e.type === "hit") {
          showFlash(e.by === "oil" ? "¡Aceite!" : "¡Cohete!");
          sfx.hit();
          fire.spark(at, HIT_SPARK, 8, 8);
        }
        if (e.type === "blocked") showFlash("¡Escudo!");
        if (e.type === "pickup") sfx.pickup();
        if (e.type === "use") {
          showFlash(ITEM_NAMES[e.item]);
          if (e.item === "nitro") {
            sfx.boost();
            fire.spark(at, NITRO_SPARK, 10, 7);
          }
        }
      } else if (e.type === "hit" && e.owner === player.race.id) {
        showFlash("¡Tocado!");
      }
    }
  }

  /**
   * Online: el servidor dice qué ha pasado con los objetos. Cada móvil aplica a su propio kart
   * lo que le toca (trompo, turbo, escudo); los demás karts lo muestran en su estado.
   */
  function onNetItemEvents(m: ItemEventsMessage) {
    if (!online) return;
    const s = player.race.state;
    for (const e of m.events) {
      if (e.kart === online.myId) {
        if (e.type === "hit") {
          s.spinTime = e.by === "oil" ? ITEMS.oilSpinTime : ITEMS.rocketSpinTime;
          sfx.hit();
          fire.spark(new THREE.Vector3(s.x, player.y + 0.5, s.z), HIT_SPARK, 8, 8);
          showFlash(e.by === "oil" ? "¡Aceite!" : "¡Cohete!");
        }
        if (e.type === "blocked") {
          s.shieldTime = 0;
          showFlash("¡Escudo!");
        }
        if (e.type === "use" && e.item) {
          if (e.item === "nitro") {
            giveBoost(s, ITEMS.nitroTime, ITEMS.nitroSpeedMult);
            sfx.boost();
            fire.spark(new THREE.Vector3(s.x, player.y + 0.5, s.z), NITRO_SPARK, 10, 7);
          }
          if (e.item === "shield") s.shieldTime = ITEMS.shieldTime;
          showFlash(ITEM_NAMES[e.item]);
        }
        if (e.type === "pickup") sfx.pickup();
      } else if (e.type === "hit" && e.owner === online.myId) {
        const victim = online.players.find((p) => p.id === e.kart)?.name;
        showFlash(victim ? `¡Le has dado a ${victim}!` : "¡Tocado!");
      }
    }
  }

  // --- Pantalla final ---
  const resultsEl = $("#results");
  const resultsButton = $<HTMLButtonElement>("#results-again");
  function renderResults(
    rows: { name: string; me: boolean; time: number | null; points?: number }[],
    cup?: ResultsMessage["cup"],
  ) {
    resultsShown = true;
    sfx.finish();
    const list = $<HTMLOListElement>("#results-list");
    list.replaceChildren();
    rows.forEach((row, i) => {
      const li = document.createElement("li");
      if (row.me) li.className = "me";
      const timeOrPts =
        row.points !== undefined ? `${row.points} pts` : row.time === null ? "sin terminar" : formatTime(row.time);
      li.append(
        Object.assign(document.createElement("span"), { textContent: `${i + 1}º` }),
        Object.assign(document.createElement("span"), { textContent: row.name }),
        Object.assign(document.createElement("span"), { textContent: timeOrPts }),
      );
      list.append(li);
    });
    const times = player.progress.lapTimes;
    $("#results-laps").textContent = times.length
      ? `Tus vueltas: ${times.map(formatTime).join(" · ")} — mejor ${formatTime(Math.min(...times))}`
      : "";

    const podium = $("#podium");
    const cupEl = $("#results-cup");
    const title = $("#results-title");
    if (cup?.finished) {
      title.textContent = `Podio · ${cup.name}`;
      podium.hidden = false;
      const spots = [
        { el: podium.querySelector(".second")!, row: cup.scores[1] },
        { el: podium.querySelector(".first")!, row: cup.scores[0] },
        { el: podium.querySelector(".third")!, row: cup.scores[2] },
      ];
      for (const s of spots) {
        const name = s.el.querySelector(".podium-name")!;
        const pts = s.el.querySelector(".podium-pts")!;
        name.textContent = s.row?.name ?? "—";
        pts.textContent = s.row ? `${s.row.points} pts` : "";
        s.el.classList.toggle("empty", !s.row);
      }
      cupEl.hidden = true;
      resultsButton.textContent = online ? "Volver a la sala" : "Otra carrera";
    } else {
      title.textContent = cup ? `${cup.name} · Carrera ${cup.race - 1}/${cup.total}` : "Resultados";
      podium.hidden = true;
      if (cup) {
        cupEl.hidden = false;
        cupEl.textContent = cup.scores.map((s) => `${s.name} ${s.points}`).join(" · ");
        resultsButton.textContent = online ? "Seguir copa" : "Otra carrera";
      } else {
        cupEl.hidden = true;
        resultsButton.textContent = online ? "Volver a la sala" : "Otra carrera";
      }
    }
    resultsEl.hidden = false;
  }
  const onResultsButton = () => {
    resultsEl.hidden = true;
    if (online) opts.onExit?.();
    else resetLocals();
  };
  resultsButton.addEventListener("click", onResultsButton);

  // --- Red ---
  const unsubscribe: (() => void)[] = [];
  if (online) {
    unsubscribe.push(
      online.net.on<StatesMessage>(MSG.states, (m) => {
        for (const k of m.karts) {
          if (k.id === online.myId) serverMe = { lap: k.lap, position: k.position, item: k.item, rolling: k.rolling };
          else {
            const rem = remotes.find((r) => r.id === k.id);
            if (rem) {
              rem.buffer.push(m.t, k.s);
              rem.finished = k.finished;
            }
          }
        }
        if (m.items) itemsBuffer.push(m.t, m.items);
      }),
      online.net.on<ItemEventsMessage>(MSG.itemEvents, onNetItemEvents),
      online.net.on<ResultsMessage>(MSG.results, (m) => {
        renderResults(
          m.results.map((r: RaceResult) => ({ name: r.name, me: r.id === online.myId, time: r.time })),
          m.cup,
        );
      }),
    );
  }

  function netState(): NetKartState {
    const s = player.race.state;
    return {
      x: s.x,
      z: s.z,
      heading: s.heading,
      speed: s.speed,
      driftDir: s.driftDir,
      driftLevel: driftLevel(s),
      hop: hopHeight(s),
      y: player.y,
      vy: s.vy,
      boosting: s.boostTime > 0,
      spinning: s.spinTime > 0,
      shield: s.shieldTime > 0,
      respawns: player.respawns,
    };
  }

  // --- Simulación ---
  function stepCountdown(dt: number) {
    countdown += dt;
    // "Acelerador" en la salida: un dedo en la pantalla o la tecla de acelerar.
    const revving = !paused && (touch.holding || readKeyboard().throttle);
    if (revving && holdFrom === null) holdFrom = countdown;
    if (!revving) holdFrom = null;

    if (countdown >= RACE.countdown) {
      phase = "racing";
      const result = startResult(holdFrom);
      player.stall = applyStart(player.race.state, result);
      if (player.stall > 0) showFlash("¡Calado!");
      else if (result === "perfect") showFlash("¡Salida perfecta!");
      // Los de prueba salen a veces con turbo.
      for (const r of locals) if (r.bot) applyStart(r.race.state, Math.random() < 0.4 ? "perfect" : "normal");
    }
  }

  const idle = { steer: 0, throttle: false, brake: false, drift: false };
  function stepPhysics() {
    const input = phase !== "countdown" && player.stall <= 0 && !paused ? readInput() : idle;
    for (const r of locals) {
      const s = r.race.state;
      Object.assign(r.prev, s);
      if (phase === "countdown") {
        const c = closestPoint(track, s.x, s.z);
        r.y = surfaceY(c);
        r.bank = c.bank;
        continue;
      }
      r.stall = Math.max(0, r.stall - PHYSICS_DT);
      const tuning = r === player ? deriveTuning(KART, r.stats, r.driftMult) : r.tuning;
      const c = stepKartOnTrack(s, r.bot ? botInput(r.bot, s, track) : input, PHYSICS_DT, track, tuning);
      if (!s.airborne && hazardActiveAt(track, c, raceTime) && s.spinTime <= 0) {
        s.spinTime = SURFACE.hazardSpinTime;
        if (r === player) {
          sfx.hit();
          showFlash("¡Tren!");
        }
      }
      r.bank = c.bank;
      r.y = s.airborne ? s.y : surfaceY(c) + s.climb;

      const event = updateProgress(r.progress, track, c.distance, raceTime, laps);
      if (r === player) {
        if (event === "lap" && r.progress.lap === laps) showFlash("¡Última vuelta!");
        if (event === "finish") {
          phase = "finished";
          showFlash(online ? "¡Meta!" : `¡Meta! ${ranking().indexOf(r) + 1}º`);
          // Al terminar, el kart sigue solo (como en la referencia).
          r.bot = { lane: 0, lookAhead: 12 };
        }
        // Dirección contraria durante más de 1 s.
        const dot = Math.cos(s.heading - pointAt(track, c.distance).heading);
        r.wrongWay = dot < -0.3 && s.speed > 3 ? r.wrongWay + PHYSICS_DT : 0;
      }
      if (needsRespawn(s, r.progress, PHYSICS_DT)) {
        respawnKart(s, r.progress, track);
        r.respawns++;
        Object.assign(r.prev, s);
        if (r === player) chase.snap();
      }
    }
    // Choques: entre los locales se empujan los dos; con los remotos, solo se corrige el propio.
    for (let i = 0; i < locals.length; i++) {
      for (let j = i + 1; j < locals.length; j++) collideKarts(locals[i]!.race.state, locals[j]!.race.state);
      for (const rem of remotes) if (rem.shown) collideKarts(locals[i]!.race.state, rem.shown, false);
    }
    if (!online) onItemEvents(stepItems(world, PHYSICS_DT));
    if (phase !== "countdown") raceTime += PHYSICS_DT;

    if (online) {
      sendTimer += PHYSICS_DT;
      if (sendTimer >= 1 / NET_SEND_HZ) {
        sendTimer = 0;
        online.net.send(MSG.state, netState());
      }
    }
  }

  // --- Dibujo ---
  const wheelWorld = new THREE.Vector3();
  const flameDir = new THREE.Vector3();
  const localFlame = new THREE.Vector3(0, 0.28, -1).normalize();
  function paintKartFire(
    m: KartModel,
    view: { driftDir: number; level: number; spinning: boolean; boosting: boolean },
    time: number,
    dt: number,
  ) {
    const grow = 1;
    const mode = view.boosting ? "boost" : view.driftDir !== 0 && view.level > 0 ? "drift" : "idle";
    const reach = (mode === "boost" ? 1.2 : mode === "drift" ? 0.45 : 0.35) * (m.detail ? 1 : 0.4);
    for (const a of m.exhausts) {
      a.updateWorldMatrix(true, false);
      flameDir.copy(localFlame).transformDirection(a.matrixWorld);
      paintExhaust(fire, a.getWorldPosition(flameAt), flameDir, m.flameLength * reach * grow, mode, time, dt);
    }
    if (m.detail) {
      for (const a of m.ornaments) paintHair(fire, a.getWorldPosition(flameAt), m.ornamentSpectral, time, grow);
    }
    if (view.driftDir !== 0 && view.level > 0) {
      const col = TURBO_COLORS[Math.min(2, view.level - 1)] ?? PALETTE.llama;
      const n = quality.pixelRatio >= 1.5 ? 2 : 1;
      for (const w of m.rearWheels) {
        wheelWorld.copy(w);
        m.body.localToWorld(wheelWorld);
        fire.spark(wheelWorld, col, n, 4);
      }
    }
    if (view.spinning && Math.floor(time * 2) !== Math.floor((time - dt) * 2)) {
      fire.spark(m.head.getWorldPosition(flameAt), PALETTE.ascua, 3, 5);
    }
    m.setOutline(showDriverOutline(quality.pixelRatio));
  }

  function drawKart(
    m: KartModel,
    r: { driftVisual: number; spinVisual: number },
    x: number,
    y: number,
    z: number,
    heading: number,
    view: {
      driftDir: number;
      level: number;
      spinning: boolean;
      boosting: boolean;
      shield: boolean;
      shieldLeft: number;
      finished: boolean;
    },
    dt: number,
    time: number,
  ) {
    m.root.position.set(x, y, z);
    m.root.rotation.y = heading;
    r.driftVisual += (view.driftDir * KART.driftVisualAngle - r.driftVisual) * Math.min(1, dt * 10);
    // Trompo: dos vueltas completas mientras dura.
    r.spinVisual = view.spinning ? r.spinVisual + dt * Math.PI * 4 : 0;
    m.body.rotation.y = r.driftVisual + r.spinVisual;
    m.body.rotation.z = -r.driftVisual * 0.15;
    m.shield.visible = view.shield && (view.shieldLeft > 2 || Math.floor(time * 8) % 2 === 0);
    m.setDetail(poseHold || camera.position.distanceTo(m.root.position) < 15);
    m.setMood(view.spinning ? "angry" : view.finished ? "celebrate" : "idle", time);
    paintKartFire(m, view, time, dt);
  }

  function orientKart(
    root: THREE.Object3D,
    store: { aim: THREE.Quaternion; aimReady: boolean },
    heading: number,
    pitch: number,
    bank: number,
    dt: number,
  ) {
    if (!track.relief) {
      root.rotation.set(0, heading, 0);
      return;
    }
    // El signo del peralte en el euler YXZ queda al revés de la normal de la calzada.
    aimEuler.set(-pitch, heading, -bank, "YXZ");
    aimTarget.setFromEuler(aimEuler);
    if (!store.aimReady) {
      store.aim.copy(aimTarget);
      store.aimReady = true;
    } else store.aim.slerp(aimTarget, 1 - Math.exp(-12 * dt));
    root.quaternion.copy(store.aim);
  }

  function drawRemotes(dt: number, time: number) {
    const serverNow = online?.net.clock.now(performance.now());
    if (serverNow == null) return;
    for (const rem of remotes) {
      const s = rem.buffer.sample(serverNow - INTERP_DELAY);
      rem.model.root.visible = s !== null;
      if (!s) continue;
      const ground = closestPoint(track, s.x, s.z);
      const road = surfaceY(ground);
      rem.y = typeof s.y === "number" ? s.y : road;
      rem.bank = ground.bank;
      rem.shown = { ...createKart(s.x, s.z, s.heading), speed: s.speed, mass: rem.stats.weight, y: rem.y, vy: s.vy ?? 0 };
      const air = typeof s.y === "number" && s.y > road + 0.5;
      drawKart(
        rem.model,
        rem,
        s.x,
        rem.y + s.hop,
        s.z,
        s.heading,
        { driftDir: s.driftDir, level: s.driftLevel, spinning: s.spinning, boosting: s.boosting, shield: s.shield, shieldLeft: 8, finished: rem.finished },
        dt,
        time,
      );
      const pitch = air ? Math.atan2(s.vy ?? 0, Math.max(1, Math.abs(s.speed))) : 0;
      orientKart(rem.model.root, rem, s.heading, pitch, air ? 0 : (rem.bank * Math.PI) / 180, dt);
    }
  }

  /** Online: pasa al mundo de dibujo los objetos que manda el servidor (con el retraso de interpolación). */
  function syncNetItems() {
    const serverNow = online?.net.clock.now(performance.now());
    const snap = serverNow == null ? null : itemsBuffer.sample(serverNow - INTERP_DELAY);
    if (!snap) return;
    const hidden = new Set(snap.hiddenBoxes);
    world.boxes.forEach((b, i) => (b.respawn = hidden.has(i) ? 1 : 0));
    world.oils = snap.oils.map((o) => ({ ...o, owner: -1, safeTime: 0 }));
    world.rockets = snap.rockets.map((r) => ({ ...r, owner: -1, distance: 0, lateral: 0, dir: 1, target: null, life: 1 }));
  }

  function updateRaceHud() {
    const lap = Math.min(Math.max(serverMe?.lap ?? player.progress.lap, 1), laps);
    lapLabel.textContent = `Vuelta ${lap}/${laps}`;
    timeLabel.textContent = formatTime(player.progress.finishTime ?? raceTime);
    const total = online ? remotes.length + 1 : locals.length;
    updatePosition(online ? serverMe?.position ?? 1 : ranking().indexOf(player) + 1, total);

    if (phase === "countdown") {
      const n = Math.ceil(RACE.countdown - countdown);
      if (n !== lastCount) {
        lastCount = n;
        countdownEl.textContent = String(n);
        countdownEl.hidden = false;
        countdownEl.classList.remove("pop", "go");
        void countdownEl.offsetWidth;
        countdownEl.classList.add("pop");
        sfx.countdown(n);
      }
    } else if (lastCount !== 0) {
      lastCount = 0;
      countdownEl.textContent = "¡YA!";
      countdownEl.classList.remove("pop");
      countdownEl.classList.add("go");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("pop");
      sfx.countdown(0);
    }
    wrongWayEl.hidden = player.wrongWay < 1;
  }

  // --- Bucle ---
  const wrongOrientation = matchMedia("(orientation: landscape) and (pointer: coarse)");
  let accumulator = 0;
  let last = performance.now();
  let frames = 0;
  let fpsStart = last;
  let time = 0;
  /** La consola de fotos deja el kart quieto en un sitio y a una velocidad. */
  let poseHold = false;

  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // En solitario se congela todo; online la carrera sigue (los demás no esperan) pero sin control.
    const frozen = !online && (paused || wrongOrientation.matches);
    if (frozen) {
      accumulator = 0;
      fpsStart = now;
      frames = 0;
      return;
    }
    time += dt;

    if (phase === "countdown") stepCountdown(dt);
    for (let a = takeItemAction(); a; a = takeItemAction()) {
      if (phase !== "racing") continue;
      if (online) {
        // Lo decide el servidor; aquí solo se evita mandar gestos cuando no hay nada que usar.
        if (serverMe?.item && !serverMe.rolling) online.net.send(MSG.useItem, { action: a });
        continue;
      }
      const events: ItemEvent[] = [];
      useItem(world, player.race, a, events);
      onItemEvents(events);
    }

    if (!poseHold) {
      accumulator += dt;
      while (accumulator >= PHYSICS_DT) {
        stepPhysics();
        accumulator -= PHYSICS_DT;
      }
    } else accumulator = 0;
    const alpha = accumulator / PHYSICS_DT;

    fire.begin();
    for (const r of locals) {
      const s = r.race.state;
      const heading = lerpAngle(r.prev.heading, s.heading, alpha);
      drawKart(
        r.model,
        r,
        r.prev.x + (s.x - r.prev.x) * alpha,
        r.y + hopHeight(s),
        r.prev.z + (s.z - r.prev.z) * alpha,
        heading,
        {
          driftDir: s.driftDir,
          level: driftLevel(s),
          spinning: s.spinTime > 0,
          boosting: s.boostTime > 0,
          shield: s.shieldTime > 0,
          shieldLeft: s.shieldTime,
          finished: r.progress.finishTime !== null,
        },
        dt,
        time,
      );
      const pitch = s.airborne
        ? Math.atan2(s.vy, Math.max(1, Math.abs(s.speed)))
        : Math.asin(Math.max(-1, Math.min(1, s.grade)));
      orientKart(r.model.root, r, heading, pitch, s.airborne ? 0 : (r.bank * Math.PI) / 180, dt);
    }
    drawRemotes(dt, time);
    if (online) syncNetItems();
    itemsView.update(world, dt);
    for (const tail of itemsView.flamePoints()) {
      fire.flame(tail, PALETTE.llama, 0.14);
      fire.flame(tail, PALETTE.brasa, 0.22);
    }
    const seen: THREE.Vector3[] = [];
    for (const r of locals) seen.push(r.model.root.position);
    for (const r of remotes) if (r.model.root.visible) seen.push(r.model.root.position);
    fire.setView(camera.position, seen);
    fire.end(dt);

    const me = player.race.state;
    const root = player.model.root;
    chase.update(
      root.position.x,
      player.y,
      root.position.z,
      me.heading,
      me.speed / KART.maxSpeed,
      dt,
      track.relief
        ? {
            relief: true,
            bankDeg: player.bank,
            airborne: me.airborne,
            groundY: surfaceY(closestPoint(track, me.x, me.z)),
            bigJump: me.airborne && me.flightRamp === "L",
            normal: surfaceNormal(track, closestPoint(track, me.x, me.z)),
            floorAt: (x, z) => {
              const road = surfaceY(closestPoint(track, x, z));
              const lagoon = scene.getObjectByName("laguna");
              return Math.max(road, lagoon ? lagoon.position.y : -Infinity);
            },
          }
        : undefined,
    );
    sky.position.copy(camera.position);
    blobs.update(track, [
      ...locals.map((r) => ({ x: r.model.root.position.x, z: r.model.root.position.z, on: true })),
      ...remotes.map((r) => ({ x: r.model.root.position.x, z: r.model.root.position.z, on: r.model.root.visible })),
    ]);
    renderer.render(scene, camera);

    const dots = [
      { x: me.x, z: me.z, me: true, color: playerHex },
      ...locals.filter((r) => r !== player).map((r, i) => ({ x: r.race.state.x, z: r.race.state.z, color: `#${KART_COLORS[(i + 1) % KART_COLORS.length]!.toString(16).padStart(6, "0")}` })),
      ...remotes.filter((r) => r.shown).map((r) => ({ x: r.shown!.x, z: r.shown!.z, color: "#9b5de5" })),
    ];
    minimap.draw(dots, 0, track);

    updateHud(Math.abs(me.speed) * 3.6, driftLevel(me), me.boostTime > 0);
    if (online) updateItemSlot(serverMe?.item ?? null, serverMe?.rolling ?? false, time);
    else updateItemSlot(player.race.item, player.race.rollTime > 0, time);
    updateRaceHud();
    if (!online && phase === "finished" && !resultsShown && raceTime - (player.progress.finishTime ?? 0) > 1.5) {
      renderResults(ranking().map((r) => ({ name: r.name, me: r === player, time: r.progress.finishTime })));
    }

    frames++;
    if (now - fpsStart >= 500) {
      const fps = (frames * 1000) / (now - fpsStart);
      quality.report(fps, (now - fpsStart) / 1000);
      fpsLabel.textContent = `${Math.round(fps)} fps · x${quality.pixelRatio}`;
      frames = 0;
      fpsStart = now;
    }
  });

  return {
    setPaused(p) {
      paused = p;
    },
    restart() {
      if (!online) resetLocals();
    },
    debug() {
      const place = (distance: number, lateral = 0, speed = 22) => {
        const p = pointAt(track, distance, lateral);
        const s = player.race.state;
        s.x = p.x;
        s.z = p.z;
        s.heading = p.heading;
        s.speed = speed;
        // La consola de fotos deja el kart sin acelerar para encuadrar.
        player.stall = 999;
        s.airborne = false;
        s.vy = 0;
        s.climb = 0;
        s.along = -1;
        s.flightRamp = null;
        const c = closestPoint(track, p.x, p.z);
        s.grade = gradeAlong(track, c, s.heading);
        s.bank = c.bank;
        player.y = surfaceY(c);
        player.bank = c.bank;
        player.aimReady = false;
        Object.assign(player.prev, s);
        phase = "racing";
        poseHold = true;
        chase.snap();
      };
      return {
        kart: player.race.state,
        view() {
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion.clone().invert());
          return {
            bank: player.bank,
            horizon: (Math.atan2(up.x, up.y) * 180) / Math.PI,
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
          };
        },
        stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
        boxes: world.boxes,
        length: track.length,
        teleport: place,
        fly(distance: number, speed = 26) {
          place(distance, 0, speed);
          const s = player.race.state;
          const c = closestPoint(track, s.x, s.z);
          s.airborne = true;
          s.flightRamp = "L";
          s.vy = 3.5;
          s.y = surfaceY(c) + 2.3;
          player.y = s.y;
          chase.snap();
        },
      };
    },
    dispose() {
      renderer.setAnimationLoop(null);
      resultsButton.removeEventListener("click", onResultsButton);
      for (const off of unsubscribe) off();
      resultsEl.hidden = true;
      countdownEl.hidden = true;
      wrongWayEl.hidden = true;
      $("#minimap").hidden = true;
      // Liberar la memoria de la GPU (geometrías, materiales y texturas de este circuito).
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const m of mats) {
          if (m.userData.shared) continue;
          const mat = m as THREE.MeshBasicMaterial;
          if (mat.map && !mat.map.userData.shared) mat.map.dispose();
          m.dispose();
        }
      });
    },
  };
}

