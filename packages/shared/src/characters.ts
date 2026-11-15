// Los personajes (datos). Dan una clase de peso que ajusta un poco las estadísticas del coche.
// Los 5 primeros conservan id y clase: solo cambian el nombre, el texto y los colores.
// Los 3 últimos usan la misma fórmula de clase (no tienen estadísticas propias).
// Todo ORIGINAL (ver CLAUDE.md). Añadir un personaje = una entrada nueva aquí + su aspecto en el cliente.

export type WeightClass = "light" | "medium" | "heavy";

/** Cómo se dibuja la cabeza y los accesorios (el cliente construye cada estilo con primitivas). */
export type CharacterLook = "mechanic" | "robot" | "courier" | "bulldog" | "granny" | "mascot" | "sheet" | "dandy";

export interface CharacterDef {
  id: string;
  name: string;
  /** Una línea para la pantalla de selección. */
  blurb: string;
  weightClass: WeightClass;
  look: CharacterLook;
  /** Color principal de la ropa / cuerpo. */
  color: number;
  /** Hueso de la calavera. */
  skin: number;
  /** Detalle (gorra, bufanda, antena, fuego…). */
  accent: number;
}

export const WEIGHT_CLASS_NAMES: Record<WeightClass, string> = { light: "Ligero", medium: "Medio", heavy: "Pesado" };

/** Ajuste a las estadísticas del coche según la clase de peso (se limita a 1–5 después). */
export const WEIGHT_CLASS_MOD: Record<WeightClass, { weight: number; accel: number }> = {
  light: { weight: -1, accel: 1 },
  medium: { weight: 0, accel: 0 },
  heavy: { weight: 1, accel: -1 },
};

const HUESO = 0xf3e7d3;

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: "lia",
    name: "Lía Brasas",
    blurb: "Mecánica esqueleto, coleta de fuego espectral, llave de hueso y mono ciruela.",
    weightClass: "light",
    look: "mechanic",
    color: 0x6b3fd6,
    skin: HUESO,
    accent: 0x3ff2c8,
  },
  {
    id: "kiko",
    name: "Kiko Farolillo",
    blurb: "Robot-farol redondo, con una calavera en la pantalla y una llama cian en la antena.",
    weightClass: "light",
    look: "robot",
    color: 0x2e2547,
    skin: HUESO,
    accent: 0x3ff2c8,
  },
  {
    id: "toni",
    name: "Toni Repartumbas",
    blurb: "Repartidor esqueleto con gorra y mochila-ataúd térmica de esquinas redondas.",
    weightClass: "medium",
    look: "courier",
    color: 0xff6a1f,
    skin: HUESO,
    accent: 0xf3e7d3,
  },
  {
    id: "tocho",
    name: "Tocho del Más Allá",
    blurb: "Bulldog fantasma con collar de pinchos romos, gafas de aviador y ojos espectrales.",
    weightClass: "medium",
    look: "bulldog",
    color: 0xc8b597,
    skin: HUESO,
    accent: 0x3ff2c8,
  },
  {
    id: "nonna-pina",
    name: "Nonna Pina Calavera",
    blurb: "Abuela esqueleto con casco vintage, gafas redondas y bufanda de fuego.",
    weightClass: "heavy",
    look: "granny",
    color: 0x6b3fd6,
    skin: HUESO,
    accent: 0xff6a1f,
  },
  {
    id: "brasa",
    name: "Brasa",
    blurb: "Calavera con melena de fuego y chaqueta de cuero. Fuego naranja amable.",
    weightClass: "medium",
    look: "mascot",
    color: 0x3a241c,
    skin: HUESO,
    accent: 0xff6a1f,
  },
  {
    id: "mimi",
    name: "Mimí Sábana",
    blurb: "Fantasmita de sábana con farol y mejillas violeta. Flota, no tiene piernas.",
    weightClass: "light",
    look: "sheet",
    color: 0xf3e7d3,
    skin: HUESO,
    accent: 0x9b6bff,
  },
  {
    id: "don-osario",
    name: "Don Osario",
    blurb: "Esqueleto grandullón con sombrero de copa y pajarita. Muy educado.",
    weightClass: "heavy",
    look: "dandy",
    color: 0x2e2547,
    skin: HUESO,
    accent: 0xffb423,
  },
];

export const DEFAULT_CHARACTER = CHARACTERS[0]!.id;

export function findCharacter(id: unknown): CharacterDef | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
