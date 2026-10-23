// HUD en HTML: velocímetro y nivel de turbo.

const speedEl = document.querySelector<HTMLSpanElement>("#hud-speed")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const pips = [...document.querySelectorAll<HTMLSpanElement>("#hud-turbo span")];

let lastSpeed = -1;
let lastLevel = -1;
let lastBoost = false;

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
