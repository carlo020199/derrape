# Plan de implementación — circuito nuevo, objetos y cohete (Derrape)

Preparado el 27/11/2026 para Carlo. **Solo es un plan: no se ha tocado código ni ramas del repo** (`/workspace/derrape-hydrogen` y `derrape-release` solo se han leído).
Vista previa del trazado: [`LAYOUT_preview.png`](./LAYOUT_preview.png) (misma orientación que el boceto: meta a la izquierda, sentido horario).

> Nota de fuentes: las fotos del boceto son privadas para mí (no he podido abrirlas); trabajo con la transcripción confirmada por Carlo. Todo lo que es **interpretación mía** va marcado como *(lectura A)* o *(supuesto)* y está en las preguntas del final.

---

## 0. Lo importante en 10 líneas

1. **El cohete ya existe en el juego** (`items.ts`: Nitro, Aceite, **Cohete**, Escudo; teledirigido por carril, 45 m/s, 6 s de vida, trompo de 1,2 s, el escudo lo bloquea; el servidor es autoritativo con los objetos). No hay que inventarlo: hay que **rediseñarlo (esbelto y puntiagudo), darle contrajuego** (aviso, saltarlo, escudo, turbo) y **hacerlo funcionar bien en el circuito nuevo**.
2. El motor ya tiene lo básico: zonas por tramo y franja lateral (`boostPad`, `ramp` S/M/L con vuelo balístico real, `fall`), peralte y relieve. **Los turbos nuevos y las rampas-mueble son datos + dos funciones pequeñas**, no un motor nuevo.
3. Trazado propuesto: **1.884 m**, ancho 16 m, arcén 6 m, 9 tramos (A–I), calculado con la misma `smoothTrack`/`closestPoint` del juego. Un bot da una vuelta en **≈74 s**. Es ~30 % más largo que los otros circuitos (1.360–1.490 m): pregunta 3.
4. Hay una **trampa técnica**: la pista del juego es una sola línea con `closestPoint` global. Un circuito que se dobla sobre sí mismo (la Z/N del boceto) solo funciona si los tramos están lejos entre sí: mínimo **47 m** entre ejes en mi trazado (el muro más el arcén ocupan 28 m). Va como test.
5. **Los turbos no se apilan en multiplicador** (el motor ya funciona así: gana el mayor y la duración se alarga). Hay que **ordenar la escala de turbos** porque el port de Hydrogen sube el mini-turbo nivel 3 a ×1,52 (≈ azul ×1,5).
6. El **triturbo ×3** da 78 m/s: el servidor hoy marca como "salto sospechoso" todo lo que pase de 52 m/s, y con 20 Hz un kart a 78 m/s avanza 3,9 m entre mensajes y puede **atravesar una caja o aceite sin recogerlo**. Hay que subir el umbral y hacer colisión por segmento en el servidor (fase 2/4).
7. La "plataforma flotante" no puede ser un objeto lateral: **la altura del suelo del motor depende solo de la distancia en la pista**. Se resuelve como un tramo elevado de la propia pista con zonas `fall` a los lados (como ya hace la Laguna bajo el salto L1).
8. **Orden por valor/riesgo:** trazado → turbos de suelo → rampas-mueble → cohete v2 → raíl triturbo → gigantes y plataforma → pulido. Primer circuito jugable con turbos tras ~2 noches de Claude.
9. **Dependencia con el port de Hydrogen** (`hydrogen/fisicas`): toca `kart.ts` y `tuning.ts` (turbo por niveles). Las fases 2, 3 y 5 deben empezar **después** de que ese port esté en main (o rebasadas sobre él). Trazado (fase 1) y arte van en paralelo.
10. Total estimado: **7–9 noches de Claude** + ~18 peticiones de Hydrogen + 3 rondas de Dalí. Nada a main sin tu OK en cada PR.

---

## 1. Del boceto al trazado

### 1.1 Cómo leo el boceto
- **Recta de meta a la izquierda**, subiendo (norte), con la línea de salida hacia la mitad. Sentido **horario**.
- Arriba: curva ancha a la derecha (la "horquilla ancha"), luego **tres eses** bajando por la derecha.
- Desde abajo-derecha de las eses, una **diagonal larga hacia el suroeste** por dentro del bucle; una **horquilla interior** a la izquierda (el pliegue de la Z/N) y una **segunda diagonal hacia el este**, casi paralela a la primera.
- **Curva grande abajo a la derecha**, vuelta al oeste por el borde inferior, curva inferior izquierda y de nuevo la recta de meta.
- Bocetos grises de la esquina superior derecha = **variante B** (circuito 13B futuro; se ignora ahora).

### 1.2 Puntos de control propuestos
Notación del repo (`p(x, z, altura, peralte)`), con el plano dibujado como el boceto (X a la derecha) y escala **0,8**; el juego invierte X (su izquierda es +X), igual que `12-ribera-de-las-animas.ts`. **Convención de peralte: + = curva a la izquierda; mi circuito es horario, así que las curvas a derechas llevan peralte negativo** (la horquilla interior es la única a la izquierda).

