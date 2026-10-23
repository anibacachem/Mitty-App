// Conexión a Supabase usando fetch (sin librerías extra).
// Las llaves vienen del archivo .env (nunca se escriben aquí).
// Importante: Expo solo reemplaza process.env.EXPO_PUBLIC_X escrito tal cual, con punto.
const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// Función única para hablar con la base de datos.
//   ruta:         tabla y filtros, por ejemplo "parejas?codigo=eq.ABC"
//   metodo:       GET (leer), POST (crear)
//   cuerpo:       datos a guardar (solo en POST)
//   codigoPareja: va en el header x-pareja; la base solo deja pasar filas con ese código
export async function pedir(ruta, { metodo = 'GET', cuerpo, codigoPareja } = {}) {
  const headers = {
    apikey: LLAVE,
    'Content-Type': 'application/json',
    Prefer: 'return=representation', // pide que devuelva la fila creada
  };
  if (codigoPareja) headers['x-pareja'] = codigoPareja;

  const respuesta = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  // Si Supabase responde con error (401, 403, etc.), lo avisamos con el detalle.
  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Supabase ${respuesta.status}: ${detalle}`);
  }
  return respuesta.json();
}
