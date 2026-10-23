# Prompts para Claude Code, fase a fase

Cómo usarlos:
1. Abre la terminal en la carpeta `derrape` y ejecuta `claude`.
2. Pega el prompt de la fase que toca. Uno por fase; no mezcles fases.
3. Al terminar, pruébalo tú (en PC y en el móvil) antes de pasar a la siguiente.
4. Si algo no te convence, díselo en la misma sesión ("el derrape se siente lento, sube el turbo").
5. Consejo: para las fases grandes, pide primero un plan con `/plan` o "primero dime el plan, no escribas código", y luego "adelante".

---

## Fase 0 — Esqueleto

```
Lee CLAUDE.md y docs/PLAN.md. Vamos con la Fase 0.

Crea el monorepo con npm workspaces (apps/client, apps/server, packages/shared) en TypeScript estricto:
- apps/client: Vite + Three.js que muestre un cubo girando a pantalla completa, con un contador de fps en una esquina.
- apps/server: servidor Colyseus mínimo con una sala "race" vacía y un endpoint /health.
- packages/shared: un archivo tuning.ts con una constante de ejemplo, importado desde cliente y servidor.
- Scripts en la raíz: dev (cliente + servidor a la vez), dev:host (cliente accesible desde la red local), test, build.
- Vitest configurado con un test de ejemplo en shared.
- .gitignore, README corto con cómo arrancar, y ASSETS.md vacío con su cabecera.
- Inicializa git y haz el primer commit.

Al terminar, explícame en pocas líneas cómo arrancarlo y cómo abrirlo desde el móvil en la misma Wi-Fi.
```

## Fase 1 — Conducir

```
Fase 1 de docs/PLAN.md: conducir.

- En packages/shared/kart.ts implementa la simulación arcade de un kart a paso fijo de 60 Hz, sin Three.js:
  aceleración, velocidad punta, giro que depende de la velocidad, frenado, marcha atrás y rozamiento.
- Derrape con turbo: mantener derrape mientras giras carga 3 niveles (chispas azul → naranja → morado);
  al soltar, mini-turbo proporcional. Todas las constantes en tuning.ts.
- Una pista de prueba ovalada y plana con bordes; el kart rebota suave contra ellos.
- Render en el cliente: kart provisional (cajas de colores), suelo, cámara de persecución suave
  que se abre un poco a alta velocidad, chispas de derrape simples.
- Controles de teclado: flechas/WASD, Espacio = derrape.
- Tests de Vitest para la física: acelera hasta la punta y no la supera, el turbo se carga por niveles,
  el rebote contra el borde no atraviesa la pista.
- Un panel de debug (tecla F1) para ajustar en vivo las constantes de tuning.

Commit al terminar.
```

## Fase 2 — Móvil

```
Fase 2 de docs/PLAN.md: que se juegue bien en el móvil. Revisa la checklist de la sección 5 del plan.

- Controles táctiles: mitad izquierda = joystick invisible para girar; mitad derecha = botón grande
  DERRAPE (mantener), botón OBJETO (de momento sin función) y botón pequeño de frenar.
  Acelerar automático activado por defecto, con opción en un menú de ajustes.
- Multitouch correcto (girar y derrapar a la vez), sin zoom, sin selección de texto, sin scroll.
- Aviso "gira el móvil" en vertical.
- Giroscopio opcional (desactivado por defecto), con petición de permiso en iOS tras un toque.
- HUD en HTML/CSS: velocímetro y nivel de turbo, respetando safe-area (muesca / isla dinámica).
- PWA: manifest, iconos provisionales, pantalla completa al añadir a inicio, funciona en iOS y Android.
- Rendimiento: pixel ratio máximo 2, calidad automática que baja si los fps caen de 50 durante unos segundos.
- Pausa al salir de la app.

Dime después exactamente cómo probarlo en un iPhone y en un Android. Commit al terminar.
```

## Fase 3 — Carrera

```
Fase 3 de docs/PLAN.md: una carrera completa en solitario y el sistema de circuitos.
Lee docs/CONTENIDO.md: habrá 10 circuitos, así que el formato tiene que servir para todos.

- packages/shared/track.ts: circuito definido como spline 3D cerrada (lista de puntos de control con
  posición, altura y ancho). Funciones: punto más cercano, progreso en la pista (0–1), dentro/fuera.
- Formato de circuito como DATOS: un archivo por circuito en packages/shared/src/tracks/
  (spline, salida, cajas de objetos, tema, zonas especiales) y un índice con los 10 (solo el 1 relleno).
- Zonas especiales reutilizables preparadas desde ya: superficie lenta, bajo agarre, panel de turbo, rampa, caída al vacío.
- Generar la malla del asfalto, bordillos y muros a partir de la spline. Fuera del asfalto se va más lento.
- Sistema de "kit de tema": decoración de los bordes con piezas reutilizables, colores de cielo y suelo.
- Circuito 1 "Paseo del Puerto" (ver docs/CONTENIDO.md): ORIGINAL, 60–75 s por vuelta, curvas amplias
  ideales para aprender a derrapar, tema ciudad mediterránea con puerto y faro.
- Carga bajo demanda: solo se descarga el circuito que se juega.
- Checkpoints en orden para contar vueltas (no se puede atajar ni ir marcha atrás para sumar).
- Respawn si caes o te quedas atascado (botón o automático).
- Flujo: cuenta atrás 3-2-1 con turbo de salida, 3 vueltas, tiempo por vuelta y total, pantalla final.
- Tests de checkpoints y vueltas.

Commit al terminar.
```

## Fase 4 — Multijugador

