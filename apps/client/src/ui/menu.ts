// Menú de ajustes y pantalla de pausa.

import { calibrateGyro, disableGyro, enableGyro } from "../input/gyro";
import { saveSettings, settings, type Settings } from "./settings";

export function setupMenu(onPauseChange: (paused: boolean) => void) {
  const menu = document.querySelector<HTMLDivElement>("#menu")!;
  const pause = document.querySelector<HTMLDivElement>("#pause")!;
  const note = document.querySelector<HTMLParagraphElement>("#gyro-note")!;
  const fps = document.querySelector<HTMLDivElement>("#fps")!;
  const calibrate = document.querySelector<HTMLButtonElement>("#gyro-calibrate")!;

  const applyFps = () => (fps.hidden = !settings.showFps);
  applyFps();

  const syncGyroUi = () => {
    calibrate.hidden = !settings.gyro;
    document.body.classList.toggle("gyro", settings.gyro);
  };

  for (const input of menu.querySelectorAll<HTMLInputElement>("input[data-setting]")) {
    const key = input.dataset.setting as keyof Settings;
    input.checked = settings[key];
    input.addEventListener("change", async () => {
      if (key === "gyro") {
        note.textContent = "";
        if (input.checked) {
          const error = await enableGyro();
          if (error) {
            note.textContent = error;
            input.checked = false;
          }
        } else {
          disableGyro();
        }
      }
      settings[key] = input.checked;
      saveSettings();
      applyFps();
      syncGyroUi();
    });
  }
  // El giroscopio no se puede reactivar solo al recargar (iOS exige un toque).
  if (settings.gyro) {
    settings.gyro = false;
    menu.querySelector<HTMLInputElement>('input[data-setting="gyro"]')!.checked = false;
  }
  syncGyroUi();
  calibrate.addEventListener("click", () => calibrateGyro());

  const open = () => {
    menu.hidden = false;
    onPauseChange(true);
  };
  const close = () => {
    menu.hidden = true;
    onPauseChange(false);
  };
  document.querySelector("#btn-menu")!.addEventListener("click", open);
  document.querySelector("#menu-close")!.addEventListener("click", close);

  // Pausa al cambiar de app; se sigue con un toque.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && menu.hidden) {
      pause.hidden = false;
      onPauseChange(true);
    }
  });
  pause.addEventListener("click", () => {
    pause.hidden = true;
    onPauseChange(false);
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") (menu.hidden ? open : close)();
  });
}
