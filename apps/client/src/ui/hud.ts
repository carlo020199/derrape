// HUD en HTML: velocímetro, nivel de turbo, posición y objeto.

import type { ItemType } from "@derrape/shared";

const speedEl = document.querySelector<HTMLSpanElement>("#hud-speed")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const pips = [...document.querySelectorAll<HTMLSpanElement>("#hud-turbo span")];
const slot = document.querySelector<HTMLDivElement>("#item-slot")!;
const slotIcon = slot.querySelector("span")!;
const positionEl = document.querySelector<HTMLDivElement>("#position")!;

export const ITEM_ICONS: Record<ItemType, string> = { nitro: "⚡", oil: "🛢️", rocket: "🚀", shield: "🛡️" };
export const ITEM_NAMES: Record<ItemType, string> = { nitro: "Nitro", oil: "Aceite", rocket: "Cohete", shield: "Escudo" };
const ROULETTE = Object.values(ITEM_ICONS);

let lastSpeed = -1;
let lastLevel = -1;
let lastBoost = false;
let lastIcon = "";
let lastPosition = "";

export function updateHud(speedKmh: number, driftLevel: number, boosting: boolean) {
  const speed = Math.round(speedKmh);
  if (speed !== lastSpeed) {
    speedEl.textContent = String(speed);
    lastSpeed = speed;
  }
  if (driftLevel !== lastLevel) {
    pips.forEach((p, i) => p.classList.toggle("on", i < driftLevel));
    hud.dataset.level = String(driftLevel);
    lastLevel = driftLevel;
  }
  if (boosting !== lastBoost) {
    hud.classList.toggle("boost", boosting);
    lastBoost = boosting;
  }
}

/** Cuadro del objeto: vacío, ruleta girando o el objeto listo. */
export function updateItemSlot(item: ItemType | null, rolling: boolean, time: number) {
  const icon = item === null ? "" : rolling ? ROULETTE[Math.floor(time * 12) % ROULETTE.length]! : ITEM_ICONS[item];
  const isRolling = item !== null && rolling;
  if (icon === lastIcon && slot.classList.contains("rolling") === isRolling) return;
  slotIcon.textContent = icon;
  slot.classList.toggle("ready", item !== null && !rolling);
  slot.classList.toggle("rolling", isRolling);
  slot.classList.toggle("empty", item === null);
  lastIcon = icon;
}

export function updatePosition(position: number, total: number) {
  const text = `${position}/${total}`;
  if (text === lastPosition) return;
  const place = positionEl.querySelector("#position-place");
  const totalEl = positionEl.querySelector("#position-total");
  if (place && totalEl) {
    place.textContent = `${position}º`;
    totalEl.textContent = `/${total}`;
  } else {
    positionEl.textContent = `${position}º/${total}`;
  }
  positionEl.classList.toggle("lead", position === 1);
  lastPosition = text;
}
