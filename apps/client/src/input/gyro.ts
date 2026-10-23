// Girar inclinando el móvil. En iOS hay que pedir permiso tras un toque y servir por HTTPS.

/** Grados de inclinación para girar al máximo. */
const TILT_RANGE = 25;
const DEAD_ZONE = 2;

let tilt = 0;
let zero = 0;
let listening = false;

type PermissionFn = () => Promise<"granted" | "denied">;

function screenAngle(): number {
  return screen.orientation?.angle ?? (window.orientation as number | undefined) ?? 0;
}

function onOrientation(e: DeviceOrientationEvent) {
  // En horizontal, girar el móvil como un volante cambia "beta".
  const a = screenAngle();
  const beta = e.beta ?? 0;
  tilt = a === 90 ? beta : a === 270 || a === -90 ? -beta : (e.gamma ?? 0);
}

/** Pide permiso (si hace falta) y empieza a escuchar. Llamar desde un toque del usuario. */
export async function enableGyro(): Promise<string | null> {
  if (!window.isSecureContext) return "El giroscopio necesita HTTPS (funcionará en la versión publicada).";
  if (typeof DeviceOrientationEvent === "undefined") return "Este dispositivo no tiene giroscopio.";
  const request = (DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
  if (request) {
    try {
      if ((await request()) !== "granted") return "Permiso denegado. Actívalo en los ajustes de Safari.";
    } catch {
      return "No se pudo pedir permiso para el giroscopio.";
    }
  }
  if (!listening) {
    window.addEventListener("deviceorientation", onOrientation);
    listening = true;
  }
  calibrateGyro();
  return null;
}

export function disableGyro() {
  window.removeEventListener("deviceorientation", onOrientation);
  listening = false;
  tilt = zero = 0;
}

/** La posición actual pasa a ser "recto". */
export function calibrateGyro() {
  zero = tilt;
}

export function readGyroSteer(): number {
  const d = tilt - zero;
  if (Math.abs(d) < DEAD_ZONE) return 0;
  return Math.max(-1, Math.min(1, d / TILT_RANGE));
}
