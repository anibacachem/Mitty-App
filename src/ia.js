// Habla con la Edge Function "interpretar-gasto" de Supabase, que es la que consulta a la IA.
// La llave de la IA NO está aquí: vive como secreto en Supabase. Aquí solo usamos la llave publishable de siempre.
import { hoyISO } from './formato';

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// La IA tarda más que la base de datos, por eso damos más margen (20 segundos)
const ESPERA_MAXIMA_MS = 20000;

// Envía una frase y devuelve { ok: true, gasto, supuestos } o { ok: false, mensaje }.
//   codigo: código de la pareja. yo: 0 o 1 (quién habla). texto: lo que escribió.
// Si no hay conexión o la función falla, lanza un Error con el motivo.
export async function interpretarGasto({ codigo, yo, texto }) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), ESPERA_MAXIMA_MS);
  try {
    const respuesta = await fetch(`${URL_BASE}/functions/v1/interpretar-gasto`, {
      method: 'POST',
      headers: { apikey: LLAVE, 'x-pareja': codigo, 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, yo, hoy: hoyISO() }),
      signal: controlador.signal,
    });
    const datos = await respuesta.json().catch(() => null);
    if (!datos) throw new Error(`La función respondió ${respuesta.status} sin datos`);
    return datos; // incluso un "no entendí" llega aquí con ok:false y su mensaje
  } finally {
    clearTimeout(temporizador);
  }
}
