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
  applyStart,
  botInput,
  buildTrackFromDef,
  closestPoint,
  collideKartWithTrack,
  collideKarts,
  createItemBoxes,
  createKart,
  createProgress,
  createRaceKart,
  driftLevel,
  formatTime,
  gridPose,
  hopHeight,
  needsRespawn,
  pointAt,
  respawnKart,
  standings,
  startResult,
  stepItems,
  stepKart,
  surfaceAt,
  updateProgress,
  useItem,
  type BotDriver,
  type CountdownMessage,
  type ItemEvent,
  type ItemWorld,
  type KartState,
  type LapProgress,
  type LobbyPlayer,
  type NetKartState,
  type RaceKart,
  type RaceResult,
  type ResultsMessage,
  type StatesMessage,
  type TrackDef,
} from "@derrape/shared";
import { readInput } from "../input";
import { readKeyboard } from "../input/keyboard";
import { takeItemAction, touch } from "../input/touch";
import { INTERP_DELAY, SnapshotBuffer } from "../net/interpolation";
import type { Net } from "../net/net";
import type { ChaseCamera } from "../render/chaseCamera";
import { ItemsView } from "../render/itemsView";
import { createKartModel, type KartModel } from "../render/kartModel";
import { createNameTag } from "../render/nameTag";
import type { AutoQuality } from "../render/quality";
import { Sparks } from "../render/sparks";
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

export interface SessionOptions {
  def: TrackDef;
  online?: OnlineRace;
  /** Online: volver a la sala desde la pantalla final. */
  onExit?: () => void;
}

export interface RaceSession {
  setPaused(paused: boolean): void;
  /** Solo en solitario: empezar otra vez. */
  restart(): void;
  dispose(): void;
}

/** Kart que se simula en este móvil (el jugador y, en solitario, los de prueba). */
interface LocalRacer {
  name: string;
  race: RaceKart;
  progress: LapProgress;
  prev: KartState;
  model: KartModel;
  bot?: BotDriver;
  tuning: typeof KART;
  driftVisual: number;
  spinVisual: number;
  y: number;
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
  driftVisual: number;
  spinVisual: number;
}

const BOT_SETUP = [
  { name: "Azul", color: 0x2e86de, lane: 3, speed: 0.9 },
  { name: "Verde", color: 0x2ecc71, lane: -3, speed: 0.93 },
  { name: "Morado", color: 0x9b5de5, lane: 0, speed: 0.95 },
];

