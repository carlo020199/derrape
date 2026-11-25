# Derrape — juego de karts multijugador para móvil (navegador)

> "Derrape" es un nombre provisional. Cámbialo cuando quieras (buscar y reemplazar).

## Qué es
Juego de carreras de karts arcade, 3D low-poly, para jugar con amigos desde el móvil
(iPhone y Android) directamente en el navegador. Partidas privadas con código de sala, 2–8 jugadores.
Versión 1.0: **10 circuitos, 8 personajes y 10 coches**, todo disponible desde el principio
(catálogo en `docs/CONTENIDO.md`).

## Reglas de oro
- **Todo el contenido es ORIGINAL.** Nada de personajes, nombres, objetos, circuitos, logos,
  música ni sonidos de Nintendo / Mario Kart ni de ninguna otra franquicia. Las mecánicas
  genéricas del género (derrape con turbo, cajas de objetos, vueltas) sí se pueden usar.
- **Mobile-first.** Objetivo: 60 fps en un iPhone de hace 3–4 años y en un Android de gama media.
  Si una feature cuesta rendimiento, se mide antes de dejarla.
- **Safari en iOS es el navegador más restrictivo.** Cada fase se prueba en un iPhone real.
- Se juega sin instalar nada (web) y se puede "Añadir a pantalla de inicio" (PWA).
- **Pasos pequeños.** Cada fase termina con algo jugable, tests en verde y un commit.

## Stack
- Monorepo con npm workspaces: `apps/client`, `apps/server`, `packages/shared`
- Cliente: TypeScript + Vite + Three.js. UI (menús, HUD) en HTML/CSS por encima del canvas.
- Física: modelo **arcade propio**, no simulación realista. La pista es una spline 3D con ancho;
  colisiones contra los bordes de la pista y entre karts como esferas.
- Multijugador: servidor Node.js + Colyseus (salas y estado sincronizado).
- `packages/shared`: tipos, mensajes de red, constantes de tuning y la simulación pura del kart.
- Tests: Vitest para la lógica pura (física, vueltas, checkpoints, objetos).
- Hosting: cliente estático (Cloudflare Pages / Vercel / Netlify); servidor en Fly.io / Railway / Render.

## Arquitectura de red
- Cada cliente simula **su propio kart** y envía su estado ~20 veces/s.
- El servidor retransmite, hace validaciones básicas (velocidad máxima, checkpoints en orden) y es
  la autoridad de: salas, cuenta atrás, cajas de objetos, qué objeto toca, impactos, vueltas,
  posiciones y resultados.
- Los karts remotos se pintan interpolados ~100 ms en el pasado.
- Motivo: es un juego entre amigos. Prioridad = que se sienta fluido y que el código sea simple;
  el anti-trampas no es un objetivo.

## Estructura prevista
```
apps/client/src/
  sim/        lógica de juego sin Three.js (puede importar de shared)
  render/     escena, cámara, modelos, partículas
  input/      teclado, controles táctiles, giroscopio
  net/        cliente Colyseus, interpolación
  ui/         menús, lobby, HUD
apps/server/src/
  rooms/      RaceRoom
packages/shared/src/
  tuning.ts   TODAS las constantes de ajuste (velocidades, derrape, objetos)
  kart.ts     simulación de un kart (paso fijo)
  track.ts    spline, checkpoints, progreso en pista
  messages.ts tipos de mensajes cliente/servidor
  characters.ts  los 8 personajes (datos)
  karts.ts       los 10 coches y sus estadísticas (datos)
  tracks/        un archivo de datos por circuito + índice
```
- Personajes, coches y circuitos son DATOS. Añadir uno no debería requerir tocar la lógica del juego.

## Comandos (se crean en la Fase 0)
- `npm run dev` — cliente + servidor en local
- `npm run dev:host` — expone el cliente en la red local para probar en móviles
- `npm test`
- `npm run build`

## Convenciones
- TypeScript estricto. La lógica de juego no depende de Three.js.
- Bucle de física a paso fijo (60 Hz) con interpolación al renderizar.
- Assets solo CC0 o propios, en `apps/client/public/assets`, anotados en `ASSETS.md` con origen y licencia.
- Textos de la interfaz en español.
- El plan completo está en `docs/PLAN.md`, el catálogo de contenido en `docs/CONTENIDO.md`
  y los prompts por fase en `docs/PROMPTS.md`. Las físicas de referencia (y sus fuentes) están en `docs/FISICAS.md` y la comparativa con los juegos de referencia en `docs/REFERENCIA.md`.
  Al terminar una fase, marca su casilla en `docs/PLAN.md`.

## Release 1 (rama `release/v1`)
Alcance: **2 pilotos con su kart y 1 circuito (Laguna de las Ánimas)** con el aspecto de `docs/release-v1/referencias/`
(`ejemplo1` = carrera, `ejemplo2` = Lía Brasas, `ejemplo3` = paleta/fuentes/fases). Dirección de arte y criterios C1–C10:
`docs/release-v1/referencias/DALI_direccion_arte.md`. Lo que se pasa a `/goal`: `docs/release-v1/GOAL.md`.
Objetivo: 60 fps en móvil e iPhone, test del bot en verde, `npm run build` y `npm run lint` limpios.