```
0  p(-150,  -40, 0,    0)   META (distancia 0)         15 p( -96, -160, 0,  14)  horquilla interior
1  p(-150,   70, 0,    0)                              16 p(-104, -212, 0,  16)
2  p(-150,  165, 0.5, -4)                              17 p( -62, -248, 0,  12)
3  p(-120,  245, 1.5,-12)  esquina arriba-izq.         18 p(  10, -232, 0,   0)  2.ª diagonal
4  p( -50,  288, 2.5,-14)                              19 p(  95, -205, 0,   0)
5  p(  40,  296, 3,  -12)  curva ancha                 20 p( 170, -192, 0,  -8)
6  p( 125,  268, 3,  -12)                              21 p( 225, -225, 0, -18)  curva grande
7  p( 185,  215, 2.5, -8)                              22 p( 222, -285, 0, -18)
8  p( 208,  150, 2,  -12)  ese 1 (derecha)             23 p( 165, -322, 0, -10)
9  p( 166,   82, 1.5, 12)  ese 2 (izquierda)           24 p(  60, -330, 0,   0)  borde inferior
10 p( 204,   14, 1,   -8)  ese 3 (derecha)             25 p( -50, -326, 0,   0)
11 p( 175,  -30, 0.5,  0)                              26 p(-135, -304, 0,  -8)
12 p( 115,  -62, 0,    0)  diagonal larga              27 p(-170, -245, 0,  -4)
13 p(  30, -100, 0,    0)                              28 p(-158, -140, 0,   0)
14 p( -45, -135, 0,    0)
```
Parámetros: `width 16`, `verge 6`, `laps 3`, `theme: "animas"` (de momento), `itemRows` ver §2.8. Es un circuito **con relieve** (hay peralte y rampas con tamaño), así que usa la cámara de relieve que ya se usa en Laguna/Ribera; no se toca la cámara.

### 1.3 Métricas medidas con las funciones reales del juego
| Medida | Resultado | Límite / referencia |
|---|---|---|
| Longitud | **1.884 m** | otros: 1.357–1.492 m |
| Vuelta de bot (sin turbos) | **73,6 s** | ≈ 55–60 s en los demás (estimado: 1.400 m a ~25 m/s) |
| Velocidad mínima del bot | 16,6 m/s en las eses (m 683) | tope de agarre `GRIP` (μ 1,1) con peralte ±12° |
| Radio mínimo en planta | 21 m (eses) | con peralte llega a ≈19 m/s sin frenar |
| Separación mínima entre tramos no contiguos | **47 m** (m 1.002 ↔ 1.776) | muro+arcén = 28 m; exigir ≥ 38 m |
| Pendiente máx. / peralte máx. / ritmo de peralte | 1,6 % / 19,3° / 0,51 °/m | límites de `trackSmoothness`: 22 % / 30° / 1,5 °/m |

Notas de diseño que salen de aquí:
- **Peralte obligatorio en toda curva < 140 m de radio**: en pistas con relieve el motor frena el kart si la curva no cabe (`gripCap`). Sin peralte, una horquilla de 25 m limitaría a 16 m/s. El turbo no se recorta (ya es regla del motor).
- Las eses son **lentas a propósito** (16–21 m/s): ahí los turbos azules en franja premian la línea interior.
- Si Carlo prefiere vuelta de ~60 s: escala 0,65 y curvas más abiertas (menos Z). Sale con radios de ~14 m, que ya no caben: habría que quitar una ese. Por eso propongo 0,8 y vuelta de 74 s con **2 vueltas en pruebas y 3 en carrera**.

### 1.4 Tramos (distancias desde la meta)
| | Tramo | m | Carácter |
|---|---|---|---|
| A | Recta de meta (sube) | 1.740 → 233 | 377 m, la más larga: aquí va el raíl triturbo antes de meta |
| B | Curva ancha norte | 233 → 509 | derechas amplias, peralte −12/−14° |
| C | Eses | 509 → 738 | 3 apoyos, zona lenta y técnica |
| D | Diagonal 1 (SO) | 738 → 979 | recta de 190 m: salto gigante |
| E | Horquilla interior | 979 → 1.068 | izquierda cerrada, peralte +14/+16° |
| F | Diagonal 2 (ENE) | 1.068 → 1.199 | cadena de rampas |
| G | Curva grande SE | 1.199 → 1.419 | derecha larga (el interior es la zona **rosa** *(lectura A)*) |
| H | Recta inferior (oeste) | 1.419 → 1.600 | plataforma elevada |
| I | Curva inferior izq. | 1.600 → 1.740 | abanico de turbos hacia el raíl (zona **morada** *(lectura A)*) |

### 1.5 Vista previa
`LAYOUT_preview.png`: asfalto, arcén, meta, distancias cada 200 m, turbos, rampas, plataforma, cajas y las zonas rosa/morada **como yo las leo** (triángulo rosa dentro de la curva G; zona morada en el interior bajo la horquilla). Carlo debe compararlo con su boceto y corregir: es la forma más barata de equivocarse.

