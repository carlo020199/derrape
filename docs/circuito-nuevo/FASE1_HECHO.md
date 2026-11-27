ESTADO: COMPLETO

# Fase 1 — Desván de las Maravillas: trazado + turbos de suelo

Rama `circuito/nuevo` (desde `main` 87d28fd). Plan completo copiado en `docs/circuito-nuevo/PLAN.md` (+ `LAYOUT_preview.png`).

## Qué se ha hecho
- **Circuito 13 «Desván de las Maravillas»** (`packages/shared/src/tracks/13-desvan-de-las-maravillas.ts`, id `desvan-de-las-maravillas`, extra fuera de copa). Los 29 puntos de control de PLAN §1.2 (escala 0,8, X invertida como en la Ribera), `width 16`, `verge 6`, `laps 3`, peralte y relieve del plan, 6 filas de cajas (m 45, 290, 940, 1.300, 1.510, 1.700). Registrado en `tracks/index.ts`: sale en el selector y se abre con `?track=desvan-de-las-maravillas`. Longitud: 1.884 m. Tema `animas` (provisional).
- **Turbos de suelo** como datos de zona: 4 tipos nuevos de `ZoneType` (`boostBlue`, `boostBlueNarrow`, `boostOrange`, `boostOrangeNarrow`) y tabla `PADS` en `tuning.ts` (azul ×1,5: 1,5 s ancho / 2 s franja; naranja ×1,75: 2,5 s / 3 s). Lógica mínima en `kart.ts` (una línea: `giveBoost` con la tabla). Regla «gana el mayor, no se apilan» = la que ya tenía `giveBoost` (multiplicador mayor, duración mayor). 13 azules y 6 naranjas colocados según PLAN §2.3. El panel antiguo `boostPad` no se toca.
- **Servidor:** no hace falta cambio. Cada cliente simula su kart y el servidor no lee superficies ni turbos; la punta máxima (45,5 m/s) queda bajo `MAX_PLAUSIBLE_SPEED` (52 m/s).
- **Visual** (`apps/client/src/render/groundBoost.ts`): una malla fusionada con atlas de dos fichas = **1 llamada de dibujo** para todos los turbos (174 triángulos). Azul = Espectro, naranja = Brasa, dos chevrones Texto hacia delante, borde Sombra. Se pinta desde `decorateAnimas` y desde `withDress` (cualquier otro tema).
- Test genérico de ritmo (`track.test.ts`, 50–75 s a 85 % de la punta) limitado a los circuitos 2–12: el 13 es más largo a propósito y tiene su propio test.
- Docs: `docs/CONTENIDO.md` (fila 13) y casilla en `docs/PLAN.md`.
- `scripts/smoke-circuito.ts`: capturas fijas + práctica en solitario con dedo simulado (CDP) y vigilancia de errores de consola.

## Resultados de tests/lint/build/smoke
- `npm test`: **22 archivos, 214 tests en verde** (nuevos: `desvan.test.ts` 16, `groundBoost.test.ts` 5).
- `npm run lint`: limpio. `npm run build` (typecheck + cliente + servidor): OK.
- Tests del circuito: separación mínima entre tramos no contiguos ≥ 38 m (medida en el plan: 47 m); suavidad (pendiente, peralte, ritmo, aceleración de peralte, salto de normal) dentro de límites; bot **73,0 s** por vuelta sin turbos (rango 65–80), **59,9 s** con turbos (el bot pasa por los anchos del centro; vmax 45,5 m/s), 0 reapariciones; 19 zonas, sin solapes; tipo ancho/franja coherente con su anchura; reglas de turbo (multiplicadores, duraciones, no apilar, punta 39 / 45,5 m/s, trompo cancela).
- Smoke Playwright 390×844 (Chrome del sistema, WebGL por software, cliente + servidor local): **0 errores de consola**; práctica en solitario real: el HUD marcó **140 km/h** (= 26·1,5·3,6) al pisar el azul ancho de la salida, frente a 94 km/h de punta normal. (El primer intento dio `ERR_CONNECTION_REFUSED` solo porque el servidor Colyseus no estaba levantado; se arrancó y desapareció.)
- `npm run medir` (8 karts, cámara vertical): Desván **39 llamadas, 33.040 triángulos** (límite del release: ≤ 90 y ≤ 110.000; Laguna 53 y 86.082). Fps reales en iPhone: **pendiente de prueba en dispositivo** (solo Carlo).

