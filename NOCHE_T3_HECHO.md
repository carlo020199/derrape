ESTADO: COMPLETO

> Cierre a las ~03:40 del 27/11: tras la última vuelta no queda ninguna mejora visual razonable dentro de las restricciones (lo pendiente necesita decisión de Carlo o rediseño, ver abajo). Continuación del T3 (orden de Carlo del 27/11: seguir mientras quede límite). La versión anterior (Hydrogen sin cuota, 26/11) sigue en el historial de git.

## Qué se ha hecho
Una entrada por vuelta (cada una: tests, lint, build, `npm run medir`, capturas de Lía+Hueso y Calavera Chispas+Medianoche, commit y push a `release/v1`).

- **Vuelta 1 · farolillos (C5).** Tapas de Sombra en vez de Hueso (ya no parecen platos blancos duros) y halo aditivo más ancho (×1,4) con caída suave (cúbica + cola). Sin llamadas nuevas. `medir` Laguna 54 llamadas · 89 762 tris (igual).
- **Vuelta 2 · bruma y horizonte (C4).** Nuevo anillo `bruma` (`createHaze` en `sky.ts`, 1 llamada): Niebla con alfa por vértice, más densa justo sobre el horizonte, vela colinas y base de nubes; solo por encima del horizonte, así la laguna lejana no se apaga (C3 `a` 0,89 % / `b` 1,56 %, igual que antes). `medir` Laguna 55 llamadas · 90 146 tris. Probado y descartado: con `depthTest: false` la bruma tapaba también el agua lejana. Las nubes siguen opacas con borde claro (hacerlas traslúcidas con discos solapados daría doble mezcla).
- **Vuelta 3 · neumáticos y fuego del escape (C5/C8).** Cada rueda de Hueso/Medianoche lleva un aro de flanco morado medio `#4A3F66` (torus 3×12, 72 triángulos) y el neumático pasa de 8 a 6 segmentos radiales para compensar (+64 triángulos por coche; el test de ≤ 10 000 piloto+coche sigue en verde). El chorro del escape pasa de 6→9 sprites en reposo y de 8→12 con turbo, para que se lea como una llama continua y no como 3 puntos (visto de lado). Test de `flames` actualizado (13 y 12 sprites). Herramienta de captura: `&turbo=1` con `?foto=` (y `EXTRA="&turbo=1"` en `npm run capturas`) para ver el fuego con turbo.

- **Vuelta 4 · HUD menos recargado (C9).** Fuera el «/4» junto al puesto, velocímetro de 34 → 46 px y engranaje de ajustes más pequeño y translúcido (sigue tocable). Solo CSS, sin coste de render.

- **Vuelta 5 · nubes (C4).** Cada nube suma una panza de tono medio (mitad entre el borde claro y Sombra) entre el borde superior claro y la base: tres bandas de toon en lugar de un escalón duro; el borde superior sigue siendo el más claro. +1 disco por puff (nubes ~3 500 → ~5 200 triángulos, la misma llamada).

- **Probado y revertido · camposanto (lápidas y calabazas).** 22 grupos instanciados (+5 000 triángulos, +1 llamada): desde la salida y la recta no se ve ni uno (los tapan la cresta y la calzada elevada) y solo aparecen como puntos lejanos en la curva. No compensa el coste; no se commitea.

- **Vuelta 6 · campanario legible desde la salida (C4).** Escala 1,6 → 2,1: en `a-salida` ya no asoma solo la punta del tejado sino el cuerpo con la campana de Llama. Laguna `a` 0,88 % / `b` 1,50 % (casi igual). Mismo coste (mismas mallas). Probado y revertido antes: camposanto (lápidas+calabazas), ver arriba.

- **Vuelta 7 · árboles grandes en el borde derecho de la salida (C7).** 3 árboles (uno por modelo) a escala 3,2 en el lateral derecho de la recta de salida (d = 22, 46, 74 m); sus copas asoman sobre la calzada elevada y enmarcan la esquina superior derecha como en ejemplo1. Solo el lado derecho: así no tapan el campanario, la luna ni los farolillos de la izquierda (lo que falló el 25/11). Las mismas 3 llamadas de árboles; +~800 triángulos. Laguna `a` 0,87 % / `b` 1,47 %.