### 1.6 Qué se valida en tests (fase 1)
`tracks/13-*.test.ts` o ampliar `track.test.ts`: (a) separación mínima ≥ 38 m entre tramos no contiguos, (b) `measureSmoothness` dentro de límites, (c) vuelta de bot completa en 60–90 s sin respawn, (d) ningún tramo > 140 m de radio sin peralte con curvatura > 0, (e) todas las zonas dentro de su tramo y sin solaparse salvo las franjas dentro de las anchas.

---

## 2. Los objetos

### 2.1 Cómo se representan (cambio mínimo de datos)
Hoy `ZoneType = "slow" | "lowGrip" | "boostPad" | "fall" | "ramp"` y el kart tiene **una** superficie (`s.surface`). Propuesta:
- **Nuevos tipos de zona**: `"boostBlue"`, `"boostOrange"`, `"boostTri"` (cada uno es una superficie más; el paso de kart ya lee `s.surface`). `boostPad` (el actual) **no cambia**, para no tocar los otros 12 circuitos.
- `ZoneDef` gana `landBoost?: boolean` (solo las rampas-mueble lo activan; Laguna y Ribera quedan igual) y `RampSize` pasa a `"S"|"M"|"L"|"XL"`.
- Parámetros nuevos **solo** en `tuning.ts` (tabla `PADS`, `RAMP.XL`, `LANDING`), porque `CLAUDE.md` exige que todas las constantes vivan ahí.
- **Orden de zonas importa**: `surfaceAt` devuelve la primera que coincide. Regla: raíl primero, luego franjas, luego anchos.

### 2.2 Escala de turbos y si se apilan
`giveBoost(time, mult)` ya hace: **multiplicador = el mayor, duración = la mayor**. Propongo mantenerlo (no multiplicar entre sí) porque ×1,5 × ×1,75 = ×2,6 ya es casi el triturbo.

| Fuente | Mult. | Dur. | Notas |
|---|---|---|---|
| Mini-turbo N1/N2/N3 (port Hydrogen) | ×1,28 / 1,40 / 1,52 | 0,85 / 1,5 / 2,2 s | pendiente de merge |
| Salida con turbo | ×1,3 | 0,5–1,2 s | existe |
| Nitro (objeto) | ×1,3 | 1,5 s | **propuesta: ×1,6 / 1,2 s** (hoy queda por debajo de un azul) |
| Panel antiguo `boostPad` | ×1,3 (1,4 con el port) | 1 s | no se toca |
| Aterrizaje de rampa-mueble | ×1,5 | 0,5 s | del dibujo |
| **Turbo azul** | **×1,5** | ancho 1,5 s · franja 2,0 s *(supuesto)* | |
| **Turbo naranja** | **×1,75** | ancho 2,5 s · franja 3,0 s | "Boost 1 dura 2,5–3 s" |
| **Raíl triturbo** | **×3** | mientras estés encima + 0,8 s | 78 m/s (≈ 281 km/h en el HUD) |

Consecuencias que hay que decidir (pregunta 2): el N3 del port (×1,52) **empata con el azul**; con la regla "gana el mayor" pisar un azul con N3 solo alarga el tiempo. Recomiendo bajar el N3 a ×1,45 tras probar el port. El turbo azul ×1,5 → 39 m/s; naranja → 45,5 m/s.

Aceleración al subir: `boostAccel` 45 (55 en el port): de 26 a 45,5 m/s en ~0,4 s; a 78 m/s en ~1,2 s. Al terminar, el motor baja a la punta a `coastDrag·2` = 12 m/s²: tras un triturbo eso son **4,3 s y ~220 m de inercia**. Propongo un parámetro `triDecel` 20 m/s² para recortarlo a ~2,6 s. Como la recta A mide 377 m, cabe.

### 2.3 Turbos de suelo (azul / naranja, ancho / franja)
- **Física:** al pisar la zona, `giveBoost(s, tiempo, mult)` cada paso (igual que `boostPad`). La detección es la del motor: distancia de pista + **franja lateral del centro del kart**. Franja = 3 m de ancho (el kart mide 1,8 m): se entra sin precisión milimétrica.
- **Detección en curvas/peralte**: usa `lateral` del `closestPoint`, así que sigue la curva sin cambios.
- **Combinación con derrape**: pisar un turbo **no corta ni carga** el derrape; el mini-turbo al soltar compite con el mayor (regla 2.2).
- **Online:** nada que sincronizar: son datos de la pista que cargan cliente y servidor, y cada cliente simula su kart. Ya viaja `boosting` en `NetKartState`; opcional `pad?: 0|1|2|3` para colorear la llama de los rivales.
- **Colocación v0** (m, franja lateral; + = izquierda):
  - A: azul ancho 20–26 · naranja franja 70–78 [3,6]
  - B: azul franja 330–338 [1,4] · naranja ancho 470–478
  - C (eses): azul franja 538–544 [−5,−2] · 600–606 [2,5] · 664–670 [−5,−2] (línea interior; a afinar con la simulación)
  - D: naranja ancho 900–906
  - E: azul franja 1.010–1.016 [3,6] · naranja ancho 1.072–1.078
  - G (abanico): azul 1.230–1.238 [−6,−3] · 1.250–1.258 [−1,2] · 1.270–1.278 [3,6] · naranja franja 1.400–1.408 [−1,5 … 1,5]
  - I (abanico hacia el raíl): azul 1.625–1.633 [−6,−3] · 1.642–1.650 [3,6] · 1.670–1.678 [−3,0] · 1.700–1.708 [0,3] · naranja franja 1.735–1.745 [−1,5 … 1,5]
  - Total: 13 azules, 6 naranjas.

