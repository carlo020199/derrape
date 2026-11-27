# PR: `circuito/nuevo` → `main` — Circuito 13 «Desván de las Maravillas»

> Borrador de descripción. **No se ha abierto el PR** (lo decide Carlo). Última comprobación: 27/11/2026.

## Estado real de la rama (léelo primero)
- Las fases 1–5 **ya están en `main`** (PRs #14, #16 y #17 de `circuito/nuevo`). Lo que aún no está en `main` es la **fase 6** (2 commits, 9 archivos de código + docs). Este documento resume las seis fases para que el PR se entienda entero.
- **El «conflicto previsto con `hydrogen/fisicas` ya no existe**: `origin/hydrogen/fisicas` es ancestro de `origin/main` (PR #15, comprobado con `git merge-base --is-ancestor`) y `main` ya se ha fusionado en esta rama (`8f15faf`). `git merge-tree origin/main HEAD` da un árbol limpio, sin conflictos. El aviso «no está en main» de `HYDROGEN_FISICAS.md` está desactualizado.
- La interacción física que sí importaba (mini-turbo III ×1,52 empatando con el azul ×1,5) ya está resuelta en `main`: N3 = ×1,45.

## Resumen por fases
| Fase | Qué trae | Datos clave |
|---|---|---|
| 1 | Trazado «Desván de las Maravillas» (id `desvan-de-las-maravillas`, circuito 13, fuera de copa) + **turbos de suelo** azul ×1,5 (1,5 s ancho / 2 s franja) y naranja ×1,75 (2,5 / 3 s); no se apilan, gana el mayor | 1.884 m, ancho 16 m, 3 vueltas; 13 azules + 6 naranjas; 1 llamada de dibujo |
| 2 | **Rampas-mueble** con turbo de aterrizaje ×1,5 durante 0,5 s; cadenas de 2 y 3 (saltas, aterrizas, vuelves a saltar); cuñas de tablones/somier y muebles viejos al borde (marrones, grises, óxido, verdes; sin naranjas de turbo) | 6 rampas (3 S, 1 S, 2 M); huecos calculados con la física real |
| 3 | **Raíl triturbo ×3** de 2 m de ancho (justo un kart), contador `triTime` propio, inercia controlada, **servidor**: umbral de salto sospechoso 90 m/s y **barrido de cajas/aceite por segmento** (a 78 m/s un kart avanza 3,9 m entre mensajes) | 50 m en la recta de meta; 78,0 m/s medidos |
| 4 | **Rampas gigantes XL** (una sube a una **plataforma flotante** con cajas encima; otra termina en salto largo); plataforma = tramo elevado de la propia pista con zonas `fall` a los lados; reaparición correcta tras caer | +3 m, meseta de 75 m; vuelos 30–85 m según turbo |
| 5 | **Asfalto pintado decorativo** rosa y morado entre tramos (como patrocinadores en escapatorias de F1), **sin efecto de juego** | 1 malla, ≈40 triángulos; fuera del muro |
| 6 | **Arte de fantasía** (tema propio `desvan`) + **VFX/SFX de turbos** (ver abajo) | +2 llamadas… ver Medidas |

### Fase 6 en detalle
- **Tema `desvan`** (`ThemeId` nuevo, `render/desvanProps.ts`): muebles gigantes del tamaño de una casa a los lados de la pista — estanterías con libros enormes, pilas de libros, lámparas de pie (pantalla que brilla), armarios, cajas de juguetes con cubos de letras, sillas, relojes de pie, torres de cubos, pelotas de playa y un **osito de peluche** que asoma (guiño a King Kong). Cielo y luz algo más cálidos que Ánimas; sin campanario ni laguna. Todo en código, sin texturas ni luces reales. Reparto determinista con tests: siempre fuera del muro + 5 m, sin pisar asfalto pintado ni solaparse; una malla por celda de 170 m para que el GPU descarte lo lejano.
- **VFX de turbos**: flechas con **animación UV** (corren hacia delante dentro de cada celda; el raíl, el doble de rápido; fichas periódicas, sin costuras); **destello + chispas al pisar** (azul / naranja / triturbo); **color de llama del escape según el turbo** activo (azul = Espectro, naranja = Llama→Brasa más larga, triturbo = blanco/Ánima/Espectro, aún más larga); chispas al aterrizar.
- **SFX por código (WebAudio, sin archivos)**: `sfx.pad(azul|naranja|tri)` y `sfx.landing(conTurbo)` sobre el sistema `audio/sfx.ts` existente.

## Archivos más tocados (fase 6)
`apps/client/src/render/desvanProps.ts` (nuevo), `groundBoost.ts`, `flames.ts`, `furniture.ts` (exporta `Pieces`), `animas.ts`, `themes.ts`, `props.ts`; `apps/client/src/game/raceSession.ts` (destello, llama por tinte, sonidos), `apps/client/src/audio/sfx.ts`; `packages/shared/src/tracks/types.ts` (`ThemeId` + `"desvan"`) y `13-desvan-de-las-maravillas.ts` (`theme: "desvan"`). **No se toca**: física, cámara, control del dedo, cohete, red/servidor, otros circuitos.

## Tests y comprobaciones
- `npm test`: **29 archivos, 292 tests en verde**. `npm run lint` y `npm run build`: limpios.
- Nuevos en la fase 6: `desvanProps.test.ts` (reparto del decorado), `flames.test.ts` (+2: tinte por turbo, llama triturbo más larga), `audio/sfx.test.ts` (2, con un `AudioContext` falso).
- **Smoke Playwright 390×844 @2x** (`scripts/smoke-circuito.ts`, Chrome del sistema con WebGL por software, cliente + servidor locales, práctica en solitario): **0 errores de consola**. Comprueba, además: flechas animadas (3 cuadros distintos), destello y llama azul/naranja, cadena de 3 S (3 saltos ×1,5), raíl a 78,0 m/s, plataforma y XL de la diagonal, caída con reaparición.
- Bot del Desván: vuelta completa sin reaparecer (≈58 s con turbos y rampas).

## Medidas (`npm run medir`, 8 karts, 390×844)
| Circuito | Llamadas | Triángulos | Límite |
|---|---|---|---|
| **Desván** | **43** | **53 782** | ≤ 90 / ≤ 110 000 |
| Laguna / Ribera / Viñedos (sin cambios) | 57 / 55 / 36 | 93 879 / 89 497 / 100 152 | ≤ 120 / ≤ 150 000 |

Antes de la fase 6 el Desván medía 41 llamadas y 38 906 triángulos (+2 llamadas, +14 876 triángulos de decorado). En el smoke, con el decorado a la vista (software, karts y HUD): 22–53 llamadas y 42 411–74 959 triángulos. **Fps reales en iPhone: pendiente de prueba en dispositivo.**

## Riesgos
1. **Rendimiento en iPhone no medido** (el decorado añade ~15 k triángulos y la animación UV usa `textureGrad`/`dFdx`, soportado en WebGL2; no probado en Safari real).
2. **Estética por validar**: muebles y colores son propuesta mía (rosa, turquesa, malva fuera de la paleta Dalí; óxido y verdín ya lo estaban). Pendiente de visto bueno de Dalí/Carlo.
3. **Remotos**: los rivales online muestran siempre la llama azul (la red solo envía `boosting`); el destello y los sonidos de pisada son del jugador local. Opcional futuro: `pad?: 0|1|2|3` en `NetKartState`.
4. **Raíl de ±1,0 m**: puede resultar duro con el dedo (el plan permitía ensanchar hasta ±1,4). Decisión de Carlo tras probar.
5. **Audio**: los sonidos son sintéticos y no se han podido oír en el box; hay que juzgarlos en un móvil (volumen y mezcla con `sfx.boost`).
6. Posible parpadeo de sombreado de `fract` en las flechas si un GPU móvil no soporta `textureGrad` (el fallo sería visual, no de juego).

## Cómo probarlo
1. `npm install && npm run dev`; abre `http://localhost:5173/?track=desvan-de-las-maravillas` (o `npm run dev:host` para el móvil). Práctica en solitario.
2. Mira: flechas corriendo en los turbos; pisa uno y fíjate en el destello, las chispas y el color de la llama del kart (azul → naranja → raíl de la recta de meta); aterriza una rampa-mueble (golpe + chirrido).
3. Vistas directas: `&foto=10,0,0` (azul), `&foto=1745,0,0&correr=bot` (raíl), `&foto=0,0,0&vista=-150,60,-60,-170,10,60` (decorado desde arriba).
4. `npm test && npm run lint && npm run build && npm run medir`. Smoke: con `npm run dev` en marcha, `npx tsx scripts/smoke-circuito.ts http://localhost:5173` (capturas en `/workspace/derrape-circuito-capturas/fase6/`).

## Capturas (`/workspace/derrape-circuito-capturas/`)
- Fase 1 `fase1/`: turbos de suelo (`02`–`06`), salida (`01`).
- Fase 2 `fase2/`: rampas y cadenas (`09`–`15`).
- Fase 3 `fase3/`: raíl triturbo (`16`–`20`).
- Fase 4 `fase4/`: plataforma y XL (`21`–`30`).
- Fase 5 `fase5/`: asfalto pintado (`31`–`36`).
- Fase 6 `fase6/`: decorado (`40`–`47`), flechas animadas (`51`–`53`), destello y llama azul (`54`–`55`) y naranja (`56`–`57`), raíl con llama triturbo (`19`, `20`), vista general (`07`).

## Checklist para Carlo
- [ ] Jugar el circuito en el iPhone (Safari) y confirmar los 60 fps con el decorado a la vista.
- [ ] ¿Gustan los muebles gigantes y el osito? ¿Más/menos densidad, otros muebles (paraguas, tazas, discos)? Visto bueno de Dalí a la paleta de utilería.
- [ ] Flechas animadas: ¿velocidad correcta? ¿Se leen bien azul/naranja/raíl?
- [ ] Sonidos de turbo, triturbo y aterrizaje: volumen, timbre, que no cansen.
- [ ] Raíl triturbo: ¿±1,0 m es demasiado estrecho con el dedo?
- [ ] Plataforma: ¿es justa la caída a ±8,5 m del eje? ¿Se entiende el vacío a los lados?
- [ ] Zonas rosa/morada: ¿era esa la idea (adorno entre tramos, sin efecto)? (hay una pregunta abierta en `docs/circuito-nuevo/PLAN.md` §6).
- [ ] Decidir si el PR se abre solo con la fase 6 (lo único pendiente respecto a `main`).
- [ ] Siguientes fases del plan: cohete v2 y pulido (el cohete actual se ha dejado tal cual).
