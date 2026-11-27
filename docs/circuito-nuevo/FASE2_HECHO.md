ESTADO: COMPLETO

# Fase 2 — Desván de las Maravillas: rampas-mueble

Rama `circuito/nuevo`. Plan: `docs/circuito-nuevo/PLAN.md` §2.4 y §2.8. Fase anterior: `FASE1_HECHO.md`.

## Qué se ha hecho
- **Turbo de aterrizaje** (`LANDING` en `tuning.ts`: ×1,5, 0,5 s). `ZoneDef`/`TrackZone` ganan `landBoost`; `KartState.flightLandBoost` recuerda si el vuelo salió de una rampa-mueble; `landKart` (`track.ts`) llama a `giveBoost` → regla «gana el mayor, no se apila». El truco en el aire alarga ese turbo a ×1,5 (en rampas normales sigue siendo ×1,3). Las rampas de la Laguna/Ribera no cambian (sin `landBoost`).
- **Aterrizaje «suficientemente limpio»**: el turbo se cobra con cabeceo < `LANDING.maxPitch` = 22° (el aterrizaje «limpio» general sigue en 15°). Motivo: tras un turbo de aterrizaje el kart sale más rápido, el salto es más alto y la 3.ª rampa de una cadena aterrizaba a ~16°, sin premio.
- **Las rampas-mueble solo actúan en la calzada** (`lateralMin/Max` = ±8): `rampAt` y el labio ahora respetan la franja lateral (en el resto de circuitos las zonas cubren todo el ancho, así que no cambia nada). Se puede esquivar por el arcén.
- **6 rampas en el Desván** (`13-desvan-de-las-maravillas.ts`, helper `ramp()`): cadena de **3 S** en la recta de meta (despegues en 120/150/196 m), **S** sola a la salida de las eses (719 m), cadena de **2 M** (1.098/1.138 m). Huecos calculados con la física real (`scripts/cadenas.ts`): 1.º vuelo 17 m (S) → aterriza 10 m antes del siguiente; 2.º 32 m; la cadena de 2 M 23 m + 39 m.
- **Turbos movidos** para que no deshagan las cadenas (un turbo a la entrada convierte el vuelo en 46–61 m y se salta la rampa siguiente): azul estrecho de la horquilla 1.010→988 m y naranja ancho 1.072→1.188 m (sigue habiendo 13 azules y 6 naranjas).
- **Visual** (`render/furniture.ts`): UNA malla fusionada con color por vértice = **1 llamada**, ~1.950 triángulos. Cada rampa es una cuña exacta a la física (sube `lip` a lo largo del tramo, sigue peralte y cuesta) de **tablones** (franjas madera clara/madera) o **somier metálico** (gris violáceo y óxido), y a cada lado fuera de la calzada hay muebles viejos: cómoda (y cómoda apilada), mesa, sillón verde, cabecero de cama oxidado, baúl, tablones. Sin Brasa/Llama/Espectro: no se confunden con los turbos. `animas.ts` ya no dibuja el lomo de hueso en las rampas con `landBoost`.
- `scripts/cadenas.ts` (simulador de vuelos) y `scripts/smoke-circuito.ts` ampliado (6 capturas fijas + cadena recorrida en vuelo; salida por defecto `fase2/`). En `raceSession.ts`, solo con `?foto`: `__escena.kart` (estado vivo) y `?correr` (sin cuenta atrás); no afectan a la partida normal.
- Docs: casilla en `docs/PLAN.md` y fila 13 de `docs/CONTENIDO.md`.

## Resultados de tests/lint/build/smoke/medir
- `npm test`: **24 archivos, 231 tests en verde** (nuevos: `rampasMueble.test.ts` 14, `furniture.test.ts` 3). Cubren: aterrizar da ×1,5 durante 0,5 s; sin `landBoost` no hay turbo; no se apila (naranja ×1,75 se mantiene; mini-turbo ×1,3 no suma; **aterrizar dentro de un azul de suelo** sigue ×1,5 con la duración del azul, no la suma; dentro de un naranja conserva ×1,75); el kart acelera hacia ×1,5; cadena de 3 S (3 saltos, cada aterrizaje antes del labio siguiente y antes de la curva B), cadena de 2 M (aterriza antes de la curva G), con naranja se salta una rampa pero se encadena la siguiente; por el arcén no se salta; ningún vuelo pasa a < 30 m de otro tramo (`closestPoint` global); colores de muebles lejos de los de turbo; bot completa la vuelta.
- Bot del Desván: **57,7 s** por vuelta con turbos y rampas, 59,7 s sin rampas, 73,0 s sin nada; **0 reapariciones**; ≥ 5 aterrizajes con turbo por vuelta.
- `npm run lint`: limpio. `npm run build`: OK.
- Smoke Playwright 390×844 (Chrome del sistema, WebGL por software, cliente + servidor locales, práctica en solitario): **0 errores de consola**; HUD hasta 140 km/h (azul de salida). Cliente y servidor cerrados al terminar.
- **Cadena recorrida de verdad en el cliente** (`?foto=96,0,0&correr`, un dedo apoyado, estado del kart leído de `__escena.kart`): el smoke registró **2 saltos** con aterrizaje a **×1,5 durante 0,48 y 0,50 s**, con captura en vuelo (`15-cadena-en-vuelo-1/2.png`). El tercer salto no se registró en esa pasada: el muestreo cada ~40 ms con WebGL por software se salta vuelos cortos (en una prueba previa el kart sí saltó y aterrizó las tres veces a 39 m/s). La cadena de 3 completa queda cubierta por el test de `shared`.
- **Herramienta del plan `herramientas/cadenas.mts`**: se ejecutó tal cual (solo lectura, importa la física del port de Hydrogen) y sus números coinciden con el repo: S sola 17 m; S×3 con huecos 26/42 → vuelos 17 → 32 → 32 m; M sola 24 m. Como el repo no debe depender de Hydrogen, la versión propia es `scripts/cadenas.ts` (física de este repo, con el circuito real y el turbo de aterrizaje real, no emulado): 17 → 32 → 34 m en la cadena de 3 S y 23 → 39 m en la de 2 M.
- `npm run medir` (8 karts, cámara vertical): Desván **40 llamadas, 34.990 triángulos** (fase 1: 39 y 33.040; +1 llamada y +1.950 triángulos por los muebles). Límite del release: ≤ 90 y ≤ 110.000. Otros circuitos sin cambio (no se ha tocado su código ni sus datos). Fps reales en iPhone: **pendiente de prueba en dispositivo**.

