// Arranque: menú de inicio → sala (online) o práctica en solitario → carrera → resultados.

import * as THREE from "three";
import {
  DEFAULT_TRACK,
  ITEMS,
  KART,
  KART_COLORS,
  MSG,
  RACE,
  SURFACE,
  TOUCH,
  TRACKS,
  findTrack,
  normalizeRoomCode,
  type CountdownMessage,
  type LobbyMessage,
} from "@derrape/shared";
import { unlockAudio } from "./audio/sfx";
import { createRaceSession, type GameView, type RaceSession } from "./game/raceSession";
import { releaseTouch, setupTouchControls } from "./input/touch";
import { NET_DEBUG, Net, wakeServer } from "./net/net";
import { CAMERA, ChaseCamera } from "./render/chaseCamera";
import { GaragePreview } from "./render/garagePreview";
import { AutoQuality } from "./render/quality";
import { createDebugPanel } from "./ui/debugPanel";
import { setupGarage } from "./ui/garage";
import { setupMenu } from "./ui/menu";
import {
  profile,
  refreshLookButtons,
  renderLobby,
  setHomeError,
  setLobbyError,
  setupHome,
  setupLobby,
  showScreen,
} from "./ui/screens";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// Audio: se desbloquea con el primer toque/clic (requisito de móviles).
const unlockOnce = () => {
  void unlockAudio();
  window.removeEventListener("pointerdown", unlockOnce);
};
window.addEventListener("pointerdown", unlockOnce);

