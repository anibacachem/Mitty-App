# Guion de demo de Mitty (5 minutos)

La idea que ordena todo: **Mitty no resuelve una cuenta, resuelve un hábito.** Calcular quién debe a quién es fácil; lo difícil es anotar cada gasto en el momento en que ocurre. Por eso la solución es una app: está en el bolsillo justo cuando se gasta, tarda unos 20 segundos y da una recompensa inmediata.

## Línea de tiempo

| Tiempo | Qué muestro | Qué quiero que se lleven |
|---|---|---|
| 0:00 – 0:45 | El problema (historia propia) | Es un problema real y repetido, no inventado |
| 0:45 – 1:20 | Lo que intentamos y por qué falló | Probamos soluciones simples antes de construir |
| 1:20 – 1:50 | Por qué una app y por qué un hábito | El cuello de botella es anotar a tiempo |
| 1:50 – 3:50 | Demo en vivo (ocho momentos, abajo) | Rápido de usar, sincronizado y con progreso |
| 3:50 – 4:30 | Sensación de progreso y límites honestos | Sabemos qué medimos y qué no |
| 4:30 – 5:00 | ¿La usaríamos? | Cierre personal y honesto |

## 1. El problema (0:00 – 0:45)

> "Con mi pareja llevamos siete años juntos y vivimos juntos hace uno. Y siempre tenemos el mismo problema: muchos de nuestros gastos son compartidos o a medias. Cada fin de mes aparecen las discusiones, porque no llevamos un control de quién le debe qué a quién. Revisamos el historial del banco, pero muchas veces no trae el detalle, o no nos acordamos si ese gasto fue a medias o si uno invitó al otro."

Idea clave: el banco dice **cuánto** se gastó, no **de quién era** el gasto.

## 2. Lo que intentamos y por qué falló (0:45 – 1:20)

> "Intentamos llevar un hilo de WhatsApp donde anotábamos cada gasto compartido. Funcionó unos días y después se perdía entre otros mensajes, y dejamos de usarlo. Y cuando llegaba fin de mes, perdíamos tiempo y cabeza tratando de recordar quién invitó a qué y qué se pagó a medias, calculando y rastreando."

Idea clave: la idea de anotar era buena; el **medio** fallaba (sin estructura, sin cálculo, sin recompensa).

## 3. Por qué la solución es una app (1:20 – 1:50)

> "Nos dimos cuenta de que el problema no es calcular, es el hábito de anotar en el momento. Por eso lo hicimos una app: está en el teléfono cuando pagas, anotas en unos 20 segundos, tu pareja lo ve al instante, y el saldo ya está calculado. Y como es un hábito, la app te acompaña: te recuerda a tres horas del día y te muestra tu progreso de la semana."

## 4. Demo en vivo (1:50 – 3:50)

Preparar dos teléfonos con Expo Go, una pareja inventada (Ana y Luis) y datos de prueba. Cada momento dura unos 15 segundos.

1. **Pantalla principal.** Mostrar el saldo ("Al día") y la tarjeta "Esta semana" con la barra de 10 tramos, por ejemplo 6/10. *"Lo primero que ves es cómo vas."*
2. **Anotar a mano un gasto compartido.** Monto, Mitad, quién pagó. Cronometrar en voz alta: *"unos 20 segundos."*
3. **Sincronización.** Mirar el segundo teléfono: el gasto aparece solo y el saldo cambia. *"La otra persona lo ve y no hay nada que recordar."*
4. **Mitty AI por voz.** Decir: *"Invité yo a comer, 25 mil, pero pagó Ana."* Mostrar lo que entendió y confirmar. El saldo pasa a "Luis le debe $25.000". *"Justo el caso que antes nos hacía discutir."*
5. **Esta semana.** Abrir la tarjeta: el medidor, la raya en 8 (éxito), el mensaje amable y cuántos gastos se anotaron en el momento. *"Nunca hay culpa: cada gasto suma."*
6. **Detalle del saldo.** Dos grupos: compartidos y personales e invitaciones. *"Se entiende de dónde sale cada número."*
7. **Recordatorios.** Activar en el engranaje y mostrar la notificación de prueba. *"Tres avisos al día, a las 10:00, 15:00 y 20:00, para no depender de la memoria."* (No prometer que al tocarla abre "Añadir gasto": esa parte no está verificada.)
8. **Saldar cuenta del mes.** Un botón, confirmación, saldo en cero. *"Lo que antes era una noche de discusión, hoy es un botón."*

Si la IA falla o no hay internet: seguir con el gasto manual (es el plan B) y decir que la IA es una ayuda, no un requisito.

## 5. Sensación de progreso y límites honestos (3:50 – 4:30)

- La barra de 10 tramos se llena con cada gasto y el tramo 8 marca el éxito: **8 de 10 es una semana lograda.**
- Mensajes sin culpa, que celebran lo hecho. El mes muestra cuántas semanas se lograron.
- Se mide aparte cuántos gastos se anotaron **el mismo día**, sin restar puntos a quien anota tarde.
- Límites: la app no sabe cuántos gastos hubo en realidad; el acceso es por un código de pareja (para un prototipo); no hay bancos ni edición, solo eliminar.

> "Una prueba informal nuestra: anotar un gasto toma alrededor de 20 segundos, a mano o con la IA."

## 6. ¿La usaríamos? (4:30 – 5:00)

Responder con lo que sea verdad para ti. Una base, para que la ajustes con tus palabras:

> "Sí, la usaríamos, porque es la primera solución que ataca el hábito y no solo el cálculo. [Agrega aquí tu razón personal.] Y lo que más queremos probar ahora es si, durante cuatro semanas, al menos tres llegan a los 8 gastos anotados."

Si hasta el pitch la usaron en pareja unos días, di cuántos y qué notaron. Es mejor un dato pequeño y real que una afirmación grande.

## Antes de subir al escenario

- [ ] Dos teléfonos con Expo Go, con batería y conectados al mismo internet.
- [ ] La función `interpretar-gasto` desplegada y `dueno.sql` ejecutado en Supabase.
- [ ] Pareja inventada (Ana y Luis) con datos de varias semanas; si hace falta, borrar pruebas con "Seleccionar".
- [ ] Recordatorios activados y permiso de notificaciones concedido.
- [ ] Ensayo cronometrado de punta a punta, dos veces, en menos de 5 minutos.
- [ ] Completar en el README el código de la pareja de demo.

## Preguntas que pueden hacer

- **¿Por qué no una planilla o un chat?** Lo probamos con WhatsApp: sin estructura ni cálculo, se abandona. Aquí anotar es de unos 20 segundos y el saldo sale solo.
- **¿Qué pasa con los datos?** El prototipo usa solo datos inventados. Para datos reales haría falta iniciar sesión.
- **¿Cómo saben que el hábito cambia?** Lo definimos: tres de cuatro semanas con 8 gastos o más, y la mayoría anotados el mismo día.
- **¿Qué falta?** Avisos más inteligentes (que se salten si ya anotaste), un widget, accesos rápidos y bancos.
