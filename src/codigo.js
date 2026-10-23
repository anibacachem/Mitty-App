// Genera el código de pareja: 10 caracteres, en mayúsculas.
// Quitamos las letras y números que se confunden al leer o dictar:
// 0 (cero) y O, 1 (uno) e I y L.
const CARACTERES = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Id único para cada gasto, por ejemplo "lq3k9x2a-f7m2pz".
// Mezcla la hora actual con letras al azar, así dos gastos nunca repiten id.
export function generarId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function generarCodigo() {
  let codigo = '';
  for (let i = 0; i < 10; i++) {
    // Elegimos un caracter al azar de la lista, 10 veces
    codigo += CARACTERES[Math.floor(Math.random() * CARACTERES.length)];
  }
  return codigo;
}
