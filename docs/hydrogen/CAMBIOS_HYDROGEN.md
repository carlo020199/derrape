# Cambios de físicas y turbo (porte del one-shot)

Porte de la sensación de derrape y mini-turbo descrita en `docs/hydrogen/FISICAS_oneshot.md` (sección 12), conservando intactos el control de arrastre, la cámara, el peralte (`BANK`), el agarre (`GRIP`), las pendientes (`SLOPE`), la hierba, las rampas y la colisión con el suelo.

---

## 1. Constantes (`packages/shared/src/tuning.ts`)

| Constante | Antes | Ahora | Motivo |
|---|---|---|---|
| `KART.hopTime` | `0.22` | `0.36` | Saltito más largo y legible al iniciar derrape (sigue por debajo de `SURFACE.rampHopTime = 0.55`, así que `0.55 > 0.36 + 0.05` distingue rampa de hop). |
| `KART.hopHeight` | `0.35` | `0.65` | Saltito visual más alto al pulsar derrape. |
| `KART.driftSteerRate` | `8` | `14` | Contravolante más ágil (~0,14 s de lado a lado en lugar de ~0,25 s) sin perder suavizado en táctil. |
| `KART.driftChargeSlow` | `120` | `240` | Carga usable también en neutro o abriendo (el arrastre en móvil no siempre queda al tope hacia dentro). |
| `KART.boostTime1` | `0.62` | `0.85` | Duración nivel I alineada con el one-shot. |
| `KART.boostTime2` | `1.67` | `1.5` | Duración nivel II equilibrada. |
| `KART.boostTime3` | `2.63` | `2.2` | Duración nivel III equilibrada. |
| `KART.boostSpeedMult` | `1.2` (único) | eliminado | Sustituido por multiplicadores crecientes por nivel. |
| `KART.boostMult1` | — | `1.28` | Mini-turbo nivel I (+28 % sobre la punta del kart). |
| `KART.boostMult2` | — | `1.4` | Súper-turbo nivel II (+40 %). |
| `KART.boostMult3` | — | `1.52` | Ultra-turbo nivel III (+52 %). |
| `KART.boostAccel` | `45` | `55` | Respuesta más viva durante cualquier turbo. |
| `SURFACE.boostPadMult` | `1.3` | `1.4` | Los paneles de impulso no quedan por debajo de un mini-turbo II. |

Sin cambios en `maxSpeed` (26), `accelLimit` (16.4), `coastDrag` (6), `TOUCH`, `BANK`, `GRIP`, `SLOPE` ni `RAMP`.

---

## 2. Fórmulas y lógica cambiadas (`packages/shared/src/kart.ts` y `apps/client/src/game/raceSession.ts`)

1. **Entrada inmediata del derrape (`stepKart`)**:
   - Al pulsar derrape se sigue lanzando el salto (`startHop(s, t.hopTime)` si estaba apoyado y en movimiento).
   - Mientras `s.driftDir === 0`, si `input.drift` está mantenido, `s.speed >= t.driftMinSpeed` y existe lado (`side = input.driftSide || (|steer| > 0.15 ? steer : 0)`), el derrape arranca **en el mismo paso** aunque `s.hopTime > 0` o esté en el aire.
   - `s.hopTime` se decrementa en cada paso con independencia de `s.driftDir`, y la carga del mini-turbo solo suma cuando `s.hopTime === 0 && !s.airborne` (no regala carga durante el hop ni en rampas).
2. **Mini-turbo por nivel y empujón al soltar (`boostForLevel`, `endDrift`, `giveBoost`)**:
   - `boostForLevel(level, t)` devuelve `{ time, mult }` usando `boostTime1/2/3` y `boostMult1/2/3`.
   - `endDrift` aplica `giveBoost(s, time, mult)` cuando `time > 0` y añade el empujón instantáneo:
     `s.speed = Math.max(s.speed, top + (mult - 1) * top * 0.75)`
     donde `top = t.maxSpeed` (la velocidad punta efectiva del kart resultante de `deriveTuning`).
   - `giveBoost(s, time, mult)` conserva su firma para paneles, salida y objetos.
3. **Variantes de kart (`packages/shared/src/karts.ts`)**:
   - Revisado: `deriveTuning` propaga `...base` (heredando los nuevos tiempos, multiplicadores y `boostAccel`) y escala `t.maxSpeed`, de modo que el empujón y la punta de cada turbo escalan proporcionalmente con cada variante sin cambios adicionales en `karts.ts`.
