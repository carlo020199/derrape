# Pista supersmooth (fase 1)

- `medidas-antes.json` / `medidas-despues.json`: salida de `npx tsx scripts/medir-pista.ts` (12 pistas: quiebros y triángulos/llamadas de la malla de la pista).
- `escena-antes-despues.json`: triángulos y llamadas de la escena completa de Ánimas (renderer.info) y ms/fotograma por software (no son fps de iPhone).
- Capturas en `docs/screenshots/supersmooth/` (`antes-*` y `despues-*`).
- Nota: el «salto de normal» de antes se midió con el rumbo sin filtrar (constante a trozos cada 3 m); el de después usa el rumbo filtrado de `roadFrameAt`, el mismo que la malla.
