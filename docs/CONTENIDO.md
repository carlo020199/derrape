# Derrape — Contenido de lanzamiento

Todo disponible desde el primer día (nada que desbloquear):
**10 circuitos de copa, 1 extra, 9 personajes y 12 coches.** Todo ORIGINAL (ver reglas en `CLAUDE.md`).

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

## Personajes (8)

Los cinco primeros son el elenco de siempre (mismo id y misma clase de peso). Los tres últimos usan esa misma fórmula: la clase solo mueve peso y aceleración, no hay estadísticas nuevas.

| # | Nombre | Quién es | Clase |
|---|---|---|---|
| 1 | **Lía Brasas** | Mecánica esqueleto, coleta de fuego espectral, llave de hueso y mono ciruela | Ligera |
| 2 | **Kiko Farolillo** | Robot-farol redondo, calavera en la pantalla y llama cian en la antena | Ligero |
| 3 | **Toni Repartumbas** | Repartidor esqueleto con gorra y mochila-ataúd térmica | Medio |
| 4 | **Tocho del Más Allá** | Bulldog fantasma con collar de pinchos romos y gafas de aviador | Medio |
| 5 | **Nonna Pina Calavera** | Abuela esqueleto con casco vintage, gafas redondas y bufanda de fuego | Pesada |
| 6 | **Brasa** | Calavera con melena de fuego y chaqueta de cuero | Medio |
| 7 | **Mimí Sábana** | Fantasmita de sábana con farol. Flota, sin piernas | Ligera |
| 8 | **Don Osario** | Esqueleto grandullón con sombrero de copa y pajarita | Pesado |

Proporción chibi (la cabeza ronda el 45 % de la figura sentada), calavera amable y contorno solo en el piloto. Celebrar estira la cabeza; enfadarse pone las pupilas en ascua.

## Coches (10)

| # | Nombre | Estilo | Vel | Acel | Man | Peso | Para quién |
|---|---|---|---|---|---|---|---|
| 1 | **Chispa** | Kart clásico de hueso y brasa | 3 | 3 | 3 | 3 | Equilibrado, el de empezar |
| 2 | **Bólido** | Ataúd redondeado y alargado | 5 | 2 | 2 | 3 | Rectas largas |
| 3 | **Pulga** | Calabaza de ruedas gordas | 2 | 5 | 4 | 1 | Circuitos técnicos |
| 4 | **Tanque** | Frontal de lápida y cuatro escapes | 3 | 2 | 2 | 5 | Empujar a los demás |
| 5 | **Centella** | Deportivo bajo con aletas de murciélago | 4 | 3 | 3 | 2 | Rápido y manejable |
| 6 | **Mosquito** | Patinete-escoba | 2 | 4 | 5 | 1 | Precisión |
| 7 | **Furgo** | Furgoneta de churros del más allá | 4 | 1 | 2 | 5 | Pesado y veloz |
| 8 | **Flecha** | Alerón en hoja de guadaña | 5 | 1 | 3 | 3 | Expertos |
| 9 | **Grillo** | Buggy con jaula de costillas | 2 | 4 | 3 | 3 | Salidas y remontadas |
| 10 | **Derrapín** | Traseras anchas y cuernecitos romos | 3 | 3 | 4 | 2 | **Extra:** el turbo de derrape carga un 15 % más rápido |
| 11 | **Hueso** | Kart blanco con morro de calavera, dos escapes y un hueso cruzado (Release 1: el de **Lía Brasas**) | 3 | 3 | 3 | 3 | Equilibrado; es el coche por defecto |
| 12 | **Medianoche** | Kart oscuro con laterales de hueso, banda brasa, faros redondos y turbo espectral (Release 1: el de **Calavera Chispas**) | 4 | 3 | 2 | 3 | Rectas rápidas |

Todos con color elegible, salvo Hueso y Medianoche, que llevan la paleta fija de Dalí. Los modelos son procedurales (primitivas de Three.js, sin assets externos).

## Pilotos
Cada piloto sugiere un coche (la pantalla «Piloto y coche» lo propone al elegirlo; se puede cambiar).

| Piloto | Clase | Aspecto | Coche |
|---|---|---|---|
| **Lía Brasas** (rediseñada) | Ligera | Calavera amable, ojos Llama con pupila Brasa, coleta alta Espectro con mechones que se balancean, diadema Ánima prof., sudadera Ciruela/Sombra | Hueso |
| **Calavera Chispas** (nuevo) | Media | Calavera grande sin pelo, cuencas vacías con destello Ánima, 5 dientes en bloque, costillas sobre torso Sombra, guantes Brasa | Medianoche |

Los otros siete pilotos siguen igual y siguen siendo elegibles.

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

### Extra (no entra en las copas)
| # | Circuito | Tema | Dificultad | Mecánica propia |
|---|---|---|---|---|
| 11 | **Laguna de las Ánimas** | Noche de difuntos junto a una laguna espectral | ★★★ | Peralte, cuestas y saltos S/M/L con vuelo real. Se abre directo con `?track=laguna-de-las-animas` |
| 12 | **Ribera de las Ánimas** | La misma laguna espectral, por la orilla | ★★ | Vuelta más llana y abierta: curvas peraltadas y tres saltos (S, M, L). 1.466 m, ~56 s por vuelta. `?track=ribera-de-las-animas` |
| 13 | **Desván de las Maravillas** | Muebles viejos en un mundo de fantasía (de momento con el tema `animas`) | ★★★ | Circuito largo (1.884 m, ≈74 s por vuelta sin turbos, ≈60 s de bot con ellos): eses, horquilla y curva grande. 13 turbos de suelo azules (×1,5) y 6 naranjas (×1,75), en ancho completo o franja estrecha. 6 rampas-mueble (cadena de 3 S, S sola, cadena de 2 M) que dan ×1,5 durante 0,5 s al aterrizar. Raíl triturbo ×3 de 2 m de ancho en la recta de meta. 2 rampas gigantes XL: una sube a una plataforma flotante de 80 m (+3 m, cajas encima, vacío a los lados: caer reaparece) y otra termina en un salto largo por la diagonal. Dos escapatorias de asfalto pintado decorativo (rosa y morada, con estrellas, setas, calaveritas y logos inventados) en los huecos interiores del sur, sin efecto de juego. `?track=desvan-de-las-maravillas` |

Cómo hacer 10 circuitos sin volverse loco:
- Cada circuito es **un archivo de datos** (`packages/shared/src/tracks/NN-nombre.ts`): puntos de la spline,
  ancho, cajas de objetos, salida, tema y mecánica. El asfalto, los bordillos y los muros se generan solos.
- Cada tema usa un **kit de piezas** reutilizable (edificios, árboles, rocas, vallas…) que decoran los bordes.
- Las mecánicas son "módulos" reutilizables: zona de bajo agarre, panel de turbo, rampa, obstáculo que se mueve, caída al vacío.
- Solo se descarga el circuito que se va a jugar (no los 10 a la vez), para que cargue rápido en móvil.
- Circuitos espejo como bonus futuro (gratis: invertir la spline).