4. **Ángulo visual variable en derrape (`driftVisualSlip` en `kart.ts` y `raceSession.ts`)**:
   - Exportada `driftVisualSlip(s, _t)`: si `driftDir === 0` devuelve `0`; si no, calcula `inside = clamp(-s.driftSteer * s.driftDir, -1, 1)` y devuelve `s.driftDir * (0.44 + inside * 0.16)` (de `0.28` rad abriendo a `0.60` rad cerrando).
   - Usada en `apps/client/src/game/raceSession.ts` en lugar de `view.driftDir * KART.driftVisualAngle` (añadido `driftSteer?: number` opcional al parámetro `view`), cambiando solo la rotación visual del chasis sin tocar la cámara.

---

## 3. Tests actualizados y nuevos

### Tests modificados (solo por afinación vieja intencionada)
- `packages/shared/src/kart.test.ts`:
  - Reemplazado `"el derrape empieza al aterrizar del salto, no antes"` por `"el derrape arranca durante el hop sin esperar al aterrizaje"` (la entrada inmediata es el cambio principal del objetivo 1).
  - En `"el derrape carga los niveles en orden y al soltar da turbo"`, `"el turbo dura lo que toca y vuelve a la punta normal"` y `"el rebote contra el borde no atraviesa la pista"`: sustituida la referencia eliminada `KART.boostSpeedMult` por `KART.boostMult3` / `KART.boostMult2`.
- `packages/shared/src/race.test.ts`:
  - En `"un turbo ignora el terreno"`: sustituida la referencia eliminada `KART.boostSpeedMult` por `KART.boostMult1`.

### Tests nuevos en `packages/shared/src/kart.test.ts`
- **(a)** `el derrape arranca durante el hop sin esperar al aterrizaje`: comprueba que en el primer paso con derrape y giro ya hay `hopTime > 0`, `hopHeight > 0` y `driftDir === 1`.
- **(b)** `no carga el mini-turbo mientras dura el hop ni en el aire`: verifica `driftCharge === 0` durante `hopTime > 0` y que `driftCharge` permanece congelada cuando `airborne = true`.
- **(c)** `con driftSide del gesto arranca el derrape aunque steer sea ~0`: comprueba entrada izquierda/derecha con `|steer| = 0.02` y prioridad de `driftSide` sobre `steer`.
- **(d)** `el turbo de nivel 3 da más velocidad y dura más que el de nivel 1`: verifica mayor `boostTime`, `boostMult` y `speed` en nivel 3 frente a nivel 1.
- **(e)** `empujón inicial al soltar el derrape`: usando un `KartTuning` con `maxSpeed = 30`, verifica el salto inmediato de velocidad a `top + (mult - 1) * top * 0.75`.
- **(f)** `driftVisualSlip crece al cerrar y baja al abrir`: comprueba `0.60 > 0.44 > 0.28` rad en izquierda y simetría en derecha.

---

## 4. Mapeo del arrastre del dedo al derrape

- El control táctil (`TOUCH` en `tuning.ts`) traduce el arrastre horizontal respecto a `steerRange = 90` px CSS (con zona muerta `deadZone = 0.06`):
  - La posición horizontal relativa fija `input.steer` en `[-1, 1]`.
  - Al superar `driftTrigger = 0.6` (`54` px de arrastre lateral), el gesto activa `input.drift = true` y fija `input.driftSide` al lado inicial (`-1` izquierda, `1` derecha).
  - En `stepKart`, `input.driftSide` tiene prioridad sobre `steer` y arranca el derrape en ese mismo paso (aunque el dedo vuelva cerca del centro, `|steer| <= 0.15`), lanzando a la vez el hop visual (`0.36` s, `0.65` m).
  - Mientras se mantiene el dedo, moverlo dentro o fuera controla `steer` y `driftSteer` (contravolante más ágil con `driftSteerRate = 14`, carga mínima garantizada de `240/s` incluso abriendo, y ángulo visual dinámico con `driftVisualSlip`).
  - Al levantar el dedo (`input.drift = false`), `endDrift` libera el mini-turbo acumulado según el nivel (`I/II/III`) con su empujón inmediato.
