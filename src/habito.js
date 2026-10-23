// Indicador de éxito de Mitty: ¿cuántos gastos compartidos se anotan, comparado con lo esperado?
//
// Reglas (definidas por Angel):
//  - Meta base: 3 gastos compartidos POR DÍA. Si hay más de 3, el día cuenta 3 de 3 y NO compensa a otros días.
//  - Si un día hubo menos gastos, la pareja lo declara (0, 1 o 2) y la meta de ese día baja a ese número.
//  - Se mide por la fecha del gasto, en semanas de lunes a domingo recortadas al mes, y por mes calendario.
//  - Los días futuros no cuentan; el día de hoy sí. El mes se reinicia solo el día 1.
import { hoyISO } from './formato';

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
function sumarDias(iso, n) {
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
