# Derrape — juego de karts multijugador para móvil (navegador)

> "Derrape" es un nombre provisional. Cámbialo cuando quieras (buscar y reemplazar).

## Qué es
Juego de carreras de karts arcade, 3D low-poly, para jugar con amigos desde el móvil
(iPhone y Android) directamente en el navegador. Partidas privadas con código de sala, 2–8 jugadores.
Versión 1.0: **10 circuitos, 5 personajes y 10 coches**, todo disponible desde el principio
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
  characters.ts  los 5 personajes (datos)
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
  y los prompts por fase en `docs/PROMPTS.md`.
  Al terminar una fase, marca su casilla en `docs/PLAN.md`.
