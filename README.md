# Mitty App

Una app para que una pareja anote en segundos sus gastos compartidos y cierre el mes sin discutir.

## Qué problema decidimos atacar

La pareja comparte muchos gastos: unos a medias, otros que paga uno por el otro y otros que son una invitación. Cada fin de mes discuten porque no recuerdan quién pagó qué ni cuál fue invitación, y el historial del banco no trae ese detalle. Intentaron llevar un hilo de WhatsApp con cada gasto compartido, pero igual había que calcular todo a fin de mes y rehacer la trazabilidad, que se perdía con los gastos no anotados. A fin de mes perdían tiempo y cabeza recordando quién invitó a qué y qué se pagó a medias, y calculando y rastreando.

El problema no es calcular quién debe a quién. Es el hábito de anotar cada gasto en el momento en que ocurre.

## Por qué ese y no otro

La cuenta es fácil; anotar a tiempo no lo fue. Por eso Mitty reduce el esfuerzo a unos pocos toques (monto, cómo se reparte y quién pagó) y da una recompensa inmediata: la otra persona lo ve y el saldo se actualiza. Atacar la calculadora o el reparto no habría cambiado nada, porque el fallo ocurría antes: el gasto no quedaba anotado.

Sabremos que el hábito cambió si, durante cuatro semanas:

- Al menos 3 de cada 4 semanas llegan a 8 gastos anotados o más.
- La mayoría de los gastos se anotan el mismo día en que ocurren.
- Saldar la cuenta del mes toma menos de 5 minutos y sin discusión.

## Qué dejamos fuera, y por qué

- **Expansión de gastos compartidos con amigos, roomies, familia, etc.:** Mitty es solo para una pareja. Sumar más personas cambia el reparto y el saldo, y no es lo que queremos probar.
- **Conexión con bancos:** no hace falta para probar el hábito y exige datos sensibles.
- **Exportar a Excel o PDF:** pospuesto; el prototipo se enfoca en el hábito de anotar.
- **Edición de gastos:** no es necesaria para probar el hábito. Solo se puede eliminar uno o varios gastos para corregir un error; los pagos del cierre no se eliminan.
- **Inicio de sesión:** el acceso es por código de pareja, suficiente para un prototipo. Con datos reales haría falta iniciar sesión.
- **Varias parejas por cuenta:** no cambia la hipótesis que queremos probar.
- **Penalizar anotar tarde:** se muestra cuántos gastos se anotaron en el momento, pero no resta puntos, para no castigar a quien anota después.
- **Abrir "Añadir gasto" al tocar un recordatorio:** lo probamos y no funcionó, así que se quitó; hoy el aviso solo abre la app.
- **Recordatorios inteligentes, widget y accesos rápidos:** los recordatorios del engranaje son tres avisos fijos al día (10:00, 15:00 y 20:00); que se salten cuando ya anotaste, un widget y los accesos rápidos quedaron para una siguiente versión.
- **Mejoras de Mitty AI:** corregir un campo sin repetir la frase, y más idiomas o acentos en la voz.

---

## Cómo medimos el hábito

La meta es **10 gastos anotados por semana** (de lunes a domingo) y desde **8** la semana es un éxito. Cuenta todo gasto anotado (compartido, personal o invitación). Además se muestra aparte cuántos se anotaron **el mismo día en que ocurrieron**, que es el hábito real, sin restar puntos a quien anota tarde. Hay un acumulado del mes, con cuántas semanas llegaron al éxito, que vuelve a cero cada mes.

Prueba de velocidad: el autor anotó gastos de prueba, tanto a mano como con Mitty AI, y le tomó alrededor de 20 segundos cada uno, que es la meta que nos pusimos. Fue una prueba informal de una sola persona, no una medición con varias parejas.

Limitación: la app no sabe cuántos gastos hubo en realidad. Un gasto que nadie anotó no se detecta, y la meta de 10 es fija, igual para una semana de muchos gastos que para una de pocos. El acceso es solo por el código de la pareja: quien lo tenga puede ver y eliminar sus gastos.

## Qué construimos