## Capturas (390×844 @2x salvo las `08-*`, que son @1x)
Carpeta `/workspace/derrape-circuito-capturas/fase1/`:
- `/workspace/derrape-circuito-capturas/fase1/01-salida.png`
- `/workspace/derrape-circuito-capturas/fase1/02-turbo-azul-ancho.png`
- `/workspace/derrape-circuito-capturas/fase1/03-turbo-azul-franja.png`
- `/workspace/derrape-circuito-capturas/fase1/04-turbo-naranja-ancho.png`
- `/workspace/derrape-circuito-capturas/fase1/05-turbo-naranja-franja.png`
- `/workspace/derrape-circuito-capturas/fase1/06-eses.png`
- `/workspace/derrape-circuito-capturas/fase1/07-vista-general.png` (cámara cenital sin niebla)
- `/workspace/derrape-circuito-capturas/fase1/08-solitario-1.png` … `08-solitario-4.png` (conduciendo; la 1 es a 140 km/h)
- `/workspace/derrape-circuito-capturas/fase1/smoke.json` (errores, velocidades, `renderer.info`)

## Decisiones tomadas
- **Nombre:** «Desván de las Maravillas» (fantasía + muebles viejos, el desván como sitio de los muebles — pregunta 4 del plan, por confirmar con Carlo).
- **Tipos de zona:** 4 tipos (color × ancho/franja) en vez de una propiedad de zona, porque `Surface` es solo el tipo de zona y así no hay que tocar `surfaceAt`. Un test comprueba que el nombre cuadra con la anchura.
- **Color:** azul = Espectro `#3FF2C8` (turbo 1 de las chispas); naranja = **Brasa `#FF6A1F`**, no Llama `#FFB423`, porque Llama se lee amarillo y se quería un naranja claro frente al azul. Las llamas/chispas siguen con sus colores: unificarlos queda para la fase de pulido/Dalí.
- **«Gana el mayor»**: se mantiene el `giveBoost` actual, que aplica el mayor multiplicador durante la mayor duración. Consecuencia conocida: naranja con poco tiempo restante + pisar un azul mantiene ×1,75 hasta 1,5–2 s. Es lo que pidió Carlo («la duración se alarga como ya hace el motor»).
- **Vuelta ≈74 s** = vuelta de bot **sin** turbos. Con turbos baja a ≈60 s (bot); un humano estará entre ambas.
- Cajas: las 6 filas del plan (la de 1.510 m queda sobre asfalto normal hasta que exista la plataforma).
- Tema `animas` tal cual (campanario, laguna, etc. aparecen en el mismo sitio que en la Laguna); el arte de muebles es una fase posterior.

## Revisar al rebasar sobre el port de Hydrogen (`hydrogen/fisicas`)
- `kart.ts` `endDrift`: usa `t.boostSpeedMult`; el port lo sustituye por `boostMult1/2/3` (el typecheck lo cazará).
- Mini-turbo N3 del port ×1,52 ≈ azul ×1,5: con la regla «gana el mayor» el azul solo alargaría tiempo. Plan: bajar N3 a ×1,45 o subir el azul (PLAN §2.2).
- `boostPadMult` pasa a 1,4 en el port: no afecta a `PADS`, pero revisar la escala completa.
- `boostAccel` 45 → 55 en el port: cambia el tiempo de subida a 39 / 45,5 m/s.
- `PADS` y las zonas están en `tuning.ts`/`13-*.ts`; el conflicto probable es solo la línea de `stepKart` que lee `PADS`.

## Qué falta
- Fases siguientes: rampas-mueble (×1,5 al aterrizar 0,5 s), cohete v2, raíl triturbo ×3, rampas gigantes + plataforma, zonas rosa/morada decorativas, arte de muebles/tema, sfx y color de llamas por nivel, bots que elijan carril de turbo, minimapa con turbos.
- Los turbos no tienen animación de UV ni sonido propio todavía.
- Fps reales en iPhone / Android: sin medir.
- El smoke conduce recto con un dedo (no hay bot de navegador): no recorre la vuelta entera; la vuelta completa está cubierta por el test del bot en `shared`.

## Cómo probarlo
1. `npm run dev` (cliente en :5173 y servidor en :2567; el cliente pide `/health` al servidor).
2. Abrir `http://localhost:5173/?track=desvan-de-las-maravillas` (o `npm run dev:host` y abrirlo desde el móvil). También sale en el selector de circuito como «13. Desván de las Maravillas».
3. Práctica en solitario: acelera hasta los azules/naranjas; el HUD debe subir a ≈140 km/h (azul) y ≈164 km/h (naranja).
4. Tests: `npm test` (`desvan.test.ts`, `groundBoost.test.ts`). Smoke: con el cliente y el servidor en marcha, `npx tsx scripts/smoke-circuito.ts http://localhost:5173`.
