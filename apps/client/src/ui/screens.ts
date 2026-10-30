// Pantallas de menú: inicio (nombre, crear, unirse, practicar) y sala (código, jugadores, color, circuito).

import {
  COLOR_NAMES,
  DEFAULT_CHARACTER,
  DEFAULT_KART,
  KART_COLORS,
  MIN_PLAYERS,
  TRACKS,
  normalizeName,
  findCharacter,
  findKart,
  normalizeRoomCode,
  type LobbyMessage,
} from "@derrape/shared";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

// --- Perfil guardado (nombre, color, personaje y coche preferidos) ---
const PROFILE_KEY = "derrape.profile";
export const profile: { name: string; color: number; character: string; kart: string } = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as Partial<{
      name: string;
      color: number;
      character: string;
      kart: string;
    }> | null;
    return {
      name: saved?.name ?? "",
      color: saved?.color ?? 0,
      character: findCharacter(saved?.character) ? saved!.character! : DEFAULT_CHARACTER,
      kart: findKart(saved?.kart) ? saved!.kart! : DEFAULT_KART,
    };
  } catch {
    return { name: "", color: 0, character: DEFAULT_CHARACTER, kart: DEFAULT_KART };
  }
})();
/** Colores que ya tienen otros jugadores en la sala (para no ofrecerlos). */
export const lobbyTakenColors = new Set<number>();
export function saveProfile() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Sin almacenamiento: se pedirá el nombre otra vez.
  }
}

/** "Lia · Chispa" para los botones y la lista de la sala. */
export function lookLabel(character: string, kart: string): string {
  return `${findCharacter(character)?.name ?? "?"} · ${findKart(kart)?.name ?? "?"}`;
}

/** Pone en los botones de "piloto y coche" lo que hay elegido. */
export function refreshLookButtons() {
  const text = `Piloto y coche: ${lookLabel(profile.character, profile.kart)}`;
  $("#home-garage").textContent = text;
  $("#lobby-garage").textContent = text;
}

export function showScreen(which: "home" | "lobby" | "garage" | null) {
  $("#home").hidden = which !== "home";
  $("#lobby").hidden = which !== "lobby";
  $("#garage").hidden = which !== "garage";
  document.body.classList.toggle("in-menu", which !== null);
}

// --- Inicio ---
export interface HomeActions {
  create(name: string): Promise<void>;
  join(code: string, name: string): Promise<void>;
  solo(name: string): void;
  garage(): void;
}

