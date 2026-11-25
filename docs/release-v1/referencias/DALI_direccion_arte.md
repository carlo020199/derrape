# Derrape · Dirección de arte del primer release (Dalí)

Alcance: 2 pilotos con su kart y 1 circuito (Laguna de las Ánimas). Referencias en esta carpeta:
- `ejemplo1` es la carrera vertical con HUD y se toma como **objetivo de encuadre y ambiente**.
- `ejemplo2` es **Lía Brasas** con su kart.
- `ejemplo3` contiene la paleta, la tipografía y las fases, y en su parte de abajo el **objetivo técnico**.

Reglas técnicas, ninguna negociable:
- 60 fps en móvil, como máximo 120 draw calls y 150k triángulos por escena.
- Materiales `MeshToonMaterial` con `gradientMap` de 3 escalones.
- Contorno (outline por casco invertido) **solo en pilotos y karts**.
- Fuego con sprites aditivos instanciados, pixelRatio de 2 como máximo y sombras blob, sin shadow maps.
- Ningún asset de Nintendo.

## 0. Paleta (los únicos hex permitidos)

| Nombre | Hex | Nombre | Hex |
|---|---|---|---|
| Noche | #120F1E | Ánima | #9B6BFF |
| Ciruela | #1E1830 | Ánima prof. | #6B3FD6 |
| Sombra | #2E2547 | Hueso | #F3E7D3 |
| Niebla | #5B4E7A | Hueso sombra | #C8B597 |
| Brasa | #FF6A1F | Texto | #FFF7EA |
| Llama | #FFB423 | Peligro | #FF4D6D |
| Ascua | #D9362B | Espectro | #3FF2C8 |

Neumáticos y negro técnico: #141018, que es una derivación de Noche. Tipografía: Lilita One para títulos y números, Nunito para el texto.

## 1. Pilotos (chibi-calavera, «amables, no de miedo»)

### Proporciones comunes
- Altura total sentado de unos 1,1 m en escala de juego. La cabeza mide **el 45-50 % de la altura del piloto sentado** y su ancho es igual o mayor que el de los hombros × 1,6.
- Calavera redondeada (esfera ligeramente achatada, 1,0 × 0,92 × 0,95):
  - Mandíbula integrada y sonrisa con 4-5 dientes cuadrados en relieve.
  - Cuencas grandes y redondas (cada una mide el 22-25 % del ancho del cráneo) con ojos emisivos.
  - Nariz en forma de corazón invertido, hundida, en Hueso sombra.
- Cuerpo pequeño: el torso es una cápsula y los brazos y piernas son huesos-cápsula con articulaciones de bola. Manos de 4 dedos rechonchos agarrando el volante.
- Sin aristas duras: todo con bevel o subdivisión baja, con un presupuesto de 3-5k triángulos por piloto y 4-6k por kart.
- Outline de 0,025 m en Noche #120F1E sobre piloto y kart. Sombra blob debajo del kart.

### Piloto A: Lía Brasas (ejemplo2)

**Cabeza**
- Calavera en Hueso #F3E7D3 con sombreado en Hueso sombra #C8B597.
- Ojos emisivos en Llama #FFB423 con pupila Brasa #FF6A1F (emisivo al 100 %). Sonrisa amable con dientes visibles.

**Pelo**
- Coleta alta muy voluminosa en Espectro #3FF2C8 (sombra en un cian oscuro derivado, unos #1FA896), con 3 o 4 mechones-cápsula que se balancean con el movimiento (bone o vertex shader barato).
- Flequillo en dos mechones y diadema en Ánima prof. #6B3FD6.

**Ropa**
- Sudadera de capucha en Ciruela #1E1830 y Sombra #2E2547, con cordones en Hueso.
- Pantalón en Sombra. Las manos son huesos en Hueso.

**Kart «Hueso»** (el kart blanco del ejemplo2)
- Carrocería redondeada en Hueso #F3E7D3 con sombra Hueso sombra.
- Morro en forma de **calavera** con cuencas en Noche, situado en el frontal.
- Asiento en Sombra. Volante en Noche con un cubo en Ánima.

**Ruedas y escapes**
- Ruedas grandes y gordas (diámetro de 0,55 veces la altura del kart) en #141018, con llanta en Hueso sombra.
- **Dos escapes traseros** cilíndricos en Hueso sombra que escupen llama aditiva Brasa a Llama a Ascua, con chispas en Espectro.
- Un hueso cruzado decorativo detrás del asiento, también en Hueso.

