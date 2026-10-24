// Indicador de éxito de Mitty: ¿cuántos gastos compartidos se anotan, comparado con lo esperado?
//
// Reglas (definidas por Angel):
//  - Meta base: 3 gastos compartidos POR DÍA. Si hay más de 3, el día cuenta 3 de 3 y NO compensa a otros días.
//  - Si un día hubo menos gastos, la pareja lo declara (0, 1 o 2) y la meta de ese día baja a ese número.
//  - Se mide por la fecha del gasto, en semanas de lunes a domingo recortadas al mes, y por mes calendario.
//  - Los días futuros no cuentan; el día de hoy sí. El mes se reinicia solo el día 1.
import { fechaLocalDe, hoyISO } from './formato';

// Tipos que cuentan como "gasto compartido". Las invitaciones y los pagos entre ustedes no.
export const TIPOS_COMPARTIDOS = ['mitad', 'fraccion', 'por_otro'];

export const META_DIARIA = 3; // gastos compartidos esperados por día, salvo que se declare menos
export const META_PORCENTAJE = 80; // desde este % una semana o un mes cuenta como "logrado"

// ---- Ayudas de fechas ("2026-10-23" <-> Date local) ----
function aFecha(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}
function aISO(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
export function sumarDias(iso, n) {
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}

// 0 = domingo ... 6 = sábado
export function diaDeSemana(iso) {
  return aFecha(iso).getDay();
}

// Lista de días entre dos fechas, ambas incluidas: ["2026-10-19", "2026-10-20", ...]
export function diasEntre(desde, hasta) {
  const dias = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}

// Primer y último día del mes de la fecha dada.
export function limitesDelMes(fecha) {
  const d = aFecha(fecha);
  return {
    desde: aISO(new Date(d.getFullYear(), d.getMonth(), 1)),
    hasta: aISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)), // día 0 del mes siguiente = último de este
  };
}

// Semanas fijas del mes: de lunes a domingo, recortadas al mes.
// La primera y la última pueden ser más cortas. Ej. octubre 2026: 1-4, 5-11, 12-18, 19-25, 26-31.
export function semanasDelMes(fecha) {
  const { desde: primero, hasta: ultimo } = limitesDelMes(fecha);
  const semanas = [];
  let inicio = primero;
  while (inicio <= ultimo) {
    const dow = diaDeSemana(inicio); // 0 = domingo
    const domingo = sumarDias(inicio, dow === 0 ? 0 : 7 - dow); // el domingo que cierra esta semana
    const fin = domingo < ultimo ? domingo : ultimo; // si pasa del fin de mes, recortamos
    semanas.push({ desde: inicio, hasta: fin });
    inicio = sumarDias(fin, 1);
  }
  return semanas;
}

// La semana fija (lunes a domingo, recortada al mes) que contiene una fecha. Ej. "2026-10-14" -> 12 al 18 de octubre.
export function semanaQueContiene(fecha) {
  return semanasDelMes(fecha).find((s) => fecha >= s.desde && fecha <= s.hasta);
}

// Mide un período (una semana o un mes) día por día.
//   movimientos:   todos los movimientos de la pareja
//   declaraciones: [{ fecha, esperados }] días en que declararon que hubo menos de 3 (esperados = 0, 1 o 2)
//   hoy:           se puede pasar para probar; por defecto, la fecha de hoy
// Devuelve:
//   dias:       un objeto por día ya transcurrido: { fecha, anotados, objetivo, contados, extra, completo, declarado }
//   anotados:   suma de lo contado (cada día con tope en su objetivo)
//   esperados:  suma de los objetivos de cada día
//   extra:      gastos de más (sobre el objetivo), que no compensan otros días
//   porcentaje: anotados / esperados, o null si no hay nada que medir
//   estado:     'sin_datos' | 'logrado' | 'en_camino'
export function medirPeriodo(movimientos, declaraciones, desde, hasta, hoy = hoyISO()) {
  // Cuántos gastos compartidos hay por fecha
  const cuenta = {};
  for (const m of movimientos) {
    if (TIPOS_COMPARTIDOS.includes(m.tipo)) cuenta[m.fecha] = (cuenta[m.fecha] || 0) + 1;
  }
  // Metas declaradas por fecha
  const declarado = {};
  for (const d of declaraciones) declarado[d.fecha] = Number(d.esperados);

  const limite = hasta < hoy ? hasta : hoy; // los días futuros no cuentan
  const dias = [];
  let anotados = 0;
  let esperados = 0;
  let extra = 0;

  if (desde <= limite) {
    for (const fecha of diasEntre(desde, limite)) {
      const estaDeclarado = declarado[fecha] !== undefined;
      const objetivo = estaDeclarado ? declarado[fecha] : META_DIARIA;
      const n = cuenta[fecha] || 0;
      const contados = Math.min(n, objetivo); // tope: más de lo esperado no compensa otros días
      dias.push({
        fecha,
        anotados: n,
        objetivo,
        contados,
        extra: Math.max(0, n - objetivo),
        completo: contados >= objetivo,
        declarado: estaDeclarado,
      });
      anotados += contados;
      esperados += objetivo;
      extra += Math.max(0, n - objetivo);
    }
  }

  const porcentaje = esperados === 0 ? null : Math.round((anotados / esperados) * 100);
  let estado = 'en_camino';
  if (esperados === 0) estado = 'sin_datos';
  else if (porcentaje >= META_PORCENTAJE) estado = 'logrado';

  return { dias, anotados, esperados, extra, porcentaje, estado };
}


