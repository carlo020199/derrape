# Laguna de las Ánimas · arreglo de C3 (laguna) y C7 (relleno)

Metodología: `npm run capturas` (mismas 5 tomas, 390×844 @2x), antes = main del 27/11 por la mañana, después = esta rama.
Capturas y `metricas.json` en `docs/screenshots/release1-c3c7/{antes,despues}`.

| Toma | Laguna % (antes → después) | Región plana mayor % (antes → después) | Llamadas | Triángulos |
|---|---|---|---|---|
| a-salida | 0,90 → 2,5 | 26,1 → 4,0 | 61 → 63 | 107 032 → 88 888 |
| b-recta-campanario | 1,54 → 7,1 (**≥ 6 %**) | 32,0 → 3,1 | 60 → 61 | 106 236 → 86 956 |
| c-curva-valla | 0,52 → 0,5 | 30,8 → 2,8 | 60 → 65 | 102 798 → 93 590 |
| d-laguna | 7,98 → 8,0 | 14,6 → 6,8 | 67 → 74 | 107 930 → 100 930 |
| e-frontal | 0,58 → 0,6 | 32,7 → 7,2 | 54 → 57 | 102 660 → 88 512 |

## Qué cambia
- **C3** (`animas.ts`): el río lejano sube de 22 a 74 m de altura y es más ancho, y se acerca 40–60 m: desde la recta de salida asoma por encima de la cresta, entra por la izquierda del campanario y baja hasta la laguna. Es un río de luz alto, de fantasía (visto desde la salida flota sobre el horizonte).
- **C7**:
  - Asfalto (`materials.ts`): gravilla y esquirlas de hueso (puntos redondos claros, dos capas, fundido con la distancia) en el shader. Es lo que rompe el plano liso: la región plana mayor era casi toda calzada. Sin triángulos.
  - `createFillTrees`: 56 arbolillos Ánima instanciados a 8–25 m del borde, a los dos lados, en 8 sectores con esfera de límites propia (se descartan los que no se ven).
  - Terreno: colinas escalonadas (terrazas de 2,4 m de altura con borde inferior oscuro, en el shader del terreno).
- **Presupuesto**: los postes de las vallas pasan de un solo `InstancedMesh` (siempre dibujado entero, ~24 000 triángulos) a grupos de 25 con frustum culling propio. Baja ~18 000 triángulos por captura, con +1…+7 llamadas.
- **Menor**: las nubes pierden la base oscura que se leía como contorno (se aclara hacia el tono medio). Transparencia real descartada: las nubes se pintan sin prueba de profundidad y taparían el terreno. La cámara de la toma d es la de `?foto=`, no la de juego; no se toca.
- No se toca la cámara de juego, `maxSpeed` ni los controles.

## Pendiente
- C3 en `a-salida` queda en 2,5 %: el objetivo (≥ 6 %) se cumple en `b`.
- 60 fps en móvil real sin verificar (los ms/fotograma de las capturas son de render por software).

## v2 (corrección tras la revisión de Dalí del PR 18)
El río alto de la v1 flotaba en el cielo (una losa Espectro por encima del horizonte). Se retira: el río lejano vuelve a su altura original y **ningún píxel Espectro queda por encima de la línea de colinas**.

- **C3**: la laguna se agranda hacia la salida (óvalo 62×72 en lugar de 78×38, desplazado 56 m hacia la salida) y la isleta del campanario baja de 19 a ~16 m, así que se ve desde la recta, a ras de suelo. La recta está en un terraplén 30 m por encima del valle y la propia calzada tapa el agua que queda justo delante, así que en a/b solo se ve una franja baja (≈ 1 %); en d la laguna ocupa el 18 %. Se prefiere esto a cualquier cosa flotante.
- **C7**: arcén ancho de 7 m en la recta de salida (el terreno sigue a la altura de la calzada antes de caer) y orilla de la laguna en talud empinado junto a la salida; lomas de 3–6 m a 8–25 m del borde (nunca bajo rampas ni junto a la laguna); 80 arbolillos (6 agrupados en la recta de salida a 2–6 m del arcén, el resto a 4–11 m) que ahora se ven en las bandas laterales de a y b.
- **Coste**: mismas llamadas de dibujo que main (61 en b, 74 en d); +2 000 / +3 400 triángulos (89 048 en b, 104 358 en d). Los ms por software dependen de la carga del equipo (main y esta rama dan lo mismo en la misma pasada: 74/110 vs 80/101).

| Toma | Laguna % | Región plana mayor % | Llamadas | Triángulos |
|---|---|---|---|---|
| a-salida | 1,0 | 4,0 | 63 | 91 564 |
| b-recta-campanario | 0,9 | 3,1 | 61 | 89 048 |
| c-curva-valla | 0,5 | 2,8 | 66 | 97 934 |
| d-laguna | 17,8 | 6,8 | 74 | 104 358 |
| e-frontal | 0,6 | 7,2 | 58 | 92 668 |

Capturas en `docs/screenshots/release1-c3c7/v2/`. No se alcanza ≥ 6 % de laguna en a/b sin flotar.