### 2.4 Rampas de muebles (S/M ×1, ×2 encadenadas, ×3 encadenadas)
- **Física:** las rampas con tamaño ya existen (`RAMP.S/M/L`: labio y largo; vuelo balístico con `g=14`; derrapando no se salta; mínimo 12 m/s). Se añade `landBoost`: al aterrizar **limpio** (cabeceo < 15° de la pista, ya calculado en `landKart`) → `giveBoost(0,5 s, ×1,5)`. El **truco** existente (deslizar arriba en el aire) alarga ese turbo hasta `RAMP[size].trick` (0,4 / 0,6 / 0,9 / 1,1 s) **a ×1,5** en vez de ×1,2.
- **Importante:** hoy `landKart` usa `KART.boostSpeedMult`, que el port de Hydrogen elimina (lo sustituye por `boostMult1/2/3`). Quien haga la fase 3 debe arreglarlo (el `typecheck` lo cazará).
- **Vuelo medido con la física real** (a 26 m/s en recta; sube con el turbo):

| Rampa | Labio × largo | Vuelo a 26 m/s | a 39 m/s | a 45,5 m/s |
|---|---|---|---|---|
| S | 0,6 × 4 m | 17 m · 0,68 s | 35 m | 47 m |
| M | 1,5 × 8 m | 24 m · 0,92 s | 46 m | 61 m |
| L (existente) | 3 × 12 m | 32 m · 1,25 s | 61 m | 80 m |
| XL (nueva) | 4,5 × 16 m | 38 m · 1,45 s | 70 m | 91 m |

- **Cadenas** (saltar, aterrizar, saltar): la segunda rampa debe empezar **después** del aterrizaje y su labio **después** de donde aterrizas, o se pierde. Simulado con `stepKartOnTrack` y el turbo de aterrizaje emulado (banda de diseño 22–34 m/s):
  - **S×2**: hueco labio→siguiente rampa 26 m. **S×3**: 26 m y 42 m (aterrizas a 13 m del siguiente; vuelos 17 → 32 → 32 m).
  - **M×2**: 32 m. **M×3**: 32 m y 48 m (vuelos 24 → 41 → 41 m).
  - Rampa a cada lado del ancho completo (−8…8) para que no se pueda esquivar.
  - **Tolerancia:** si aterrizas pasado el labio siguiente, no hay segundo salto. Si en pruebas resulta frustrante, regla de ayuda: el labio dispara si aterrizaste a < 6 m *después* de él ("labio generoso").
- **Colocación v0:** A: S×3 (130–134, 160–164, 206–210) · C: S sola (715–719) · F: M×2 (1.096–1.104, 1.136–1.144). Aterrizar con turbo ×1,5 al salir de las eses o al final de F es el premio.
- **Colisión:** las rampas **no son obstáculos** (se suben). Los muebles de adorno al lado no colisionan (solo muros).
- **Online:** nada nuevo; `NetKartState` ya trae `y` y `vy` para dibujar el vuelo de los rivales.
- **Bots:** `botInput` ya se centra antes de una rampa con tamaño; hay que **ampliar el aviso a las cadenas** (mantener carril 0 hasta el último labio) y que **elijan carril de turbo** en las zonas con franja (con 10–20 % de fallo, para que no sean perfectos).

### 2.5 Rampas gigantes y plataforma flotante
- **Rampa XL (la que "acaba en salto")**: tamaño nuevo en `RAMP`, mismo muro invisible alto que L (`tallWall`, hoy solo para `"L"`; extenderlo a XL con `tallSpan` 70 m) para que no se pueda atajar volando. Colocación: **D, 770–786** (labio en 786). Aterrizas entre 824 y 877 m; quedan 100 m de recta antes de la horquilla.
- **Plataforma con objetos encima**: tramo elevado **+3 m** en H (control points `y` entre 1.441 y 1.475 m: pendiente ≈ 9 %, bajo el límite 22 %), meseta 1.475–1.555 m con una fila de cajas de objetos, bajada 1.555–1.595. A los lados, zonas `fall` (|lateral| > 8,5 m) → reaparecer, como en la Laguna. Se **entra** con una rampa XL (1.425–1.441): con ella aterrizas en la meseta; sin saltar, subes la cuesta. Con turbo naranja (45,5 m/s) el vuelo llega a 91 m y **sigue dentro de la meseta**: no hay riesgo de pasarse. Es la zona **rosa** en mi lectura.
- **Riesgo (el mayor del plan):** aterrizajes sobre pista que sube/baja, caídas al `fall`, interacción con cámara de relieve y con el muro alto. Por eso va en la fase 6, con simulación automática de entradas a 20/26/39/45 m/s antes de jugar.
- **Lectura B (más ambiciosa, no incluida):** si el triángulo rosa es un **atajo** por dentro de la curva G, haría falta un salto de ~60–80 m que cruce el arcén (el progreso de carrera ya tolera saltos adelante < media vuelta). Se podría añadir tras la fase 6.

