// TODAS las constantes de ajuste del juego viven aquí.

/** Frecuencia del bucle de física (pasos por segundo). */
export const PHYSICS_HZ = 60;
export const PHYSICS_DT = 1 / PHYSICS_HZ;

/** Veces por segundo que cada cliente envía su estado al servidor. */
export const NET_SEND_HZ = 20;

/** Jugadores por sala. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

/**
 * Constantes del kart. Es un objeto mutable a propósito: el panel de debug (F1)
 * las cambia en vivo. Unidades: metros, segundos, radianes.
 *
 * Los valores imitan el comportamiento documentado de los juegos de karts de referencia
 * (ver docs/FISICAS.md): aceleración en dos fases, salto antes del derrape, carga del
 * mini-turbo más rápida girando hacia dentro y tres niveles con duraciones crecientes.
 */
export const KART = {
  /** Velocidad punta (m/s). */
  maxSpeed: 26,
  /**
   * Aceleración en dos fases: hasta `accelLimit` (m/s²) cuando vas lento, y luego
   * `accelRelative` (1/s) × lo que falta hasta la punta. Arranque fuerte y final suave.
   */
  accelLimit: 16.4,
  accelRelative: 1.2,
  /** Frenada (m/s²). */
  brake: 30,
  /** Velocidad máxima marcha atrás (m/s). */
  maxReverse: 8,
  /** Aceleración marcha atrás (m/s²). */
  reverseAccel: 10,
  /** Deceleración sin pisar nada (m/s²). */
  coastDrag: 6,
  /** Giro máximo sin derrapar (rad/s). */
  turnRate: 2.0,
  /** Velocidad a partir de la cual se gira al máximo (m/s). */
  turnFullSpeed: 8,
  /** Fracción del giro que se conserva a velocidad punta (0–1). */
  turnAtTopSpeed: 0.85,
  /** Radio de colisión del kart (m). */
  radius: 0.9,

  /** Salto que inicia el derrape (s en el aire) y su altura (m, solo visual). */
  hopTime: 0.22,
  hopHeight: 0.35,
  /** Velocidad mínima para empezar a derrapar (m/s). */
  driftMinSpeed: 10,
  /** Giro derrapando con el control neutro (rad/s): el derrape cierra más que el giro normal. */
  driftTurnBase: 2.0,
  /** Giro extra/menos según cierres (hacia dentro) o abras (hacia fuera) el derrape (rad/s). */
  driftTurnRange: 1.1,
  /** Velocidad que se pierde derrapando (fracción de la punta). Casi nada. */
  driftSpeedLoss: 0.02,
  /** Carga por segundo girando hacia dentro de la curva / en neutro o hacia fuera (5 y 2 por fotograma a 60 fps). */
  driftChargeFast: 300,
  driftChargeSlow: 120,
  /** A partir de qué parte del giro hacia dentro se carga rápido (0–1). */
  driftInsideThreshold: 0.4,
  /** Carga necesaria para cada nivel de chispas: azul, naranja, morado. */
  driftLevel1: 270,
  driftLevel2: 570,
  driftLevel3: 870,
  /** Multiplicador de carga (el coche Derrapín tendrá +15 %). */
  driftChargeMult: 1,
  /** Ángulo visual del kart derrapando (rad). Solo estético. */
  driftVisualAngle: 0.45,

  /** Duración del mini-turbo por nivel (s). */
  boostTime1: 0.62,
  boostTime2: 1.67,
  boostTime3: 2.63,
  /** Velocidad punta durante el mini-turbo (multiplicador). */
  boostSpeedMult: 1.2,
  /** Aceleración durante cualquier turbo (m/s²). */
  boostAccel: 45,

  /** Velocidad que se conserva al chocar con un borde de frente (0–1). */
  wallBounceKeep: 0.45,
  /** Velocidad que se conserva rozando un borde en paralelo (0–1). */
  wallScrapeKeep: 0.97,
};

export type KartTuning = typeof KART;

