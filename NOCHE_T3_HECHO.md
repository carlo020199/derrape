ESTADO: PARCIAL

> Hydrogen no estuvo disponible (429, cuota diaria gratuita agotada). El objetivo no se ha cumplido del todo: no hay lista de diferencias de Hydrogen ni nueva pasada de Hydrogen; solo 1 de los 3 arreglos posibles quedó aplicado.

## Qué se ha hecho
- **Hydrogen**: 3 intentos (503 → 429; luego 429 dos veces, «retry in 9h47m»). Sin respuesta. Constado en `docs/release-v1/HYDROGEN_vs_referencias.md`.
- **Plan B (decisión mía, sin supervisión)**: Claude comparó a ojo `a`, `b` y `d` con `ejemplo1` y listó 3 diferencias compatibles con Dalí/T2. Está marcado en el documento como comparación de Claude, no de Hydrogen.
- **Arreglo 1 (aplicado, commit propio)**: luna Hueso sin tinte rosa (el halo Ánima se pinta antes del disco, `sky.ts`).
- **Arreglo 2 (revertido)**: laguna lejana más alta; solo 0,90 → 1,19 % en `a` y aspecto peor.
- **Arreglo 3 (revertido, 2 pruebas)**: árboles de salida más grandes; tapaban campanario, farolillos y laguna.
- Capturas 390×844 regeneradas (Lía+Hueso y Calavera Chispas+Medianoche) en `docs/release-v1/capturas/` y `docs/screenshots/release1/`.
- Verificación final: `npm test` 191/191, bot «piloto automático» OK, lint 0, build 0. `npm run medir` Laguna **53 llamadas · 86 082 tris** (≤ 90 / ≤ 110 000). `renderer.info` en capturas: 54–61 llamadas, 94–100 k tris. Laguna `d-laguna` 7,97 % (≥ 6 %); `a` 0,92 %, `b` 1,57 %, `c` 0,58 % (igual que T2).

## Archivos producidos (rutas absolutas)
- /workspace/derrape-release/docs/release-v1/HYDROGEN_vs_referencias.md
- /workspace/derrape-release/NOCHE_T3_HECHO.md
- /workspace/derrape-release/apps/client/src/render/sky.ts (luna)
- /workspace/derrape-release/docs/screenshots/release1/ y /workspace/derrape-release/docs/release-v1/capturas/ (capturas y metricas.json)

## Qué falta
- La pasada final de las capturas nuevas por Hydrogen (no hay cuota): no se sabe qué opina Hydrogen del cambio.
- Laguna ancha visible desde la salida (C3 en `a`/`b`) y árboles grandes en primer plano (C7): necesitan rediseñar terreno/colocación, no basta un parámetro.
- Prueba en iPhone/Android (sigue pendiente).

## Cómo comprobarlo
- `git log -3`, `npm test`, `npm run lint`, `npm run build`, `npm run medir`.
- Mirar `docs/screenshots/release1/a-salida.png` (luna Hueso).
- Hydrogen, cuando haya cuota: `gemini -m gemini-4-hydrogen -p "Compara @docs/screenshots/release1/a-salida.png con @/workspace/derrape-look-ejemplos/ejemplo1_2026-11-13.png …"`.

## Bloqueos
- Cuota diaria de Hydrogen agotada (429, límite 20/día); se repone ~09:00.
- Mi comparación de plan B es una opinión de una sola vista; no sustituye a Hydrogen ni a Dalí.

## Decisiones para Carlo
- ¿Repetir con Hydrogen mañana (una sola llamada con 3–4 capturas) y aplicar lo que salga?
- ¿Quieres que rehaga el terreno para que se vea la laguna desde la salida (C3), o lo dejamos como está (pasa en `d`)?