### 2.6 Raíl triturbo
- **Física:** zona `boostTri`, franja lateral **−1,0 … +1,0 m** (el kart mide ±0,9: "exactamente del ancho"), 50 m, en A entre **1.765 y 1.815** (antes de meta y de la parrilla, que ocupa −6…−46 m). Mientras estás encima: `giveBoost(1,0 s, ×3)` refrescado; al salir quedan 0,8 s. Máx. 78 m/s.
- **Es difícil de pillar**: con arrastre de dedo, 2 m de margen es poco. Para que sea jugable (y no un meme): **embudo** de flechas azules/naranjas en forma de V en I (las del abanico), que te dejan centrado. Parámetro `triHalfWidth` ajustable (1,0 → 1,4 si es demasiado duro).
- **Cabida:** tras el raíl hay 377 m de recta. A 78 m/s, el giro del motor (1,7 rad/s a esa velocidad) sigue siendo suficiente para la curva ancha B (R ≈ 110 m); `gripCap` frena a 30 m/s² si no cabe.
- **Cohete vs triturbo:** el cohete (45 m/s) **no alcanza** a un kart a ×3: es parte del contrajuego natural.
- **Cámara:** `speedRatio` ya se limita a 1,4 en el FOV; a ×3 se queda saturado y **no hay que tocar la cámara**.
- **Online:** subir `MAX_PLAUSIBLE_SPEED` (hoy `maxSpeed·2` = 52 m/s) a ~90 m/s, o el servidor ignorará el progreso del que usa el raíl. Y **colisión por segmento** en el servidor (ver 3.3).

### 2.7 Resumen de lo que cambia en el código (para estimar)
| Archivo | Cambio |
|---|---|
| `shared/tuning.ts` | `PADS`, `RAMP.XL`, `LANDING`, `triDecel`, cohete v2, `MAX_PLAUSIBLE` |
| `shared/track.ts` | tipos de zona, `RampSize` XL, `tallWallAt` para XL, `landBoost` en `landKart` |
| `shared/kart.ts` | leer las nuevas superficies en `stepKart` (tabla `PADS`) |
| `shared/tracks/types.ts`, `index.ts`, `13-*.ts` | `ZoneDef`, circuito nuevo y entrada en el selector (extra, fuera de copa) |
| `shared/items.ts` | cohete v2 (inmunidad en el aire, pérdida de objetivo, velocidad), colisión por segmento |
| `shared/bot.ts` | cadenas de rampas, carril de turbo |
| `server/raceLogic.ts` | umbral de velocidad, posición previa para el barrido, `target` del cohete en la instantánea |
| `client/render/*` | decals de turbo (instanciados), rampas/muebles, tema, minimapa, llamas por nivel |
| `client/audio/sfx.ts`, `ui/hud.ts` | sonidos, aviso de cohete fijado |

### 2.8 Visuales según la paleta de Dalí
Reglas del repo: solo los hex de Dalí, `MeshToonMaterial` con `gradientMap` de 3 escalones, modelos procedurales o GLB propios con color por vértice (`COLOR_0`), **contorno solo en pilotos y karts**, sombras blob, instanciado.
- **Turbos de suelo**: no van en Blender. Son **calcomanías planas instanciadas** (1 llamada de dibujo para todas) con textura de chevrones generada por código y desplazamiento de UV animado. Color por nivel, **el mismo que las chispas del derrape** (`PALETTE.turbo1/2/3`): azul = Espectro `#3FF2C8`, naranja = Llama `#FFB423`, morado = Ánima `#9B6BFF`. Así el jugador aprende un solo código de color. Flechas en Texto `#FFF7EA`. (Las "bandas azul y verde" del Boost 1 del dibujo: a decidir con Dalí.)
- **Rampas**: la **superficie** (cuña) es procedural y exacta a la física (labio y largo de `RAMP`), con color por vértice; sobre y alrededor, **piezas de mueble** modeladas (Blender): cajoneras, somieres, puertas, tableros, patas, tambores. Cada pieza ≤ 300 tris, bajo las mismas reglas del brief de Dalí (`BRIEF_DALI.md`: redondeado, vertex colors, normales suaves, base en el origen, instanciable).
- **Colores de los muebles que no están en la paleta.** Carlo habla de marrones, grises, óxido, verdes y naranjas rojizos; Dalí prohíbe el gris neutro y el negro puro. Propuesta para que Dalí decida:

