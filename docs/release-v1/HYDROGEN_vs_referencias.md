# Hydrogen vs referencias (T3) — SIN RESULTADO

La consulta a `gemini-4-hydrogen` no se pudo completar el 2026-11-25 (noche de T3).

- Comando: `gemini -m gemini-4-hydrogen -p "Compara @docs/screenshots/release1/a-salida.png con @…/ejemplo1_2026-11-13.png @…/ejemplo2_2026-11-20.png @…/ejemplo3_image.png según C1–C10 de @…/DALI_direccion_arte.md …"`
- Intento 1: 503 (alta demanda) con reintentos internos y después **429**: `generate_content_free_tier_requests, limit: 20, model: gemini-4-hydrogen` (límite diario de la capa gratuita, ya agotado).
- Intentos 2 y 3 (tras 60 s cada uno): 429 de nuevo, «Please retry in 9h47m» → la cuota se repone ~09:00, el límite de la ventana.
- Se agotaron los 3 reintentos permitidos. No se usó ninguna API de pago ni otro modelo.

No hay lista de 5 diferencias. La última lista de Hydrogen es `/workspace/derrape-look-ejemplos/HYDROGEN_arreglos.md`, del commit `211a312`, anterior a T1 y T2; no se ha aplicado porque sus puntos ya se atendieron en T2 o están desfasados.
