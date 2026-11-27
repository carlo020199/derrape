ESTADO: COMPLETO

## Qué se ha hecho
- Una sola llamada a `gemini-4-hydrogen` (esta vez sin 429). Usó la copia de `ejemplo1` del repo (no lee fuera del workspace). Respuesta íntegra (8 diferencias) en `docs/release-v1/HYDROGEN_vs_referencias.md`.
- Arreglo 1 (commit propio): HUD — casilla de objeto vacía con borde brasa vivo y círculos de turbo con contorno Hueso (dif. 8). Sin coste de render.
- Sin repetir los árboles grandes ni la laguna alta (revertidos el 25/11). Cámara más alta descartada (jugabilidad/C3). Resto anotado como pendiente.
- Capturas 390×844 regeneradas (Calavera+Medianoche y Lía).
- Verificación: `npm test` 191/191, bot «piloto automático» OK, lint 0, build 0. `npm run medir` Laguna 54 llamadas · 89 762 tris (≤ 90 / ≤ 110 000). `renderer.info` en capturas: 49–62 llamadas, 98–103 k tris.

## Archivos producidos (rutas absolutas)
- /workspace/derrape-release/docs/release-v1/HYDROGEN_vs_referencias.md
- /workspace/derrape-release/apps/client/src/style.css
- /workspace/derrape-release/docs/release-v1/capturas/ y /workspace/derrape-release/docs/screenshots/release1/

## Qué falta
- Árboles/vallas en primer plano, relieve de la orilla, cámara más alta, agua con espuma: requieren rediseño.
- Prueba de fps en iPhone/Android: pendiente de prueba en dispositivo.

## Cómo comprobarlo
- `git log -4`, `npm test`, `npm run lint`, `npm run build`, `npm run medir`; ver `docs/release-v1/capturas/a-salida.png`.

## Bloqueos
- Hydrogen no lee rutas fuera del workspace (se usó la copia del repo).

## Decisiones para Carlo
- ¿Rediseñar colocación de árboles/vallas y orilla de la laguna (dif. 2 y 3)?
- ¿Probar una cámara algo más alta solo en vertical?
