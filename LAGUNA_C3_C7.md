# Laguna de las Ánimas · arreglo de C3 (laguna) y C7 (relleno)

Metodología: `npm run capturas` (mismas 5 tomas, 390×844 @2x), antes = main del 27/11 por la mañana, después = esta rama.
Capturas y `metricas.json` en `docs/screenshots/release1-c3c7/{antes,despues}`.

| Toma | Laguna % (antes → después) | Región plana mayor % (antes → después) | Llamadas | Triángulos |
|---|---|---|---|---|
| a-salida | 0,90 → 2,5 | 26,1 → 4,0 | 61 → 63 | 107 032 → 88 888 |
| b-recta-campanario | 1,54 → 7,0 (**≥ 6 %**) | 32,0 → 3,1 | 60 → 61 | 106 236 → 86 956 |
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