/** Reglas de la carrera. */
export const RACE = {
  /** Duración de la cuenta atrás 3-2-1 (s). El "2" sale en el segundo 1. */
  countdown: 3,
  /** Vueltas por defecto (cada circuito puede cambiarlo). */
  laps: 3,
  /** Un checkpoint cada tantos metros. */
  checkpointSpacing: 50,
  /** Reaparecer si estás casi parado (m/s) durante tantos segundos. */
  stuckSpeed: 1.5,
  stuckTime: 3,
  /**
   * Salida con turbo: empezar a mantener el acelerador entre `startPerfectFrom` y `startPerfectTo`
   * (justo al salir el "2") da el turbo largo; hasta `startGoodTo`, uno corto; antes del "2", se cala.
   */
  startPerfectFrom: 1,
  startPerfectTo: 1.4,
  startGoodTo: 2.2,
  startPerfectBoost: 1.2,
  startGoodBoost: 0.5,
  startBoostMult: 1.3,
  startStallTime: 1,
};

/**
 * Superficies. Los turbos (mini-turbo, nitro, paneles) ignoran el terreno, como en la referencia.
 * Fuera de pista: MK7 usa ×0,78 / ×0,43 / ×0,31 según lo malo que sea el terreno.
 */
export const SURFACE = {
  /** Velocidad punta en el arcén (hierba, tierra). */
  offroadSpeedMult: 0.45,
  /** Velocidad punta en zonas lentas (arena profunda, barro). */
  slowSpeedMult: 0.35,
  /** Frenada al entrar en una superficie lenta yendo más rápido que su punta (m/s²). */
  roughDecel: 20,
  /** Hielo: fracción del giro y de la aceleración que se conserva. */
  lowGripTurnMult: 0.55,
  lowGripAccelMult: 0.6,
  /** Panel de turbo: duración y fuerza. */
  boostPadTime: 1,
  boostPadMult: 1.3,
};

/** Objetos y cajas. Tiempos en s, distancias en m. */
export const ITEMS = {
  /** Segundos que tarda una caja en reaparecer. */
  boxRespawn: 3,
  /** Distancia para recoger una caja. */
  boxRadius: 2,
  /** Duración de la ruleta antes de poder usar el objeto. */
  rollTime: 1,
  /** Nitro: duración del acelerón y velocidad punta (más fuerte que un mini-turbo). */
  nitroTime: 1.5,
  nitroSpeedMult: 1.3,
  /** Escudo: duración (bloquea un golpe). */
  shieldTime: 8,
  /** Trompo al pisar aceite o recibir un cohete. */
  oilSpinTime: 1,
  rocketSpinTime: 1.2,
  /** Frenada durante el trompo (m/s²). */
  spinDecel: 22,
  /** Aceite: radio, distancia al lanzarlo adelante, distancia al soltarlo detrás y máximo en pista. */
  oilRadius: 1.7,
  oilThrowDistance: 22,
  oilDropBack: 3,
  maxOils: 12,
  /** Cohete: velocidad, duración, radio de impacto y rapidez con la que se cambia de carril hacia el objetivo. */
  rocketSpeed: 45,
  rocketLife: 6,
  rocketHitRadius: 2,
  rocketHoming: 5,
};

/**
 * Probabilidad de cada objeto según la posición (pesos relativos).
 * Los de delante reciben objetos defensivos; los de detrás, de remontada.
 */
export const ITEM_ODDS = {
  front: { nitro: 2, oil: 5, rocket: 1, shield: 3 },
  middle: { nitro: 3, oil: 3, rocket: 3, shield: 2 },
  back: { nitro: 5, oil: 1, rocket: 4, shield: 1 },
};

/** Controles táctiles (móvil en vertical). Distancias en píxeles CSS, tiempos en ms. */
export const TOUCH = {
  /** Arrastre horizontal para girar al máximo. */
  steerRange: 90,
  /** Zona muerta del giro (fracción de steerRange). */
  deadZone: 0.06,
  /** Fracción de steerRange a partir de la cual el giro se convierte en derrape. */
  driftTrigger: 0.6,
  /** Un toque: dura menos que esto... */
  tapMaxMs: 250,
  /** ...y el dedo se mueve menos que esto. */
  tapSlop: 14,
  /** Un deslizamiento vertical: dura menos que esto... */
  swipeMaxMs: 400,
  /** ...y recorre al menos esto en vertical. */
  swipeMin: 45,
};