1. Crear la pareja con un código (se puede copiar) y unirse desde otro teléfono.
2. Anotar un gasto en pocos toques: monto, cómo se reparte (mitad, fracción, invitación o gasto personal), quién pagó y la fecha (hoy, ayer u otro día). En invitación y gasto personal se pregunta además quién invitó o de quién es el gasto: si pagó la otra persona, el dueño le debe todo.
3. Lista y saldo compartidos, sincronizados entre los dos teléfonos cada 5 segundos. El saldo dice "Al día", "Le debes $X a Y" o "Y te debe $X". El detalle es del mes en curso y va en dos grupos, "Gastos compartidos" y "Gastos personales e invitaciones", con el gasto total y lo que le correspondía a cada uno; abajo, los pagos entre ustedes y el resultado en palabras ("Debe" / "Le deben"); el botón (i) explica cada concepto.
   Los gastos del mes van en una caja con scroll propio (unos 5 visibles), con el total (N), filtros (Todos, Compartidos, Personales e invitaciones, Pagos) y orden por fecha del gasto, con un botón para invertirlo. En la lista, "Gastó" es un gasto anotado y "Pagó" es un pago entre ustedes. Para corregir un error, el botón "Seleccionar" permite marcar uno o varios gastos y eliminarlos con confirmación; los pagos del cierre no se pueden eliminar.
4. Esta semana (el ritual de domingo): la tarjeta "Esta semana" de la pantalla principal muestra los gastos anotados contra la meta (10 por semana, éxito desde 8) y al tocarla abre la pantalla con un mensaje amable, el medidor, lo anotado cada día y el acumulado del mes con las semanas logradas. Las flechas permiten ver semanas anteriores.
5. Saldar cuenta del mes (cierre de mes): resumen del mes y un botón para registrar el pago del que debe, con confirmación, que deja el saldo en cero. El pago se registra siempre a nombre de quien debe, lo toque cualquiera de los dos.
6. Mitty AI: un botón para anotar un gasto escribiendo o hablando ("pagué 25 mil en el super, a medias"). Una función de Supabase (`interpretar-gasto`) consulta a Gemini, que entiende la frase; la app muestra lo que entendió y el gasto solo se guarda si se confirma. La cuenta (que las partes sumen el total) la hace el código, no la IA, y la llave de Gemini vive como secreto en Supabase, nunca en la app ni en el repositorio.

## Cómo probarlo

Necesitas Expo Go con soporte del SDK 58 y un proyecto propio de Supabase.

1. Crea un proyecto en Supabase y, en el SQL Editor, ejecuta `supabase/esquema.sql`. (Si tu base ya existía de antes, ejecuta también `supabase/dueno.sql`.)
2. Clona el repo y ejecuta `npm install`.
3. Copia `.env.example` a `.env` y completa las dos variables con la Project URL (sin `/rest/v1` al final) y la llave *publishable* de tu proyecto. Nunca uses la llave secret.
4. Ejecuta `npx expo start` y escanea el QR con Expo Go.

Para Mitty AI (opcional; sin esto la app funciona igual, solo no anota por texto o voz):

1. En Supabase, ve a Edge Functions y crea una función llamada `interpretar-gasto`; pega el contenido de `supabase/functions/interpretar-gasto/index.ts` y desactiva *Verify JWT*.
2. En los secretos de las funciones agrega `GEMINI_API_KEY` con una llave de Gemini. Opcionalmente `GEMINI_MODEL` para cambiar el modelo (por defecto `gemini-3.1-flash-lite`).
3. Despliega la función. Cada vez que cambies `index.ts` hay que volver a desplegarla.

La capa gratuita de Gemini puede usar el contenido para mejorar productos de Google, por eso en las pruebas se usan solo datos inventados.

El guion de la presentación de 5 minutos está en [DEMO.md](DEMO.md).

Demo con una pareja ficticia: [código de la pareja de demo].

## Equipo y notas

Angel, trabajando solo. Todo el código se escribió durante la Hackatón Señales (23 y 24 de octubre de 2026). Los datos de la demo son inventados; no hay datos de personas reales.