### Piloto B: Calavera Chispas (el piloto de ejemplo1)
Contrapunto de Lía. Ella es clara con acentos cian; él es oscuro con acentos naranja.

**Cabeza**
- Calavera más grande y redonda, sin pelo, en Hueso.
- Ojos en Noche (cuencas vacías) con un brillo pequeño en Ánima #9B6BFF y emisivo al 60 %.
- **Dientes legibles a 5 m**: 5 bloques separados por ranuras en Noche.

**Cuerpo**
- Costillas visibles: 3 arcos en Hueso sobre un torso en Sombra.
- Brazos de hueso. Guantes en Brasa #FF6A1F.

**Kart «Medianoche»** (el kart oscuro del ejemplo1)
- Carrocería en Sombra #2E2547 y Ciruela #1E1830, con laterales en Hueso #F3E7D3 y una banda en Brasa.
- Faros redondos delanteros emisivos en Llama #FFB423 con halo aditivo.
- Pilotos traseros en Brasa.
- Ruedas en #141018 con llanta en Ánima prof.
- Escapes laterales con llama aditiva y turbo azul-espectro (Espectro #3FF2C8) al derrapar.

### Ambos pilotos
- Animaciones mínimas: botar con el bache, inclinar el cuerpo al girar (±12°), la cabeza mira hacia el lado del giro, rebote de 0,1 s al recibir turbo y un «¡yuju!» de brazos al cruzar meta.
- En la selección de piloto aparecen sobre un pedestal con un foco cálido en Llama (como en «Piloto y coche» del ejemplo3).

## 2. Circuito: Laguna de las Ánimas (ejemplo1)

**Cielo**
- Degradado de cúpula: cenit Ciruela #1E1830, a media altura Sombra #2E2547 y horizonte Niebla #5B4E7A con un toque de Ánima.
- **Luna llena** en Hueso con cráteres en Hueso sombra y halo aditivo en Ánima al 25 %. Su tamaño aparente es del 12-15 % del ancho de pantalla, en el cuadrante superior.
- Nubes toon suaves en 2-3 capas (Niebla y Sombra, con el borde superior más claro), semitransparentes y nunca opacas tipo piedra.

**Niebla**
- `Fog` lineal en #4A3F66 que empieza a unos 40 m y es total a unos 180 m.
- Los planos lejanos (colinas y árboles) se funden en morado. Nunca debe verse negro puro en el horizonte.

**Terreno**
- Fuera de la calzada hay colinas y montículos de hierba toon en Sombra a Niebla, con relieve suave.
- **Prohibido el plano liso vacío** junto a la pista.

**Laguna espectral**
- Agua en Espectro #3FF2C8 emisiva, con el centro más claro (#7FFFE0 derivado) y la orilla en #1FA896.
- Espuma animada con shader de ruido y borde claro de orilla, 1,8 m por debajo del asfalto.
- Se lee como **un río de luz que serpentea desde el primer plano medio hasta el campanario** y tiene que verse de frente en la recta de salida.

**Árboles**
- Árboles retorcidos con copa de nube redonda en Ánima #9B6BFF y Ánima prof. #6B3FD6, con tronco en Noche o Sombra.
- 3 modelos, instanciados (entre 40 y 80 en total), concentrados en los laterales del encuadre.

**Faroles**
- Farolillos de papel flotantes en Brasa y Llama, con el interior emisivo y un halo sprite aditivo, sin luces reales.
- Oscilan entre ±4° y ±0,15 m.
- Entre 15 y 30 en total, con algunos colgados de postes en Sombra en la curva.

**Bordes de pista**
- Vallas de hueso: postes con forma de **fémur o vértebra rematados en calavera** en Hueso, unidos por cuerda en Hueso sombra. Van en el borde exterior de las curvas, instanciados y con una separación de unos 3 m.
- Bordillo alternando Sombra y Hueso, o Ánima y Hueso en las curvas, con una línea Espectro de 0,15 m en el borde exterior (ver ejemplo1, curva derecha).

**Calzada y campanario**
- Asfalto en #3A3352 con shade #2A2440, como está hoy.
- Campanario o torre al fondo en Sombra con una luz cálida en la ventana y el tejado cónico en Ciruela, recortado contra la luna.

**Opcionales si sobra presupuesto**
- Lápidas redondeadas y calabazas con cara (moodboard del ejemplo3) en grupos pequeños.
- Luciérnagas en Espectro como partículas aditivas sobre la laguna.

**HUD** (ejemplo1, solo si el release lo incluye)
- Posición «1º» en Lilita One Texto con sombra Noche, arriba a la izquierda, con una altura del 9-10 % de la pantalla.
- Pastilla «VUELTA 2/3» con fondo Ciruela al 80 % y borde Niebla.
- Botón de objeto de 64 px con borde Brasa.
- Minimapa circular abajo a la izquierda con trazo Hueso.
- Velocidad en Lilita One y fila de 3 monedas en Llama.

## 3. Criterios de aceptación «se ve como las fotos» (comprobables con capturas)

**Capturas obligatorias**
- Vertical 390×844 a @2x, en la Laguna:
  - a) salida
  - b) recta hacia el campanario
  - c) curva peraltada con valla
  - d) tramo con la laguna delante