### Qué se toca
- Pilotos y coches: `packages/shared/src/characters.ts`, `karts.ts` (datos), `apps/client/src/render/kartModel.ts`, `garagePreview.ts`, `materials.ts`, `flames.ts`, `sparks.ts`.
  Pilotos: Lía Brasas (ya existe, se rediseña) y Calavera Chispas (nuevo). Coches: «Hueso» y «Medianoche» (nuevos). Los demás se quedan como están y siguen elegibles.
- Circuito: `apps/client/src/render/themes.ts` (tema `animas`), `animas.ts`, `sky.ts`, `trackMesh.ts`, `props.ts`; datos en `packages/shared/src/tracks/11-laguna-de-las-animas.ts`.
- UI: `apps/client/src/style.css`, `index.html`, `ui/hud.ts`, `ui/garage.ts` (paleta de Dalí, Lilita One + Nunito).
- NO tocar: otros circuitos, otros personajes, red/servidor, física (`kart.ts`, `tuning.ts`), salvo lo estrictamente necesario y dicho en el commit.

### Reglas
- **No hacer `git push` ni merge a `main`** (están denegados en `.claude/settings.json`). Todo se queda commiteado en `release/v1`.
- Commits en español, pequeños, uno por fase; cada uno con tests, build y lint en verde.
- Paleta: solo los hex de Dalí (sección 0). Sin assets de otras franquicias. Modelos procedurales en código (`SphereGeometry`, `CapsuleGeometry`, `LatheGeometry`…) con `MeshToonMaterial` + `gradientMap` de 3 escalones; si se añade un asset externo, solo CC0 y anotado en `ASSETS.md`.
- Outline (casco invertido) **solo en pilotos y karts**. Fuego = sprites aditivos instanciados. Sombras blob, sin shadow maps. `pixelRatio` ≤ 2. Sin luces reales para los farolillos.
- Renderer: **WebGL** con `three` actual del repo (no WebGPU/TSL). No usar APIs de Three.js obsoletas: mira la versión instalada y sus tipos antes de usar una API que no conozcas.
- Los textos de la interfaz en español. Al terminar cada fase, marca su casilla en `docs/PLAN.md`.

### Comandos
- Tests: `npm test`. Test del bot: `npx vitest run packages/shared/src/race.test.ts -t "piloto automático"`.
- Build: `npm run build` (typecheck + cliente + servidor). Lint: `npm run lint` (`tsc --noEmit` con `noUnusedLocals`/`noUnusedParameters` en shared, server y client; no cubre `scripts/`).
- Presupuesto de escena: `npm run medir` (= `tsx scripts/medir-escena.ts`, JSON por circuito: llamadas y triángulos con 8 karts, cámara vertical 390×844).
- Capturas 390×844 @2x: con `npm run dev -w @derrape/client` en marcha, `npm run capturas -- http://localhost:5173 docs/release-v1/capturas <personaje> [coche]`.
  Genera `a-salida`, `b-recta-campanario`, `c-curva-valla`, `d-laguna`, `seleccion-<personaje>`, las `hoja-*` (captura junto a `ejemplo1`/`ejemplo2`) y `metricas.json` (C2, C3, C7 aproximados y `renderer.info`). Usa el Chrome del sistema con WebGL por software (`CHROME_PATH` para cambiarlo). Las posiciones están en `SHOTS` (`?foto=metros,lateral,giro`).

### Presupuestos de rendimiento (en coherencia con `medidas.json`)
Límites duros por escena (parrilla de 8 karts, cámara de persecución vertical): **≤ 120 llamadas de dibujo y ≤ 150 000 triángulos**.
Objetivo del release, para dejar margen en un iPhone de hace 3–4 años: **Laguna ≤ 90 llamadas y ≤ 110 000 triángulos**
(hoy: 52 llamadas y ~71 700 triángulos con `medir-escena`; `peor` en `medidas.json`: 46 y 87 732).
Dalí pide más detalle por piloto/coche que los 1 800 triángulos de `medidas.json`, así que este release **sustituye** esos dos límites:
- Piloto + coche de cerca (≤ 15 m): **≤ 10 000** triángulos (piloto 3–5k, coche 4–6k, sin contar el contorno, que se mide aparte y no pasa de 2×).
- Piloto + coche lejos (modelo barato): **≤ 1 500**. Con 8 karts, como mucho 3 cerca.
- Entre 40 y 80 árboles instanciados (3 modelos), 15–30 farolillos, vallas instanciadas: cada familia = 1 llamada.
- Al terminar, actualizar `medidas.json` (campos `limites` y una entrada `release1` con antes/después) con los números reales.
- Los fps reales de un iPhone solo los confirma Carlo; en el box se dejan métricas proxy (`renderer.info`, `npm run medir`, ms/fotograma por software) y se marca «pendiente de prueba en dispositivo».
