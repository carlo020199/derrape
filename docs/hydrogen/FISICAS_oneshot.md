# Modelo de físicas y derrape del one-shot de Gemini

Fuente: `/workspace/oneshot-gemini/derrape_oneshot.html` (HTML autocontenido, ~110 KB, Three.js r128).
Función central: `stepKartPhysics(kart, dt)` (líneas 1861–2075).
Bucle: `animate()` (2552–2604) con acumulador a paso fijo `FIXED_DT = 1/60`.

Este documento extrae fórmulas y constantes exactas, las compara con el juego real
(`packages/shared/src/kart.ts`, `packages/shared/src/tuning.ts`) y propone cómo
portar la sensación **sin cambiar el control de arrastre** del juego real.

---

## 1. Qué tipo de modelo es (y qué no es)

El one-shot es una simulación **arcade unidimensional**, igual que el juego real:

- Una sola velocidad escalar `kart.speed` a lo largo del rumbo `kart.heading`.
- La posición se integra así (idéntico al real):

```js
const forwardX = Math.sin(kart.heading);
const forwardZ = Math.cos(kart.heading);
kart.pos.x += forwardX * kart.speed * dt;
kart.pos.z += forwardZ * kart.speed * dt;
```

- El campo `lateralSpeed` se inicializa a `0` en `setupRacers()` (línea 1643) y **nunca se usa**.
  No hay vector de velocidad lateral, ni µ de agarre, ni deslizamiento físico.
- El «deslizamiento» que se ve es **solo visual**: `visualSlipAngle` gira el chasis, el piloto
  y un poco la cámara, pero el kart sigue yendo por `heading`.
- **No hay peralte, pendiente, superficies (hierba/hielo) ni tope de agarre (`gripCap`)**.
  El circuito del one-shot es una cinta de 24 m de ancho (`TRACK_WIDTH = 24`, `HALF_TRACK = 12`)
  proyectada al sample más cercano, con un muro suave.

Conclusión: la sensación distinta no viene de un modelo físico más rico, sino de
**números más agresivos**, **entrada de derrape inmediata**, **mini-turbo mucho más
premiado** y **feedback visual** (ángulo, hop, FOV, viñeta, barra, banners).

---

## 2. Constantes globales

| Símbolo | One-shot | Juego real (`tuning.ts`) |
|---|---|---|
| Paso fijo | `FIXED_DT = 1/60` | `PHYSICS_DT = 1/60` |
| Vueltas | `TOTAL_LAPS = 3` | `RACE.laps = 3` |
| Ancho de pista | `TRACK_WIDTH = 24` m | Laguna real es más estrecha (calzada ~10–12 m; no comparable 1:1) |
| Samples de pista | `TRACK_SAMPLES = 400` | Polyline propia del circuito |

---

## 3. Aceleración, freno, inercia (costa) y punta

### One-shot (`stepKartPhysics`)

Punta base del jugador: `baseMaxSpeed = 44.0` m/s (el HUD la pinta como `speed * 3.4` km/h → ~150 km/h).
La IA usa `baseMaxSpeed * aiSkill + rubberBand`, con `aiSkill = 0.95 + idx*0.018` y
`rubberBand = clamp(progressGap * 8.5, -2.5, 3.2)`.

Aceleración constante (no hay dos fases):

```js
let currentMaxSpeed = baseMaxSpeed; // 44
let accelForce = 34.0;
if (kart.boostTimer > 0) {
  kart.boostTimer -= dt;
  currentMaxSpeed += kart.boostPower;  // aditivo, no multiplicativo
  accelForce += 28.0;
}
if (ctrl.throttle > 0) {
  kart.speed += accelForce * ctrl.throttle * dt;
} else if (ctrl.brake > 0) {
  if (kart.speed > 1.5) kart.speed -= 48.0 * ctrl.brake * dt;
  else kart.speed -= 20.0 * ctrl.brake * dt;          // reversa
} else {
  kart.speed *= Math.pow(0.28, dt);                   // costa exponencial
}
const reverseLimit = -14.0;
if (kart.speed > currentMaxSpeed) {
  kart.speed = THREE.MathUtils.lerp(kart.speed, currentMaxSpeed, 6 * dt);
} else if (kart.speed < reverseLimit) {
  kart.speed = reverseLimit;
}
```