// --- Lo común a todas las carreras ---
const canvas = $<HTMLCanvasElement>("#game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const camera = new THREE.PerspectiveCamera(CAMERA.baseFov, 1, 0.1, 500);
const view: GameView = {
  renderer,
  camera,
  chase: new ChaseCamera(camera),
  quality: new AutoQuality((ratio) => renderer.setPixelRatio(ratio)),
  showFlash(text) {
    const flash = $<HTMLDivElement>("#item-flash");
    flash.textContent = text;
    flash.hidden = true;
    void flash.offsetWidth; // reinicia la animación
    flash.hidden = false;
  },
};

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

setupTouchControls($<HTMLDivElement>("#touch-zone"));
createDebugPanel(
  { kart: KART, race: RACE, surface: SURFACE, items: ITEMS, camera: CAMERA, touch: TOUCH, red: NET_DEBUG },
  // Simulador de red: retraso y variación en ms, pérdida en % (solo estados de karts).
  { "red.latency": 500, "red.jitter": 200, "red.loss": 50 },
);

let session: RaceSession | null = null;
let net: Net | null = null;
let lobby: LobbyMessage | null = null;
let soloTrack = findTrack(new URLSearchParams(location.search).get("pista") ?? "")?.id ?? DEFAULT_TRACK;

setupMenu((paused) => {
  releaseTouch();
  view.quality.reset();
  session?.setPaused(paused);
});

function endSession() {
  session?.dispose();
  session = null;
}

async function loadDef(trackId: string) {
  $("#loading").hidden = false;
  try {
    return await (findTrack(trackId) ?? findTrack(DEFAULT_TRACK)!).load();
  } finally {
    $("#loading").hidden = true;
  }
}

// --- En solitario ---
let soloToken = 0;
async function startSolo(trackId: string) {
  const token = ++soloToken;
  endSession();
  soloTrack = trackId;
  document.body.classList.remove("online");
  const def = await loadDef(trackId);
  // Si se cambió de circuito mientras este cargaba, no se pinta el trazado viejo.
  if (token !== soloToken) return;
  showScreen(null);
  session = createRaceSession(view, { def, look: { character: profile.character, kart: profile.kart, color: KART_COLORS[profile.color] ?? KART_COLORS[0] } });
}

const trackSelect = $<HTMLSelectElement>("#track-select");
for (const t of TRACKS) trackSelect.add(new Option(t.number ? `${t.number}. ${t.name}` : t.name, t.id));
trackSelect.value = soloTrack;
trackSelect.addEventListener("change", () => {
  $<HTMLButtonElement>("#menu-close").click();
  void startSolo(trackSelect.value);
});
$("#menu-restart").addEventListener("click", () => {
  session?.restart();
  $<HTMLButtonElement>("#menu-close").click();
});
$("#menu-home").addEventListener("click", () => {
  $<HTMLButtonElement>("#menu-close").click();
  void goHome();
});

// --- Online ---
function connectNet(): Net {
  const n = new Net();
  /** Cuenta atrás que llegó antes que la lista de jugadores (pasa al volver tras recargar). */
  let pending: CountdownMessage | null = null;
  const startOnline = async (m: CountdownMessage) => {
    if (!lobby || !n.id) {
      pending = m;
      return;
    }
    const players = lobby.players;
    const def = await loadDef(m.trackId);
    endSession();
    showScreen(null);
    session = createRaceSession(view, { def, online: { net: n, myId: n.id, start: m, players }, onExit: backToLobby });
  };
  n.on<LobbyMessage>(MSG.lobby, (m) => {
    lobby = m;
    renderLobby(m, n.id);
    if (pending) {
      const m2 = pending;
      pending = null;
      void startOnline(m2);
    }
  });
  n.on<CountdownMessage>(MSG.countdown, startOnline);
  n.on<{ message: string }>(MSG.error, (m) => {
    setLobbyError(m.message);
    view.showFlash(m.message);
  });
  n.onConnection = (state) => {
    $("#reconnecting").hidden = state !== "lost";
    if (state === "gone") {
      endSession();
      net = null;
      showScreen("home");
      setHomeError("Se perdió la conexión con la sala.");
    }
  };
  document.body.classList.add("online");
  return n;
}

function backToLobby() {
  endSession();
  showScreen("lobby");
  if (lobby && net) renderLobby(lobby, net.id);
}

async function goHome() {
  endSession();
  const n = net;
  net = null;
  lobby = null;
  document.body.classList.remove("online");
  // Volver al menú al momento; la desconexión puede tardar o colgarse al despertar Render.
  showScreen("home");
  try {
    await Promise.race([n?.leave() ?? Promise.resolve(), new Promise<void>((r) => setTimeout(r, 2000))]);
  } catch {
    // Salir de la sala no debe bloquear el menú.
  }
}

// --- Piloto y coche: la vista previa se dibuja con el mismo renderer, detrás de la pantalla ---
let garageFrom: "home" | "lobby" = "home";
const preview = new GaragePreview(renderer, canvas);
const garage = setupGarage(preview, {
  change() {
    refreshLookButtons();
    net?.send(MSG.profile, { color: profile.color, character: profile.character, kart: profile.kart });
  },
  done() {
    preview.stop();
    showScreen(garageFrom);
    if (garageFrom === "lobby" && lobby && net) renderLobby(lobby, net.id);
  },
});
function openGarage(from: "home" | "lobby") {
  garageFrom = from;
  showScreen("garage");
  garage.render(false);
  preview.start();
}

setupHome(
  {
    async create(name) {
      await net?.leave();
      net = connectNet();
      await net.create({ name, color: profile.color, character: profile.character, kart: profile.kart }).catch((e) => {
        net = null;
        throw e;
      });
      showScreen("lobby");
    },
    async join(code, name) {
      await net?.leave();
      net = connectNet();
      await net.join(code, { name, color: profile.color, character: profile.character, kart: profile.kart }).catch((e) => {
        net = null;
        throw e;
      });
      showScreen("lobby");
    },
    solo() {
      void startSolo(soloTrack);
    },
    garage: () => openGarage("home"),
  },
  normalizeRoomCode(new URLSearchParams(location.search).get("sala") ?? ""),
);

setupLobby({
  color: (i) => net?.send(MSG.profile, { color: i }),
  track: (id) => net?.send(MSG.setTrack, { trackId: id }),
  start: () => net?.send(MSG.start),
  garage: () => openGarage("lobby"),
  async invite() {
    const code = net?.code;
    if (!code) return;
    const url = `${location.origin}${location.pathname}?sala=${code}`;
    const text = `¡Échate una carrera conmigo en Derrape! Código de sala: ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Derrape", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      view.showFlash("Enlace copiado");
    } catch (e) {
      // Cancelar el menú de compartir no es un error.
      if ((e as Error)?.name !== "AbortError") setLobbyError(`Pásales este enlace: ${url}`);
    }
  },
  leave: () => void goHome(),
});

// Solo en desarrollo: para inspeccionar desde la consola del navegador.
if (import.meta.env.DEV) {
  Object.assign(window, { derrape: { net: () => net, lobby: () => lobby, session: () => session } });
}

// Despertar al servidor nada más abrir la web, mientras se escribe el nombre.
const STATUS_TEXT = {
  checking: "",
  slow: "Despertando el servidor… La primera vez del día puede tardar hasta un minuto.",
  ready: "",
} as const;
void wakeServer((status) => {
  $("#home-status").textContent = STATUS_TEXT[status];
});

// Al recargar en mitad de una sala, se intenta volver a ella; si no, al inicio.
(async () => {
  const n = connectNet();
  if (await n.resume()) {
    net = n;
    showScreen("lobby");
  } else {
    document.body.classList.remove("online");
    showScreen("home");
  }
})();
