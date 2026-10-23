# Mitty App

Una app para que una pareja anote en segundos sus gastos compartidos y cierre el mes sin discutir.

## Qué problema decidimos atacar

La pareja comparte muchos gastos: unos a medias, otros que paga uno por el otro y otros que son una invitación. Cada fin de mes discuten porque no recuerdan quién pagó qué ni cuál fue invitación, y el historial del banco no trae ese detalle. Intentaron llevar un hilo de WhatsApp con cada gasto compartido, pero se perdía entre otros mensajes y dejaron de usarlo.

El problema no es calcular quién debe a quién. Es el hábito de anotar cada gasto en el momento en que ocurre.

## Por qué ese y no otro

La cuenta es fácil; anotar a tiempo no lo fue. Por eso Mitty reduce el esfuerzo a una línea de texto y da una recompensa inmediata: la otra persona lo ve y el saldo se actualiza.

Sabremos que el hábito cambió si, durante cuatro semanas:
- Al menos 8 de cada 10 gastos compartidos se anotan el mismo día en que ocurren.
- El cierre de mes toma menos de 5 minutos y sin discusión.

## Qué construimos

1. Crear la pareja con un código y unirse desde otro teléfono.
2. Anotar un gasto en una línea (por ejemplo, "super 42000 mitad") y confirmarlo con un toque.
3. Lista y saldo compartidos, sincronizados entre los dos teléfonos cada 5 segundos.
4. Ritual de domingo: resumen de la semana con cuántos gastos se anotaron el mismo día.
5. Cierre de mes: registrar el pago y dejar el saldo en cero.

## Qué dejamos fuera, y por qué

- **Conexión con bancos:** no hace falta para probar el hábito y exige datos sensibles.
- **Edición de gastos:** no es necesaria para probar el hábito.
- **Inicio de sesión:** el acceso es por código de pareja, suficiente para un prototipo. Con datos reales haría falta iniciar sesión.
- **Varias parejas por cuenta:** no cambia la hipótesis que queremos probar.

## Cómo probarlo

Necesitas Expo Go con soporte del SDK 58 y un proyecto propio de Supabase.

1. Clona el repo y ejecuta `npm install`.
2. Copia `.env.example` a `.env` y completa las dos variables con tu proyecto.
3. Ejecuta `npx expo start` y escanea el QR con Expo Go.

Demo con una pareja ficticia: [código de la pareja de demo]. Versión web: [link, si existe].

## Equipo y notas

Angel, trabajando solo. Todo el código se escribió durante la Hackatón Señales (23 y 24 de octubre de 2026). Los datos de la demo son inventados; no hay datos de personas reales.