// =====================================================================================================
// Hábito SEMANAL (nuevo): anotar los gastos en el momento en que ocurren.
//  - Semana = lunes a domingo COMPLETA (puede cruzar de mes), así la meta es justa todas las semanas.
//  - Cuenta TODO gasto anotado con fecha de la semana: compartido, personal o invitación. Los pagos
//    entre ustedes no son gastos y no cuentan.
//  - Meta: 10 gastos por semana. Desde 8 la semana es un éxito. Más de 10 se muestra, pero la barra se llena en 10.
//  - "En el momento" = el gasto se anotó el mismo día en que ocurrió (fecha del gasto = día en que se anotó).
//    No resta puntos a quien anota tarde: es un dato aparte para ver el hábito real.
// =====================================================================================================
export const META_SEMANA = 10; // gastos esperados por semana
export const EXITO_SEMANA = 8; // desde aquí la semana cuenta como éxito

// Lunes a domingo (completa) de la semana que contiene una fecha. Ej. "2026-10-28" -> 26/10 al 01/11.
export function semanaCompleta(fecha) {
  const dow = diaDeSemana(fecha); // 0 = domingo
  const desde = sumarDias(fecha, dow === 0 ? -6 : 1 - dow); // retrocedemos hasta el lunes
  return { desde, hasta: sumarDias(desde, 6) };
}

// ¿Este movimiento es un gasto que cuenta para el hábito? (todos los tipos menos 'pago')
export const esGastoAnotado = (m) => m.tipo !== 'pago';

// ¿Se anotó el mismo día en que ocurrió? Compara la fecha del gasto con el día LOCAL de "creado".
export function fueEnElMomento(m) {
  return !!m.creado && fechaLocalDe(m.creado) === m.fecha;
}

// Cuenta los gastos anotados entre dos fechas (ambas incluidas).
// Devuelve { total, enElMomento, porDia: { "2026-10-26": 2, ... } }
export function contarAnotados(movimientos, desde, hasta) {
  let total = 0;
  let enElMomento = 0;
  const porDia = {};
  for (const m of movimientos) {
    if (!esGastoAnotado(m) || m.fecha < desde || m.fecha > hasta) continue;
    total += 1;
    if (fueEnElMomento(m)) enElMomento += 1;
    porDia[m.fecha] = (porDia[m.fecha] || 0) + 1;
  }
  return { total, enElMomento, porDia };
}

// Mide UNA semana contra la meta. Devuelve:
//   anotados, enElMomento, porDia
//   meta (10), exito (8)
//   faltan:     cuántos faltan para llegar al éxito (0 si ya llegó)
//   porcentaje: anotados / meta, con tope 100 (para llenar la barra)
//   estado:     'logrado' (8 o más) | 'en_camino' (menos de 8)
export function medirSemana(movimientos, desde, hasta) {
  const { total, enElMomento, porDia } = contarAnotados(movimientos, desde, hasta);
  return {
    anotados: total,
    enElMomento,
    porDia,
    meta: META_SEMANA,
    exito: EXITO_SEMANA,
    faltan: Math.max(0, EXITO_SEMANA - total),
    porcentaje: Math.min(100, Math.round((total / META_SEMANA) * 100)),
    estado: total >= EXITO_SEMANA ? 'logrado' : 'en_camino',
  };
}

// Mide un MES: gastos anotados acumulados y cuántas semanas ya empezadas llegaron al éxito.
// Una semana (lunes a domingo) pertenece al mes en que cae su domingo; así cada semana cuenta una sola vez.
// Devuelve { anotados, enElMomento, semanasLogradas, semanasMedidas }
export function medirMes(movimientos, fechaDelMes, hoy = hoyISO()) {
  const { desde, hasta } = limitesDelMes(fechaDelMes);
  const { total, enElMomento } = contarAnotados(movimientos, desde, hasta);
  let semanasLogradas = 0;
  let semanasMedidas = 0;
  // Recorremos los lunes cuya semana termina (domingo) dentro del mes y que ya empezaron
  let lunes = semanaCompleta(desde).desde;
  while (lunes <= hasta) {
    const domingo = sumarDias(lunes, 6);
    if (domingo >= desde && domingo <= hasta && lunes <= hoy) {
      semanasMedidas += 1;
      if (medirSemana(movimientos, lunes, domingo).estado === 'logrado') semanasLogradas += 1;
    }
    lunes = sumarDias(lunes, 7);
  }
  return { anotados: total, enElMomento, semanasLogradas, semanasMedidas };
}