Traducción de la costa: `0.28^(1/60) ≈ 0,979` por fotograma, o
`dv/dt = ln(0.28)·v ≈ −1,273·v`. A 26 m/s frena ~33 m/s²; a 44 m/s, ~56 m/s².
En 1 s la velocidad se queda en el 28 %. Es una inercia **muy baja** al soltar el acelerador.

Tiempo a punta sin turbo: 44 / 34 ≈ **1,29 s** (y llega lineal, no se suaviza hasta el tope).

### Juego real (`stepKart` + `KART`)

```
maxSpeed        = 26 m/s     (HUD: speed * 3.6 → ~94 km/h)
accelLimit      = 16.4 m/s²  (tope al arrancar)
accelRelative   = 1.2 /s     (cerca de la punta: 1.2 * lo que falta)
brake           = 30 m/s²
maxReverse      = 8 m/s
reverseAccel    = 10 m/s²
coastDrag       = 6 m/s²     (lineal, no exponencial)
```

Fórmula de aceleración con gas (si `speed < topSpeed`):

```
gain = min(accelLimit, accelRelative * (topSpeed - speed)) * (icy ? 0.6 : 1)
speed = min(topSpeed, speed + gain * dt)
```

Llega al ~95 % de la punta en ~2,7 s. El turbo usa `approach(speed, maxSpeed*boostMult, boostAccel*dt)`
con `boostAccel = 45` y `boostMult = 1.2` (solo +20 % → 31,2 m/s).

En hierba/lento la punta se recorta (`offroadSpeedMult = 0.45`, `slowSpeedMult = 0.35`).
En cuesta: `speed += clamp(−k·gGame·grade, ±maxAccel) * dt`.
Si `gripCap > 0` y no hay turbo, no se puede superar ese tope (hay que soltar en curva sin peralte).

### Diferencia que se nota

| | One-shot | Real |
|---|---|---|
| Punta | 44 m/s (~150 km/h) | 26 m/s (~94 km/h) |
| Arranque | 34 m/s² constantes | 16,4 m/s², luego se suaviza |
| Costa al soltar | Pierde el 72 % en 1 s | 6 m/s² (~4 s de 26 a 0) |
| Freno | 48 m/s² | 30 m/s² |
| Reversa | −14 m/s, 20 m/s² | −8 m/s, 10 m/s² |
| Traspasada la punta | lerp con k=6/s | `approach` con coast*2 o roughDecel |

El one-shot se siente más «go-kart»: pega al acelerar y se planta al soltar.
El real es más inercial y más cercano a la referencia MK.

---

## 4. Giro normal (fuera de derrape)

### One-shot

```js
const speedFactor = THREE.MathUtils.clamp(Math.abs(kart.speed) / 14, 0, 1);
const reverseSign = kart.speed >= -0.2 ? 1 : -1;
const turnRate = 2.05 * speedFactor * reverseSign;
kart.heading += ctrl.steer * turnRate * dt;
kart.visualSlipAngle = lerp(visualSlipAngle, ctrl.steer * 0.1, 10 * dt);
```

A partir de 14 m/s el giro es **máximo y no cae** (2,05 rad/s ≈ 117 °/s) hasta la punta (44 m/s).

### Juego real

```
low  = min(1, |speed| / turnFullSpeed)     // turnFullSpeed = 8
high = 1 - (1 - turnAtTopSpeed) * min(1, |speed| / maxSpeed)  // turnAtTopSpeed = 0.85
turn = -steer * turnRate * low * high * sign(speed)           // turnRate = 2.0
```

A punta solo queda el 85 % del giro (1,70 rad/s). En peralte, si el giro va hacia el lado alto:

```
turn *= 1 + BANK.turnBonus * sin(|bank|°)    // turnBonus = 0.35
```

En el aire, `turn *= RAMP.airTurn` (0,3). En hielo, `× 0.55`.

### Diferencia que se nota

El one-shot **sigue siendo ágil a alta velocidad**; el real se cierra un poco al llegar a punta
(y además el `gripCap` te obliga a soltar en curvas sin peralte suficiente). Por eso el one-shot
puede «llevarse» una curva a fondo con más facilidad, aunque su pista no tenga peralte.

---

## 5. Salto (hop) al pedir derrape

### One-shot

