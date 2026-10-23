// Funciones para mostrar montos. Se reutilizan en el flujo, la lista y el saldo.

// 42000 -> "42.000" (puntos de miles, como en pesos chilenos).
// Lo hacemos a mano en vez de usar toLocaleString, porque no siempre funciona igual en todos los teléfonos.
export function formatearMonto(numero) {
  return String(numero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Fecha de hoy en formato "2026-10-23" (la que entiende la columna "fecha" de Supabase).
// Usamos la hora local del teléfono: toISOString() usa hora UTC y de noche podría dar el día siguiente.
function aTexto(d, dia) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
export function hoyISO() {
  const d = new Date();
  return aTexto(d, String(d.getDate()).padStart(2, '0'));
}
// Primer día del mes actual: "2026-10-01". Sirve para pedir solo los gastos del mes.
export function inicioDeMes() {
  return aTexto(new Date(), '01');
}

// Fecha de hace N días: hace(1) = ayer. Mismo formato "2026-10-22".
export function hace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias); // JS resta bien aunque cambie de mes o de año
  return aTexto(d, String(d.getDate()).padStart(2, '0'));
}

// Convierte día y mes escritos a mano (ej. 15 y 10) en "2026-10-15".
// Devuelve null si la fecha no existe (31/02) o es futura: no se anotan gastos del futuro.
export function fechaDeDiaMes(dia, mes) {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), mes - 1, dia);
  // Si el día no existe, JS la "corrige" a otro mes. Lo detectamos y la rechazamos.
  if (d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  if (d > hoy) return null;
  return aTexto(d, String(dia).padStart(2, '0'));
}

// Nombre legible de cada tipo de movimiento, para mostrarlo en la lista.
const ETIQUETAS = {
  mitad: 'Mitad', fraccion: 'Fracción', invita: 'Invitación',
  por_otro: 'Era del otro', personal: 'Personal', pago: 'Pago',
};
export function etiquetaTipo(tipo) {
  return ETIQUETAS[tipo] || tipo;
}

// "42.000" o "42abc000" -> 42000. Deja solo los dígitos y los convierte a número.
export function soloDigitos(texto) {
  return Number(texto.replace(/\D/g, '')) || 0;
}
