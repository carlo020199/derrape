# Físicas del one-shot en Derrape (rama `hydrogen/fisicas`)

Gemini **Hydrogen** (gemini-4-hydrogen, cuota gratuita) ha portado el derrape y el mini-turbo del one-shot de Gemini al juego real. El código lo ha escrito Hydrogen. El orquestador (Grok Bot) ha lanzado los tests, ha hecho tres arreglos mecánicos a mano (abajo) y ha integrado `main`. **No está en `main` ni hay PR**: lo decide Carlo.

Detalle completo escrito por Hydrogen: `docs/hydrogen/CAMBIOS_HYDROGEN.md`. Análisis del one-shot: `docs/hydrogen/FISICAS_oneshot.md`.

## Qué NO cambia
- **Cámara**: posición, distancia, altura y FOV iguales (la nuestra da más sensación de velocidad).
- **Control**: arrastrar el dedo, sin botones ni auto-acelerar. `KartInput` y `TOUCH` intactos.
- **Punta y aceleración**: `maxSpeed` 26 m/s, `accelLimit` 16,4 y `coastDrag` 6.
- Peralte, agarre, pendientes, hierba, rampas y las correcciones de suelo del PR #10 (los tests de suelo y de bots pasan).

## Qué cambia (viejo → nuevo)

| Constante | Antes | Ahora |
|---|---|---|
| Salto al derrapar `hopTime` / `hopHeight` | 0,22 s / 0,35 m | **0,36 s / 0,65 m** |
| Carga abriendo o en neutro `driftChargeSlow` | 120/s | **240/s** (cerrando sigue en 300/s) |
| Rapidez del contravolante `driftSteerRate` | 8 | **14** |
| Mini-turbo nivel I (azul) | ×1,20 · 0,62 s | **×1,28 · 0,85 s** |
| Mini-turbo nivel II (naranja) | ×1,20 · 1,67 s | **×1,40 · 1,50 s** |
| Mini-turbo nivel III (morado) | ×1,20 · 2,63 s | **×1,52 · 2,20 s** |
| Aceleración en turbo `boostAccel` | 45 | **55** m/s² |
| Panel de turbo clásico `boostPadMult` | ×1,3 | **×1,4** |
| Truco en rampa sin turbo de aterrizaje | ×1,2 | ×1,28 (usa `boostMult1`) |

Con la punta de 26 m/s, el mini-turbo sube a **33,3 / 36,4 / 39,5 m/s** según nivel.

Fórmulas:
- **Entrada inmediata**: si mantienes el derrape con lado (`driftSide` del gesto, o `|giro| > 0,15`) y vas a ≥ 10 m/s, el derrape empieza **en el mismo paso**, con el saltito aún en el aire (antes esperaba a aterrizar y pedía `|giro| > 0,3`). Mientras dura el salto o estás en el aire **no carga**: las rampas no regalan carga.
- **Empujón al soltar**: `velocidad = max(velocidad, punta + (mult − 1) · punta · 0,75)`, es decir 31,5 / 33,8 / 36,1 m/s al instante, y luego el turbo sigue empujando hasta ×mult.
- **Ángulo visual del kart**: `driftDir · (0,44 + dentro · 0,16)`, de 0,28 rad abriendo a 0,60 rad cerrando (antes fijo 0,45). Solo gira el chasis; la cámara no se toca.

## Cómo se mapea el arrastre
- Arrastrar a un lado = girar (90 px = giro máximo, zona muerta 6 %).
- Arrastrar lejos (≥ 60 %, unos 54 px) = saltito y derrape **ya**, hacia ese lado. El lado queda fijado hasta levantar el dedo.
- Con el dedo apoyado, moverlo hacia dentro o hacia fuera = contravolante: cerrar carga a 300/s y abrir a 240/s, y el zigzag da ×1,25.
- **Levantar el dedo = soltar el mini-turbo** del nivel alcanzado. Con el dedo levantado tampoco hay gas, así que hay que volver a apoyarlo.
- Deslizar arriba o abajo y tocar = lo mismo que antes (gas o freno, objeto).

## Tests
- `npx vitest run`: **258/258** en verde, contando ya los tests del circuito nuevo integrados desde `main`.
- `npm run lint` y `npm run build`: en verde.
- Tests nuevos de Hydrogen en `kart.test.ts`:
  - (a) el derrape arranca durante el saltito;
  - (b) no carga en el aire;
  - (c) `driftSide` del gesto arranca aunque el giro sea ~0;
  - (d) el nivel III da más velocidad y dura más que el I;
  - (e) empujón al soltar;
  - (f) el ángulo visual crece al cerrar y baja al abrir.
- Tests cambiados, solo por la afinación nueva:
  - «el derrape empieza al aterrizar» ahora es «arranca durante el hop»;
  - las referencias a `boostSpeedMult`, que ya no existe, ahora usan `boostMult1/2/3` en `kart.test.ts`, `race.test.ts`, `desvan.test.ts` y `rampasMueble.test.ts`. En estos dos últimos la expectativa no cambia: ×1,28 sigue por debajo del azul y del aterrizaje ×1,5.

