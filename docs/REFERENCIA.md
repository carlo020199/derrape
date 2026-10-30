# Referencia: Mario Kart Tour y Mario Kart 7 frente a Derrape

Para comparar mientras pruebas. Cada tema tiene tres columnas: cómo es en **Tour** (el de móvil),
cómo es en **MK7** (Nintendo 3DS, la base de las físicas de Tour) y cómo está **Derrape hoy**.
Las físicas en detalle están en `docs/FISICAS.md`.

> Son **mecánicas** del género: se pueden imitar. Nombres, personajes, objetos concretos,
> circuitos y gráficos de Nintendo **no** se copian (ver `CLAUDE.md`). Aquí se nombran solo para comparar.

Leyenda del estado en Derrape: ✅ hecho · 🟡 parcial · ⏳ en el plan (fase) · ➖ no lo vamos a hacer

---

## 1. Controles

| Tema | Tour | MK7 | Derrape hoy |
|---|---|---|---|
| Orientación | Vertical | Consola (horizontal) | ✅ Vertical en móvil |
| Acelerar | Siempre automático | Botón | ✅ Automático en móvil (en PC, flecha arriba) |
| Frenar / marcha atrás | No hay | Botón | ✅ No hay en móvil (en PC, flecha abajo) |
| Girar | Arrastrar el dedo a los lados | Stick | ✅ Arrastrar el dedo |
| Giroscopio | Opcional | En vista en primera persona | ✅ Opcional en ajustes (necesita HTTPS) |
| Derrape automático | Sí (por defecto): girar un rato empieza a derrapar; carga azul y naranja | Sí, con el stick | ➖ Solo manual (es el único con morado) |
| Derrape manual | Opción: arrastrar lejos = salto + derrape | Botón R: salto + derrape | ✅ Arrastrar lejos = salto de 0,22 s + derrape |
| Saltito con un toque | En una de las opciones de control, cada toque es un salto | Botón R | ➖ En Derrape el toque usa el objeto |
| Giro inteligente | Opción que te aparta de los muros (intensidad ajustable) | Opción | ⏳ Posible ajuste futuro |
| Usar objeto | Tocar | Botón L | ✅ Tocar |
| Lanzar adelante / atrás | Deslizar arriba / abajo | Stick arriba/abajo + botón | ✅ Deslizar arriba / abajo |

**Cómo probarlo:** gira solo con arrastres pequeños y comprueba que no derrapa; arrastra lejos y
comprueba que salta y luego derrapa; levanta el dedo y mira si sale el turbo.

## 2. Conducción y derrape

| Tema | Tour | MK7 | Derrape hoy |
|---|---|---|---|
| Aceleración | Base de MK7 | Dos fases: arranque fuerte y final suave | ✅ Igual (95 % de la punta en ~2,7 s) |
| Salto antes del derrape | Sí (manual) | Sí | ✅ 0,22 s |
| Niveles de chispas | 3: azul, naranja, rosa/morado (morado solo en manual) | 2: azul y naranja | ✅ 3: azul, naranja, morado |
| Carga | No carga en el aire. Más rápida cerrando la curva (dato de otras entregas) | Las chispas dependen de lo cerrada que sea la curva | ✅ Cerrando la curva 2,5× más rápido; no carga en el aire |
| Duración del mini-turbo | Según la estadística del kart | 30 / 90 fotogramas (0,5 / 1,5 s) por defecto | ✅ 0,62 / 1,67 / 2,63 s (cifras de 8 Deluxe) |
| Salida con turbo | Existe; el momento exacto no está documentado | Pulsar acelerar cuando sale el "2" | ✅ Mantener el dedo en la pantalla (o la flecha arriba) desde que sale el "2": perfecta = turbo de 1,2 s; algo tarde = 0,5 s; antes del "2" = calado 1 s |
| Rebufo | Existe | Ir detrás de otro 3–5 s → acelerón de ~3 s | ⏳ Después de la 1.0 |
| Saltos con truco | Sí, cuentan para combos | Truco en una rampa → turbo al aterrizar | ⏳ Fase 3/8 (rampas) |
| Planeador | Sí | Sí (rampas azules) | ➖ No previsto |
| Bajo el agua | Sí (puntos por agua) | Sí, con otra velocidad y manejo | ➖ No previsto |
| Fuera de pista | Te frena | Punta ×0,78 / ×0,43 / ×0,31 según el terreno | ✅ Arcén a ×0,45 y zonas de arena a ×0,35; los turbos lo ignoran |
| Monedas | Hasta 99 por carrera (sirven para la tienda) | Hasta 10; cada una sube un poco la punta; las pierdes al recibir un golpe | ➖ No previsto |

