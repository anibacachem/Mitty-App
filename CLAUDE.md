Instrucciones del proyecto
Contexto
Proyecto de la Hackatón Señales (caso 06, un hábito de bienestar): una app móvil para que una pareja anote en el momento sus gastos compartidos y cierre el mes sin discutir. Stack: Expo (React Native) con SDK 58 y Supabase como base de datos. Trabaja una sola persona, Angel, que está aprendiendo a programar: explica con palabras simples.

1. Reglas del evento
Todo el código se escribe durante el evento. No copies código de proyectos anteriores.
Solo datos inventados. Nunca datos personales ni financieros reales.
Nunca leas, edites ni subas .env. Nunca escribas llaves ni contraseñas en el código: usa EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY, definidas en .env.
2. Alcance
Prioriza este recorrido y nada más: anotar un gasto en una línea (meta: menos de 20 segundos), lista y saldo sincronizados entre dos teléfonos, ritual de domingo (resumen semanal) y cierre de mes. Quedan fuera: bancos, edición de gastos, inicio de sesión y varias parejas. Si te pido algo fuera de ese alcance, avísame antes de hacerlo.

3. Al empezar una sesión
Lee README.md y bitacora.md para saber qué se hizo antes.
Ejecuta git status.
4. Modo guiado (obligatorio)
Avanza paso a paso, nunca todo de golpe. Estoy aprendiendo.

Ante un pedido nuevo, antes de escribir código: repite el objetivo en una frase; si quedan decisiones abiertas (cómo se ve, cómo se comporta, qué datos usa), haz de 1 a 3 preguntas cortas, cada una con una opción recomendada, y espera la respuesta antes de editar.
Si el pedido es grande, divídelo en pasos numerados (máximo 5) y haz solo el paso 1. Empieza cada respuesta con "Paso N de M: <título>".
Un paso por respuesta: una función pequeña que se pueda probar en Expo Go. No pases al siguiente paso hasta que responda.
Explica en simple qué hace el código nuevo y por qué lo escribiste así. Muestra en la respuesta el fragmento clave (máximo 20 líneas), con comentarios en español.
Cierra cada paso con "Sugerencias": 2 o 3 mejoras posibles, con letra (A, B, C), una línea de beneficio por cada una y la que recomiendas marcada. Termina con una sola pregunta: "¿Cuál seguimos?".
Excepción: si mi mensaje empieza con "Rápido:", puedes hacer varios pasos seguidos sin preguntar. Mantén el commit sugerido y la bitácora.
5. Cómo trabajar
Toca solo los archivos necesarios y dime cuáles tocaste.
Interfaz en español y comentarios del código en español.
Usa fetch contra la API REST de Supabase en lugar de librerías extra. En cada petición envía el header x-pareja con el código de la pareja.
Instala librerías con npx expo install <paquete> para que calcen con el SDK 58.
No ejecutes git commit, git push, git pull, git reset ni git checkout. Esas acciones las hago yo en Git Bash.
6. Al terminar CADA paso que cambie archivos, sin que te lo pidan
Cierra la respuesta siempre con estas partes, en este orden:

Qué cambié: de 1 a 3 líneas simples.
Cómo probarlo: 1 línea. Expo Go se actualiza solo; di qué buscar en la pantalla.
Commit sugerido: un bloque listo para pegar en Git Bash, que guarda el commit y lo sube a GitHub:

```bash
git add <archivos que cambiaron, separados por espacio>
git commit -m "<tipo>: <qué se hizo, en español, máximo 72 caracteres>"
git push
```

Sugerencias: las del modo guiado (punto 4), con la pregunta final.

Tipos: feat (función nueva), fix (arreglo), docs (textos y README), style (diseño), refactor (ordenar código), chore (configuración).
Si el paso produjo cambios sin relación entre sí, entrega un bloque de commit por cada uno.
Incluye siempre bitacora.md en el git add (punto 7).
Si en la respuesta no cambiaste archivos, no incluyas el commit sugerido.
7. Bitácora
Cada paso agrega una línea en bitacora.md con este formato: - <mensaje del commit> | archivos: ... | motivo: .... Así, en la próxima sesión, sabes qué se hizo sin que te lo cuente.