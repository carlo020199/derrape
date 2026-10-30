// Los 5 personajes (datos). Dan una clase de peso que ajusta un poco las estadísticas del coche.
// Todo ORIGINAL (ver CLAUDE.md). Añadir un personaje = una entrada nueva aquí + su aspecto en el cliente.

export type WeightClass = "light" | "medium" | "heavy";

/** Cómo se dibuja la cabeza/accesorios (el cliente sabe construir cada estilo con primitivas). */
export type CharacterLook = "mechanic" | "robot" | "courier" | "bulldog" | "granny";

export interface CharacterDef {
  id: string;
  name: string;
  /** Una línea para la pantalla de selección. */
  blurb: string;
  weightClass: WeightClass;
  look: CharacterLook;
  /** Color principal de la ropa / cuerpo. */
  color: number;
  /** Color de la piel / pelo / carcasa. */
  skin: number;
  /** Detalle (gorra, bufanda, antena…). */
  accent: number;
}

export const WEIGHT_CLASS_NAMES: Record<WeightClass, string> = { light: "Ligero", medium: "Medio", heavy: "Pesado" };

/** Ajuste a las estadísticas del coche según la clase de peso (se limita a 1–5 después). */
export const WEIGHT_CLASS_MOD: Record<WeightClass, { weight: number; accel: number }> = {
  light: { weight: -1, accel: 1 },
  medium: { weight: 0, accel: 0 },
  heavy: { weight: 1, accel: -1 },
};

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: "lia",
    name: "Lia",
    blurb: "Mecánica joven, mono azul y llave inglesa a la espalda.",
    weightClass: "light",
    look: "mechanic",
    color: 0x2e86de,
    skin: 0xf1c27d,
    accent: 0xffd23f,
  },
  {
    id: "kiko",
    name: "Kiko",
    blurb: "Robot ayudante pequeño y redondo, con antena y una pantalla por cara.",
    weightClass: "light",
    look: "robot",
    color: 0xb8c4d6,
    skin: 0x6c7a90,
    accent: 0x4cc9f0,
  },
  {
    id: "toni",
    name: "Toni",
    blurb: "Repartidor con gorra y mochila térmica; siempre tiene prisa.",
    weightClass: "medium",
    look: "courier",
    color: 0xff6b35,
    skin: 0xd9a066,
    accent: 0xf4f4f4,
  },
  {
    id: "tocho",
    name: "Tocho",
    blurb: "Bulldog con gafas de aviador y bufanda.",
    weightClass: "medium",
    look: "bulldog",
    color: 0xc8a36b,
    skin: 0xd9b98a,
    accent: 0xe63946,
  },
  {
    id: "nonna-pina",
    name: "Nonna Pina",
    blurb: "Abuela, ex piloto de rallies, con casco vintage y gafas de sol.",
    weightClass: "heavy",
    look: "granny",
    color: 0x9b5de5,
    skin: 0xe8b894,
    accent: 0xf2e8cf,
  },
];

export const DEFAULT_CHARACTER = CHARACTERS[0]!.id;

export function findCharacter(id: unknown): CharacterDef | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
