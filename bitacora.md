# Bitácora

- feat: pantalla de inicio y conexión a Supabase | archivos: App.js, src/supabase.js, src/pantallas/Inicio.js, bitacora.md | motivo: Fase 1 paso 1, base para crear o unirse a una pareja
- style: la app pasa a llamarse Mitty App | archivos: src/pantallas/Inicio.js, app.json, bitacora.md | motivo: nombre definitivo de la app
- fix: mostrar el motivo del error de conexión | archivos: src/pantallas/Inicio.js, bitacora.md | motivo: diagnosticar "No hay conexión" en la pantalla de inicio
- docs: README, CLAUDE.md y .env.example completos | archivos: README.md, CLAUDE.md, .env.example, bitacora.md | motivo: dejar documentado el proyecto; la URL de Supabase se corrigió en .env (sin /rest/v1) y la conexión ya funciona
- feat: crear pareja con código de 10 caracteres | archivos: App.js, src/codigo.js, src/pantallas/CrearPareja.js, bitacora.md | motivo: Fase 1 paso 2, guardar la pareja en la tabla parejas
- feat: botón para copiar el código de pareja | archivos: src/pantallas/CrearPareja.js, package.json, package-lock.json, bitacora.md | motivo: pasar el código al otro teléfono sin dictarlo (expo-clipboard)
- feat: unirme con código y elegir quién soy | archivos: App.js, src/pantallas/UnirmeConCodigo.js, bitacora.md | motivo: Fase 1 paso 3, buscar la pareja en Supabase y guardar si soy nombre0 o nombre1
- feat: guardar la sesión y pantalla principal | archivos: App.js, src/sesion.js, src/pantallas/Principal.js, package.json, package-lock.json, bitacora.md | motivo: Fase 1 paso 4, recordar pareja y quién soy con AsyncStorage
- feat: botón Añadir gasto y paso de monto | archivos: App.js, src/formato.js, src/pantallas/AnadirGasto.js, src/pantallas/Principal.js, bitacora.md | motivo: Fase 2 paso 1, flujo guiado (monto con puntos de miles y descripción opcional)
- style: resumen fijo arriba en cada paso del gasto | archivos: src/pantallas/AnadirGasto.js, bitacora.md | motivo: Fase 2 paso 1 (mejora), ver lo anotado y poder corregir el monto con un toque
- feat: elegir tipo de gasto y quién pagó | archivos: src/pantallas/AnadirGasto.js, bitacora.md | motivo: Fase 2 paso 2, Mitad / Fracción / Invitación y ¿Quién pagó? con tu nombre primero
- feat: fracción con la parte de cada uno | archivos: src/pantallas/AnadirGasto.js, bitacora.md | motivo: Fase 2 paso 3, escribes tu parte y la del otro se calcula sola
- feat: guardar gastos en Supabase y lista del mes | archivos: App.js, src/codigo.js, src/formato.js, src/pantallas/AnadirGasto.js, src/pantallas/Principal.js, bitacora.md | motivo: Fase 2 paso 4, el gasto se guarda en movimientos y se lista con los más recientes primero
- feat: saldo, detalle, sincronización cada 5 s y aviso al guardar | archivos: App.js, src/saldo.js, src/supabase.js, src/pantallas/Principal.js, bitacora.md | motivo: Fase 3, tarjeta de saldo con indicador Sincronizado/Sin conexión, detalle por persona, reparto al tocar una fila y mensaje "Gasto anotado"
