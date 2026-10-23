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
 */
export const KART = {
  /** Velocidad punta (m/s). */
  maxSpeed: 26,
  /** Aceleración con el acelerador pisado (m/s²). */
  accel: 16,
  /** Frenada (m/s²). */
  brake: 30,
  /** Velocidad máxima marcha atrás (m/s). */
  maxReverse: 8,
  /** Aceleración marcha atrás (m/s²). */
  reverseAccel: 10,
  /** Deceleración sin pisar nada (m/s²). */
  coastDrag: 6,
  /** Giro máximo (rad/s). */
  turnRate: 2.4,
  /** Velocidad a partir de la cual se gira al máximo (m/s). */
  turnFullSpeed: 8,
  /** Fracción del giro que se conserva a velocidad punta (0–1). */
  turnAtTopSpeed: 0.75,
  /** Radio de colisión del kart (m). */
  radius: 0.9,

  /** Velocidad mínima para empezar a derrapar (m/s). */
  driftMinSpeed: 10,
  /** Giro durante el derrape con el stick neutro (rad/s). */
  driftTurnBase: 1.5,
  /** Giro extra/menos según cuánto cierres o abras el derrape (rad/s). */
  driftTurnRange: 1.0,
  /** Velocidad que se pierde derrapando (fracción de la punta). */
  driftSpeedLoss: 0.08,
  /** Segundos de derrape para cada nivel de chispas (azul, naranja, morado). */
  driftLevel1: 0.6,
  driftLevel2: 1.3,
  driftLevel3: 2.2,
  /** Cerrar el derrape carga más rápido (multiplicador con el stick a tope). */
  driftChargeTightBonus: 0.5,
  /** Ángulo visual del kart derrapando (rad). Solo estético. */
  driftVisualAngle: 0.45,

  /** Duración del mini-turbo por nivel (s). */
  boostTime1: 0.5,
  boostTime2: 1.0,
  boostTime3: 1.6,
  /** Velocidad punta durante el turbo (multiplicador). */
  boostSpeedMult: 1.35,
  /** Aceleración durante el turbo (m/s²). */
  boostAccel: 45,

  /** Velocidad que se conserva al chocar con un borde de frente (0–1). */
  wallBounceKeep: 0.45,
  /** Velocidad que se conserva rozando un borde en paralelo (0–1). */
  wallScrapeKeep: 0.97,
};

export type KartTuning = typeof KART;

/** Objetos y cajas. Tiempos en s, distancias en m. */
export const ITEMS = {
  /** Segundos que tarda una caja en reaparecer. */
  boxRespawn: 3,
  /** Distancia para recoger una caja. */
  boxRadius: 2,
  /** Duración de la ruleta antes de poder usar el objeto. */
  rollTime: 1,
  /** Nitro: duración del acelerón. */
  nitroTime: 1.5,
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
