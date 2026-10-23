// Indicador de éxito de Mitty: ¿se anotan los gastos el mismo día en que ocurren?
// Regla central: se mide la PROPORCIÓN de gastos anotados a tiempo sobre el total de gastos
// del período. No se mide por día: un día con 0 gastos no cuenta ni a favor ni en contra.
import { fechaLocalDe } from './formato';

// Qué tipos cuentan como "gasto compartido". Cambia esta lista si decides medir otros
// (por ejemplo agregar 'invita'). Los pagos entre ustedes nunca cuentan: no son gastos.
export const TIPOS_COMPARTIDOS = ['mitad', 'fraccion', 'por_otro'];

export const META_PORCENTAJE = 80; // la meta del README: 8 de cada 10 el mismo día
export const MINIMO_PARA_JUZGAR = 3; // con menos gastos, el porcentaje salta demasiado para sacar conclusiones

// Mide el hábito entre dos fechas ("2026-10-17" y "2026-10-23", ambas incluidas).
// Devuelve { total, mismoDia, tarde, porcentaje, estado }.
//   porcentaje: null si no hubo gastos (así no mostramos un "0%" falso)
//   estado: 'sin_datos' | 'pocos' | 'logrado' | 'en_camino'
export function medirHabito(movimientos, desde, hasta) {
  const compartidos = movimientos.filter(
    (m) => TIPOS_COMPARTIDOS.includes(m.tipo) && m.fecha >= desde && m.fecha <= hasta
  );
  // A tiempo = se anotó el mismo día del gasto (o antes). Usamos "<=" y no "===" porque si los dos
  // teléfonos tienen distinta zona horaria, la fecha local de "creado" podría quedar un día antes.
  const mismoDia = compartidos.filter((m) => fechaLocalDe(m.creado) <= m.fecha).length;
  const total = compartidos.length;
  const porcentaje = total === 0 ? null : Math.round((mismoDia / total) * 100);

  let estado = 'en_camino';
  if (total === 0) estado = 'sin_datos';
  else if (total < MINIMO_PARA_JUZGAR) estado = 'pocos';
  else if (porcentaje >= META_PORCENTAJE) estado = 'logrado';

  return { total, mismoDia, tarde: total - mismoDia, porcentaje, estado };
}
