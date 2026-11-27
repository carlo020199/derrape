ESTADO: COMPLETO

# Fase 4 — Rampas gigantes y plataforma flotante (Desván de las Maravillas)

Rama `circuito/nuevo`. Plan: `docs/circuito-nuevo/PLAN.md` §2.5 (que lo numera como fase 6; aquí es la 4.ª fase hecha). Fase anterior: `FASE3_HECHO.md`.

## Qué se ha hecho
- **Rampa XL** (`RAMP.XL` en `tuning.ts`: labio 4 m en 16 m, truco 1,2 s). `RampSize` gana `"XL"`. El muro alto invisible (`tallWall`, 4 m) cubre también las XL, con su propio alcance `tallSpanXL` = 95 m tras el labio (el vuelo con naranja mide ≈ 85 m), para no atajar volando.
- **Plataforma flotante = tramo elevado de la propia pista** (como pide el plan, nada de objeto lateral):
  - `TrackLift` / `liftAt` (`track.ts`) y `TrackDef.lifts` (`tracks/types.ts`): suman una elevación suave (smoothstep) a la altura de los nodos de la pista. La altura del suelo sigue dependiendo solo de la distancia.
  - Desván (`13-desvan-de-las-maravillas.ts`): sube **+3 m en 44 m** (1.436 → 1.480 m, ≈ 7 %), **meseta de 75 m** (1.480–1.555 m) con la fila de cajas de objetos de 1.510 m, baja en 40 m (11 %). A los lados, dos zonas **`fall`** desde ±8,5 m del eje (la calzada mide ±8), igual que el agua bajo el salto L1 de la Laguna.
- **Dos rampas gigantes XL** (datos: helper `giant()`, `landBoost`: turbo de aterrizaje ×1,5 / 0,5 s como el resto de rampas-mueble):
  - **H, 1.420–1.436 m**: sube a la plataforma. Entrando a 26 m/s el vuelo es de 30 m y aterriza al pie de la meseta; con azul (39 m/s) 57 m; con naranja (45,5 m/s) 76 m y aterriza dentro de la meseta, sin pasarse del final.
  - **D, 770–786 m**: termina en un salto largo por la diagonal (33–40 m a 26 m/s, 65 m con azul, 84 m con naranja), aterriza antes del naranja de 900 m y de la horquilla.
- **Reaparecer** (`race.ts`, `respawnKart`): si el último checkpoint cae dentro de una rampa con tamaño (la cuña XL mide 4 m), el kart reaparece justo después del labio (`to + 2`) en vez de subido a la cuña. Caer de la meseta reaparece en la meseta (altura 3,0 m, parado, en la calzada) porque el checkpoint está ahí.
- **Visual** (`render/furniture.ts`, `trackMesh.ts`): las cuñas XL salen solas del mismo código que las rampas-mueble (cuña de tablones/somier + muebles al borde). Nuevo `plataforma()`: tablero de madera (borde claro de 0,35 m, costados, panza y cajones de cómoda con tirador metálico cada 10 m) bajo la calzada elevada, en la **misma malla fusionada** (sigue siendo 1 llamada). `createTrackMesh` no dibuja el arcén bajo la plataforma (`skip` en `roadStrip`): fuera de la calzada es el vacío.
- **Herramientas**: `npm run gigantes` (`scripts/gigantes.ts`) simula entradas a 14/20/26/39/45,5 m/s con la física real, con y sin truco, y da despegue, aterrizaje, vuelo, pico, altura y lateral del aterrizaje, si cae y si cobra el turbo. Sustituye a las `herramientas/` de Hydrogen del plan (no dependo de ese port).
- **No se ha tocado**: cámara de persecución, control del dedo, cohete, red/servidor, `stepKart`. Cambio de física pequeño y dicho aquí: `RAMP.XL`, `tallWallAt`, `respawnKart`, `liftAt`.
- Docs: casillas de `docs/PLAN.md` (fases 3 y 4) y fila 13 de `docs/CONTENIDO.md`.