| Lo que pide Carlo | Opción A (solo paleta) | Opción B (ampliar 3 tonos de "utilería", Dalí aprueba) |
|---|---|---|
| Madera clara | Hueso sombra `#C8B597` | igual |
| Madera oscura / marrón | **Marfil `#8C7B66`** (ya está en `PALETTE` del código, falta en el brief de Dalí) | igual |
| Gris (metal) | Niebla `#5B4E7A` / Sombra `#2E2547` (grises violáceos) | igual |
| Óxido | Ascua `#D9362B` degradado a Marfil | Óxido propuesto ≈ `#A8421F` |
| Verde (pátina, tapizado) | no hay verde: **Espectro `#3FF2C8` solo en sombra mezclada con Sombra** | Verdín propuesto ≈ `#2F6F62` |
| Naranja rojizo | Ascua `#D9362B` | igual |
  - **Regla anti-confusión:** los colores de acción son solo de los turbos (azul Espectro, naranja Llama/Brasa, morado Ánima). **Ningún mueble usa Llama, Brasa ni Espectro saturados en la superficie de la rampa**, para que nadie confunda una rampa naranja con un turbo naranja. Los "naranjas rojizos" van en Ascua.
  - Los hex de la opción B son **sugerencias mías**, no valores finales; los fija Dalí.
- **Tema**: de momento se reutiliza `animas` (noche, Ánima). Los muebles viejos sugieren un ambiente de trastero/desván/vertedero: pregunta 4.
- **Presupuesto**: regla de release v1 ≤ 90 llamadas y ≤ 110.000 triángulos (Laguna: 52 llamadas, 71.700). Un circuito 30 % más largo aporta más malla de pista; cada familia de props instanciada = 1 llamada; 8 modelos de mueble + decals ≈ +12 llamadas. Se mide con `npm run medir` en cada fase.
- **Cajas de objetos** (`itemRows`, 4 por fila): v0 → m 45, 290, 940, 1.300, 1.510 (sobre la plataforma), 1.700 = `[0.024, 0.154, 0.499, 0.690, 0.801, 0.902]`.

### 2.9 SFX y VFX
- **SFX** (`audio/sfx.ts`, ya existe un `sfx` sintetizado): chorro corto por nivel de turbo (tono sube con el nivel), crujido de madera al despegar, golpe sordo + chorro al aterrizar con turbo, zumbido que sube de tono en el raíl, pitido del aviso de cohete (cadencia creciente), lanzamiento/estela/explosión del cohete.
- **VFX**: llamas por nivel (`flames.ts` tiene modo `boost`; añadir color por tier con `PALETTE.turbo1..3`), líneas de velocidad en los bordes a partir de ×1,75 y para el triturbo (sprites, sin tocar cámara ni FOV), polvo en anillo al aterrizar, chispas moradas en el raíl, humo en la estela del cohete (`itemsView.flamePoints` ya existe).

---

## 3. Sistema de objetos y cohete

### 3.1 Qué hay hoy
| | Hoy |
|---|---|
| Objetos | Nitro, Aceite, **Cohete**, Escudo (`ITEM_TYPES`) |
| Cajas | filas de 4 a lo ancho (`createItemBoxes`), recoge a ≤ 2 m, reaparece en 3 s, ruleta de 1 s |
| Reparto | por posición: delante `{nitro 2, aceite 5, cohete 1, escudo 3}`, medio `{3,3,3,2}`, detrás `{5,1,4,1}` |
| Cohete | avanza por la pista a 45 m/s, 6 s de vida, se acerca al carril del objetivo (`rocketHoming` 5/s), se pega a él si lo adelanta, radio de impacto 2 m, trompo 1,2 s; "atrás" lo lanza hacia atrás sin objetivo |
| Escudo | bloquea 1 golpe, 8 s |
| Red | **el servidor manda**: cajas, qué toca, aceite y cohetes; los clientes mandan solo su posición (~20 Hz) |
| Dibujo | cono rojo de 1,4 m (`itemsView.ts`) |

### 3.2 Cohete v2 (primer objeto ofensivo, "caparazón rojo" esbelto)
**Diseño** (Dalí): silueta **esbelta y puntiaguda** (alargada, ojiva afilada, 3 aletas pequeñas), cuerpo Ascua `#D9362B`, banda Hueso `#F3E7D3`, llama Llama `#FFB423`; ≤ 250 tris, sin contorno (el contorno es solo de pilotos y karts). La punta puntiaguda es la lectura visual "esto me persigue".

**Comportamiento (cambios sobre lo que hay):**
1. **Velocidad adaptativa:** `max(45, 1,12·velocidad del objetivo)` con tope de 60 m/s: alcanza a un kart con naranja (45,5), **no** a uno con triturbo (78).
2. **Inmunidad en el aire:** un kart con `airborne` (vuelo de rampa) no recibe el golpe. Si el cohete llega al objetivo en el aire, **lo pierde (`target = null`) y sigue recto** por el carril (puede darle a otro). Hoy el cohete se "pegaría" debajo y golpearía al aterrizar: no habría contrajuego. El servidor sabe si vuela por `y` frente a la superficie (ya llega `y`).
3. **Aviso al objetivo:** `ItemsSnapshot.rockets` incluye `target`; el cliente que es objetivo muestra un triángulo rojo en el HUD y un pitido cuyo ritmo crece de 80 m a 0. Da **tiempo de reacción de ~1,5 s**.
4. **Salto del derrape (experimento, desactivado por defecto):** `ITEMS.hopDodge`. El salto del derrape dura 0,36 s en el port de Hydrogen; si es demasiado fácil de clavar, se queda apagado.
5. **Choque con muro:** no aplica (el cohete va por el espacio de la pista); su carril se limita al ancho del asfalto.
6. **Cohete hacia atrás** (deslizar abajo): sin objetivo, castiga al perseguidor directo.
7. **Impacto:** trompo 1,2 s (≈ 31 m perdidos ≈ 1,2 s), cancela turbos (ya lo hace `spinTime`), VFX de explosión y estela de humo.

