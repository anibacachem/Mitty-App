// Cálculo del saldo entre los dos. Aquí vive TODA la regla de "quién le debe a quién".
// Convención: las personas son 0 (nombre0) y 1 (nombre1), igual que "pagador" en la base de datos.
import { pesos } from './formato';

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
    case 'invita': // el gasto es de quien invitó (el "dueño"). Si pagó él mismo, no hay deuda;
    case 'personal': // si pagó el otro, el dueño le debe todo. Sin "dueno" (gastos antiguos) = quien pagó.
      partes[mov.dueno ?? pagador] = monto;
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
//         (positivo = le deben, negativo = debe, 0 = al día)
// Los dos netos siempre suman 0: lo que uno debe es lo que el otro tiene a favor.
export function calcularBalance(movimientos) {
  const gastado = [0, 0];
  const corresponde = [0, 0];
  const pagosEnviados = [0, 0];
  const pagosRecibidos = [0, 0];
  // Lo mismo, pero separado en dos grupos para el Detalle: compartidos (mitad, fracción, era del otro)
  // y propios (invitaciones y gastos personales). Los dos grupos suman exactamente gastado y corresponde.
  const secciones = {
    compartidos: { gastado: [0, 0], corresponde: [0, 0] },
    propios: { gastado: [0, 0], corresponde: [0, 0] },
  };

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
    const grupo = secciones[m.tipo === 'invita' || m.tipo === 'personal' ? 'propios' : 'compartidos'];
    grupo.gastado[pagador] += monto;
    grupo.corresponde[0] += partes[0];
    grupo.corresponde[1] += partes[1];
  }

  const neto = [0, 1].map(
    (i) => gastado[i] - corresponde[i] + pagosEnviados[i] - pagosRecibidos[i]
  );
  return { gastado, corresponde, pagosEnviados, pagosRecibidos, secciones, neto };
}

// Texto del reparto de un gasto, para mostrar al tocar una fila.
// Ejemplo: "Ana $12.000 · Luis $30.000"
export function textoReparto(mov, nombres) {
  const otro = mov.pagador === 0 ? 1 : 0;
  if (mov.tipo === 'pago') return `${nombres[mov.pagador]} le pagó a ${nombres[otro]}`;
  if (mov.tipo === 'invita' || mov.tipo === 'personal') {
    const dueno = mov.dueno ?? mov.pagador; // quién invitó / de quién es el gasto
    const quien = mov.tipo === 'invita' ? `Invitó ${nombres[dueno]}` : `Gasto personal de ${nombres[dueno]}`;
    if (dueno === mov.pagador) return `${quien}: no genera deuda`;
    return `${quien}, lo pagó ${nombres[mov.pagador]}: ${nombres[dueno]} le debe todo`;
  }
  const partes = cuantoLeToca(mov);
  return `${nombres[0]} ${pesos(partes[0])} · ${nombres[1]} ${pesos(partes[1])}`;
}

// Frase del saldo vista desde mi lado, con su "clase" para elegir el color.
// neto: [neto0, neto1] de calcularBalance. yo: 0 o 1. Se usa en la pantalla principal y en el ritual,
// así los dos lugares siempre dicen exactamente lo mismo.
export function describirSaldo(neto, yo, nombres) {
  const otro = yo === 0 ? 1 : 0;
  if (neto[yo] <= -0.5) return { texto: `Le debes ${pesos(-neto[yo])} a ${nombres[otro]}`, clase: 'debo' };
  if (neto[yo] >= 0.5) return { texto: `${nombres[otro]} te debe ${pesos(neto[yo])}`, clase: 'medeben' };
  return { texto: 'Al día', clase: 'amano' };
}

// Resultado de UNA persona en palabras, para la última fila del Detalle (en vez de +/− sin explicación).
// neto: el neto de esa persona. Ejemplo: "Debe $62.000" / "Le deben $62.000" / "Al día".
export function resultadoEnPalabras(neto) {
  if (neto <= -0.5) return `Debe ${pesos(-neto)}`;
  if (neto >= 0.5) return `Le deben ${pesos(neto)}`;
  return 'Al día';
}