const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export function createRaceSession(view: GameView, opts: SessionOptions): RaceSession {
  const { renderer, camera, chase, quality, showFlash } = view;
  const { def, online } = opts;
  const track = buildTrackFromDef(def);
  const theme = THEMES[def.theme];
  const laps = online?.start.laps ?? def.laps;

  // --- Escena ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.sky, theme.fog[0], theme.fog[1]);
  scene.add(new THREE.HemisphereLight(0xffffff, theme.ground, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(30, 60, 20);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ color: theme.ground }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = theme.track.groundY;
  scene.add(ground);
  scene.add(createTrackMesh(track, theme.track));
  theme.decorate(scene, track, def);

  // --- Karts ---
  function makeLocal(slot: number, name: string, color: number, bot?: BotDriver, speed = 1): LocalRacer {
    const model = createKartModel(color);
    scene.add(model.root);
    const pose = gridPose(track, slot);
    const state = createKart(pose.x, pose.z, pose.heading);
    return {
      name,
      race: createRaceKart(slot, state, track),
      progress: createProgress(),
      prev: { ...state },
      model,
      bot,
      // Los de prueba son algo más lentos; KART se lee en vivo para el jugador (panel F1).
      tuning: bot ? { ...KART, maxSpeed: KART.maxSpeed * speed } : KART,
      driftVisual: 0,
      spinVisual: 0,
      y: 0,
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
    player = makeLocal(slot, me?.name ?? "Tú", KART_COLORS[me?.color ?? 0] ?? KART_COLORS[0]);
    locals = [player];
    for (const p of online.players) {
      if (p.id === online.myId || !online.start.grid.includes(p.id)) continue;
      const color = KART_COLORS[p.color] ?? KART_COLORS[0];
      const model = createKartModel(color);
      model.root.add(createNameTag(p.name, color));
      model.root.visible = false; // hasta que llegue su primer estado
      scene.add(model.root);
      remotes.push({ id: p.id, name: p.name, model, buffer: new SnapshotBuffer(), shown: null, y: 0, driftVisual: 0, spinVisual: 0 });
    }
  } else {
    player = makeLocal(0, "Tú", KART_COLORS[0]);
    locals = [
      player,
      ...BOT_SETUP.map((b, i) => makeLocal(i + 1, b.name, b.color, { lane: b.lane, lookAhead: 12 }, b.speed)),
    ];
  }

  // Objetos: en solitario, en local. Online llegan en la Fase 5 (los decidirá el servidor).
  const world: ItemWorld = {
    track,
    karts: locals.map((r) => r.race),
    boxes: online ? [] : createItemBoxes(track, def.itemRows, 4),
    oils: [],
    rockets: [],
    random: Math.random,
  };
  const itemsView = new ItemsView(world);
  scene.add(itemsView.group);
  const sparks = new Sparks();
  scene.add(sparks.points);

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
  let serverMe: { lap: number; position: number } | null = null;

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
      r.race = createRaceKart(r.race.id, s, track);
      r.progress = createProgress();
      r.prev = { ...s };
      r.stall = 0;
      r.wrongWay = 0;
      r.respawns = 0;
      if (r === player) r.bot = undefined;
    });
    world.karts = locals.map((r) => r.race);
    world.boxes = online ? [] : createItemBoxes(track, def.itemRows, 4);
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
    for (const e of events) {
      if (e.kart === player.race.id) {
        if (e.type === "hit") showFlash(e.by === "oil" ? "¡Aceite!" : "¡Cohete!");
        if (e.type === "blocked") showFlash("¡Escudo!");
        if (e.type === "use") showFlash(ITEM_NAMES[e.item]);
      } else if (e.type === "hit") {
        showFlash("¡Tocado!");
      }
    }
  }

  // --- Pantalla final ---
  const resultsEl = $("#results");
  const resultsButton = $<HTMLButtonElement>("#results-again");
  function renderResults(rows: { name: string; me: boolean; time: number | null }[]) {
    resultsShown = true;
    const list = $<HTMLOListElement>("#results-list");
    list.replaceChildren();
    rows.forEach((row, i) => {
      const li = document.createElement("li");
      if (row.me) li.className = "me";
      li.append(
        Object.assign(document.createElement("span"), { textContent: `${i + 1}º` }),
        Object.assign(document.createElement("span"), { textContent: row.name }),
        Object.assign(document.createElement("span"), { textContent: row.time === null ? "sin terminar" : formatTime(row.time) }),
      );
      list.append(li);
    });
    const times = player.progress.lapTimes;
    $("#results-laps").textContent = times.length
      ? `Tus vueltas: ${times.map(formatTime).join(" · ")} — mejor ${formatTime(Math.min(...times))}`
      : "";
    resultsButton.textContent = online ? "Volver a la sala" : "Otra carrera";
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
          if (k.id === online.myId) serverMe = { lap: k.lap, position: k.position };
          else remotes.find((r) => r.id === k.id)?.buffer.push(m.t, k.s);
        }
      }),
      online.net.on<ResultsMessage>(MSG.results, (m) => {
        renderResults(m.results.map((r: RaceResult) => ({ name: r.name, me: r.id === online.myId, time: r.time })));
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
      if (phase === "countdown") continue;
      r.stall = Math.max(0, r.stall - PHYSICS_DT);
      stepKart(s, r.bot ? botInput(r.bot, s, track) : input, PHYSICS_DT, r.tuning);
      const c = collideKartWithTrack(s, track, r.tuning);
      s.surface = surfaceAt(track, c);
      r.y = c.y;

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
  function emitFromWheels(model: KartModel, level: number, count: number) {
    for (const w of model.rearWheels) {
      wheelWorld.copy(w);
      model.body.localToWorld(wheelWorld);
      sparks.emit(wheelWorld, level, count);
    }
  }

  function drawKart(
    m: KartModel,
    r: { driftVisual: number; spinVisual: number },
    x: number,
    y: number,
    z: number,
    heading: number,
    view: { driftDir: number; level: number; spinning: boolean; boosting: boolean; shield: boolean; shieldLeft: number },
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
    if (view.driftDir !== 0 && view.level > 0) emitFromWheels(m, view.level, 2);
    if (view.boosting) emitFromWheels(m, 2, 1);
  }

  function drawRemotes(dt: number, time: number) {
    const serverNow = online?.net.clock.now(performance.now());
    if (serverNow == null) return;
    for (const rem of remotes) {
      const s = rem.buffer.sample(serverNow - INTERP_DELAY);
      rem.model.root.visible = s !== null;
      if (!s) continue;
      rem.y = closestPoint(track, s.x, s.z).y;
      rem.shown = { ...createKart(s.x, s.z, s.heading), speed: s.speed };
      drawKart(
        rem.model,
        rem,
        s.x,
        rem.y + s.hop,
        s.z,
        s.heading,
        { driftDir: s.driftDir, level: s.driftLevel, spinning: s.spinning, boosting: s.boosting, shield: s.shield, shieldLeft: 8 },
        dt,
        time,
      );
    }
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
        countdownEl.classList.remove("pop");
        void countdownEl.offsetWidth;
        countdownEl.classList.add("pop");
      }
    } else if (lastCount !== 0) {
      lastCount = 0;
      countdownEl.textContent = "¡YA!";
      countdownEl.classList.remove("pop");
      void countdownEl.offsetWidth;
      countdownEl.classList.add("pop");
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
      if (phase !== "racing" || online) continue;
      const events: ItemEvent[] = [];
      useItem(world, player.race, a, events);
      onItemEvents(events);
    }

    accumulator += dt;
    while (accumulator >= PHYSICS_DT) {
      stepPhysics();
      accumulator -= PHYSICS_DT;
    }
    const alpha = accumulator / PHYSICS_DT;

    for (const r of locals) {
      const s = r.race.state;
      drawKart(
        r.model,
        r,
        r.prev.x + (s.x - r.prev.x) * alpha,
        r.y + hopHeight(s),
        r.prev.z + (s.z - r.prev.z) * alpha,
        lerpAngle(r.prev.heading, s.heading, alpha),
        {
          driftDir: s.driftDir,
          level: driftLevel(s),
          spinning: s.spinTime > 0,
          boosting: s.boostTime > 0,
          shield: s.shieldTime > 0,
          shieldLeft: s.shieldTime,
        },
        dt,
        time,
      );
    }
    drawRemotes(dt, time);
    sparks.update(dt);
    itemsView.update(world, dt);

    const me = player.race.state;
    const root = player.model.root;
    chase.update(root.position.x, player.y, root.position.z, root.rotation.y, me.speed / KART.maxSpeed, dt);
    renderer.render(scene, camera);

    updateHud(Math.abs(me.speed) * 3.6, driftLevel(me), me.boostTime > 0);
    updateItemSlot(player.race.item, player.race.rollTime > 0, time);
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
    dispose() {
      renderer.setAnimationLoop(null);
      resultsButton.removeEventListener("click", onResultsButton);
      for (const off of unsubscribe) off();
      resultsEl.hidden = true;
      countdownEl.hidden = true;
      wrongWayEl.hidden = true;
      // Liberar la memoria de la GPU (geometrías, materiales y texturas de este circuito).
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const m of mats) {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        }
      });
    },
  };
}

