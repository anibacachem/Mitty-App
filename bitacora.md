# Bitácora

- feat: pantalla de inicio y conexión a Supabase | archivos: App.js, src/supabase.js, src/pantallas/Inicio.js, bitacora.md | motivo: Fase 1 paso 1, base para crear o unirse a una pareja
- style: la app pasa a llamarse Mitty App | archivos: src/pantallas/Inicio.js, app.json, bitacora.md | motivo: nombre definitivo de la app
- fix: mostrar el motivo del error de conexión | archivos: src/pantallas/Inicio.js, bitacora.md | motivo: diagnosticar "No hay conexión" en la pantalla de inicio
- docs: README, CLAUDE.md y .env.example completos | archivos: README.md, CLAUDE.md, .env.example, bitacora.md | motivo: dejar documentado el proyecto; la URL de Supabase se corrigió en .env (sin /rest/v1) y la conexión ya funciona
- feat: crear pareja con código de 10 caracteres | archivos: App.js, src/codigo.js, src/pantallas/CrearPareja.js, bitacora.md | motivo: Fase 1 paso 2, guardar la pareja en la tabla parejas
