// Edge Function "interpretar-gasto": recibe una frase (texto o audio) y devuelve el gasto ya armado.
// Corre en los servidores de Supabase, NO en el teléfono. Por eso aquí vive la llave de la IA:
//   GEMINI_API_KEY (obligatoria) -> se guarda como "Secret" en Supabase, nunca en el código ni en .env
//   GEMINI_MODEL   (opcional)    -> nombre del modelo; por defecto gemini-3.1-flash-lite
//
// Entrada (POST, JSON):  { texto?: string, audioBase64?: string, mime?: string, yo: 0 | 1, hoy: "2026-10-23" }
// Headers que manda la app: apikey (llave publishable) y x-pareja (código de la pareja)
// Salida: { ok: true, gasto: {...}, supuestos } o { ok: false, mensaje }

const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
const TIPOS = ['mitad', 'fraccion', 'invita', 'por_otro'];
const MAX_TEXTO = 300; // caracteres
const MAX_AUDIO = 2_000_000; // caracteres de base64 (~1,5 MB: sobra para un audio de 20-30 segundos)

// Forma exacta que debe tener la respuesta de la IA (así devuelve siempre JSON y no texto suelto)
const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    entendido: { type: 'BOOLEAN' },
    motivo: { type: 'STRING', nullable: true }, // por qué no se entendió
    monto: { type: 'INTEGER', nullable: true },
    descripcion: { type: 'STRING', nullable: true },
    tipo: { type: 'STRING', enum: TIPOS, nullable: true },
    pagador: { type: 'STRING', enum: ['yo', 'otro'], nullable: true },
    porcentaje_yo: { type: 'INTEGER', nullable: true }, // solo en fracción
    monto_yo: { type: 'INTEGER', nullable: true }, // solo en fracción
    fecha: { type: 'STRING', nullable: true }, // AAAA-MM-DD
    supuestos: { type: 'STRING', nullable: true }, // lo que la IA tuvo que asumir
  },
  required: ['entendido'],
};

// Las instrucciones para la IA. Se arman con los nombres reales de la pareja.
function instrucciones(yoNombre: string, otroNombre: string, hoy: string): string {
  return `Eres el asistente de Mitty, una app chilena donde una pareja anota sus gastos compartidos.
Extrae UN gasto de lo que dice la persona (texto o audio, en español).
La persona que habla se llama ${yoNombre}. Su pareja se llama ${otroNombre}. Hoy es ${hoy}.
Moneda: pesos chilenos, sin decimales. "42 mil" = 42000, "5 lucas" = 5000, "1,5 millones" = 1500000, "42.000" = 42000.

Tipos de gasto:
- mitad: se reparte 50 y 50 ("a medias", "mitad y mitad").
- fraccion: reparto distinto. Indica porcentaje_yo O monto_yo = lo que le toca a ${yoNombre}.
- invita: alguien invitó o regaló; no se comparte ni genera deuda.
- por_otro: el gasto era todo de la pareja de quien pagó ("pagué por ella", "es todo de ${otroNombre}").

Reglas:
- pagador = "yo" si pagó ${yoNombre} ("pagué", "yo", "puse yo") y "otro" si pagó ${otroNombre}.
- Si no dicen quién pagó, usa "yo" y escríbelo en supuestos.
- Si no dicen cómo se reparte, usa "mitad" y escríbelo en supuestos.
- fecha en formato AAAA-MM-DD: hoy por defecto; entiende "ayer", "anteayer", "el lunes", "el 15 de octubre". Nunca una fecha futura.
- descripcion: en qué se gastó, máximo 3 palabras, con mayúscula inicial ("Super", "Cine"). Si no lo dicen, "Gasto".
- Si no hay un monto claro o no hablan de un gasto, entendido=false y en motivo una frase corta en español.
- No inventes datos. Responde solo con el JSON pedido.`;
}

// Revisa lo que dijo la IA y arma el gasto con las reglas de Mitty. La aritmética la hacemos AQUÍ,
// no la IA: así las partes de una fracción siempre suman el total (la base de datos lo exige).
// p: respuesta de la IA. yo: 0 o 1 (quién habla). hoy: "AAAA-MM-DD".
export function armarGasto(p: any, yo: number, hoy: string) {
  if (!p || p.entendido !== true) {
    return { ok: false, mensaje: p?.motivo || 'No entendí el gasto. Prueba con algo como "42 mil en super, pagó Ana, a medias".' };
  }
  const monto = Math.round(Number(p.monto));
  if (!(monto > 0)) return { ok: false, mensaje: 'No pude ver cuánto fue el gasto. ¿Me dices el monto?' };
  if (!TIPOS.includes(p.tipo)) return { ok: false, mensaje: 'No entendí cómo se reparte. ¿A medias, en porcentajes o invitación?' };

  const pagador = p.pagador === 'otro' ? (yo === 0 ? 1 : 0) : yo; // 'yo' -> el que habla
  let parte0: number | null = null;
  let parte1: number | null = null;

  if (p.tipo === 'fraccion') {
    let parteYo: number | null = null;
    if (p.monto_yo != null) parteYo = Math.round(Number(p.monto_yo));
    else if (p.porcentaje_yo != null) parteYo = Math.round((monto * Number(p.porcentaje_yo)) / 100);
    if (parteYo === null || Number.isNaN(parteYo)) {
      return { ok: false, mensaje: 'Me falta saber cuánto le toca a cada uno. Dime porcentajes o montos.' };
    }
    parteYo = Math.max(0, Math.min(monto, parteYo)); // nunca fuera de 0 a monto
    const parteOtro = monto - parteYo; // el resto: así siempre suman el total
    parte0 = yo === 0 ? parteYo : parteOtro;
    parte1 = monto - parte0;
  }

  // Fecha: si falta, es inválida o es futura, usamos hoy
  const fechaValida = typeof p.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) && p.fecha <= hoy;
  const fecha = fechaValida ? p.fecha : hoy;
  const descripcion = (typeof p.descripcion === 'string' && p.descripcion.trim()) || 'Gasto';

  return {
    ok: true,
    gasto: { monto, descripcion: descripcion.slice(0, 60), tipo: p.tipo, pagador, fecha, parte0, parte1 },
    supuestos: p.supuestos || '',
  };
}