Se dispara al flanco de subida (`ctrl.driftPressed` / `inputState.driftJustPressed`),
si `isGrounded` y `speed > 12`:

```js
kart.hopVel = 6.4;
kart.isGrounded = false;
if (kart.isPlayer) sound.playHop();
```

Integración vertical (gravedad 26 m/s²):

```js
if (!kart.isGrounded || kart.hopVel > 0) {
  kart.heightOffset += kart.hopVel * dt;
  kart.hopVel -= 26.0 * dt;
  if (kart.heightOffset <= 0) {
    kart.heightOffset = 0;
    kart.hopVel = 0;
    kart.isGrounded = true;
  }
}
kart.pos.y = sample.pos.y + kart.heightOffset;
```

Valores: t_subida = 6,4/26 ≈ **0,25 s**; t_total ≈ **0,49 s**; altura máx = v²/2g ≈ **0,79 m**.

El derrape **no espera al aterrizaje**. Si en el mismo paso (o mientras está en el aire)
se cumple `driftHold && |steer| > 0.15 && speed > 18`, el derrape empieza ya.
`isGrounded` solo bloquea el hop, no el inicio del derrape.

### Juego real

```
hopTime = 0.22 s, hopHeight = 0.35 m
altura visual = 4 * h * u * (1-u)     // parábola, u = tiempo transcurrido / total
```

Pulsar derrape (`pressed && hopTime==0 && speed>0 && !airborne`) solo lanza el hop.
**Al aterrizar** (`hopTime` llega a 0):

```
side = input.driftSide || (|steer| > 0.3 ? steer : 0)
si input.drift && side !== 0 && speed >= driftMinSpeed (10):
    driftDir = side < 0 ? 1 : -1
```

Si no hay giro (ni `driftSide` del gesto), el hop es solo un salto y no arranca el derrape.
En el aire no se carga mini-turbo.

### Diferencia que se nota

En el one-shot el derrape es **inmediato** si ya ibas girando: saltas y ya estás de lado.
En el real hay **0,22 s de espera** y hace falta `|steer| > 0,3` (o el `driftSide` del
arrastre) al aterrizar. Esa latencia es la que más «enfría» la acción de derrape.

El hop del one-shot también es más alto (0,79 m vs 0,35 m) y dura el doble: se lee mejor.

---

## 6. Entrada, mantenimiento y salida del derrape

### Entrada (one-shot)

```js
if (!kart.isDrifting && ctrl.driftHold && Math.abs(ctrl.steer) > 0.15 && kart.speed > 18) {
  kart.isDrifting = true;
  kart.driftDir = Math.sign(ctrl.steer);
  kart.driftCharge = 0;
  kart.driftTier = 0;
}
```

- Umbral de giro: **0,15** (el real usa 0,3 al aterrizar, o `driftSide` del gesto).
- Velocidad mínima: **18 m/s** (el real: 10 m/s). En la práctica el one-shot llega antes a 18
  porque acelera a 34 m/s² (en 0,53 s); el real tarda ~0,6 s en llegar a 10, pero el hop retrasa el inicio.

### Mientras derrapa (one-shot): giro, «slip» visual y carga

```js
const inwardSteer = ctrl.steer * kart.driftDir; // +1 cierra, -1 abre (contravolante)
const driftTurnRate = (1.65 + inwardSteer * 0.72) * kart.driftDir;
kart.heading += driftTurnRate * dt;

const targetSlip = kart.driftDir * (0.44 + inwardSteer * 0.16);
kart.visualSlipAngle = lerp(visualSlipAngle, targetSlip, 10 * dt);

const chargeRate = 1.0 + Math.max(0, inwardSteer) * 0.42;
kart.driftCharge += chargeRate * dt;

if (kart.driftCharge >= 2.95) kart.driftTier = 3;
else if (kart.driftCharge >= 1.8) kart.driftTier = 2;
else if (kart.driftCharge >= 0.8) kart.driftTier = 1;
```

Giro derrapando: de **0,93** rad/s (abriendo del todo) a **2,37** rad/s (cerrando del todo).
En neutro: 1,65 rad/s. El input se aplica **al instante** (no hay `driftSteer` suavizado).

