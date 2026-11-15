# Físicas de referencia (investigación)

Cómo se comportan los juegos de karts de referencia (sobre todo la saga Mario Kart: Wii, 7, 8 Deluxe
y Tour para móvil) y qué hemos copiado. Las **mecánicas** del género se pueden imitar; el contenido
(nombres, personajes, gráficos, sonidos) sigue siendo original (ver `CLAUDE.md`).

## Aviso importante
- Nintendo no publica sus físicas. Los números vienen de la comunidad: datos extraídos de los juegos
  (*datamining*), TAS y conteo de fotogramas. Son fiables en proporciones y tiempos, no en unidades.
- Cada juego de la saga es distinto (Wii ≠ 7 ≠ 8 Deluxe ≠ Tour). Tour reutiliza la base de Mario Kart 7.
- Por tanto no se puede hacer "idéntico" al 100 %: hemos copiado **tiempos, proporciones y reglas**,
  traducidos a nuestra escala (metros y segundos). Todo vive en `packages/shared/src/tuning.ts`.

## Lo que hemos aplicado

### Aceleración en dos fases
En Mario Kart 7 cada fotograma la velocidad sube lo **menor** de dos cosas: un tope absoluto
(`AccLmtFwd`, 0,08 u/f por defecto) y una fracción de lo que falta hasta la punta (`SpdKfFwd`, 0,02).
Efecto: arranque muy fuerte y llegada suave a la punta.
- Nuestro modelo: `accelLimit` = 16,4 m/s² y `accelRelative` = 1,2/s (las mismas proporciones respecto
  a la velocidad punta). Llega al ~95 % de la punta en unos 2,7 s.

### Derrape: salto, dirección y carga
- **Salto (hop):** pulsar derrape hace un saltito de 13 fotogramas (~0,22 s). La dirección del derrape
  se decide al aterrizar; si no giras, solo es un salto.
- **Velocidad mínima** para derrapar (en Wii, por debajo de cierto umbral no hay salto sino mini-turbo parado).
- **Carga:** girar **hacia dentro** de la curva carga 5 unidades por fotograma; neutro o hacia fuera, 2.
  Es decir, cerrar el derrape carga 2,5 veces más rápido. Mientras estás en el aire no carga.
- **Umbrales:** mini-turbo a 270; súper a 570 (Mario Kart 8). El tercer nivel (ultra, chispas moradas)
  existe en 8 Deluxe y en Tour, pero su umbral no está documentado: usamos 870 (mismo salto de 300).
  - Cerrando el derrape: azul a los 0,9 s, naranja a 1,9 s y morado a 2,9 s.
  - Abriéndolo: 2,25 s, 4,75 s y 7,25 s.
- **Giro derrapando:** el derrape gira más cerrado que la conducción normal (en MK7, 1,6 frente a 0,7),
  y el control lo abre o lo cierra. Apenas se pierde velocidad derrapando.
- Chocar de frente contra un muro corta el derrape sin turbo.

### Mini-turbos
- **Duraciones** (vídeo de Nintendo para 8 Deluxe): 0,62 s (azul), 1,67 s (naranja), 2,63 s (morado).
- **Fuerza:** el mini-turbo sube la velocidad un **20 %** sobre la máxima (dato de Wii).
- El Nitro (equivalente a un champiñón) es más fuerte: +30 %, 1,5 s.

### Controles en móvil (Tour)
- Tour tiene derrape automático y "derrape manual". El morado solo es posible en manual.
- Nuestro esquema es el manual: arrastrar lejos = salto + derrape; soltar el dedo = mini-turbo.
- Tour también tiene "giro inteligente" (te impide salirte); no lo hemos puesto.

## Relieve (solo Laguna de las Ánimas)

El resto de circuitos sigue en 2D: si el punto no trae `bank` y la rampa no tiene tamaño, no cambia nada.

- **Cuesta:** `speed += −0,35·14·sin(pendiente)·dt`, con tope ±3,5 m/s². No sube la velocidad punta.
- **Peralte:** el giro hacia el lado alto va ×(1 + 0,35·sin|bank|). Parado, resbala hacia el borde bajo. En un peralte de 25° o más el derrape carga ×1,15. El muro exterior frena la mitad.
- **Agarre** μ = 1,1 (g = 9,81): sin peralte hay que soltar en la curva cerrada; con 40° se puede ir a fondo. No se aplica en los otros circuitos.
- **Rampas S/M/L:** vuelo de verdad (`vy = v·sin(ángulo + pendiente)`, g = 14). En el aire, 30 % de giro y los muros solo por debajo de 0,9 m (4 m en el salto L). Deslizar hacia arriba da un mini-turbo al aterrizar (0,4 / 0,6 / 0,9 s).

## Pendiente (cuando toque cada fase)
| Mecánica | Cómo es en la referencia | Fase |
|---|---|---|
| Salida con turbo | Pulsar justo cuando sale el "2" de la cuenta atrás; pronto = el motor se cala unos segundos; tarde = turbo más débil | 3 |
| Fuera de pista | Velocidad máxima ×0,78 / ×0,43 / ×0,31 según lo malo que sea el terreno (MK7, tierra) | 3 |
| Paneles de turbo y rampas | Turbo al pisarlos; truco en el aire al saltar da mini-turbo | 3 / 8 |
| Choques entre karts | Masa que pasa de "parado" a "a tope" según la velocidad; el más pesado empuja más | 4 / 7 |
| Estadísticas por coche | Velocidad, aceleración, peso, manejo, agarre y una oculta de mini-turbo (cambia carga y duración) | 7 |
| Rebufo | Ir detrás de otro un rato da un acelerón | después de la 1.0 |

## Fuentes
- [MKWii TAS Wiki — Miniturbo](https://wiki.mkwtas.com/wiki/Miniturbo): carga 5/2 por fotograma, umbral 270, duraciones, +20 %.
- [MKWii TAS Wiki — Hop](https://wiki.mkwtas.com/wiki/Hop): salto de 13 fotogramas, dirección al aterrizar, velocidad mínima.
- [Super Mario Wiki — Mini-Turbo](https://www.mariowiki.com/Mini-Turbo): umbrales de MK8 (270 / 570), tres niveles en 8 Deluxe y Tour, Tour basado en MK7.
- [Super Mario Wiki — Mario Kart 7 in-game statistics](https://www.mariowiki.com/Mario_Kart_7_in-game_statistics): aceleración en dos fases, giro normal frente a derrape, fuera de pista, masas de choque.
- [Perfectly Nintendo — comparativa de mini-turbos](https://www.perfectly-nintendo.com/?p=205734): 0,621 / 1,674 / 2,633 s.
- [Kotaku — Everything you didn't know about drifting](https://kotaku.com/everything-you-didn-t-know-about-drifting-in-mario-kart-1819196173): estadística oculta de mini-turbo.
- [GameSkinny — manual drift en Tour](https://www.gameskinny.com/047p0/how-to-manual-drift-in-mario-kart-tour) e [iMore — derrape en Tour](https://www.imore.com/mario-kart-tour-how-drift-and-when-you-should-try-it).
- [Super Mario Wiki — Rocket Start](https://www.mariowiki.com/Starting_Boost) y [Nintendo Life — salida en 8 Deluxe](https://Nintendolife.Com/guides/mario-kart-8-deluxe-boost-how-to-get-a-rocket-start).
