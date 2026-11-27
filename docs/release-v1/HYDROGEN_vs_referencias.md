# Hydrogen vs referencias (T3) — SIN RESULTADO

La consulta a `gemini-4-hydrogen` no se pudo completar el 2026-11-25 (noche de T3).

- Comando: `gemini -m gemini-4-hydrogen -p "Compara @docs/screenshots/release1/a-salida.png con @…/ejemplo1_2026-11-13.png @…/ejemplo2_2026-11-20.png @…/ejemplo3_image.png según C1–C10 de @…/DALI_direccion_arte.md …"`
- Intento 1: 503 (alta demanda) con reintentos internos y después **429**: `generate_content_free_tier_requests, limit: 20, model: gemini-4-hydrogen` (límite diario de la capa gratuita, ya agotado).
- Intentos 2 y 3 (tras 60 s cada uno): 429 de nuevo, «Please retry in 9h47m» → la cuota se repone ~09:00, el límite de la ventana.
- Se agotaron los 3 reintentos permitidos. No se usó ninguna API de pago ni otro modelo.

No hay lista de 5 diferencias. La última lista de Hydrogen es `/workspace/derrape-look-ejemplos/HYDROGEN_arreglos.md`, del commit `211a312`, anterior a T1 y T2; no se ha aplicado porque sus puntos ya se atendieron en T2 o están desfasados.

---

## Plan B: comparación hecha por Claude (NO es de Hydrogen)

Al fallar Hydrogen, Claude miró `a-salida`, `b-recta-campanario` y `d-laguna` junto a `ejemplo1` y anotó las diferencias más visibles que no contradicen a Dalí ni a T2 (calzada Ciruela plana, paleta, puntos de `NOCHE_T2_HECHO.md`). Es una opinión de Claude, no un resultado de Hydrogen.

| # | Diferencia (C) | Cambio probado | Resultado |
|---|---|---|---|
| 1 | C4 — la luna era blanco-rosa; en la referencia es Hueso con cráteres sutiles | El halo aditivo Ánima se pinta antes que el disco (`sky.ts`) | **Aplicado** (commit propio). Luna Hueso #F3E7D3 con cráteres Hueso sombra. Sin cambio de llamadas ni triángulos |
| 2 | C3 — laguna: rendija en `a`/`b`, río ancho en `ejemplo1` | `FAR_LIFT` 22 → 40 (`animas.ts`) | **Revertido**. Laguna en `a` 0,90 → 1,19 %, pero aparece una línea turquesa dura sobre una banda oscura; la cresta de la pista sigue tapando el agua. Hace falta rehacer el terreno/trazado, fuera del alcance de un retoque |
| 3 | C7 — laterales: rocas pequeñas frente a los árboles grandes de la referencia | Escala de los árboles de salida 1,5–2,0 → 2,6–3,4 y luego 2,0–2,4 (`animasProps.ts`) | **Revertido** en las dos pruebas: tapan el campanario, los farolillos y la laguna (deshace T2) |

## 2026-11-27 · Pasada de Hydrogen tras el arreglo de C7 (una sola llamada)

Hydrogen no pudo leer `/workspace/derrape-look-ejemplos/ejemplo1_2026-11-13.png` (fuera de su workspace) y usó la copia de `docs/release-v1/referencias/`. Respuesta íntegra, sobre las capturas previas al último ajuste de contraste:

> Sí, **siguen viéndose zonas planas grandes tanto en la calzada como en los laterales (no cumple C7)** respecto a `docs/release-v1/referencias/ejemplo1_2026-11-13.png` *(nota: no puedo leer la ruta externa `/workspace/derrape-look-ejemplos/...`, así que comparo con la copia del repo `docs/release-v1/referencias/ejemplo1_2026-11-13.png`)*.
> 
> **Diferencias principales:**
> - **Calzada muy plana y ancha en primer plano:** En `a-salida.png` (mitad inferior) y en el tramo bajo el kart de `calavera-chispas-d-laguna.png`, el asfalto ocupa una superficie amplia casi uniforme y oscura con manchas muy tenues; en `ejemplo1` la calzada es más compacta en encuadre, tiene degradado/bandas toon más marcadas, líneas laterales cian nítidas y bordillos bicolores gruesos que rompen el plano.
> - **Laterales sin masa vegetal ni vallas (C7):** En `ejemplo1` ambos bordes (15 % izq. y der.) están enmarcados por árboles retorcidos con copas moradas voluminosas, rocas facetadas y vallas de postes con calavera + cuerda. En `a-salida.png` solo hay rocas bajas y un par de farolillos, y el tercio inferior lateral queda vacío/liso; en `calavera-chispas-d-laguna.png` el lateral izquierdo es una ladera lisa vacía sin árboles ni valla.
> - **Terreno intermedio y colinas:** En `calavera-chispas-d-laguna.png`, la lengua de terreno sobre la laguna es una superficie extensa y plana con motas de textura poco integradas y un único árbol diminuto al fondo; en `ejemplo1` las orillas tienen relieve, arbustos, árboles cercanos y bruma en capas.
> - **Nubes, niebla y campanario:** En las capturas las nubes son discos planos opacos y las colinas del fondo son bandas lisas sin niebla intermedia, mientras que en `ejemplo1` hay nubes suaves estratificadas, neblina entre planos y el campanario detallado en silueta.
> - **Agua de la laguna:** En `calavera-chispas-d-laguna.png` la laguna es un relleno cian muy plano con dos tonos rígidos; en `ejemplo1` tiene espuma estilizada, brillo suave en el centro y transición hacia la orilla.

Aplicado tras leerla (barato): más contraste de rodadas, aceite y borde oscuro; 110 grupos de rocas en vez de 70; parches más marcados. Sin árboles nuevos ni terreno rehecho (decisión para Carlo). Las nubes ya tenían borde claro (cdb652a): no se tocaron.


## 2026-11-27 · T3 completada: pasada de Hydrogen (una sola llamada, respuesta tal cual)

Comando: `gemini -m gemini-4-hydrogen -p "Compara @docs/screenshots/release1/a-salida.png @docs/screenshots/release1/b-recta-campanario.png @docs/screenshots/release1/calavera-chispas-d-laguna.png con @docs/release-v1/referencias/ejemplo1_2026-11-13.png (y ejemplo2/3 si caben): lista numerada de las diferencias visuales más visibles (color, luz, encuadre, detalle), de más a menos importante."` (se usó la copia de `ejemplo1` del repo porque Hydrogen no lee fuera del workspace). Respuesta íntegra:

> Comparando `docs/screenshots/release1/a-salida.png`, `b-recta-campanario.png` y `calavera-chispas-d-laguna.png` frente a `docs/release-v1/referencias/ejemplo1_2026-11-13.png` (y `ejemplo2_2026-11-20.png` / `ejemplo3_image.png`), estas son las diferencias visuales más visibles, ordenadas de mayor a menor impacto:
> 
> 1. **Iluminación, contraste y atmósfera nocturna**
>    - **Referencias (`ejemplo1`, `ejemplo3`):** Cielo nocturno profundo violeta-índigo arriba (`#120F1E`–`#1E1830`) que degrada hacia neblina luminosa lavanda/morada entre capas escalonadas de colinas, con estrellas sutiles y halos cálidos/turquesas que tiñen el entorno.
>    - **Capturas:** Cielo gris-violáceo mucho más plano y apagado, con poco rango dinámico entre el cielo y el suelo. Faltan capas atmosféricas de niebla entre colinas, estrellas y proyección real de luz ambiental desde los farolillos y la laguna.
> 
> 2. **Entorno lateral, vegetación y nivel de detalle de los props**
>    - **Referencias (`ejemplo1`, `ejemplo3`):** La pista está muy enmarcada por **árboles frondosos** de copas moradas redondeadas en primer y segundo plano, **vallas de piedra hueso con calaveras**, un **campanario detallado** (tejado curvo, arcos, campana visible) en lo alto de la colina y **farolillos estilizados** con borla y degradado naranja-amarillo.
>    - **Capturas (`a-salida`, `b-recta-campanario`, `calavera-chispas-d-laguna`):** Los márgenes se ven muy vacíos y angulosos (rocas low-poly sin árboles grandes en primer plano ni vallas de calaveras). El campanario es un prisma liso con tejado cónico sin arcos ni campana, y los farolillos son octaedros simples con bandas blancas.
> 
> 3. **Acabado de la laguna espectral, la pista y el terreno**
>    - **Referencias (`ejemplo1`, `ejemplo3`):** Laguna turquesa translúcida/brillante con espuma orgánica y volutas de niebla luminosa sobre el agua; pista azul-índigo satinada con reflejos suaves, bordillos alternos morado/hueso bien definidos y línea guía turquesa fina.
>    - **Capturas:** En `calavera-chispas-d-laguna`, la laguna es una superficie plana muy opaca con manchas bicolor duras y un borde negro grueso, sin vapor/brillo hacia la orilla; el terreno morado tiene una textura ruidosa de manchas planas y la pista se ve casi negra mate con bandas oscuras poco integradas.
> 
> 4. **Encuadre, altura y ángulo de la cámara**
>    - **Referencias (`ejemplo1`):** Cámara algo más alta, picada y con ángulo en tres cuartos trasero, lo que permite ver el perfil del kart y del piloto, la curva sinuosa de la pista, la laguna completa en el plano medio y el campanario + luna en el tercio superior.
>    - **Capturas:** Cámara centrada y pegada justo detrás del kart. En `a-salida` y `b-recta-campanario` el horizonte queda bajo y deja la mitad superior casi vacía; en `calavera-chispas-d-laguna` el kart queda muy abajo/encajonado contra la laguna y parte del agua queda cortada detrás de la pista.
> 
> 5. **Modelado y detalle de kart + piloto (especialmente ruedas y escapes)**
>    - **Referencias (`ejemplo1`, `ejemplo2`):** Formas muy redondeadas estilo *vinyl toy*, sombreado suave en la carrocería hueso, ruedas con dibujo y **aros naranja en las llantas**, llamas aditivas con transición naranja-turquesa y chispas en los escapes, además de pelo fluido/mechones definidos en Lía.
>    - **Capturas:** Las ruedas se ven prácticamente como cilindros negros planos sin llanta ni aro; las llamas de escape son simples conos brillantes sin penacho ni chispas ricas. En `calavera-chispas-d-laguna`, el kart oscuro se funde demasiado con el asfalto y la cabeza de la calavera vista desde atrás es una esfera lisa sin detalle.
> 
> 6. **Sombras de contacto e integración con la pista**
>    - **Referencias (`ejemplo1`, `ejemplo2`):** Sombra de contacto nítida y suave bajo el chasis y las 4 ruedas, acompañada del reflejo cálido de los escapes sobre el asfalto.
>    - **Capturas:** La sombra proyectada es una mancha larga y difusa hacia atrás (`a-salida`, `b-recta-campanario`), y en `calavera-chispas-d-laguna` la parte trasera/ruedas del kart se ven algo hundidas o desconectadas de la superficie.
> 
> 7. **Luna y nubes del cielo**
>    - **Referencias (`ejemplo1`):** Luna grande, traslúcida e integrada en el violeta del cielo, con cráteres suaves y atmósfera difusa.
>    - **Capturas:** Luna más pequeña y opaca color crema con cráteres planos; en `calavera-chispas-d-laguna`, nubes construidas con discos planos muy recortados contra el fondo.
> 
> 8. **HUD, jerarquía visual y acabados de interfaz**
>    - **Referencias (`ejemplo1`, `ejemplo3`):** `1º` compacto en **Lilita One** sin `/4` colgando; velocímetro grande (`68 KM/H`) con los **3 indicadores de turbo rellenos en naranja-amarillo**; caja de objeto brillante con borde naranja vivo; minimapa limpio con trazado grueso y 3–4 puntos de pilotos bien legibles.
>    - **Capturas:** `1º` más vertical con `/4` separado abajo y botón de ajustes arriba a la derecha; velocímetro pequeño (`0 km/h`) con los 3 círculos vacíos casi invisibles sobre la pista oscura; caja de objeto vacía con borde marrón apagado; y minimapa con línea gris más fina cargada de pequeños triángulos de colores.

### Qué se hizo con esta lista (27-nov, límite 3 arreglos)
| Dif. | Acción | Resultado |
|---|---|---|
| 8 (HUD) | Casilla de objeto vacía conserva el borde brasa vivo; círculos de turbo con contorno Hueso | **Aplicado** (commit propio), 0 llamadas/triángulos extra |
| 2 (árboles/vallas), 4 (cámara más alta) | No aplicados: los árboles grandes ya se revertieron el 25/11 por tapar campanario y laguna; la cámara cambia la jugabilidad y rompe C3/C5 | Descartado |
| 3, 5, 6, 7 | Ruedas ya llevan llanta Brasa; resto exige rehacer terreno/modelos | Pendiente (decisión de Carlo) |