**Contrajuego completo:** escudo (bloquea 1), saltar con rampa (inmunidad en el aire), superar su velocidad con turbo (naranja alcanzable, triturbo no), y el aviso para reaccionar. **El aceite no lo detiene** (se mantiene simple).

### 3.3 Balance y red
- **Reparto:** mantener hoy (cohete 1/3/4 por posición). Los de cola reciben más cohetes: remontada. Revisar tras probar con el circuito nuevo, donde las rampas hacen el cohete más esquivable.
- **Cajas en el circuito:** nunca en rampas ni en el raíl; una fila sobre la plataforma como premio por entrar con salto.
- **Colisión por segmento (servidor):** el servidor ve posiciones a 20 Hz. A 78 m/s son 3,9 m entre mensajes, más que el diámetro de una caja (4 m) o de un aceite (3,4 m): un kart con triturbo puede **atravesarlas**. Solución: guardar la posición anterior y comprobar la **distancia punto-segmento**. El modo solitario (60 Hz) no lo necesita.
- **Autoridad:** no cambia (cajas, golpes y objetos en servidor; física del kart en cliente). Los turbos y rampas son deterministas desde los datos de pista, sin sincronización extra.

---

## 4. Fases

Unidades: **noche = una noche de Claude Code** (límite semanal compartido con la tarea estética nocturna). Cada fase termina en PR pequeña a revisar por Carlo, con tests, `npm run build` y `npm run lint` en verde. Rama nueva desde main **después** del port de Hydrogen para las fases 2, 3, 5; la 1 y el arte no dependen de él.

| # | Fase | Qué se hace | Tú pruebas | Quién | Tamaño |
|---|---|---|---|---|---|
| 0 | Decisiones | Carlo responde las 5 preguntas; Dalí decide paleta de muebles; confirmar orden con el port de Hydrogen | revisar `LAYOUT_preview.png` | Proyectos, Carlo, Dalí | ½ noche |
| 1 | **Trazado** | circuito 13 (extra, fuera de copa), tests de §1.6, minimapa, 12 cajas v0, bots de relleno | elegirlo en el selector, dar 2 vueltas (74 s), ver si "es el de mi boceto" | Claude | 1 noche |
| 2 | **Turbos de suelo** | zonas azul/naranja ancho/franja, `PADS`, calcomanías instanciadas, color de llamas por nivel, servidor: umbral 90 m/s | vuelta completa pisando turbos; comparar con el mini-turbo | Claude (calcomanías y sfx: Hydrogen opcional) | 1 noche |
| 3 | **Rampas-mueble** | `landBoost`, cadenas S×2/S×3/M×2, bots con cadenas, cuña procedural, piezas placeholder | saltar la cadena de A y la de F; probar a no tocar y a hacer truco | Claude | 1–1½ noches |
| 4 | **Cohete v2 + items** | inmunidad en el aire, velocidad adaptativa, aviso HUD, colisión por segmento, nitro ×1,6 | 2 móviles en la misma sala: cohetearse, saltar, escudo | Claude + Hydrogen (HUD, sfx) | 1 noche |
| 5 | **Raíl triturbo + abanico** | zona `boostTri`, `triDecel`, abanico de I, embudo | clavar el raíl desde la curva I; ver si 2 m de margen es jugable | Claude | ½–1 noche |
| 6 | **Gigantes + plataforma** | `RAMP.XL`, `tallWall` XL, tramo elevado, `fall`, simulación de entradas a 4 velocidades | entrar a la plataforma con y sin salto; caer y reaparecer | Claude (riesgo alto) | 1½–2 noches |
| 7 | **Arte** | kit de muebles + cohete en Blender, GLB instanciados, tema | comparar con las previews y el brief de Dalí | Dalí (PASA/NO PASA), Hydrogen (Blender), Claude (integración) | 3–4 días de cupo de Hydrogen + 1 noche |
| 8 | **Pulido** | sfx y vfx completos, minimapa con turbos, medidas de rendimiento, reparto de cajas | partida de 8 en el móvil | Claude + Hydrogen (sfx) | 1 noche |

**Total Claude: 7–9 noches** (≈ 2 semanas por el límite semanal). **Primer circuito jugable con turbos: fin de la fase 2 (≈ 2 noches).**

Orden por valor/riesgo: 1 y 2 son baratas y cambian mucho lo que se siente; 3 y 4 reutilizan lo que el motor ya hace; 5 es pequeña pero depende del servidor (2); **6 es lo más arriesgado y va casi al final**; el arte (7) corre en paralelo desde la fase 0.