- Selección de piloto con Lía y Calavera Chispas.
- Para cada captura de carrera hay que montar una hoja junto a `ejemplo1` y, para los pilotos, junto a `ejemplo2`.

**C1 Encuadre**
- El kart ocupa el 30-40 % del ancho de la pantalla, con su centro entre el 60 y el 75 % de la altura.
- La cámara está detrás y en ligero picado: se ve el techo del kart y la cabeza entera del piloto, nunca solo su nuca tapando la pista.
- El horizonte cae entre el 25 y el 40 % de la altura y se ve al menos el 40 % de la pantalla de calzada y paisaje por delante del kart.

**C2 Color dominante**
- En las capturas de carrera, más del 55 % de los píxeles tienen un tono morado o violeta (H entre 250° y 290° en HSV, o están a menos de ΔE 20 de algún morado de la paleta).
- Menos del 5 % son casi negros (V < 8 %). Nada de gris neutro como superficie dominante.

**C3 Laguna**
- En a), b) o d), al menos el 6 % de los píxeles están a menos de ΔE 15 de Espectro o de su degradado (#1FA896 a #7FFFE0), formando una mancha alargada que llega del tercio medio al tercio superior.

**C4 Cielo**
- Luna visible y circular en a) o b), con un diámetro de entre el 10 y el 16 % del ancho.
- El cielo es un degradado de Ciruela a Niebla sin bandas visibles.
- Las nubes son más claras en el borde superior que en el inferior.

**C5 Puntos cálidos**
- Hay al menos 4 farolillos o puntos Brasa/Llama en a) o b).
- Los faros o escapes del kart son emisivos en Llama o Brasa y destacan como los píxeles más saturados del tercio inferior.

**C6 Bordes**
- En c) se distinguen al menos 4 postes-calavera en Hueso con cuerda.
- Se ven el bordillo bicolor y la línea Espectro del borde exterior.

**C7 Relleno lateral**
- En cualquier captura de carrera, los dos laterales (el 15 % izquierdo y el 15 % derecho) contienen árboles, colinas o valla.
- No puede haber ninguna región de más del 10 % de la pantalla de color plano uniforme (desviación < 3 %) que no sea el cielo.

**C8 Pilotos**
- En la vista de selección, cada piloto cumple estas proporciones y colores:
  - La cabeza mide entre el 45 y el 50 % de la altura del piloto sentado.
  - Lía lleva la coleta en Espectro y los ojos en Llama, y su kart es claro, en Hueso, con el morro en forma de calavera.
  - Calavera Chispas lleva un kart oscuro con faros en Llama.
  - El outline en Noche se ve en los dos.
- La silueta de cada piloto se reconoce sin color: si se umbraliza la captura, Lía y Calavera Chispas se distinguen por la coleta.

**C9 Legibilidad**
- Los dientes y las cuencas de las calaveras se leen en las capturas de carrera a @1x.
- El texto del HUD tiene un contraste de 4,5:1 o más sobre su fondo.

**C10 Técnico**
- `scripts/medir-escena.ts`: hasta 120 draw calls y 150k triángulos en la Laguna con 8 karts.
- Tests en verde. Los fps reales en iPhone los confirma Carlo.

**Veredicto**
- Pasa si cumple C1, C2, C3, C7, C8 y C10, y al menos 3 de C4, C5, C6 y C9.
- Si algo falla, se repite la tanda solo sobre los criterios fallidos, citándolos por su número.