## Humo en navegador (390×844, Laguna de las Ánimas, práctica)
`npx tsx scripts/humo-fisicas.ts http://localhost:5174 /workspace/derrape-hydrogen-capturas`
- **Cómo pilota**: el dedo apoyado da gas y el arrastre gira, en bucle cerrado con el piloto del bot. En las curvas hace un arrastre largo para derrapar y levanta el dedo para soltar.
- **Resultado** (14 s): 10 derrapes, 2 mini-turbos (hasta 33–36 m/s) y **0 errores de consola**. El kart nunca baja del suelo (y mínimo = 0).
- **Sin derrapar** (`SIN_DERRAPE=1`): 0/135 muestras fuera de la pista.
- **Derrapando**, el piloto automático (con 100 ms de retardo y derrapes a tope) se va a la hierba en ~1/4 de las muestras. Es el piloto, no el suelo, pero **el radio del derrape en la Laguna estrecha hay que probarlo con el dedo**.
- Capturas: `/workspace/derrape-hydrogen-capturas/humo-1.png` (derrapando), `humo-2.png` (mini-turbo) y `humo-3.png`.

## Choques con el turbo azul del circuito nuevo (Desván)
Regla de `giveBoost`: no se apilan, **gana el mayor multiplicador** y la duración más larga.

| Turbo | × | m/s |
|---|---|---|
| Mini-turbo I | 1,28 | 33,3 |
| Panel clásico | 1,40 | 36,4 |
| Mini-turbo II | 1,40 | 36,4 |
| **Turbo azul de suelo / aterrizaje en rampa-mueble** | **1,50** | **39,0** |
| **Mini-turbo III** | **1,52** | **39,5** |
| Turbo naranja de suelo | 1,75 | 45,5 |
| Raíl triturbo | 3,00 | 78,0 |

- **Choque principal**: el mini-turbo III (×1,52) supera por poco al azul (×1,5). Si sueltas un morado sobre un azul, el azul solo alarga el tiempo y no se nota. Además, un buen derrape vale lo mismo que el turbo azul, que es el premio del circuito.
- El mini-turbo II y el panel clásico ×1,4 quedan iguales entre sí.
- **Propuesta**, a elegir:
  - (A) bajar el nivel III a ×1,45 (37,7 m/s), por debajo del azul;
  - (B) subir el azul a ×1,6 y el naranja a ×1,8, como dice `docs/circuito-nuevo/FASE1_HECHO.md`.
  
  Lo más barato es la A.
- `boostAccel` 55 hace que la subida al azul o al naranja sea algo más rápida que con 45.

## Cómo probarlo (sin tocar `main`)
1. **En tu PC, recomendado**:
   - `git fetch && git switch hydrogen/fisicas` (o `git worktree add ../derrape-hydrogen hydrogen/fisicas`);
   - `npm ci`;
   - `npm run dev:host`;
   - en el móvil, en la misma wifi, abre `http://<IP-del-PC>:5173/?track=laguna-de-las-animas`.
   
   La práctica en solitario simula todo en el móvil (sin servidor de juego).
2. **Render, vista previa de PR (gratis para la web estática)**:
   - Carlo activa *Pull Request Previews → Manual* en el servicio `derrape` del panel de Render;
   - se abre un PR `hydrogen/fisicas → main` con `[render preview]` en el título, **sin fusionar**;
   - Render da una URL `*.onrender.com` propia y la borra al cerrar el PR.
   
   El modo online de esa vista previa seguiría usando el servidor de producción; para probar físicas basta la práctica.
3. Si no: fusionar a `main` con tu OK y revertir si no convence.

## Uso de Hydrogen
- **Noche (26→27/11)**:
  - Gemini CLI en modo agente: 1 fallo de red y 1 **429** (cuota diaria de 20 peticiones agotada).
  - 2 llamadas directas: 1 **503** y 1 **429**.
  - El modo agente gasta una petición por cada paso de herramienta, así que no cabe en 20/día. Por eso se cambió a **una sola petición grande** (`/workspace/hydrogen-fisicas/run_hydrogen.py`).
- **Mañana (27/11)**: **2 peticiones con éxito**.
  - Port completo: ~34k tokens de entrada, 19k de salida, 193 s.
  - Corrección: `track.ts` seguía usando `boostSpeedMult`, lo que daba NaN y 2 tests de bots en rojo. Se corrigió en 1 petición.
  - Antes de esas dos, 3 respuestas **503** (demanda alta), con esperas de 2,5–3 min.
- **Total**: 2 peticiones útiles, 2 × 429 y 4 × 503.

## Arreglado a mano por el orquestador
1. `raceSession.ts`: pasar `driftSteer` al ángulo visual. Hydrogen lo dejó opcional y sin pasar, así que se quedaba fijo en 0,44.
2. Al integrar `main` (circuito nuevo #14 y release #13), el conflicto en `track.ts` (`landKart`) se resolvió quedándose con la versión de `main` (LANDING) y cambiando `boostSpeedMult` por `boostMult1`. Igual en `desvan.test.ts` y `rampasMueble.test.ts`.
3. `scripts/humo-fisicas.ts`: el script del humo es del orquestador.

## Problemas conocidos
- El empujón al soltar usa la punta sin terreno: si sueltas en hierba sube igual a 31–36 m/s (los turbos ya ignoraban el terreno).
- Levantar el dedo para soltar el mini-turbo también quita el gas un instante.
- Falta probar con el dedo de verdad que el radio de derrape cabe en las curvas estrechas de la Laguna.
- Mini-turbo III frente al turbo azul: ver arriba.