### 4.1 Reparto con Hydrogen (20 peticiones/día, 1 por tarea, sin modo agente)
Encaja lo que es **un archivo, autocontenido, con salida completa** (como `tarea.txt` del port): 
- Blender: ~12 piezas = **10–14 peticiones** (kit de muebles en 3 tandas: S/M, XL/plataforma, adornos; cohete; farol opcional); previews a Dalí.
- HUD del aviso de cohete (1), sonidos nuevos en `sfx.ts` (1–2), circuito 13 como archivo de datos (opcional, 1).
- **No** para `kart.ts`/`track.ts`/`items.ts`/`raceLogic.ts`: cambios cruzados con tests y varios archivos → Claude. Además tocarían lo mismo que su rama `hydrogen/fisicas`.
- **Lo prohibido de siempre en sus prompts**: no tocar cámara, no cambiar `KartInput` ni el arrastre de dedo, no subir `maxSpeed`.

### 4.2 Encaje con lo que ya corre
- **Noche (`release/v1`)**: no se toca. Estas fases entrarían en una rama aparte (`circuito/…` desde main) cuando Carlo apruebe y se libere cupo; la tarea estética sigue siendo prioritaria hasta el sábado 28/11 21:00.
- **Port de Hydrogen**: tras mergearlo hay que revisar `landKart` (`KART.boostSpeedMult`), `giveBoost` (niveles) y `boostPadMult` 1,4. Mi tabla de §2.2 parte de sus números.
- **Brief de Dalí / Blender**: los muebles y el cohete usan sus mismas reglas (vertex colors, `.glb`, base en el origen). Hay que **añadir Marfil `#8C7B66` a su lista** si se elige la opción A.
- **Cámara y arrastre del dedo**: intactos. El circuito usa la cámara de relieve que ya tiene la Laguna.

---

## 5. Riesgos
1. **Tramos del circuito demasiado cerca** (`closestPoint` global): test de separación ≥ 38 m en fase 1; saltos de rampa lejos de otros tramos.
2. **Conflicto con el port de Hydrogen** en `kart.ts`/`tuning.ts`/`track.ts`: secuenciar o rebasar; `typecheck` caza `boostSpeedMult`.
3. **Triturbo a 78 m/s**: umbral del servidor, barrido de colisiones, inercia (`triDecel`), muros.
4. **Plataforma y XL**: aterrizajes en pendiente, `fall`, interacción con cámara de relieve. Simulación antes de jugar.
5. **Rendimiento en iPhone**: +30 % de pista y +12 llamadas de dibujo; solo Carlo puede confirmar los fps reales.
6. **Confusión de colores** entre rampas naranja/rojizas y turbos naranja: regla anti-confusión de §2.8.
7. **Mini-turbo N3 (×1,52) ≈ azul (×1,5)**: el azul pierde sentido; bajar N3 a ×1,45 o subir el azul.
8. **Mirror X / signo del peralte**: error fácil; ya documentado (curvas a derecha = peralte negativo).

---

## 6. Preguntas para Carlo (máximo 5)
1. **Zona rosa y zona morada:** mi lectura es *rosa = rampa gigante con plataforma elevada, en el interior de la curva grande de abajo a la derecha* y *morada = raíl triturbo con abanico de turbos, abajo a la izquierda, antes de meta*. La alternativa es que sean **sectores** del circuito (tramos llenos de turbos y rampas) o que el triángulo rosa sea **un atajo** por dentro de la curva. ¿Cuál es?
2. **Turbos:** el naranja ×1,75 dura 2,5–3 s: ¿el **ancho** o el **estrecho** (yo pongo 2,5 s y 3 s)? ¿Cuánto dura el **azul** ×1,5 (yo: 1,5 y 2 s)? ¿Se **suman** a un mini-turbo en marcha o gana el mayor (yo: gana el mayor, no se multiplican)?
3. **Tamaño:** mi trazado mide **1.884 m (74 s por vuelta)**, más largo que los demás (~60 s) porque las eses y la horquilla no caben más pequeñas. ¿Lo dejo así con 3 vueltas, o prefieres menos vueltas / quitar una ese?
4. **Ambiente:** los muebles viejos de madera y metal, ¿en qué sitio están: **trastero, desván, vertedero…**? Decide si seguimos con la noche de las Ánimas o hacemos un tema nuevo para Dalí.
5. **Cohete:** ya existe en el juego como "Cohete" (teledirigido por el carril, lo bloquea el escudo). ¿Quieres **ese mismo, rediseñado esbelto y puntiagudo** con aviso y esquivable saltando una rampa, o **otro objeto además** (p. ej. doble cohete) para más adelante?

---

## 7. Apéndice: cómo se calculó
Herramientas en `herramientas/` (no son código del repo):
- `layout.mts`: construye el trazado con `buildTrackFromDef`/`smoothTrack`/`closestPoint`/`stepKartOnTrack` y `botInput` reales (importados en solo lectura de `/workspace/derrape-hydrogen`, main `87d28fd`); mide longitud, radios, separación, suavidad y vuelta de bot.
- `cadenas.mts`: vuelos y cadenas de rampas con la física real (turbo de aterrizaje emulado).
- `objetos.json` → `objetos_mundo.json` → `dibujar_plano.py` genera `LAYOUT_preview.png`.
- Reproducir: `ESC=0.8 OUT=l_0.8.json tsx layout.mts && python3 dibujar_plano.py`.
