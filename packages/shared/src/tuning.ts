// TODAS las constantes de ajuste del juego viven aquí.

/** Frecuencia del bucle de física (pasos por segundo). */
export const PHYSICS_HZ = 60;
export const PHYSICS_DT = 1 / PHYSICS_HZ;

/** Veces por segundo que cada cliente envía su estado al servidor. */
export const NET_SEND_HZ = 20;

/** Jugadores por sala. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