**Cómo probarlo:** cronometra cuánto tardas en ver cada color cerrando la curva (debería ser
0,9 / 1,9 / 2,9 s) y abriéndola (más lento). Compara la duración del turbo morado con la del azul.

## 3. Objetos

| Tema | Tour | MK7 | Derrape hoy |
|---|---|---|---|
| Huecos de objeto | 3 por defecto (1 o 2 en algunas partidas multijugador) | 1 | 🟡 1 |
| Ruleta | Sí | Sí | ✅ 1 s |
| Reparto según posición | Sí | Sí | ✅ Delante: defensa; detrás: ataque. Online lo decide el servidor |
| Frenesí | 3 objetos iguales → 9 s usándolo sin límite y siendo invencible | No | ➖ No previsto (sería con 3 huecos) |
| Objeto especial por personaje | Sí | No | ➖ No previsto |
| Cantidad de objetos | Muchos (más los especiales) | 15 (sin contar los triples) | 🟡 4: Nitro, Aceite, Cohete, Escudo |

Equivalencias aproximadas de nuestros objetos (solo para comparar el efecto):

| Derrape | Parecido a | Diferencia |
|---|---|---|
| ⚡ Nitro | Champiñón | El nuestro da +30 % durante 1,5 s |
| 🛢️ Aceite | Plátano | Igual: se suelta detrás o se lanza adelante |
| 🚀 Cohete | Caparazón rojo | Persigue al de delante; hacia atrás va recto |
| 🛡️ Escudo | Burbuja (Tour) | La nuestra no da velocidad y dura 8 s |

**Cómo probarlo:** suelta aceite detrás de un kart de prueba y mira si lo pisa; lanza el cohete con
un kart por delante en otro carril; pon el escudo y busca que te den.

## 4. Formato de carrera

| Tema | Tour | MK7 | Derrape hoy |
|---|---|---|---|
| Corredores | 8 | 8 | 🟡 4 (tú + 3 de prueba); objetivo 2–8 amigos |
| Cilindradas | 50 / 100 / 150 / 200 cc | 50 / 100 / 150 cc + espejo | ➖ Una sola velocidad (de momento) |
| Copas | Copas de 3 carreras + desafío | 8 copas de 4 circuitos | ⏳ 2 copas de 5 circuitos (Fase 8) |
| Puntos por puesto | Tour puntúa por acciones (ver abajo) | 1º a 8º: 10, 8, 6, 5, 4, 3, 2, 1 | ⏳ Fase 8 (los de MK7 son buena base) |
| Circuitos en tramos | Algunos de 3 tramos | Algunos de 3 tramos (cada tramo cuenta como vuelta) | ➖ Vueltas normales |
| Circuitos al revés / con trucos | Sí (variantes R y T) | No | ⏳ Espejo después de la 1.0 |

### Puntuación de Tour (por si quieres algo parecido)
- Ganas puntos por acciones: saltos con truco, planear, derrapar, golpear a otros, ir primero en una vuelta…
- **Combos:** encadenar acciones en menos de ~2 s multiplica los puntos.
- Al final se multiplica según el puesto (1º ×1 … 8º ×0,2).
- En Derrape no está previsto: entre amigos importa quién llega primero.

## 5. Personajes y karts

| Tema | Tour | MK7 | Derrape hoy |
|---|---|---|---|
| Elección | Piloto + kart + planeador | Piloto + carrocería + ruedas + planeador | ✅ Personaje + coche + color |
| Estadísticas | Sobre todo afectan a los puntos (cada pieza tiene circuitos favoritos) | Velocidad, aceleración, peso, manejo, fuera de pista (+ ocultas: mini-turbo, agarre…) | ✅ Velocidad, aceleración, manejo, peso |
| Clases de peso | — | 5 (pluma a pesado) | ✅ 3 (ligero, medio, pesado) |
| Peso en los choques | — | La masa pasa de "parado" a "a tope" según la velocidad; el pesado empuja más | ✅ Pesos 1–5: el ligero se aparta más y pierde más velocidad |
| Progreso / desbloqueos | Niveles, tienda, pase de pago | Desbloqueo con monedas | ➖ Todo disponible desde el inicio |