export function setupHome(actions: HomeActions, prefillCode: string | null) {
  const nameInput = $<HTMLInputElement>("#home-name");
  const codeInput = $<HTMLInputElement>("#home-code");
  const error = $<HTMLParagraphElement>("#home-error");
  const buttons = ["#home-create", "#home-join", "#home-solo"].map((s) => $<HTMLButtonElement>(s));
  nameInput.value = profile.name;
  if (prefillCode) codeInput.value = prefillCode;

  const name = () => {
    profile.name = normalizeName(nameInput.value);
    nameInput.value = profile.name;
    saveProfile();
    return profile.name;
  };
  const busy = async (fn: () => Promise<void>) => {
    error.textContent = "";
    buttons.forEach((b) => (b.disabled = true));
    try {
      await fn();
    } catch (e) {
      error.textContent = friendlyError(e);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };

  $("#home-create").addEventListener("click", () => busy(() => actions.create(name())));
  const join = () => {
    const code = normalizeRoomCode(codeInput.value);
    if (!code) {
      error.textContent = "Escribe el código de 4 letras que te han pasado.";
      return;
    }
    void busy(() => actions.join(code, name()));
  };
  $("#home-join").addEventListener("click", join);
  codeInput.addEventListener("keydown", (e) => e.key === "Enter" && join());
  $("#home-solo").addEventListener("click", () => actions.solo(name()));
  $("#home-garage").addEventListener("click", actions.garage);
  refreshLookButtons();
}

export function setHomeError(message: string) {
  $("#home-error").textContent = message;
}

function friendlyError(e: unknown): string {
  const text = String((e as { message?: string })?.message ?? e);
  if (/not found|no rooms|invalid/i.test(text)) return "No hay ninguna sala con ese código.";
  if (/locked|full|llena/i.test(text)) return "La sala está llena.";
  if (/fetch|network|connect|ECONNREFUSED|Failed/i.test(text)) return "No se puede conectar con el servidor. ¿Está encendido?";
  return text;
}

// --- Sala ---
export interface LobbyActions {
  color(index: number): void;
  track(id: string): void;
  start(): void;
  garage(): void;
  invite(): void;
  leave(): void;
}

export function setupLobby(actions: LobbyActions) {
  const colors = $("#lobby-colors");
  KART_COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.style.background = hex(c);
    b.ariaLabel = COLOR_NAMES[i]!;
    b.addEventListener("click", () => {
      profile.color = i;
      saveProfile();
      actions.color(i);
    });
    colors.append(b);
  });
  const track = $<HTMLSelectElement>("#lobby-track");
  for (const t of TRACKS) track.add(new Option(t.number ? `${t.number}. ${t.name}` : t.name, t.id));
  track.addEventListener("change", () => actions.track(track.value));
  $("#lobby-start").addEventListener("click", actions.start);
  $("#lobby-garage").addEventListener("click", actions.garage);
  $("#lobby-invite").addEventListener("click", actions.invite);
  $("#lobby-leave").addEventListener("click", actions.leave);
}

export function renderLobby(m: LobbyMessage, myId: string | null) {
  $("#lobby-code").textContent = m.code;
  $("#lobby-error").textContent = "";
  const me = m.players.find((p) => p.id === myId);
  const amHost = me?.host ?? false;

  const list = $("#lobby-players");
  list.replaceChildren(
    ...m.players.map((p) => {
      const li = document.createElement("li");
      if (!p.connected) li.className = "off";
      const swatch = Object.assign(document.createElement("span"), { className: "swatch" });
      swatch.style.background = hex(KART_COLORS[p.color] ?? 0xffffff);
      const tags = [p.id === myId ? "tú" : "", p.host ? "anfitrión" : "", p.connected ? "" : "reconectando…"].filter(Boolean);
      const who = document.createElement("span");
      who.className = "who";
      who.append(
        Object.assign(document.createElement("b"), { textContent: p.name }),
        Object.assign(document.createElement("small"), { textContent: lookLabel(p.character, p.kart) }),
      );
      li.append(swatch, who);
      if (tags.length) li.append(Object.assign(document.createElement("span"), { className: "tag", textContent: tags.join(" · ") }));
      return li;
    }),
  );

  const taken = new Set(m.players.filter((p) => p.id !== myId).map((p) => p.color));
  lobbyTakenColors.clear();
  taken.forEach((c) => lobbyTakenColors.add(c));
  [...$("#lobby-colors").children].forEach((b, i) => {
    (b as HTMLButtonElement).disabled = taken.has(i);
    b.classList.toggle("mine", me?.color === i);
  });

  const track = $<HTMLSelectElement>("#lobby-track");
  track.value = m.trackId;
  track.disabled = !amHost;

  const connected = m.players.filter((p) => p.connected).length;
  const start = $<HTMLButtonElement>("#lobby-start");
  start.hidden = !amHost;
  start.disabled = connected < MIN_PLAYERS || m.phase !== "lobby";
  $("#lobby-wait").textContent =
    m.phase !== "lobby"
      ? "Hay una carrera en marcha: entrarás en la siguiente."
      : !amHost
        ? "Esperando a que el anfitrión empiece…"
        : connected < MIN_PLAYERS
          ? "Invita al menos a un amigo para empezar."
          : "";
}

export function setLobbyError(message: string) {
  $("#lobby-error").textContent = message;
}
