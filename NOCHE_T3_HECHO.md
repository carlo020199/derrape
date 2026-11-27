ESTADO: PARCIAL

> Continuación del T3 (orden de Carlo del 27/11: seguir mientras quede límite). La versión anterior (Hydrogen sin cuota, 26/11) sigue en el historial de git.

## Qué se ha hecho
Una entrada por vuelta (cada una: tests, lint, build, `npm run medir`, capturas de Lía+Hueso y Calavera Chispas+Medianoche, commit y push a `release/v1`).

- **Vuelta 1 · farolillos (C5).** Tapas de Sombra en vez de Hueso (ya no parecen platos blancos duros) y halo aditivo más ancho (×1,4) con caída suave (cúbica + cola). Sin llamadas nuevas. `medir` Laguna 54 llamadas · 89 762 tris (igual).
- **Vuelta 2 · bruma y horizonte (C4).** Nuevo anillo `bruma` (`createHaze` en `sky.ts`, 1 llamada): Niebla con alfa por vértice, más densa justo sobre el horizonte, vela colinas y base de nubes; solo por encima del horizonte, así la laguna lejana no se apaga (C3 `a` 0,89 % / `b` 1,56 %, igual que antes). `medir` Laguna 55 llamadas · 90 146 tris. Probado y descartado: con `depthTest: false` la bruma tapaba también el agua lejana. Las nubes siguen opacas con borde claro (hacerlas traslúcidas con discos solapados daría doble mezcla).

## Archivos producidos (rutas absolutas)
- /workspace/derrape-release/apps/client/src/render/animasProps.ts
- /workspace/derrape-release/docs/release-v1/capturas/ y /workspace/derrape-release/docs/screenshots/release1/ (regeneradas en cada vuelta)

## Qué falta
- Prueba de fps en iPhone/Android: pendiente de prueba en dispositivo.

## Cómo comprobarlo
- `git log`, `npm test`, `npm run lint`, `npm run build`, `npm run medir`; mirar `docs/release-v1/capturas/a-salida.png`.

## Bloqueos
- Ninguno por ahora.

## Decisiones para Carlo
- Ninguna nueva por ahora.
