// Cálculo del saldo entre los dos. Aquí vive TODA la regla de "quién le debe a quién".
// Convención: las personas son 0 (nombre0) y 1 (nombre1), igual que "pagador" en la base de datos.
import { formatearMonto } from './formato';

// Cuánto le toca a cada persona de UN gasto: devuelve [parte de nombre0, parte de nombre1].
export function cuantoLeToca(mov) {
  const monto = Number(mov.monto);
  const pagador = mov.pagador;
  const otro = pagador === 0 ? 1 : 0;
  const partes = [0, 0];
  switch (mov.tipo) {
    case 'mitad': // cada uno la mitad
      partes[0] = monto / 2;
      partes[1] = monto / 2;
      break;
    case 'fraccion': // las partes guardadas (si faltaran, caemos en la mitad)
      partes[0] = Number(mov.parte0 ?? monto / 2);
      partes[1] = Number(mov.parte1 ?? monto / 2);
      break;
    case 'por_otro': // el gasto era todo del otro
      partes[otro] = monto;
      break;
    case 'invita': // quien paga invita: el gasto es suyo, no genera deuda
    case 'personal':
      partes[pagador] = monto;
      break;
    default: // 'pago' no es un gasto: no reparte nada
      break;
  }
  return partes;
}

// Suma todos los movimientos y devuelve, para cada persona (posición 0 y 1):
//   gastado:         lo que pagó de su bolsillo en gastos
//   corresponde:     lo que le tocaba de esos gastos
//   pagosEnviados:   pagos que hizo a la otra persona (para saldar deuda)
//   pagosRecibidos:  pagos que recibió
//   neto: gastado - corresponde + pagosEnviados - pagosRecibidos
//         (positivo = le deben, negativo = debe, 0 = a mano)
// Los dos netos siempre suman 0: lo que uno debe es lo que el otro tiene a favor.
export function calcularBalance(movimientos) {
  const gastado = [0, 0];
  const corresponde = [0, 0];
  const pagosEnviados = [0, 0];
  const pagosRecibidos = [0, 0];

  for (const m of movimientos) {
    const monto = Number(m.monto);
    const pagador = m.pagador;
    const otro = pagador === 0 ? 1 : 0;

    if (m.tipo === 'pago') {
      pagosEnviados[pagador] += monto;
      pagosRecibidos[otro] += monto;
      continue;
    }
    gastado[pagador] += monto;
    const partes = cuantoLeToca(m);
    corresponde[0] += partes[0];
    corresponde[1] += partes[1];
  }

  const neto = [0, 1].map(
    (i) => gastado[i] - corresponde[i] + pagosEnviados[i] - pagosRecibidos[i]
  );
  return { gastado, corresponde, pagosEnviados, pagosRecibidos, neto };
}

// Texto del reparto de un gasto, para mostrar al tocar una fila.
// Ejemplo: "Ana $12.000 · Luis $30.000"
export function textoReparto(mov, nombres) {
  const otro = mov.pagador === 0 ? 1 : 0;
  if (mov.tipo === 'pago') return `${nombres[mov.pagador]} le pagó a ${nombres[otro]}`;
  if (mov.tipo === 'invita') return `Invitó ${nombres[mov.pagador]}: no genera deuda`;
  if (mov.tipo === 'personal') return `Gasto personal de ${nombres[mov.pagador]}: no genera deuda`;
  const partes = cuantoLeToca(mov);
  const pesos = (n) => `$${formatearMonto(Math.round(n))}`;
  return `${nombres[0]} ${pesos(partes[0])} · ${nombres[1]} ${pesos(partes[1])}`;
}