## Capturas (390×844 @2x salvo `08-*`, @1x)
En `/workspace/derrape-circuito-capturas/fase2/`:
- `/workspace/derrape-circuito-capturas/fase2/09-cadena-3S-antes.png`, `10-cadena-3S-entre.png`
- `/workspace/derrape-circuito-capturas/fase2/11-rampa-S-eses.png`
- `/workspace/derrape-circuito-capturas/fase2/12-cadena-2M-antes.png`, `13-cadena-2M-entre.png`
- `/workspace/derrape-circuito-capturas/fase2/14-rampa-lado.png` (cuña vista de lado con sillón y mesa)
- `/workspace/derrape-circuito-capturas/fase2/15-cadena-en-vuelo-1.png`, `15-cadena-en-vuelo-2.png` (conduciendo la cadena de 3 S en el cliente)
- Las de la fase 1 regeneradas: `01-salida.png` … `07-vista-general.png`, `08-solitario-1..3.png`, y `smoke.json`.

## Decisiones tomadas
- **Colores**: marrones = Hueso sombra `#C8B597` y Marfil `#8C7B66` (paleta) + madera oscura `#5A4636`; gris `#6A6479`; óxido `#A8421F` y verdín `#2F6F62` son **propuestas de utilería** (PLAN §2.8 opción B) a validar por Dalí; el naranja rojizo es Ascua `#D9362B`. Están en `FURNITURE` (`furniture.ts`).
- **Los turbos de suelo que preceden a una cadena la deshacen** (a 39–45 m/s el vuelo es 46–61 m). Por eso se movieron dos turbos (arriba). Un naranja de franja al principio de la recta de meta (70–78 m) hace saltarse la 2.ª rampa: se deja como riesgo/premio (sigue habiendo ≥ 2 saltos).
- **Cambio de física pequeño, dicho aquí**: `landKart`/`beginFlight`/`rampAt` en `track.ts`, `flightLandBoost` en `kart.ts`/`race.ts`. No toca `stepKart`.
- La rampa XL y la plataforma (rampas gigantes) quedan para su fase; las S/M de esta fase no necesitan muro alto.
- Rampa sobre el turbo de Hydrogen: al rebasar sobre el port, `landKart` usa `KART.boostSpeedMult` en la rama de truco de rampas normales (el typecheck lo cazará, ver FASE1).

## Qué falta
- Fps en iPhone/Android sin medir. Aprobación de Dalí de óxido y verdín y del modelado de muebles (aquí son cajas y cilindros low-poly generados en código).
- Los bots no eligen carril de turbo ni «saben» de cadenas más allá de centrarse antes de cada rampa (funciona: 0 reapariciones).
- Sin sonido propio de despegue/aterrizaje ni polvo en el aterrizaje (PLAN §2.9).
- El smoke con dedo recto no pilla siempre los tres saltos de la cadena (ver arriba); la cadena de 3 la garantizan los tests de `shared`.
- Siguientes fases: cohete v2, raíl triturbo ×3, rampas gigantes + plataforma, zonas rosa/morada decorativas, tema/arte completo.

## Cómo probarlo
1. `npm run dev`, abrir `http://localhost:5173/?track=desvan-de-las-maravillas` (o `npm run dev:host` desde el móvil).
2. Recta de meta: a fondo recto por el centro → 3 saltos seguidos; el HUD sube tras cada aterrizaje (×1,5 0,5 s). Por el arcén no se salta.
3. Simulador de vuelos: `npx tsx scripts/cadenas.ts`. Tests: `npx vitest run packages/shared/src/rampasMueble.test.ts apps/client/src/render/furniture.test.ts`.
4. Smoke: con cliente y servidor en marcha, `npx tsx scripts/smoke-circuito.ts http://localhost:5173`.
