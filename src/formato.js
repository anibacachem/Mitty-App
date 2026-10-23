// Funciones para mostrar montos. Se reutilizan en el flujo, la lista y el saldo.

// 42000 -> "42.000" (puntos de miles, como en pesos chilenos).
// Lo hacemos a mano en vez de usar toLocaleString, porque no siempre funciona igual en todos los teléfonos.
export function formatearMonto(numero) {
  return String(numero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// "42.000" o "42abc000" -> 42000. Deja solo los dígitos y los convierte a número.
export function soloDigitos(texto) {
  return Number(texto.replace(/\D/g, '')) || 0;
}