- **Vuelta 8 · pantalla de inicio (UI).** El fondo liso de `#home` pasa a noche de la Laguna: luna Hueso con halo Ánima, estrellas y colinas Sombra/Ciruela, todo con gradientes CSS (sin imágenes ni coste de render). Captura en `docs/release-v1/capturas/menu-inicio.png`.

- **Vuelta 9 · color del fuego del escape (C5).** En reposo el borde de la llama era Ascua (#D9362B); sumado al fondo morado salía rosa/magenta (se veía sobre todo en Medianoche). Ahora Llama→Brasa→Brasa, todo naranja. Turbo (Espectro/Ánima) sin cambios.

- **Vuelta 10 · luciérnagas (opcional de Dalí).** 200 puntos aditivos Espectro con núcleo claro que suben y bajan y parpadean sobre el óvalo y el cauce (`createFireflies`): +1 llamada, 0 triángulos. Se aprecian sobre todo sobre la ladera morada junto a la laguna; sobre el agua brillante contrastan poco.

- **Vuelta 11 · árbol grande a la izquierda (C7).** Uno solo (d = 30, a 14 m del arcén, escala 3,4): su copa llena la esquina izquierda de `a-salida` y deja libres el campanario, la luna y los farolillos. Probado y descartado en la misma vuelta: ensanchar el río lejano (`halfs`), que no cambia la laguna en `a`/`b` (0,90 → 0,93 %) porque la tapa la cresta.

## Archivos producidos (rutas absolutas)
- /workspace/derrape-release/apps/client/src/render/animasProps.ts (farolillos, árboles grandes de la salida)
- /workspace/derrape-release/apps/client/src/render/sky.ts (bruma `createHaze`, nubes de tres bandas) y animas.ts (bruma, campanario ×2,1)
- /workspace/derrape-release/apps/client/src/render/kartSkins.ts (aro de flanco de las ruedas) y flames.ts (+ flames.test.ts)
- /workspace/derrape-release/apps/client/src/game/raceSession.ts (`&turbo=1` con `?foto=`) y scripts/capturas-release.ts (`EXTRA`)
- /workspace/derrape-release/apps/client/src/style.css (HUD, fondo del inicio)
- /workspace/derrape-release/medidas.json (`release1.pulidoT3`) y docs/release-v1/PENDIENTE.md
- /workspace/derrape-release/docs/release-v1/capturas/ y /workspace/derrape-release/docs/screenshots/release1/ (regeneradas; incluye menu-inicio.png)

## Qué falta
- Prueba de fps en iPhone/Android: **pendiente de prueba en dispositivo** (solo hay métricas proxy).
- Laguna ancha visible desde la salida (C3 en `a`/`b`: 0,9 % / 1,5 %): requiere rediseñar el terreno o la calzada elevada; con la restricción «sin subir el terreno» no hay arreglo barato (en `d` pasa: 8,0 % / 7,3 %).
- Árboles grandes en el lado izquierdo de la salida: taparían campanario y farolillos (falló el 25/11); solo se hizo el derecho.
- Cortes del contorno en la coleta de Lía vistos de cerca (menor).
- Nubes opacas (no traslúcidas): con discos solapados la mezcla alfa se vería doble.

## Cómo comprobarlo
- `git log --oneline -12` (una vuelta por commit), `npm test` (191), `npm run lint`, `npm run build`, `npm run medir` (Laguna 55 llamadas · 92 688 tris).
- Ver `docs/release-v1/capturas/a-salida.png` (campanario, árbol derecho, farolillos, bruma), `b-recta-campanario.png`, `d-laguna.png` (nubes), `menu-inicio.png`, y las del piloto 2 en `capturas/calavera-chispas/`.
- Fuego con turbo: `EXTRA="&turbo=1" FOTOS="x:14,0,0:k,3.5,0.9,110" npm run capturas -- http://localhost:5173 /tmp/x lia`.

## Bloqueos
- Ninguno. `git push origin release/v1` funciona; nada a main.

## Decisiones para Carlo
- ¿Rediseñar el terreno/calzada para que la laguna se vea ancha desde la salida (C3 en `a`/`b`)? Ahora solo pasa en `d`.
- ¿Te gustan los 3 árboles grandes del borde derecho de la salida? Si no, quitar el bloque «Tres árboles grandes» de `createTrees` en `animasProps.ts`.
- Margen de presupuesto: las capturas de la Laguna llegan a 64 llamadas y 106 700 triángulos (4 karts); `medir` con 8 karts da 55 y 92 688. El límite del release es 110 000: queda poco para añadir más escenario.
