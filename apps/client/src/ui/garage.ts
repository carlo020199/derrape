// Pantalla de selección: personaje → coche (con barras de estadísticas) → color.

import {
  CHARACTERS,
  COLOR_NAMES,
  KARTS,
  KART_COLORS,
  STAT_NAMES,
  WEIGHT_CLASS_MOD,
  WEIGHT_CLASS_NAMES,
  combineStats,
  findCharacter,
  findKart,
  type KartStats,
} from "@derrape/shared";
import type { GaragePreview } from "../render/garagePreview";
import { lobbyTakenColors, profile, saveProfile } from "./screens";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

const STAT_KEYS = Object.keys(STAT_NAMES) as (keyof KartStats)[];

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "");

export interface GarageActions {
  /** Cambió el personaje, el coche o el color. */
  change(): void;
  /** Pulsó "Listo". */
  done(): void;
}

export function setupGarage(preview: GaragePreview, actions: GarageActions) {
  const chars = $("#garage-chars");
  const karts = $("#garage-karts");
  const colors = $("#garage-colors");

  const pick = (parent: HTMLElement, label: string, sub: string, onClick: () => void, swatch?: number) => {
    const b = document.createElement("button");
    if (swatch !== undefined) b.append(Object.assign(document.createElement("i"), { style: `background:${hex(swatch)}` }));
    b.append(Object.assign(document.createElement("b"), { textContent: label }));
    b.append(Object.assign(document.createElement("small"), { textContent: sub }));
    b.addEventListener("click", onClick);
    parent.append(b);
  };

  for (const c of CHARACTERS)
    pick(chars, c.name, WEIGHT_CLASS_NAMES[c.weightClass], () => select({ character: c.id }), c.color);
  for (const k of KARTS) pick(karts, k.name, k.style, () => select({ kart: k.id }));
  KART_COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.style.background = hex(c);
    b.ariaLabel = COLOR_NAMES[i]!;
    b.addEventListener("click", () => select({ color: i }));
    colors.append(b);
  });

  function select(change: Partial<{ character: string; kart: string; color: number }>) {
    Object.assign(profile, change);
    saveProfile();
    render(true);
    actions.change();
  }

  /** Dibuja la selección actual. `cheer` = el piloto celebra en la vista previa. */
  function render(cheer = false) {
    const c = findCharacter(profile.character)!;
    const k = findKart(profile.kart)!;
    [...chars.children].forEach((b, i) => b.classList.toggle("sel", CHARACTERS[i]!.id === c.id));
    [...karts.children].forEach((b, i) => b.classList.toggle("sel", KARTS[i]!.id === k.id));
    [...colors.children].forEach((b, i) => {
      (b as HTMLButtonElement).disabled = lobbyTakenColors.has(i);
      b.classList.toggle("mine", profile.color === i);
    });

    const mod = WEIGHT_CLASS_MOD[c.weightClass];
    const modText = [mod.weight && `peso ${signed(mod.weight)}`, mod.accel && `aceleración ${signed(mod.accel)}`]
      .filter(Boolean)
      .join(", ");
    $("#garage-char-info").textContent = `${c.blurb} ${WEIGHT_CLASS_NAMES[c.weightClass]}${modText ? `: ${modText}` : ""}.`;
    $("#garage-kart-info").textContent = `${k.style}. ${k.forWho}.`;

    const final = combineStats(c, k);
    $("#garage-stats").replaceChildren(
      ...STAT_KEYS.map((key) => {
        const row = document.createElement("div");
        const diff = final[key] - k.stats[key];
        const bar = document.createElement("span");
        bar.className = "bar";
        bar.dataset.stat = key;
        for (let i = 1; i <= 5; i++) bar.append(Object.assign(document.createElement("i"), { className: i <= final[key] ? "on" : "" }));
        row.append(
          Object.assign(document.createElement("span"), { textContent: STAT_NAMES[key] }),
          bar,
          Object.assign(document.createElement("em"), { textContent: signed(diff) }),
        );
        return row;
      }),
    );
    preview.set(c.id, k.id, profile.color, cheer);
  }

  $("#garage-done").addEventListener("click", actions.done);
  return { render };
}
