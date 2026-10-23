// Carga de datos compartida por la pantalla principal y el ritual.
import { pedir } from './supabase';

// Pide a Supabase, al mismo tiempo, todos los gastos de la pareja y los días declarados.
// Devuelve { movimientos, declaraciones, metasDisponible }.
//   metasDisponible = false cuando la tabla "metas_dia" todavía no existe en Supabase
//   (falta pegar supabase/metas_dia.sql). La app sigue funcionando, solo sin poder declarar días.
export async function cargarTodo(codigo) {
  const [movimientos, declaraciones] = await Promise.all([
    pedir(`movimientos?select=*&codigo=eq.${codigo}&order=fecha.desc,creado.desc`, { codigoPareja: codigo }),
    pedir(`metas_dia?select=*&codigo=eq.${codigo}`, { codigoPareja: codigo }).catch((e) => {
      // 404 / PGRST205 / 42P01 = "esa tabla no existe". Cualquier otro error (sin red, etc.) sí se propaga.
      if (/404|PGRST205|42P01/.test(String(e.message))) return null;
      throw e;
    }),
  ]);
  return {
    movimientos,
    declaraciones: declaraciones ?? [],
    metasDisponible: declaraciones !== null,
  };
}