Ángulo visual: 0,44–0,60 rad (25°–34°). El chasis se pinta con
`root.rotation.y = heading + visualSlipAngle`, el cuerpo rueda `−slip*0,32` y el piloto `×1,4`.
La cámara usa `heading + visualSlipAngle*0,32`.

Carga (segundos, rate 1,0 en neutro o abriendo; 1,42 cerrando del todo):

| Nivel | Umbral | Neutro/abriendo | Cerrando (rate 1,42) |
|---|---|---|---|
| I Mini | 0,80 | 0,80 s | 0,56 s |
| II Súper | 1,80 | 1,80 s | 1,27 s |
| III Ultra | 2,95 | 2,95 s | 2,08 s |

**Abrir el derrape no penaliza la carga** (el rate nunca baja de 1,0).

### Salida (one-shot)

Sale si `!ctrl.driftHold` o `speed < 13`. Al soltar, si `driftTier > 0`, dispara el mini-turbo
(ver §7) y pone a cero `isDrifting`, `driftDir`, `driftCharge`, `driftTier`.

No cancela el derrape al rozar el muro (el muro solo hace `speed *= 0.96`).

### Juego real (equivalentes)

```
driftTurnBase  = 2.0
driftTurnClose = 1.1
driftTurnOpen  = 1.1
driftSteerRate = 8          // ~0,25 s de lado a lado (suavizado)
turn = driftDir * (base + (inside>=0 ? close : open) * inside)
// rango: 0.90 … 3.10 rad/s

driftChargeFast = 300 /s    // si inside >= 0.4
driftChargeSlow = 120 /s    // neutro o abriendo  (2,5× más lento)
driftLevel1/2/3 = 270 / 570 / 870
// cerrando: 0,90 / 1,90 / 2,90 s
// abriendo: 2,25 / 4,75 / 7,25 s

+ zigzag (alternar cierra/abre ≥0,6): ×1,25 durante 0,5 s
+ peralte |bank|≥25°: × BANK.driftCharge (1,15)
+ no carga en el aire
+ driftVisualAngle = 0,45 rad (fijo, no varía con el contravolante)
```

Salida: `!input.drift || speed < driftMinSpeed*0.6` (6 m/s). El turbo se entrega si
`speed >= 6` (`endDrift(..., withBoost)`). Un choque de frente (`frontal > 0.5`) corta
el derrape **sin** turbo (`bounceKart`).

### Diferencia que se nota

1. Entrada inmediata vs hop + umbral 0,3.
2. Carga generosa al abrir (1,0× vs 0,4×). En el real, si el arrastre no va bien hacia
   dentro, el nivel 3 cuesta más de 7 s y parece que «no carga».
3. Contravolante instantáneo vs suavizado 0,25 s.
4. Slip visual más vivo (varía con el giro, rueda el cuerpo, empuja la cámara).
5. El real ya tiene un giro derrapando incluso más cerrado (hasta 3,10 vs 2,37).
   El problema no es «que no gire», es que **cuesta más arrancarlo y premiarlo**.

---

## 7. Mini-turbo y paneles de impulso

### One-shot, al soltar el derrape

```js
const tierBoosts = [
  null,
  { power: 13.5, duration: 0.85, label: '¡MINI-TURBO!',  color: '#00f5d4' },
  { power: 18.5, duration: 1.35, label: '¡SÚPER TURBO!', color: '#ffbe0b' },
  { power: 24.5, duration: 1.95, label: '¡ULTRA TURBO!', color: '#e040fb' }
];
kart.boostPower = b.power;
kart.boostTimer = b.duration;
kart.boostTier  = kart.driftTier;
kart.speed = Math.max(kart.speed, baseMaxSpeed + b.power * 0.75); // empujón inmediato
```

Durante el turbo: `currentMaxSpeed = 44 + power` y `accelForce = 34+28 = 62`.

| Nivel | Potencia añadida | Punta | Empujón inicial | Duración |
|---|---|---|---|---|
| I | +13,5 m/s | 57,5 m/s (~195 km/h) | 44+10,1 = 54,1 | 0,85 s |
| II | +18,5 m/s | 62,5 m/s (~213 km/h) | 44+13,9 = 57,9 | 1,35 s |
| III | +24,5 m/s | 68,5 m/s (~233 km/h) | 44+18,4 = 62,4 | 1,95 s |

