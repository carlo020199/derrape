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
