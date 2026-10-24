# Mitty App

Una app para que una pareja anote en segundos sus gastos compartidos y cierre el mes sin discutir.

## Qué problema decidimos atacar

La pareja comparte muchos gastos: unos a medias, otros que paga uno por el otro y otros que son una invitación. Cada fin de mes discuten porque no recuerdan quién pagó qué ni cuál fue invitación, y el historial del banco no trae ese detalle. Intentaron llevar un hilo de WhatsApp con cada gasto compartido, pero se perdía entre otros mensajes y dejaron de usarlo.

El problema no es calcular quién debe a quién. Es el hábito de anotar cada gasto en el momento en que ocurre.

## Por qué ese y no otro

La cuenta es fácil; anotar a tiempo no lo fue. Por eso Mitty reduce el esfuerzo a unos pocos toques (monto, cómo se reparte y quién pagó) y da una recompensa inmediata: la otra persona lo ve y el saldo se actualiza.

El hábito se mide con un conteo simple: la meta es **3 gastos compartidos por día**. Si un día hubo menos, la pareja lo declara (ninguno, solo 1 o solo 2) y la meta de ese día baja, así un día sin gastos no cuenta en contra. Se mide por semana (de lunes a domingo, recortada al mes) y por mes, y el conteo vuelve a cero cada mes.

Sabremos que el hábito cambió si, durante cuatro semanas:
- Al menos 8 de cada 10 gastos esperados quedan anotados (la semana o el mes se marca como "logrado" desde el 80%).
- El cierre de mes toma menos de 5 minutos y sin discusión.

Limitación: el indicador mide cuánto se anota, no si se anota el mismo día, y depende de que la pareja declare con honestidad los días con menos gastos. No detecta un gasto que nadie anotó ni declaró.

## Qué construimos

1. Crear la pareja con un código (se puede copiar) y unirse desde otro teléfono.
2. Anotar un gasto en pocos toques: monto, cómo se reparte (mitad, fracción, invitación o gasto personal), quién pagó y la fecha (hoy, ayer u otro día). En invitación y gasto personal se pregunta además quién invitó o de quién es el gasto: si pagó la otra persona, el dueño le debe todo.
3. Lista y saldo compartidos, sincronizados entre los dos teléfonos cada 5 segundos. El saldo dice "Al día", "Le debes $X a Y" o "Y te debe $X". El detalle es del mes en curso y va en dos grupos, "Gastos compartidos" y "Gastos personales e invitaciones", con el gasto total y lo que le correspondía a cada uno; abajo, los pagos entre ustedes y el resultado en palabras ("Debe" / "Le deben"); el botón (i) explica cada concepto.
   Los gastos del mes van en una caja con scroll propio (unos 5 visibles), con el total (N), filtros (Todos, Compartidos, Personales e invitaciones, Pagos) y orden por fecha del gasto, con un botón para invertirlo. En la lista, "Gastó" es un gasto anotado y "Pagó" es un pago entre ustedes.
4. Esta semana (el ritual de domingo): la tarjeta "Esta semana" de la pantalla principal muestra los gastos anotados contra la meta (10 por semana, éxito desde 8) y al tocarla abre la pantalla con un mensaje amable, el medidor, lo anotado cada día (lunes a domingo) y el acumulado del mes con las semanas logradas. Cuenta todo gasto anotado (compartido, personal o invitación) y muestra aparte cuántos se anotaron el mismo día en que ocurrieron, que es el hábito que busca la app. Las flechas permiten ver semanas anteriores.
5. Cierre de mes: resumen del mes y un botón para registrar el pago del que debe, con confirmación, que deja el saldo en cero. El pago se registra siempre a nombre de quien debe, lo toque cualquiera de los dos.

## Qué dejamos fuera, y por qué

- **Conexión con bancos:** no hace falta para probar el hábito y exige datos sensibles.
- **Exportar a Excel o PDF:** pospuesto; el prototipo se enfoca en el hábito de anotar.
- **Edición de gastos:** no es necesaria para probar el hábito.
- **Inicio de sesión:** el acceso es por código de pareja, suficiente para un prototipo. Con datos reales haría falta iniciar sesión.
- **Varias parejas por cuenta:** no cambia la hipótesis que queremos probar.
- **Medir la puntualidad:** decidimos medir cuánto se anota y no si se anota el mismo día, para no castigar los días con pocos gastos. La base guarda cuándo se anotó cada gasto, por si se quiere medir más adelante.

## Cómo probarlo

Necesitas Expo Go con soporte del SDK 58 y un proyecto propio de Supabase.

1. Crea un proyecto en Supabase y, en el SQL Editor, ejecuta `supabase/esquema.sql` y después `supabase/metas_dia.sql`. (Si tu base ya existía de antes, ejecuta también `supabase/dueno.sql`.)
2. Clona el repo y ejecuta `npm install`.
3. Copia `.env.example` a `.env` y completa las dos variables con la Project URL (sin `/rest/v1` al final) y la llave *publishable* de tu proyecto. Nunca uses la llave secret.
4. Ejecuta `npx expo start` y escanea el QR con Expo Go.

Demo con una pareja ficticia: [código de la pareja de demo]. Versión web: [link, si existe].

## Equipo y notas

Angel, trabajando solo. Todo el código se escribió durante la Hackatón Señales (23 y 24 de octubre de 2026). Los datos de la demo son inventados; no hay datos de personas reales.