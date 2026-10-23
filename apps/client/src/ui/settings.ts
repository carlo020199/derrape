// Ajustes del jugador, guardados en el navegador (si se puede).

export interface Settings {
  autoAccel: boolean;
  gyro: boolean;
  showFps: boolean;
}

const KEY = "derrape.settings";
const DEFAULTS: Settings = { autoAccel: true, gyro: false, showFps: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Modo privado o almacenamiento bloqueado: se usan los valores por defecto.
  }
  return { ...DEFAULTS };
}

export const settings: Settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Sin almacenamiento: los ajustes duran hasta cerrar la página.
  }
}