const CABECERAS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pareja',
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: CABECERAS });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CABECERAS });

  try {
    const llaveIA = Deno.env.get('GEMINI_API_KEY');
    if (!llaveIA) return responder({ ok: false, mensaje: 'Falta configurar GEMINI_API_KEY en Supabase.' }, 500);

    // 1) Solo parejas que existen. Reenviamos los mismos headers a la base: la regla de seguridad
    //    (x-pareja) hace que solo devuelva la fila si el código es real.
    const codigo = req.headers.get('x-pareja') ?? '';
    const apikey = req.headers.get('apikey') ?? '';
    const consulta = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/rest/v1/parejas?select=nombre0,nombre1&codigo=eq.${encodeURIComponent(codigo)}`,
      { headers: { apikey, 'x-pareja': codigo } }
    );
    const filas = codigo && consulta.ok ? await consulta.json() : [];
    if (!Array.isArray(filas) || filas.length === 0) {
      return responder({ ok: false, mensaje: 'Pareja no encontrada.' }, 401);
    }
    const nombres = [filas[0].nombre0, filas[0].nombre1];

    // 2) Datos de la petición, con límites para que nadie gaste la cuota de la IA
    const { texto, audioBase64, mime, yo, hoy } = await req.json();
    if (yo !== 0 && yo !== 1) return responder({ ok: false, mensaje: 'Falta saber quién habla.' }, 400);
    const hoyOk = typeof hoy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(hoy) ? hoy : new Date().toISOString().slice(0, 10);

    const partes: unknown[] = [];
    if (typeof audioBase64 === 'string' && audioBase64.length > 0) {
      if (audioBase64.length > MAX_AUDIO) return responder({ ok: false, mensaje: 'El audio es muy largo. Prueba con uno más corto.' }, 400);
      partes.push({ inline_data: { mime_type: mime || 'audio/mp4', data: audioBase64 } });
      partes.push({ text: 'Este audio contiene la instrucción del gasto.' });
    } else if (typeof texto === 'string' && texto.trim() !== '') {
      partes.push({ text: texto.trim().slice(0, MAX_TEXTO) });
    } else {
      return responder({ ok: false, mensaje: 'Escribe o graba el gasto.' }, 400);
    }

    // 3) Llamada a la IA (Gemini). La llave viaja en un header, solo entre Supabase y Google.
    const llamarIA = (partesUsadas: unknown[]) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': llaveIA },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instrucciones(nombres[yo], nombres[yo === 0 ? 1 : 0], hoyOk) }] },
          contents: [{ role: 'user', parts: partesUsadas }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0 },
        }),
      });
    let respuestaIA = await llamarIA(partes);
    // Si Google no reconoce el tipo de audio (error 400), reintentamos una vez declarándolo como AAC,
    // que es lo que realmente graba el teléfono dentro del archivo .m4a
    if (!respuestaIA.ok && respuestaIA.status === 400 && partes.length === 2 && 'inline_data' in (partes[0] as object)) {
      const reintento = [{ inline_data: { mime_type: 'audio/aac', data: audioBase64 } }, partes[1]];
      respuestaIA = await llamarIA(reintento);
    }
    if (!respuestaIA.ok) {
      const detalle = (await respuestaIA.text()).slice(0, 200);
      return responder({ ok: false, mensaje: `La IA no respondió (${respuestaIA.status}). ${detalle}` }, 502);
    }
    const datos = await respuestaIA.json();
    const textoIA = datos?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    let parseado = null;
    try {
      parseado = JSON.parse(textoIA);
    } catch {
      return responder({ ok: false, mensaje: 'No pude leer la respuesta de la IA. Intenta de nuevo.' });
    }

    // 4) Validamos y armamos el gasto con nuestras reglas
    return responder(armarGasto(parseado, yo, hoyOk));
  } catch (e) {
    return responder({ ok: false, mensaje: 'Error inesperado: ' + String((e as Error).message).slice(0, 150) }, 500);
  }
});
