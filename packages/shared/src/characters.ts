// Los 5 personajes (datos). Dan una clase de peso que ajusta un poco las estadísticas del coche.
// Todo ORIGINAL (ver CLAUDE.md). Añadir un personaje = una entrada nueva aquí + su aspecto en el cliente.

export type WeightClass = "light" | "medium" | "heavy";

/** Cómo se dibuja la cabeza/accesorios (el cliente sabe construir cada estilo con primitivas). */
export type CharacterLook = "mechanic" | "ghost" | "blaze" | "aviator" | "hooded";

export interface CharacterDef {
  id: string;
  name: string;
  /** Una línea para la pantalla de selección. */
  blurb: string;
  weightClass: WeightClass;
  look: CharacterLook;
  /** Color principal de la ropa / cuerpo. */
  color: number;
  /** Color del hueso (o de la sombra del cuerpo, en el fantasma). */
  skin: number;
  /** Detalle: pelo, llamas, bufanda, brillo de los ojos… */
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
    name: "Lía Brasas",
    blurb: "Calaverita mecánica con melena de fuego espectral y llave inglesa a la espalda.",
    weightClass: "light",
    look: "mechanic",
    color: 0x4a3a8c,
    skin: 0xf3e7d3,
    accent: 0x3ff2c8,
  },
  {
    id: "kiko",
    name: "Kiko Fatuo",
    blurb: "Fantasmita redondo que se alumbra con un farol; no pesa casi nada.",
    weightClass: "light",
    look: "ghost",
    color: 0xf6f1ff,
    skin: 0xd9d0f2,
    accent: 0xffb423,
  },
  {
    id: "toni",
    name: "Toni Ascuas",
    blurb: "Calavera con la cabeza en llamas y chupa de cuero; siempre tiene prisa.",
    weightClass: "medium",
    look: "blaze",
    color: 0x2a2238,
    skin: 0xf3e7d3,
    accent: 0xff6a1f,
  },
  {
    id: "tocho",
    name: "Capitán Tocho",
    blurb: "Esqueleto aviador con gorro de cuero, gafas y bufanda.",
    weightClass: "medium",
    look: "aviator",
    color: 0x7a5236,
    skin: 0xf3e7d3,
    accent: 0xd9362b,
  },
  {
    id: "nonna-pina",
    name: "Nonna Pina",
    blurb: "Abuela encapuchada, ex piloto de rallies del más allá.",
    weightClass: "heavy",
    look: "hooded",
    color: 0x6b3fd6,
    skin: 0xf3e7d3,
    accent: 0x3ff2c8,
  },
];

export const DEFAULT_CHARACTER = CHARACTERS[0]!.id;

export function findCharacter(id: unknown): CharacterDef | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