## Resultados de tests / lint / build / smoke / medir
- `npm test`: **26 archivos, 274 tests en verde** (antes 253). Nuevos: `packages/shared/src/gigantes.test.ts` (20): datos de la plataforma (+3 m, pendientes, zonas `fall`), cajas sobre la meseta, 2 XL con muro alto, **vuelo y aterrizaje en la plataforma entrando a 14/20/26/39/45,5 m/s** (despega en el labio, aterriza sobre la pista elevada, sin caer, con turbo ×1,5), naranja no se pasa del final, subir la cuesta sin saltar, **caída por el borde (andando y en el aire), reaparición en la meseta y tras una cuña XL**, checkpoints, **separación entre tramos ≥ 38 m** y vuelos XL a > 30 m de otro tramo y < 12 m de altura, XL de la diagonal larga y **bot: vuelta completa sin reaparecer en 55–85 s pasando por las dos XL**. Más 1 en `furniture.test.ts` y la edición de `rampasMueble.test.ts` (ahora filtra las XL). Las pruebas de suavidad (`trackSmoothness`) siguen pasando: la 1.ª versión (34 m de subida) las rompía (cambio de pendiente 0,0178 > 0,015) y por eso la subida es de 44 m.
- `npm run lint`: limpio. `npm run build`: limpio.
- **Smoke Playwright 390×844** (`npx tsx scripts/smoke-circuito.ts http://localhost:5173`, con `npm run dev` levantado y cerrado después; Chrome del sistema, WebGL por software): **0 errores de consola**. Práctica en solitario con el dedo recto: 116 muestras, 140 km/h máx. Cadena de 3 S: 3 saltos con ×1,5. Raíl: 78,0 m/s. **Nuevo**: el piloto automático sube a la plataforma (despega en 1.436,2 m, aterriza en 1.465,9 m a 2,18 m de altura, sin caer) y salta la XL de la diagonal (despega en 787,4 m, aterriza en 819,4 m: 32 m); **caída**: con el último checkpoint en 1.486 m, un kart a 9 m del eje cae y reaparece 1 vez en la calzada (`surface: road`), a 3,0 m de altura, en 1.491 m. El smoke sale con código 1 si falla cualquiera de estas comprobaciones. Datos en `smoke.json`.
- `npm run medir` (8 karts, 390×844): **Desván 41 llamadas, 38 906 triángulos** (fase 3: 40 y 35 030; +1 llamada y +3 900 triángulos: las dos cuñas XL y el tablero; la malla `rampas-mueble` pasa de ≈ 1.950 a 4.312 triángulos). Límite: ≤ 90 y ≤ 110 000. Otros circuitos idénticos antes y después de los cambios de render (Laguna 57 / 93 879, Ribera 55 / 89 497, Viñedos 36 / 100 152). Con la plataforma a la vista en el smoke (software, con karts y HUD): 33–46 llamadas, 47–50 mil triángulos.
- Fps reales en iPhone: **pendiente de prueba en dispositivo**.

## Capturas (390×844 @2x, salvo las de vuelo: @1x)
En `/workspace/derrape-circuito-capturas/fase4/`:
- `/workspace/derrape-circuito-capturas/fase4/21-xl-plataforma-antes.png` (la cuña XL de la plataforma, desde 24 m antes)
- `/workspace/derrape-circuito-capturas/fase4/22-plataforma-meseta.png` (en la meseta con la fila de cajas)
- `/workspace/derrape-circuito-capturas/fase4/23-plataforma-borde.png` (el borde del tablero y el vacío)
- `/workspace/derrape-circuito-capturas/fase4/24-xl-salto-antes.png`, `/workspace/derrape-circuito-capturas/fase4/25-xl-salto-lado.png` (la XL de la diagonal)
- `/workspace/derrape-circuito-capturas/fase4/26-plataforma-lateral.png`, `/workspace/derrape-circuito-capturas/fase4/27-xl-cuna-lateral.png` (vistas libres sin niebla)
- `/workspace/derrape-circuito-capturas/fase4/28-plataforma-en-vuelo.png`, `/workspace/derrape-circuito-capturas/fase4/29-plataforma-aterrizado.png` (el bot en el cliente real)
- `/workspace/derrape-circuito-capturas/fase4/28-diagonal-en-vuelo.png`, `/workspace/derrape-circuito-capturas/fase4/29-diagonal-aterrizado.png`
- `/workspace/derrape-circuito-capturas/fase4/30-caida-reaparece.png` (tras caer del borde, reaparece en la meseta)
- Anteriores regeneradas: `01`–`20` (turbos, rampas, cadena en vuelo, raíl, vista general, solitario) y `smoke.json`.