## 6. Multijugador

| Tema | Tour | MK7 | Derrape hoy |
|---|---|---|---|
| Jugadores | Hasta 8 | Hasta 8 (local u online) | ⏳ 2–8 con código de sala (Fase 4) |
| Salas privadas | Sí: elegir cc, huecos de objeto, equipos y número de carreras | Comunidades | ⏳ Código de 4 letras; el anfitrión elige |
| Batalla | Globos | Globos y monedas | ➖ Después de la 1.0, si acaso |
| Contrarreloj | Sí | Contra hasta 7 fantasmas | ⏳ Después de la 1.0 (con fantasma) |

---

## Lista de pruebas para comparar (rellénala al probar)

| # | Qué probar | Esperado (referencia) | Tu resultado |
|---|---|---|---|
| 1 | Desde parado hasta la punta | Arranque fuerte, ~2,7 s al 95 % | |
| 2 | Arrastre pequeño | Gira sin derrapar | |
| 3 | Arrastre largo | Saltito y derrape hacia ese lado | |
| 4 | Chispas cerrando la curva | Azul 0,9 s · naranja 1,9 s · morado 2,9 s | |
| 5 | Chispas abriendo la curva | Bastante más lento | |
| 6 | Soltar con chispas moradas | Turbo de ~2,6 s claramente más largo que el azul | |
| 7 | Chocar de frente con el muro | Pierdes el derrape y bastante velocidad | |
| 8 | Rozar el muro | Casi no frena | |
| 9 | Tocar con objeto | Se usa (aceite detrás, cohete adelante) | |
| 10 | Deslizar arriba / abajo | Lanza adelante / atrás | |
| 11 | Ruleta | ~1 s antes de poder usarlo | |
| 12 | Ir último vs primero | Detrás salen más cohetes y nitros | |
| 13 | Fps en tu móvil | ~60 | |
| 14 | Salida: mantener el dedo justo al salir el "2" | "¡Salida perfecta!" y acelerón | |
| 15 | Salida: tocar antes del "2" | "¡Calado!" y 1 s sin moverte | |
| 16 | Salirte al arcén | Frenas mucho; con turbo no | |
| 17 | Ir al revés | Aviso "¡Dirección contraria!" y no suma vueltas | |
| 18 | Quedarte atascado 3 s | Reapareces en el último punto de control | |

## Lo que no está documentado (o no pude confirmar)
- Momento exacto de la salida con turbo en Tour.
- Umbrales y velocidades de carga de Tour (se asume la base de MK7 / otras entregas).
- El umbral del tercer nivel de chispas.
- Algunos efectos de objetos especiales de Tour cambiaron con las actualizaciones.

## Fuentes
- [Super Mario Wiki — Mario Kart Tour](https://www.mariowiki.com/Mario_Kart_Tour): controles, huecos de objeto, frenesí, puntuación y combos, multijugador.
- [Super Mario Wiki — Mario Kart 7](https://www.mariowiki.com/Mario_Kart_7): controles, objetos, monedas, puntos por puesto, personalización, batalla.
- [Super Mario Wiki — Frenzy](https://mariowiki.com/Frenzy_(Mario_Kart_Tour)): 9 s de frenesí.
- [GameRevolution — lista de objetos de Tour](https://www.gamerevolution.com/?p=600671) e [iMore — objetos de Tour](https://www.imore.com/every-weapon-and-item-mario-kart-tour): lanzar adelante/atrás deslizando.
- [Super Mario Wiki — Slipstream](https://www.mariowiki.com/Slipstreaming): rebufo de 3–5 s y acelerón de ~3 s.
- [Nintendo Life — consejos de Mario Kart 7](https://www.nintendolife.com/news/2011/12/guide_mario_kart_7_top_tips).
- Las fuentes de las físicas están en `docs/FISICAS.md`.