Hay un **salto instantáneo de velocidad** al soltar (no espera a acelerar hasta la nueva punta).

Paneles: si `distance² < radius²` y el turbo actual es débil (`boostTimer < 0,9 || boostPower < 19`):

```
boostPower = 19.5; boostTimer = 1.25; boostTier = max(tier, 2);
speed = max(speed, baseMaxSpeed + 16);   // 60 m/s de golpe
banner «¡IMPULSO ESPECTRAL!»
```

Feedback: `showBanner`, viñeta `#boost-vignette`, FOV `68 + boostTier*3.2`, llamas de color
cian/ámbar/magenta, chispas 3D según nivel, sonido `playBoost` / `playTierUp`.

### Juego real

```
boostTime1/2/3  = 0.62 / 1.67 / 2.63 s
boostSpeedMult  = 1.2          // igual en los 3 niveles
boostAccel      = 45 m/s²      // approach hasta 31,2 m/s (26*1.2)
boostPadTime    = 1 s
boostPadMult    = 1.3          // 33,8 m/s
```

Los tres niveles **solo cambian la duración**, no la punta. No hay empujón instantáneo:
hay que acelerar 45 m/s² desde ~26 hasta 31,2 (~0,12 s, poco, pero el delta es solo +5,2 m/s).

### Diferencia que se nota (la más grande del manejo)

El mini-turbo del one-shot **cambia la carrera**: +31 % / +42 % / +56 % de punta y un
golpe de velocidad al soltar. El del real es un +20 % igual en los tres niveles, más
largo en II/III, pero mucho menos espectacular. Si el derrape del one-shot «ya se parece
a lo que quiere Carlo», el premio al soltarlo es la pieza que más falta en el real.

---

## 8. Agarre, deslizamiento lateral y peralte

### One-shot

- **Agarre:** no modelado. No hay `gripCap`, ni µ, ni recorte de punta en curva.
- **Deslizamiento lateral físico:** no existe (`lateralSpeed` muerto). El kart no se va al
  exterior de la curva por inercia; solo gira el heading y avanza.
- **Peralte:** no existe. La pista se proyecta al sample más cercano y se pega `pos.y`.
- **Contención:** si `|lateral| > HALF_TRACK - 1.05` (10,95 m), se corrige la posición y
  `speed *= 0.96` (rozamiento suave, sin rebote ni cambio de rumbo).
- **Resbalar parado en peralte:** no aplica.

### Juego real (no tocar al portar)

Estas reglas son del relieve de Laguna y **hay que conservarlas**; el one-shot no las tiene
porque su pista es plana:

- `GRIP.mu = 1.1`, `g = 9.81`: `gripCap` recorta la punta en curva sin peralte suficiente.
- `BANK.turnBonus = 0.35`: giro extra hacia el lado alto.
- `BANK.slideSpeed = 8`, `slide = 0.5`: parado, resbala al borde bajo
  (`push = gGame * sin(bank°) * slide * dt` en el eje perpendicular al rumbo).
- `BANK.driftFrom = 25°`, `driftCharge = 1.15`.
- `bounceKart`: rebote con mezcla wallScrapeKeep 0,97 / wallBounceKeep 0,45;
  muro exterior de peralte frena la mitad; choque frontal corta el derrape sin turbo.

Portar el «feel» del one-shot no debe desactivar esto: el circuito real se diseñó con peralte
y tope de agarre. El kart debe seguir notando la inclinación de las Ánimas.

---

## 9. Colisiones entre karts

One-shot (`resolveKartCollisions`): radio efectivo 2,45 m, empuje `overlap * 0,52` a partes
iguales, y `speed = lerp(speed, avgSpeed, 0.25)` en los dos.

Real (`collideKarts`): radio `KART.radius * 2 = 1,8 m`, `bumpPush = 0,25`, el más ligero
se aparta más (`mass` 1–5), y solo frena quien embiste de frente (`bumpSpeedKeep = 0.75`).

No es lo que hace especial al one-shot; no hace falta portarlo.

---

## 10. Cámara ligada al derrape (no es física, sí es sensación)

`updateChaseCamera` (2215–2269):

