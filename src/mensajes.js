// Mensaje amable del ritual de domingo, armado con reglas simples según cómo fue la semana.
// Regla de oro: nunca culpa. Habla de lo que sí se hizo y de cómo seguir.
//
//   medida:          el resultado de medirPeriodo para la semana
//   semanaTerminada: true si hoy es el último día de la semana (domingo, o fin de mes)
//   hoy:             "2026-10-25"
// Devuelve { titulo, texto, pista }. "pista" puede venir vacía.
export function mensajeRitual(medida, semanaTerminada, hoy) {
  const { estado, porcentaje, anotados, esperados } = medida;
  let titulo;
  let texto;

  if (estado === 'sin_datos') {
    // Todos los días quedaron declarados sin gastos
    titulo = 'Semana tranquila';
    texto = 'No hubo gastos compartidos que anotar. ¡A veces también se trata de eso!';
  } else if (porcentaje === 100) {
    titulo = semanaTerminada ? '¡Semana completa!' : '¡Van perfecto!';
    texto = semanaTerminada
      ? 'Anotaron todo lo que gastaron. Así se llega a fin de mes sin discutir.'
      : 'Todo lo de la semana está anotado. Sigan así.';
  } else if (estado === 'logrado') {
    // Entre la meta (80%) y 99%
    titulo = semanaTerminada ? '¡Muy buena semana!' : '¡Muy buen ritmo!';
    texto = 'Casi todo quedó anotado, y eso es lo que importa.';
  } else if (anotados === 0) {
    titulo = 'Un nuevo comienzo';
    texto = 'Todavía no hay gastos anotados. Con el próximo que ocurra, ya están en marcha.';
  } else if (porcentaje < 50) {
    titulo = 'Cada gasto cuenta';
    texto = 'Esta semana costó un poco más, y está bien. Retomar con el próximo gasto ya es avanzar.';
  } else {
    // Entre 50% y 79%
    titulo = 'Van por buen camino';
    texto = `Llevan ${anotados} de ${esperados}. Cada gasto anotado suma.`;
  }

  // Si algún día ya pasado quedó por debajo de su meta, recordamos que se puede declarar
  const hayDiaPasadoIncompleto = medida.dias.some((d) => !d.completo && d.fecha < hoy);
  const pista = hayDiaPasadoIncompleto
    ? 'Si algún día hubo menos gastos, tócalo en la tira y decláralo: el medidor se ajusta.'
    : '';

  return { titulo, texto, pista };
}
