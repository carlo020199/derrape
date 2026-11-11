import { PALETTE } from "./materials";

// Las chispas ya no son un Points aparte: van en la misma malla aditiva que las llamas
// (`flames.ts`), para que fuego y chispas sean una sola llamada de dibujo.

/** Índice 1–3 = niveles de turbo. El 0 no se usa. */
export const SPARK_COLORS = [0x000000, PALETTE.turbo1, PALETTE.turbo2, PALETTE.turbo3] as const;

export const HIT_SPARK = PALETTE.ascua;
export const NITRO_SPARK = PALETTE.espectro;