- En carrera: `distBehind = 8.4`, `heightAbove = 3.9`, look-ahead 6,5 m a altura +1,55.
- Rumbo de cámara: `heading + visualSlipAngle * 0.32` (se va un poco al interior del derrape).
- Seguimiento: `lerp(pos, 1 - exp(-11*dt))`, look `exp(-15*dt)` — más nerviosa que el real
  (`CAMERA.follow = 6`).
- FOV: `60 + speed*0.11` (a 44 m/s ≈ 65°); en turbo `68 + boostTier*3.2` (hasta 77,6°).
- Viñeta `#boost-vignette` a opacity 1 durante el turbo.

Real (relieve, retrato): distancia 7,8 / altura 4,4 / look-ahead 10, FOV base 62 + extra,
`fastFov = 76`, alabeo de peralte limitado a 8°. Ya es una buena cámara; lo que se puede
tomar es el **offset por slip** y un FOV un poco más pronunciado en el turbo de nivel 3.

---

## 11. Controles: no portar los botones táctiles

El one-shot tiene botones `#touch-left/right/brake/drift` y `setAutoAccel(true)` si
`innerWidth < 820`. **No se proponen para el juego real.**

Carlo prefiere el esquema actual (`TOUCH` en `tuning.ts` + `apps/client/src/input/touch.ts`
y `gestures.ts`):

- Arrastrar a los lados = giro (`steerRange = 90°`, zona muerta).
- Arrastrar lejos (`driftTrigger = 0.6`) = salto + derrape.
- Soltar = dispara el mini-turbo (ya está).
- Deslizar ↑ / ↓ = acelerar / frenar o reversa.
- Tocar = objeto.

Cualquier cambio de físicas debe seguir leyendo el mismo `KartInput { steer, throttle, brake, drift, driftSide }`.
El `driftSide` del gesto es una ventaja que el one-shot no tiene (el one-shot exige `|steer| > 0.15`;
el gesto ya puede arrancar el derrape aunque el dedo no esté del todo a un lado). Hay que **conservarlo**.

---

## 12. Propuesta concreta de porte (manteniendo el arrastre)

Objetivo: que el derrape del real se sienta como el del one-shot (entrada inmediata, carga
fiable, premio claro al soltar) **sin** quitar peralte, agarre, hierba, hop de rampa ni
el control de arrastre, y **sin** botones táctiles.

Hacerlo en `packages/shared/src/tuning.ts` y unos pocos cambios en `kart.ts`
(`stepKart`, `endDrift`). No hace falta un modelo de `lateralSpeed`.

### 12.1 Entrada del derrape (kart.ts) — prioridad alta

Hoy el derrape solo arranca al aterrizar el hop. Cambiar a un esquema mixto, como el one-shot
pero respetando `driftSide`:

1. El hop se lanza igual al pulsar (`startHop`), un poco más alto/largo para que se lea:
   `hopTime: 0.22 → 0.36`, `hopHeight: 0.35 → 0.65` (cerca del 0,49 s / 0,79 m del one-shot,
   sin llegar a confundirse con una rampa).
2. **Nuevo:** si `input.drift` está mantenido, `driftDir === 0`, `speed >= driftMinSpeed`
   y hay lado (`input.driftSide` o `|steer| > 0.15`), arrancar el derrape **en el mismo paso**
   (también en el aire). Seguir sin cargar turbo hasta aterrizar (`hopTime === 0 && !airborne`),
   como ahora, para no regalar carga en saltos de rampa.
3. Bajar el umbral de aterrizaje de `|steer| > 0.3` a **0,15**, alineado con el one-shot.
   Conservar `driftSide` del arrastre (si el gesto ya pide lado, no exigir giro extra).

Esto es lo que más acerca «la acción de derrape» sin tocar la pista.

### 12.2 Carga más generosa al abrir (tuning.ts) — prioridad alta

El arrastre en móvil no siempre deja el dedo «hacia dentro». Hoy, abriendo, el ultra tarda 7,25 s.

- Subir `driftChargeSlow` de **120 a 240** (casi como el one-shot, donde abrir no penaliza).
  Cerrando se queda en 300 (0,90 / 1,90 / 2,90 s, ya similar al one-shot).
  Abriendo pasaría a ~1,13 / 2,38 / 3,63 s, todavía más lento que cerrar, pero usable.
- Opcional: subir un poco `driftSteerRate` de 8 a **14**, para que el contravolante del
  arrastre no tarde 0,25 s en llegar (el one-shot es instantáneo). No ponerlo infinito:
  un poco de suavizado ayuda con el dedo.

