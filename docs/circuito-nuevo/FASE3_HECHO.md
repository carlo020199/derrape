ESTADO: COMPLETO

# Fase 3 — Raíl triturbo ×3 (Desván de las Maravillas)

## Qué se ha hecho
- **Zona `boostTri`** (`track.ts`, `tuning.ts` → `PADS.boostTri` ×3, 0,8 s al salir; `TRI_RAIL.halfWidth` = 1,0 m, es decir franja de 2 m para un kart de 1,8 m). Un solo raíl de **50 m en 1.812–1.862 m** del Desván (recta de meta, antes de la línea). El plan sugería 1.765–1.815, pero ahí el rumbo deriva 4,4° (salida de la curva I + una ondulación a 1.800 m) y un kart sin girar acababa a 2,9 m del eje; en 1.812–1.862 el rumbo casi no cambia. Está a 67 m del naranja de franja que lo centra, sin cajas ni rampas encima. La parrilla cae dentro del tramo pero a ±3 m del eje, fuera de la franja.
- **Física (`kart.ts`)**: el ×3 lleva su **propio contador `triTime`** (no `boostTime`), así que ningún otro turbo (naranja, nitro…) puede alargarlo ni mezclarse; `isBoosting(s)` unifica «hay turbo» (HUD, red, bot de pruebas). Punta = `maxSpeed·3` = 78 m/s. Trompo y reaparecer lo cancelan.
- **Inercia al salir** (`TRI_RAIL.decel` = 20 m/s²): por encima de la punta del naranja (45,5 m/s) el kart frena a 20 m/s² en vez de a `coastDrag·2` = 12. De 78 m/s a la punta normal tarda ≈4,05 s y 220 m (con la frenada antigua: ≈5,1 s y 288 m).
- **Servidor** (`MAX_PLAUSIBLE_SPEED` pasa a `tuning.ts` = `TOP_SPEED·1,15` = 89,7 m/s; antes `maxSpeed·2` = 52). Un salto de 150 m/s sigue descartándose.
- **Colisión por barrido** (`items.ts`): `distanceToSegment` + `sweptDistance`. Cajas y aceite se recogen si el **segmento** entre la posición anterior y la actual toca el radio (`RaceKart.prevX/prevZ`). Un salto > `ITEMS.sweepMax` (24 m, p. ej. reaparecer) no barra nada. Como `stepItems` es el mismo código en servidor y en solitario (60 Hz), el cliente lo hereda sin cambios; online el cliente no detecta colisiones de objetos.
- **Visual** (`groundBoost.ts`): una tercera ficha en el atlas de los turbos de suelo (sigue siendo 1 malla / 1 llamada): rieles metálicos (Marfil + brillo Hueso), fondo Noche y **tri-chevrones** Espectro / Llama / Ánima. Medido: +2–3 llamadas y ≈+2 700 triángulos sobre una escena con turbos.
- `scripts/jugador-falso.ts` y `raceSession.ts` usan `isBoosting`.

## Resultados de tests / lint / build / smoke / medir
- `npm test`: **253 de 253 en verde** (25 archivos; al reanudar eran 3 fallos de 234: los tests de turbos de suelo asumían que todo `PADS` era azul/naranja). Nuevos: `packages/shared/src/triturbo.test.ts` (datos del raíl, ×3 = 78 m/s, inercia, trompo, bot entra y llega a ≈78 sin reaparecer, barrido de caja y aceite a 78 m/s y 20 Hz, no ensancha la caja, teletransporte no barre), 3 en `raceLogic.test.ts` (umbral: 78 m/s cuenta, 150 m/s no; caja recogida a 78 m/s) y 2 en `groundBoost.test.ts`. Comprobado que sin barrido (`sweepMax = 0`) fallan los dos tests de recogida.
- `npm run lint`: limpio. `npm run build`: limpio.
- Bot del Desván: vuelta sin reaparecer (con raíl ×3 y la cadena de rampas después, 2 vueltas seguidas sin reaparecer); pasa el raíl a 78,0 m/s.
- **Smoke Playwright 390×844** (`npx tsx scripts/smoke-circuito.ts`, con cliente y servidor levantados y cerrados después): **0 errores de consola**, práctica en solitario (116 muestras, 140 km/h máx. con el dedo recto), cadena de 3 S completa (3 saltos con ×1,5), **raíl: 78,0 m/s** con el bot desde la curva I. Resultados en `smoke.json`.
- `npm run medir` (8 karts, 390×844): **Desván 40 llamadas, 35 030 triángulos** (límite ≤ 90 / ≤ 110 000); peor circuito de todos 53 llamadas / 100 152 triángulos (sin cambios por esta fase). Con el raíl a la vista en el smoke: 43 llamadas / 46 016 triángulos (software, incluye karts y HUD).
- Fps reales en iPhone: **pendiente de prueba en dispositivo**.

