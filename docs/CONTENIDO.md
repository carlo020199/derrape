# Derrape — Contenido de lanzamiento

Todo disponible desde el primer día (nada que desbloquear):
**10 circuitos · 5 personajes · 10 coches.** Todo ORIGINAL (ver reglas en `CLAUDE.md`).

Los nombres son provisionales: cámbialos libremente.

---

## Cómo se combinan personaje y coche
- El **coche** da las estadísticas base: Velocidad, Aceleración, Manejo y Peso (escala 1–5, suman 12).
- El **personaje** da una clase de peso que las ajusta un poco:
  - Ligero: Peso −1, Aceleración +1
  - Medio: sin cambios
  - Pesado: Peso +1, Aceleración −1
  (siempre limitado a 1–5)
- **Peso:** el más pesado empuja más en los choques y pierde menos velocidad al recibir un golpe.
- Personajes repetidos permitidos en la misma carrera (con distinto color), porque puede haber hasta 8 jugadores.
- Todas las cifras viven en `packages/shared/src/tuning.ts`, `characters.ts` y `karts.ts`.

## Personajes (5)

| # | Nombre | Quién es | Clase |
|---|---|---|---|
| 1 | **Lia** | Mecánica joven, mono azul y llave inglesa a la espalda | Ligera |
| 2 | **Kiko** | Robot ayudante pequeño y redondo, con antena y una pantalla por cara | Ligero |
| 3 | **Toni** | Repartidor con gorra y mochila térmica; siempre tiene prisa | Medio |
| 4 | **Tocho** | Bulldog con gafas de aviador y bufanda | Medio |
| 5 | **Nonna Pina** | Abuela, ex piloto de rallies, con casco vintage y gafas de sol | Pesada |

Cada uno tiene un color principal, una animación de celebración y otra de enfado (al recibir un golpe), con estilo low-poly.

## Coches (10)

| # | Nombre | Estilo | Vel | Acel | Man | Peso | Para quién |
|---|---|---|---|---|---|---|---|
| 1 | **Chispa** | Kart clásico | 3 | 3 | 3 | 3 | Equilibrado, el de empezar |
| 2 | **Bólido** | Kart de carreras alargado | 5 | 2 | 2 | 3 | Rectas largas |
| 3 | **Pulga** | Mini kart de ruedas gordas | 2 | 5 | 4 | 1 | Circuitos técnicos |
| 4 | **Tanque** | Todoterreno cuadrado | 3 | 2 | 2 | 5 | Empujar a los demás |
| 5 | **Centella** | Deportivo bajo | 4 | 3 | 3 | 2 | Rápido y manejable |
| 6 | **Mosquito** | Kart-patinete muy ligero | 2 | 4 | 5 | 1 | Precisión |
| 7 | **Furgo** | Furgoneta de comida mini | 4 | 1 | 2 | 5 | Pesado y veloz |
| 8 | **Flecha** | Kart con alerón enorme | 5 | 1 | 3 | 3 | Expertos |
| 9 | **Grillo** | Buggy de playa | 2 | 4 | 3 | 3 | Salidas y remontadas |
| 10 | **Derrapín** | Kart bajo con ruedas traseras anchas | 3 | 3 | 4 | 2 | **Extra:** el turbo de derrape carga un 15 % más rápido |

Todos con color elegible. Base de modelos: packs CC0 de Kenney (coches y karts), modificados.

## Circuitos (10) en 2 copas

Cada circuito tiene **una mecánica propia** para que se sienta distinto. Vuelta de 50–75 s, 3 vueltas.

### Copa Sol (de fácil a media)
| # | Circuito | Tema | Dificultad | Mecánica propia |
|---|---|---|---|---|
| 1 | **Paseo del Puerto** | Ciudad mediterránea, barcos y faro | ★ | Curvas amplias para aprender a derrapar (circuito tutorial) |
| 2 | **Playa Dorada** | Paseo marítimo y dunas | ★ | Arena fuera de pista muy lenta; rampas en las dunas |
| 3 | **Mercado Central** | Calles estrechas entre puestos | ★★ | Chicanes cerradas; toldos que cortan la visión |
| 4 | **Viñedos** | Colinas y bodegas | ★★ | Subidas y bajadas; saltos en las crestas |
| 5 | **Feria Loca** | Parque de atracciones | ★★ | Curva peraltada gigante y paneles de turbo |

### Copa Luna (de media a difícil)
| # | Circuito | Tema | Dificultad | Mecánica propia |
|---|---|---|---|---|
| 6 | **Estación Vieja** | Estación y vías de tren | ★★ | Pasos a nivel con trenes que cruzan cada X segundos |
| 7 | **Pico Nevado** | Montaña nevada | ★★★ | Tramos de hielo con menos agarre |
| 8 | **Cañón Rojo** | Desierto y cañones | ★★★ | Puentes de madera estrechos y salto largo sobre el cañón |
| 9 | **Volcán Dormido** | Selva y lava | ★★★ | Atajo arriesgado junto a la lava (caer = respawn) |
| 10 | **Ciudad Neón** | Ciudad de noche con rascacielos | ★★★ | Túneles, rampas entre azoteas y luces de neón |

Cómo hacer 10 circuitos sin volverse loco:
- Cada circuito es **un archivo de datos** (`packages/shared/src/tracks/NN-nombre.ts`): puntos de la spline,
  ancho, cajas de objetos, salida, tema y mecánica. El asfalto, los bordillos y los muros se generan solos.
- Cada tema usa un **kit de piezas** reutilizable (edificios, árboles, rocas, vallas…) que decoran los bordes.
- Las mecánicas son "módulos" reutilizables: zona de bajo agarre, panel de turbo, rampa, obstáculo que se mueve, caída al vacío.
- Solo se descarga el circuito que se va a jugar (no los 10 a la vez), para que cargue rápido en móvil.
- Circuitos espejo como bonus futuro (gratis: invertir la spline).