No quitar el zigzag ni el bonus de peralte: son extra, no estorban.

### 12.3 Mini-turbo con premio por nivel (tuning.ts + endDrift) — prioridad alta

El +20 % único es el mayor hueco de sensación.

Propuesta, calibrada a la punta real de 26 m/s (no copiar 44 m/s de golpe: rompería
`gripCap`, peraltes y el ritmo de la Laguna):

```
// En KART, sustituir boostSpeedMult único por multiplicadores por nivel:
boostMult1: 1.28,   // 33,3 m/s   (~ +7,3)   — equivalente recortado del +13,5 del one-shot
boostMult2: 1.40,   // 36,4 m/s
boostMult3: 1.52,   // 39,5 m/s
boostTime1: 0.85,   // como el one-shot (hoy 0,62)
boostTime2: 1.50,   // entre one-shot 1,35 y real 1,67
boostTime3: 2.20,   // entre one-shot 1,95 y real 2,63
boostAccel: 55,
```

En `endDrift` / `giveBoost`:

- Usar el multiplicador del nivel, no uno solo.
- Empujón inicial, como `speed = max(speed, maxSpeed + (mult-1)*maxSpeed*0.75)`
  (el `* 0.75` del one-shot): al soltar se nota el golpe, no solo un FOV.

Los paneles pueden quedarse en `boostPadMult = 1.3` (o subirlos a 1,4 para no quedar
por debajo de un mini-turbo II).

**No subir `maxSpeed` a 44** en el primer pase. Si tras probar el turbo Carlo sigue
pidiendo más «punch» de punta, un segundo pase puede ir a 30–32 m/s y retocar
`accelLimit` (p. ej. 16,4 → 22) sin reventar el peralte. Subir la costa a lo del
one-shot (`−1,27·v`) tampoco en el primer pase: con el arrastre, soltar el dedo
hacia arriba (quitar gas) dejaría el kart casi parado en una curva. Si se quiere
más «planta», subir `coastDrag` de 6 a **10–12**, no a 30+.

### 12.4 Slip visual y cámara — prioridad media

- Hacer que el ángulo visual dependa del contravolante, como el one-shot:
  `driftDir * (0.44 + inward*0.16)` en lugar del `driftVisualAngle = 0.45` fijo.
- En `ChaseCamera.updateRelief`, desplazar el rumbo de cámara
  `heading + visualSlip * 0.32` (poco: no pelear con el alabeo de peralte, tope 8°).
- FOV de turbo un poco mayor en nivel 3 (acercarse a 76–78°).
- Viñeta o destello corto al soltar un turbo II/III, con paleta Dalí (Llama / Ánima /
  Espectro), no el cian `#00f5d4` del one-shot.

### 12.5 Qué no portar

- Botones táctiles ni auto-acelerar por defecto (el gas del real es el deslizamiento ↑).
- Punta 44 m/s, pista de 24 m, ausencia de peralte/agarre/hierba.
- Muro `speed *= 0.96` sin rebote (en Ánimas el muro tiene que recoger).
- Tipografías Cinzel/Inter y paleta teal/magenta del one-shot (seguir Lilita One, Nunito
  y los hex de Dalí).
- Un modelo nuevo con `lateralSpeed`: el campo del one-shot está muerto; no aporta.

### 12.6 Orden de trabajo sugerido

1. Entrada inmediata del derrape + hop más legible + umbral 0,15 (`kart.ts`).
2. `driftChargeSlow` 240 y `driftSteerRate` 14 (`tuning.ts`).
3. Multiplicadores de turbo por nivel + empujón al soltar (`tuning.ts` + `endDrift`).
4. Slip visual variable y un poco de cámara/FOV/viñeta.
5. Probar en el arrastre real (no en teclado solo): un gesto lejos-y-soltar tiene que
   disparar I/II de forma fiable en una curva de Ánimas.
6. Solo entonces, si hace falta, un pase suave de `maxSpeed` / `accelLimit` / `coastDrag`.

Los tests de `kart.test.ts` y `tuning.test.ts` habrá que actualizarlos a los nuevos umbrales
y duraciones; no cambiar la regla de «en el aire no carga» ni los de peralte/agarre.