## Capturas (/workspace/derrape-circuito-capturas/fase3/)
- `/workspace/derrape-circuito-capturas/fase3/16-rail-antes.png`, `17-rail-dentro.png`, `18-rail-lado.png`, `19-rail-en-marcha.png`, `20-rail-a-78.png`
- Anteriores repetidas: `01`–`15` (turbos, rampas, cadena en vuelo, vista general, solitario) y `smoke.json`.

## Decisiones tomadas
- Contador `triTime` aparte en lugar de reutilizar `boostTime` (si no, un naranja de 3 s alargaba el ×3 y la «regla de que gana el mayor» lo hacía dudoso).
- Raíl desplazado 42 m respecto al plan (ver arriba) y mantenido en ±1,0 m (el plan permitía subir a 1,4 si resultara demasiado duro: **dudoso, hay que probarlo con el dedo**).
- El plan hablaba de 4 m de caja y 3,9 m por mensaje; el radio es 2 m, así que un pase por el centro a 78 m/s no se perdía caja (la mayor distancia a una muestra es 1,95 m), pero uno **descentrado** (≥ 1,2 m) sí. El barrido arregla ambos casos; el test lo prueba con la caja a 1,5 m del eje.
- Decel 20 m/s² como en el plan, solo por encima de 45,5 m/s: por debajo se mantiene el comportamiento de siempre.
- Interacción con la cadena de 3 S de la recta A (a 116–214 m de meta): tras el raíl se llega a la primera rampa a ≈55 m/s (diseñada para 26–39), vuelo más largo; el bot sigue enlazando los 3 saltos y completa la vuelta, pero la cadena deja de ser «exacta» justo después del raíl. Es un combo, no un bug; si molesta, subir `TRI_RAIL.decel` o mover el raíl.
- No se tocó el cohete, la cámara ni los controles. No se añadió sfx del raíl (fase 8).

## Qué falta
- Probar el raíl con un dedo real en iPhone (¿2 m de franja es jugable?) y los fps con el raíl a la vista.
- Embudo de flechas V previo al raíl y abanico de I: el abanico de turbos azules ya existía (fase 1); no se ha hecho un embudo específico.
- sfx (zumbido que sube de tono) y líneas de velocidad en el raíl: fase 8.
- Rampas gigantes y plataforma flotante (fase 6) y el arte final (fase 7).
- La velocidad máxima del servidor no se valida contra el raíl (solo umbral global); el anti-trampas no es objetivo.

## Cómo probarlo
1. `npm run dev` y abre `http://localhost:5173/?track=desvan-de-las-maravillas` (práctica en solitario), o `?track=desvan-de-las-maravillas&foto=1745,0,0&correr=bot` para ver al piloto automático entrar al raíl.
2. En la recta de meta, tras los turbos de la curva I, entra por el centro del raíl metálico (2 m de ancho): ≈281 km/h en el HUD.
3. `npm test`, `npm run lint`, `npm run build`, `npm run medir`; smoke: `npx tsx scripts/smoke-circuito.ts http://localhost:5173 /workspace/derrape-circuito-capturas/fase3` (con el cliente en marcha).
