// Mensaje amable del ritual de domingo, armado con reglas simples según cómo fue la semana.
// Regla de oro: nunca culpa. Habla de lo que sí se hizo y de cómo seguir.
//
//   medida:          el resultado de medirSemana (anotados, enElMomento, meta, exito, faltan, estado)
//   semanaTerminada: true si la semana ya pasó o hoy es domingo
// Devuelve { titulo, texto, pista }. "pista" puede venir vacía.
export function mensajeRitual(medida, semanaTerminada) {
  const { estado, anotados, enElMomento, meta, exito, faltan } = medida;
  let titulo;
  let texto;

  if (anotados >= meta) {
    titulo = semanaTerminada ? '¡Semana completa!' : '¡Superaron la meta!';
    texto = `Anotaron ${anotados} gastos. Así se llega a fin de mes sin discutir.`;
  } else if (estado === 'logrado') {
    titulo = semanaTerminada ? '¡Semana lograda!' : '¡Meta lograda!';
    texto = `Llevan ${anotados} gastos anotados y la meta era ${exito}. Lo que sigue es ganancia.`;
  } else if (anotados === 0) {
    titulo = 'Un nuevo comienzo';
    texto = 'Todavía no hay gastos anotados. Con el próximo que ocurra, ya están en marcha.';
  } else if (anotados < exito / 2) {
    titulo = 'Cada gasto cuenta';
    texto = semanaTerminada
      ? 'Esta semana costó un poco más, y está bien. Retomar con el próximo gasto ya es avanzar.'
      : `Van ${anotados}. Con el próximo gasto que anoten, ya van avanzando.`;
  } else {
    titulo = 'Van por buen camino';
    texto = `Llevan ${anotados} de ${meta}. ${faltan === 1 ? 'Falta 1 para' : `Faltan ${faltan} para`} la meta de ${exito}.`;
  }

  // Un empujón suave hacia el hábito real: anotar cuando ocurre el gasto
  const pista = anotados > 0 && enElMomento < anotados
    ? 'Anotar el gasto justo cuando ocurre es lo que más ayuda: no hay que acordarse después.'
    : '';

  return { titulo, texto, pista };
}
