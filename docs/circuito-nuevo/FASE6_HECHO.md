ESTADO: COMPLETO

# Fase 6 — Arte de fantasía del Desván + VFX/SFX de turbos + PR.md

Rama `circuito/nuevo`. Fase anterior: `FASE5_HECHO.md`.

## Qué se ha hecho
- **Tema visual propio `desvan`** (`ThemeId` nuevo; `render/desvanProps.ts`, `themes.ts`, `animas.ts`): muebles viejos GIGANTES de fantasía a los lados de la pista, generados en código y fusionados en mallas con color por vértice (`MeshToonMaterial`) + una malla de piezas que brillan por sí solas (`MeshBasicMaterial`: pantallas de lámpara, esferas de reloj, letras de los cubos, ojos). Diez clases: estantería con libros enormes, pila de libros, lámpara de pie, caja de juguetes con cubos de letras, armario, silla, osito de peluche asomando (guiño a King Kong), reloj de pie, torre de cubos y pelota de playa. Escala ×1,4/×1/×0,7 según quepan. Cielo y luz del Desván más cálidos (violeta rosado); sin campanario ni laguna (son de la Laguna). Reutiliza el cielo de Ánimas (luna, nubes, colinas, estrellas) y `decorateAnimas` (turbos, rampas-mueble, asfalto pintado): es la opción «reutiliza animas con decorados añadidos» del encargo.
  - Reparto determinista (`sceneryPlacements`, sin Three.js): cada 34 m a ambos lados, clase al azar sin repetir las dos anteriores, siempre a ≥ muro + 5 m + radio de la pista MÁS CERCANA (no solo la de su tramo), fuera del asfalto pintado y sin solaparse. Una malla por celda de 170 m con esfera envolvente → el GPU descarta lo lejano.
- **VFX de turbos**:
  - **Flechas con animación UV** (`groundBoost.ts`): el atlas pasa a ser periódico en vertical y el shader (`onBeforeCompile`, `fract` + `textureGrad`) las hace correr hacia delante: 1,5 celdas/s (3,75 m/s) en azul/naranja y 3 celdas/s en el raíl. Sigue siendo 1 malla / 1 llamada.
  - **Destello al pisar** (`raceSession.ts`): sprite aditivo grande que se apaga en 0,32 s + ráfaga de chispas del color del turbo (azul / naranja / triturbo). Chispas también al aterrizar.
  - **Llama del escape por turbo** (`flames.ts`: `BoostTint`, `TINT_COLORS`, `boostTint`): azul = Espectro con borde Ánima; naranja (×≥1,7) = Llama→Brasa y 17 % más larga; triturbo = blanco con Ánima/Espectro, 15 sprites y 33 % más larga. El raíl manda sobre el naranja y este sobre el azul.
- **SFX por código** (`audio/sfx.ts`, WebAudio, sin archivos): `sfx.pad("blue"|"orange"|"tri")` (barrido corto / barrido grave más rico / tres subidas + brillo) y `sfx.landing(conTurbo)` (golpe grave + polvo, y chirrido si cobra el turbo de rampa). Suenan solo para el jugador local. El juego ya tenía sistema de audio (`sfx.ts`), por eso se han añadido.
- **`PR.md`** en la raíz: descripción del PR `circuito/nuevo` → `main` (no abierto).
- Docs: casilla «CN·Fase 6» en `docs/PLAN.md` y fila 13 de `docs/CONTENIDO.md`.
- **No se ha tocado**: física, cámara, control del dedo, cohete, red/servidor, otros circuitos. `furniture.ts` solo exporta `Pieces` y gana un método `solid`.

## Resultados de tests / lint / build / smoke / medir
- `npm test`: **29 archivos, 292 tests en verde** (antes 27 / 280 al empezar la fase 5; durante la fase llegó una fusión de `main` con las físicas de Hydrogen y siguió todo en verde). Nuevos: `desvanProps.test.ts` (2: ≥ 50 piezas de ≥ 6 clases, deterministas; huella fuera del muro + 5 m de cualquier tramo, fuera del asfalto pintado y sin solaparse), `flames.test.ts` (+2: tinte por turbo, llama triturbo más larga), `audio/sfx.test.ts` (2: cada turbo suena distinto y el aterrizaje, con un `AudioContext` falso).
- `npm run lint`: limpio. `npm run build`: limpio.
- **Smoke Playwright 390×844 @2x** (`npx tsx scripts/smoke-circuito.ts http://localhost:5173`, con `npm run dev` —cliente y servidor— levantado y cerrado después; Chrome del sistema, WebGL por software): **0 errores de consola**. Práctica en solitario: 115 muestras, 140 km/h máx. Nuevas comprobaciones, todas correctas: flechas animadas (3 cuadros distintos entre sí), el bot pisa el azul (×1,5) y el naranja y se capturan destello y llama de cada uno; siguen pasando cadena de 3 S (3 saltos ×1,5), raíl a 78,0 m/s, plataforma, XL de la diagonal y caída con reaparición en 1.491 m. El smoke sale con código 1 si falla cualquiera (`vfxTurbos` en `smoke.json`).
- `npm run medir` (8 karts, 390×844): **Desván 43 llamadas, 53 782 triángulos** (antes de la fase 41 y 38 906; límite ≤ 90 y ≤ 110 000). Otros circuitos idénticos: Laguna 57 / 93 879, Ribera 55 / 89 497, Viñedos 36 / 100 152. Con el decorado a la vista en el smoke (software, karts y HUD): 22–53 llamadas y 42 411–74 959 triángulos. La 1.ª versión del decorado (sin celdas, tamaño ×1) sumaba 133 482 triángulos; por eso se partió en celdas y se espació a 34 m.
- Fps reales en iPhone: **pendiente de prueba en dispositivo**.

