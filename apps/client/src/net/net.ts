// Conexión con el servidor: crear/unirse a salas, mensajes, reconexión y simulador de latencia.

import { Client, type Room } from "colyseus.js";
import { MSG, ROOM_RACE, SERVER_PORT, type JoinOptions, type StatesMessage } from "@derrape/shared";
import { ServerClock } from "./interpolation";

/**
 * Dirección del servidor de juego:
 * - VITE_SERVER_URL: dirección completa (p. ej. `wss://mi-servidor.example.com`).
 * - VITE_SERVER_HOST: solo el dominio; se usa `wss://` (así lo rellena Render, ver render.yaml).
 * - Si no hay ninguna (desarrollo): el mismo equipo que sirve la web, puerto 2567.
 */
export function serverEndpoint(): string {
  const url = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (url) return url;
  const host = import.meta.env.VITE_SERVER_HOST as string | undefined;
  if (host) return `wss://${host}`;
  const secure = location.protocol === "https:";
  return `${secure ? "wss" : "ws"}://${location.hostname}:${SERVER_PORT}`;
}

/**
 * Despierta al servidor (los alojamientos gratuitos lo duermen si nadie juega) y avisa del estado:
 * "slow" si tarda más de unos segundos. Reintenta hasta que responde.
 */
export async function wakeServer(onStatus: (status: "checking" | "slow" | "ready") => void): Promise<void> {
  const health = serverEndpoint().replace(/^ws/, "http") + "/health";
  onStatus("checking");
  const slow = setTimeout(() => onStatus("slow"), 2500);
  for (;;) {
    try {
      const res = await fetch(health, { cache: "no-store" });
      if (res.ok) break;
    } catch {
      // Aún arrancando: se vuelve a intentar.
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  clearTimeout(slow);
  onStatus("ready");
}

/**
 * Simulador de red para depurar (panel F1): retraso, variación y pérdida de paquetes.
 * Solo los estados de los karts se pueden "perder" (como pasaría con mala cobertura);
 * los mensajes de sala siempre llegan, aunque con retraso.
 */
export const NET_DEBUG = { latency: 0, jitter: 0, loss: 0 };

function simulated(fn: () => void, droppable: boolean) {
  if (droppable && NET_DEBUG.loss > 0 && Math.random() * 100 < NET_DEBUG.loss) return;
  const delay = NET_DEBUG.latency + Math.random() * NET_DEBUG.jitter;
  if (delay <= 0) fn();
  else setTimeout(fn, delay);
}

const RESUME_KEY = "derrape.resume";
/** Segundos que se intenta volver a la sala tras perder la conexión (el servidor guarda 30). */
const RECONNECT_FOR = 28;

type Handler = (payload: unknown) => void;

export class Net {
  private client = new Client(serverEndpoint());
  private room: Room | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private leaving = false;
  readonly clock = new ServerClock();
  /** Se llama con true al perder la conexión y false al recuperarla (o null si no se pudo). */
  onConnection: (state: "lost" | "back" | "gone") => void = () => {};

  get id(): string | null {
    return this.room?.sessionId ?? null;
  }

  get code(): string | null {
    return this.room?.roomId ?? null;
  }

  async create(options: JoinOptions) {
    this.bind(await this.client.create(ROOM_RACE, options));
  }

  async join(code: string, options: JoinOptions) {
    this.bind(await this.client.joinById(code, options));
  }

  /** Vuelve a la sala anterior si la página se recargó hace poco. */
  async resume(): Promise<boolean> {
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(RESUME_KEY);
    } catch {
      return false;
    }
    if (!token) return false;
    try {
      this.bind(await this.client.reconnect(token));
      return true;
    } catch {
      this.forget();
      return false;
    }
  }

  on<T>(type: string, handler: (payload: T) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler as Handler);
    return () => set.delete(handler as Handler);
  }

  send(type: string, payload?: unknown) {
    const room = this.room;
    if (!room) return;
    simulated(() => {
      // Puede haberse cerrado mientras esperaba el retraso simulado.
      if (room.connection.isOpen) room.send(type, payload);
    }, type === MSG.state);
  }

  async leave() {
    this.leaving = true;
    this.forget();
    await this.room?.leave(true).catch(() => {});
    this.room = null;
  }

  private bind(room: Room) {
    this.room = room;
    this.leaving = false;
    this.remember(room.reconnectionToken);
    for (const type of Object.values(MSG)) {
      room.onMessage(type, (payload: unknown) => {
        simulated(() => {
          if (type === MSG.states) this.clock.sample((payload as StatesMessage).t, performance.now());
          for (const h of this.handlers.get(type) ?? []) h(payload);
        }, type === MSG.states);
      });
    }
    room.onLeave(() => {
      if (this.leaving || this.room !== room) return;
      void this.reconnect(room.reconnectionToken);
    });
  }

  private async reconnect(token: string) {
    this.onConnection("lost");
    const until = Date.now() + RECONNECT_FOR * 1000;
    while (Date.now() < until && !this.leaving) {
      try {
        this.bind(await this.client.reconnect(token));
        this.onConnection("back");
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    this.room = null;
    this.forget();
    this.onConnection("gone");
  }

  private remember(token: string) {
    try {
      sessionStorage.setItem(RESUME_KEY, token);
    } catch {
      // Sin almacenamiento: no se podrá volver tras recargar, pero sí tras un corte.
    }
  }

  private forget() {
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch {
      // Nada que borrar.
    }
  }
}