```
Fase 4 de docs/PLAN.md: multijugador. Sigue la sección "Arquitectura de red" de CLAUDE.md.

- Menú principal: nombre del jugador (se guarda), Crear sala, Unirse con código.
- RaceRoom en Colyseus: código de 4 letras, 2–8 jugadores, anfitrión, elección de color, botón EMPEZAR solo para el anfitrión.
- Botón "Invitar" que usa el menú de compartir del móvil (Web Share API) con el enlace que incluye el código.
- Cada cliente envía su estado ~20 veces/s; el servidor retransmite y valida lo básico.
- El servidor controla la cuenta atrás, vueltas, posiciones en carrera y resultados finales.
- Karts remotos interpolados ~100 ms en el pasado, con nombre encima.
- Colisiones entre karts (empujón suave).
- Reconexión si alguien pierde la conexión o cambia de app unos segundos.
- Simulador de latencia en modo debug para probar con 150 ms y pérdida de paquetes.

Commit al terminar.
```

## Fase 5 — Objetos

```
Fase 5 de docs/PLAN.md: objetos (ver tabla de la sección 3). Todo original.

- Cajas de objetos en 2 filas del circuito; reaparecen a los pocos segundos.
- El servidor decide qué objeto toca, según la posición (los últimos, mejores objetos).
- Objetos: Nitro, Mancha de aceite, Cohete (persigue al de delante), Escudo (8 s).
- Los impactos los confirma el servidor y todos los móviles ven lo mismo.
- Icono del objeto en el HUD y botón OBJETO funcional.
- Todos los valores en tuning.ts y tests para el reparto de objetos.

Commit al terminar.
```

## Fase 6 — Despliegue

```
Fase 6 de docs/PLAN.md: publicarlo para jugar desde casa.

Compara brevemente las opciones de hosting del CLAUDE.md para mi caso (pocos amigos, coste mínimo,
servidor en Europa) y recomiéndame una para el cliente y otra para el servidor.
Prepara la configuración necesaria (variables de entorno, URL del servidor, Dockerfile si hace falta)
y dame los pasos que tengo que hacer yo en cada web, uno a uno.
Nunca me pidas que te pegue contraseñas ni claves: si hace falta alguna, dime dónde ponerla yo.
```

## Fase 7 — Personajes y coches

```
Fase 7 de docs/PLAN.md: los 5 personajes y los 10 coches de docs/CONTENIDO.md.
Primero dime el plan, sin escribir código.

- packages/shared/src/characters.ts y karts.ts como datos, con las estadísticas y clases de peso de CONTENIDO.md.
  La fórmula personaje + coche, en una función pura con tests (límites 1–5).
- Las estadísticas afectan a la simulación del kart (velocidad punta, aceleración, giro, empujes en choques)
  vía tuning.ts. El extra de Derrapín (carga de turbo +15 %).
- Modelos low-poly: coches a partir de packs CC0 (Kenney) modificados; personajes originales sencillos
  (CC0 de Quaternius o hechos con primitivas), sentados en el kart, con animación de celebrar y de golpe.
  Todo anotado en ASSETS.md.
- Pantalla de selección: personaje → coche (barras de estadísticas) → color. Se guarda la última elección.
- En el lobby se ve qué ha elegido cada amigo.
- Rendimiento: 8 karts en pantalla a ~60 fps en móvil (compartir geometrías y texturas, LOD si hace falta).

Commit al terminar.
```

## Fase 8 — Circuitos 2 a 10 (uno por sesión)

Repite este prompt cambiando el número, en orden del 2 al 10:

```
Fase 8 de docs/PLAN.md: crea el circuito número [N] de docs/CONTENIDO.md usando el sistema de circuitos de la Fase 3.

- Diseño ORIGINAL que respete el tema, la dificultad y la mecánica propia de la tabla.
  Si la mecánica necesita un módulo nuevo (p. ej. trenes que cruzan, hielo), hazlo reutilizable y con tests.
- Kit de tema con decoración low-poly CC0 (anotada en ASSETS.md).
- Cajas de objetos en 2–3 filas; salida para 8 karts.
- Comprueba: se puede completar sin atascos, ningún atajo se salta los checkpoints, ~60 fps en móvil.
- Dime el tiempo de una vuelta buena.

Commit al terminar.
```

Tras el circuito 10:

```
Fase 8, cierre: en el lobby el anfitrión elige circuito (con miniatura), "aleatorio" o una Copa
(Copa Sol = circuitos 1–5, Copa Luna = 6–10). Las copas suman puntos por carrera y terminan con un podio.
Puntos en tuning.ts. Commit al terminar.
```

## Fase 9 — Versión 1.0 (elige uno por sesión)

```
Fase 9: [ELIGE: sonido y música CC0 | partículas y efectos | minimapa | pantalla de podio | revisión de equilibrio de coches | optimización de carga y fps].
Lee CLAUDE.md, propón el plan antes de escribir código, y respeta que todo sea original y los assets CC0 anotados en ASSETS.md.
```

## Después de la 1.0

```
[ELIGE: bots | contrarreloj con fantasma | circuitos espejo | objeto nuevo X]. Propón el plan antes de escribir código.
```

---

## Prompts útiles en cualquier momento

- **Va lento:** `En mi [modelo de móvil] va a ~X fps en el circuito. Mide qué cuesta más y propón mejoras de mayor a menor impacto.`
- **Bug:** `Pasa esto: [qué haces] → [qué pasa] → [qué esperabas]. En [iPhone/Android/PC]. Encuentra la causa antes de cambiar nada.`
- **Sensación de conducción:** `El kart [gira demasiado / derrapa poco / se siente pesado]. Ajusta tuning.ts y explícame qué has tocado.`
- **Retomar otro día:** `Lee CLAUDE.md y docs/PLAN.md, mira git log y dime en qué punto estamos y qué toca.`