## Capturas (390×844 @2x, salvo las de práctica y vuelo: @1x)
En `/workspace/derrape-circuito-capturas/fase6/`:
- Decorado: `/workspace/derrape-circuito-capturas/fase6/40-decorado-salida.png`, `41-decorado-recta.png`, `42-decorado-curva-norte.png`, `43-decorado-eses.png`, `44-decorado-diagonal.png`, `45-decorado-inferior.png`, `46-decorado-libre-1.png`, `47-decorado-libre-2.png` (todas en la misma carpeta)
- Flechas animadas (mismo punto, 3 instantes): `/workspace/derrape-circuito-capturas/fase6/51-flechas-animadas-1.png`, `52-flechas-animadas-2.png`, `53-flechas-animadas-3.png`
- Destello y llama: `/workspace/derrape-circuito-capturas/fase6/54-destello-azul.png`, `55-llama-azul.png`, `56-destello-naranja.png`, `57-llama-naranja.png`
- Llama triturbo: `/workspace/derrape-circuito-capturas/fase6/19-rail-en-marcha.png`, `20-rail-a-78.png`
- Anteriores regeneradas: `01`–`36`, `07-vista-general.png` y `smoke.json`.

## Decisiones tomadas
- **Tema nuevo `desvan` sobre `animas`** en vez de un tema desde cero: mismo cielo, calzada y turbos; solo cambia el ambiente y el decorado. Coste: 1 clave en `ThemeId` y 1 línea en `props.ts`.
- **Muebles de tamaño de una casa** (8–30 m) apoyados en el suelo del desván (−12 m): asoman 8–35 m sobre la calzada, que es lo que da la sensación de mundo gigante. Los muebles de las rampas (tamaño real) se quedan.
- **Colores de utilería** (rosa, turquesa, malva, azul, verde botella, rojo libro) fuera de la paleta Dalí, para un mundo de fantasía tipo Kirby/Mario; evitan Brasa/Llama/Espectro vivos para que nada lejano se confunda con un turbo. Pendiente de visto bueno de Dalí.
- **Celdas de 170 m** en vez de instancias: cada mueble es único (libros al azar) y así se descarta lo lejano; coste: hasta ~12 llamadas en vistas altas, dentro de presupuesto.
- **Destello y sonido solo del jugador local**; los bots tienen destello pero no sonido; los remotos online usan siempre la llama azul porque la red solo envía `boosting` (opcional futuro: `pad` en `NetKartState`).
- El tinte naranja se decide por `boostMult ≥ 1,7`: ninguna otra fuente (nitro ×1,3, aterrizaje ×1,5, mini-turbos ≤ ×1,45) llega.
- **El «conflicto con `hydrogen/fisicas`» ya no existe**: es ancestro de `main` (PR #15) y `main` ya está fusionado en la rama; `git merge-tree` con `origin/main` sale limpio. Durante esta sesión la rama avanzó sola (`8f15faf`, fusión de `main` hecha fuera de mi sesión) y lo comprobé con tests y lint antes de mi primer commit.

## Qué falta
- Probar en iPhone real (fps con el decorado, `textureGrad` en Safari) y **oír** los sonidos en un móvil.
- Visto bueno de Dalí/Carlo a los muebles y a los colores; ajustar densidad o añadir más clases (paraguas, tazas, discos).
- Sin sombras blob bajo los muebles ni halos de luz en las lámparas (`MeshBasic` plano): mejora opcional.
- Remotos online: llama por color y sonidos (hace falta `pad` en `NetKartState`).
- Fases siguientes del plan: cohete v2 y pulido.

## Cómo probarlo
1. `npm run dev` y abre `http://localhost:5173/?track=desvan-de-las-maravillas`: circuito con decorado; pisa el azul de la salida (a 20 m): destello, chispas, sonido y llama azul; el naranja de los 70 m (franja) y el raíl de la recta de meta (llama blanca/morada, más larga). Aterriza una rampa-mueble (golpe + chirrido).
2. Vistas directas: `&foto=10,0,0` (flechas), `&foto=1745,0,0&correr=bot` (raíl), `&foto=0,0,0&vista=-150,60,-60,-170,10,60` (decorado desde arriba).
3. Tests: `npx vitest run apps/client/src/render/desvanProps.test.ts apps/client/src/render/flames.test.ts apps/client/src/audio/sfx.test.ts`; todo: `npm test`, `npm run lint`, `npm run build`, `npm run medir`.
4. Smoke: con `npm run dev` en marcha, `npx tsx scripts/smoke-circuito.ts http://localhost:5173` (solo capturas: `SOLO_CAPTURAS=1`; filtrar: `FILTRO='^4[0-7]'`).
