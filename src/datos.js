// Carga de datos compartida por la pantalla principal, el ritual y el cierre de mes.
import { pedir } from './supabase';

// Pide a Supabase todos los gastos y pagos de la pareja. Devuelve { movimientos }.
// (Ya no se piden los "días declarados": la meta es semanal y fija, 8 de 10.)
export async function cargarTodo(codigo) {
  const movimientos = await pedir(`movimientos?select=*&codigo=eq.${codigo}&order=fecha.desc,creado.desc`, {
    codigoPareja: codigo,
  });
  return { movimientos };
}