## Decisiones tomadas
- **Lip 4 m (no 5)**: con 5 m el vuelo pasaba de 100 m con naranja y de 11 m de altura. Con 4 m: ≤ 8 m de pico y la meseta contiene el vuelo con naranja. El aterrizaje de una XL casi nunca es «limpio» (< 15°) pero sí cobra el turbo (< 22°, `LANDING.maxPitch`).
- **Subida más larga (44 m) y meseta de 75 m** respecto al plan (34 y 80): era la forma de pasar `trackSmoothness`. La XL pasó de 1.425 a 1.420 m (labio en 1.436, donde empieza la subida).
- **A 26 m/s no se aterriza en la meseta sino al pie** (en la subida, a 2,2 m): sigue siendo un aterrizaje con turbo sobre la pista elevada; con azul o naranja se llega a la meseta. El plan decía «con ella aterrizas en la meseta»: es cierto solo con turbo. No hay riesgo de pasarse en ningún caso probado.
- **Sin hueco en la pista bajo la XL de la diagonal** (no es un foso): el plan la define como «rampa que acaba en salto» y un foso expondría a atascos tras reaparecer desde parado. El muro alto impide atajar.
- **Sin terreno bajo la plataforma**: el Desván no usa el terreno de Ánimas (solo el plano oscuro de suelo), así que no hizo falta tocar `terrainHeightField`. Si en una fase de arte se le añade terreno habrá que restar `liftAt` a la altura de la calzada ahí.
- La cámara no se ha tocado: usa `surfaceY` bajo el kart (y bajo la cámara) y ya sigue las alturas; se ve bien en el vuelo y al reaparecer. `bigJump` (el empujón de cámara del salto L) sigue solo para L, a propósito.
- Tres parámetros nuevos de depuración solo con `?foto` (`__escena.progress`, `__escena.respawns`, `reaparece=<m>`) para que el smoke pruebe caídas sin dar media vuelta.

## Qué falta
- Probar con dedo real en iPhone: la plataforma (¿resulta justa la caída a ±8,5 m del eje?), el aterrizaje y los fps. Los fps con la cámara de la meseta no están medidos en dispositivo.
- Arte final: el tablero es muy oscuro contra el suelo negro y apenas se nota que flota (solo 3 m de altura y sin sombra ni luz bajo él); una fase de arte puede añadir resplandor o patas colgantes, y un foso visible bajo la XL de la diagonal si se quisiera. Muebles de adorno de las XL = los mismos de las rampas S/M.
- Los bots no «eligen» entrar a la plataforma con turbo ni evitan los bordes: el piloto automático se centra (lane 0) y no se cae en ninguna prueba.
- Zonas rosa/morada decorativas (asfalto pintado entre tramos), cohete v2, sfx de despegue/aterrizaje: fases siguientes.

## Cómo probarlo
1. `npm run dev` y abre `http://localhost:5173/?track=desvan-de-las-maravillas`. La plataforma está en la recta inferior (1.420–1.595 m desde meta, tras la curva grande): ve recto por el centro y salta la XL (o con el turbo naranja de 1.400 m, vuelo largo hasta la meseta); coge las cajas de encima; sal por un lado para caer y reaparecer.
2. Vista directa: `?track=desvan-de-las-maravillas&foto=1396,0,0&correr=bot` (el piloto automático sube a la plataforma); `&foto=746,0,0&correr=bot` para la XL de la diagonal; `&foto=1500,9,0&correr&reaparece=1486` para la caída.
3. Simulador: `npm run gigantes`. Tests: `npx vitest run packages/shared/src/gigantes.test.ts apps/client/src/render/furniture.test.ts`. Todo: `npm test`, `npm run lint`, `npm run build`, `npm run medir`.
4. Smoke: con `npm run dev` en marcha, `npx tsx scripts/smoke-circuito.ts http://localhost:5173` (capturas en `/workspace/derrape-circuito-capturas/fase4/`).
