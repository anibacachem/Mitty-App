// Genera el código de pareja: 10 caracteres, en mayúsculas.
// Quitamos las letras y números que se confunden al leer o dictar:
// 0 (cero) y O, 1 (uno) e I y L.
const CARACTERES = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generarCodigo() {
  let codigo = '';
  for (let i = 0; i < 10; i++) {
    // Elegimos un caracter al azar de la lista, 10 veces
    codigo += CARACTERES[Math.floor(Math.random() * CARACTERES.length)];
  }
  return codigo;
}
