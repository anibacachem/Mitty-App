import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { cargarTodo } from '../datos';
import { fechaDeDiaMes, hoyISO } from '../formato';
import {
  EXITO_SEMANA, META_SEMANA, diaDeSemana, diasEntre, medirMes, medirSemana, semanaCompleta, sumarDias,
} from '../habito';
import { mensajeRitual } from '../mensajes';
import { ACENTO } from '../colores';

// "2026-10-23" -> "23/10"
const corta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const LETRAS_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // indexadas por diaDeSemana (0 = domingo)
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Medidor de la semana: "7/10", una barra y una raya en la meta de éxito (8 de 10).
// Verde si llega a la meta; ámbar si no (nunca rojo: el ritual es sin culpas).
function Medidor({ medida }) {
  const color = medida.estado === 'logrado' ? '#16A34A' : '#D97706';
  return (
    <View>
      <View style={styles.habitoFila}>
        <Text style={styles.habitoGrande}>{medida.anotados}/{medida.meta}</Text>
        <Text style={[styles.habitoPct, { color }]}>
          {medida.estado === 'logrado' ? '¡Lograda!' : `Faltan ${medida.faltan}`}
        </Text>
      </View>
      <View style={styles.barraHabitoFondo}>
        <View style={[styles.barraHabito, { width: `${medida.porcentaje}%`, backgroundColor: color }]} />
        <View style={[styles.marcaMeta, { left: `${(medida.exito / medida.meta) * 100}%` }]} />
      </View>
      <Text style={styles.habitoMeta}>
        {medida.enElMomento} de {medida.anotados} {medida.anotados === 1 ? 'se anotó' : 'se anotaron'} en el momento
        {medida.anotados > medida.meta ? ` · +${medida.anotados - medida.meta} de más` : ''}
      </Text>
    </View>
  );
}

// Pantalla "Esta semana" (antes Ritual de domingo): el mensaje, cómo va la semana (meta 8 de 10) y el mes acumulado.
// pareja: { codigo, nombre0, nombre1, yo }. onVolver: regresar a la pantalla principal.
export default function Ritual({ pareja, onVolver }) {
  const [movimientos, setMovimientos] = useState(null); // null = todavía cargando
  const [error, setError] = useState('');
  const [semanaElegida, setSemanaElegida] = useState(null); // semana que muestra TODA la pantalla (null = la actual)
  const [verSelector, setVerSelector] = useState(false); // caja para escribir una fecha
  const [diaTxt, setDiaTxt] = useState('');
  const [mesTxt, setMesTxt] = useState('');
  const [errorFecha, setErrorFecha] = useState('');

  // Cambia de semana (null = la actual)
  function cambiarSemana(semana) {
    setSemanaElegida(semana);
  }

  // Ir a la semana que contiene la fecha que escribió (solo fechas pasadas o de hoy, del año en curso)
  function irAFecha() {
    const f = fechaDeDiaMes(Number(diaTxt), Number(mesTxt));
    if (!f) {
      setErrorFecha('Esa fecha no existe o es futura.');
      return;
    }
    setErrorFecha('');
    const s = semanaCompleta(f);
    cambiarSemana(s.desde === semanaCompleta(hoyISO()).desde ? null : s); // si es la actual, volvemos a null
    setVerSelector(false);
  }

  // Pedimos todos los movimientos: la semana y el mes salen de filtrarlos por su fecha
  async function cargar() {
    setError('');
    try {
      const datos = await cargarTodo(pareja.codigo);
      setMovimientos(datos.movimientos);
    } catch (e) {
      setError('No se pudo cargar la semana: ' + String(e.message).slice(0, 150));
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // ---- Estados de carga y error ----
  if (movimientos === null) {
    return (
      <View style={[styles.pantalla, { justifyContent: 'center', padding: 24 }]}>
        {error === '' ? (
          <ActivityIndicator color={ACENTO} size="large" />
        ) : (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.boton} onPress={cargar}>
              <Text style={styles.textoBoton}>Reintentar</Text>
            </Pressable>
            <Pressable onPress={onVolver}>
              <Text style={styles.enlace}>Volver</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  // ---- Semana completa (lunes a domingo, aunque cruce de mes) ----
  const hoy = hoyISO();
  const semanaActual = semanaCompleta(hoy);
  // TODA la pantalla (mensaje, medidor, tira y mes) sigue a la semana elegida con las flechas
  const semanaVista = semanaElegida ?? semanaActual;
  const esSemanaActual = semanaVista.desde === semanaActual.desde;
  const medSemana = medirSemana(movimientos, semanaVista.desde, semanaVista.hasta);
  // El mes es el del último día ya transcurrido de la semana que se mira (en la semana actual, el de hoy)
  const fechaDelMes = semanaVista.hasta < hoy ? semanaVista.hasta : hoy;
  const medMes = medirMes(movimientos, fechaDelMes, hoy);
  const indiceMes = Number(fechaDelMes.slice(5, 7)) - 1;
  const nombreMes = MESES[indiceMes];
  const mesSiguiente = MESES[(indiceMes + 1) % 12];
  const esMesActual = fechaDelMes.slice(0, 7) === hoy.slice(0, 7);

  // Mensaje amable según cómo va la semana (una semana pasada ya está terminada)
  const semanaTerminada = hoy >= semanaVista.hasta;
  const mensaje = mensajeRitual(medSemana, semanaTerminada);
  const fondoMensaje = medSemana.estado === 'logrado' ? '#E7F5EC' : '#FDF6E8';

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <Text style={styles.titulo}>Esta semana</Text>

      {/* Navegación de semana (manda sobre toda la pantalla): flecha atrás = semana anterior,
          flecha adelante = semana siguiente, sin pasar de la actual */}
      <View style={styles.navSemana}>
        <Pressable style={styles.flecha} hitSlop={8}
          onPress={() => cambiarSemana(semanaCompleta(sumarDias(semanaVista.desde, -1)))}>
          <Text style={styles.flechaTexto}>‹</Text>
        </Pressable>
        <Text style={styles.navTexto}>
          Semana del {corta(semanaVista.desde)} al {corta(semanaVista.hasta)}{esSemanaActual ? ' · actual' : ''}
        </Text>
        <Pressable style={[styles.flecha, esSemanaActual && styles.flechaOff]} hitSlop={8} disabled={esSemanaActual}
          onPress={() => {
            const sig = semanaCompleta(sumarDias(semanaVista.hasta, 1));
            cambiarSemana(sig.desde === semanaActual.desde ? null : sig); // al llegar a la actual, volvemos a null
          }}>
          <Text style={styles.flechaTexto}>›</Text>
        </Pressable>
      </View>
      <View style={styles.navAcciones}>
        <Pressable onPress={() => { setVerSelector(!verSelector); setErrorFecha(''); }}>
          <Text style={styles.enlaceChico}>Elegir fecha</Text>
        </Pressable>
        {!esSemanaActual && (
          <Pressable onPress={() => { cambiarSemana(null); setVerSelector(false); }}>
            <Text style={styles.enlaceChico}>Volver a la semana actual</Text>
          </Pressable>
        )}
      </View>
      {verSelector && (
        <View style={styles.selectorFila}>
          <Text style={styles.selectorTexto}>Día</Text>
          <TextInput style={styles.selectorInput} value={diaTxt} onChangeText={setDiaTxt} placeholder="DD"
            keyboardType="number-pad" maxLength={2} />
          <Text style={styles.selectorTexto}>/</Text>
          <TextInput style={styles.selectorInput} value={mesTxt} onChangeText={setMesTxt} placeholder="MM"
            keyboardType="number-pad" maxLength={2} />
          <Pressable style={styles.selectorIr} onPress={irAFecha}>
            <Text style={styles.selectorIrTexto}>Ir</Text>
          </Pressable>
        </View>
      )}
      {errorFecha !== '' && <Text style={styles.errorFecha}>{errorFecha}</Text>}
      <View style={{ height: 8 }} />

      {/* 1. El mensaje: lo primero que ven */}
      <View style={[styles.tarjeta, { backgroundColor: fondoMensaje }]}>
        <Text style={styles.heroTitulo}>{mensaje.titulo}</Text>
        <Text style={styles.heroTexto}>{mensaje.texto}</Text>
        {mensaje.pista !== '' && <Text style={styles.heroPista}>{mensaje.pista}</Text>}
      </View>

      {/* 2. Cómo va la semana: medidor (meta 8 de 10) y tira con lo anotado cada día */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Gastos anotados {esSemanaActual ? 'esta semana' : 'en la semana'}</Text>
        <Medidor medida={medSemana} />

        <View style={styles.tiraDias}>
          {diasEntre(semanaVista.desde, semanaVista.hasta).map((f) => {
            const futuro = f > hoy; // los días que aún no llegan se muestran apagados
            const n = medSemana.porDia[f] || 0;
            return (
              <View key={f} style={styles.dia}>
                <Text style={styles.diaLetra}>{LETRAS_DIA[diaDeSemana(f)]}</Text>
                <View style={[styles.diaCaja, futuro ? styles.diaFuturo : n > 0 ? styles.diaOk : styles.diaPoco,
                  f === hoy && styles.diaSel]}>
                  <Text style={styles.diaTexto}>{futuro ? '–' : n}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.nota}>
          Meta: {META_SEMANA} gastos por semana (lunes a domingo). Desde {EXITO_SEMANA} es un éxito: la raya de la barra.
          Cuentan los gastos compartidos, personales e invitaciones.
        </Text>
      </View>

      {/* 3. El mes: gastos anotados acumulados. Arranca de cero el día 1 */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Mes de {nombreMes}</Text>
        <View style={styles.habitoFila}>
          <Text style={styles.habitoGrande}>{medMes.anotados}</Text>
          <Text style={styles.habitoMesTexto}>{medMes.anotados === 1 ? 'gasto anotado' : 'gastos anotados'}</Text>
        </View>
        <Text style={styles.habitoMeta}>
          {medMes.semanasMedidas === 0
            ? 'Todavía no termina ninguna semana de este mes.'
            : `${medMes.semanasLogradas} de ${medMes.semanasMedidas} ${medMes.semanasMedidas === 1 ? 'semana lograda' : 'semanas logradas'} (${EXITO_SEMANA}+ gastos)`}
          {medMes.anotados > 0 ? ` · ${medMes.enElMomento} en el momento` : ''}
        </Text>
        <Text style={styles.nota}>
          {esMesActual ? `El conteo vuelve a cero el 1 de ${mesSiguiente}.` : 'Mes ya cerrado: así quedó su conteo.'}
        </Text>
      </View>

      <Pressable style={styles.boton} onPress={onVolver}>
        <Text style={styles.textoBoton}>Volver</Text>
      </Pressable>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFF8F5' },
  titulo: { fontSize: 28, fontWeight: '700', color: ACENTO, textAlign: 'center' },
  subtitulo: { fontSize: 15, color: '#555', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1,
    borderColor: '#F0E4E0', marginBottom: 14 },
  etiqueta: { fontSize: 13, color: '#777', marginBottom: 6 },
  // Mensaje
  heroTitulo: { fontSize: 24, fontWeight: '700', color: '#222' },
  heroTexto: { fontSize: 16, color: '#444', marginTop: 6, lineHeight: 22 },
  heroPista: { fontSize: 13, color: '#777', marginTop: 10 },
  // Medidor
  habitoFila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  habitoGrande: { fontSize: 38, fontWeight: '700', color: '#222' },
  habitoPct: { fontSize: 28, fontWeight: '700' },
  barraHabitoFondo: { height: 12, backgroundColor: '#EEE', borderRadius: 6, marginTop: 10 },
  barraHabito: { height: 12, borderRadius: 6 },
  // Raya vertical que marca dónde está la meta (80%)
  marcaMeta: { position: 'absolute', top: -3, width: 3, height: 18, backgroundColor: '#444', borderRadius: 2 },
  habitoMeta: { fontSize: 12, color: '#777', marginTop: 6 },
  habitoMesTexto: { fontSize: 16, color: '#555' },
  habitoVacio: { fontSize: 15, color: '#555', marginTop: 6 },
  // Tira de la semana
  tiraDias: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dia: { alignItems: 'center', flex: 1 },
  diaLetra: { fontSize: 12, color: '#888', marginBottom: 4 },
  diaCaja: { width: 40, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent' },
  diaOk: { backgroundColor: '#DDF3E4' },
  diaPoco: { backgroundColor: '#FDEBC8' },
  diaFuturo: { backgroundColor: '#F0F0EE' },
  diaSel: { borderStyle: 'solid', borderColor: ACENTO }, // contorno en el día seleccionado (por defecto, hoy)
  diaTexto: { fontSize: 12, fontWeight: '700', color: '#333' },
  nota: { fontSize: 12, color: '#888', marginTop: 10 },
  // Resumen
  navSemana: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF3EF', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 6, marginBottom: 6 },
  flecha: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  flechaOff: { opacity: 0.25 },
  flechaTexto: { fontSize: 28, color: ACENTO, fontWeight: '700', lineHeight: 32 },
  navTexto: { fontSize: 15, fontWeight: '700', color: '#222' },
  navAcciones: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  enlaceChico: { color: ACENTO, fontSize: 13, fontWeight: '600', paddingVertical: 4 },
  selectorFila: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  selectorTexto: { fontSize: 15, color: '#555', marginHorizontal: 6 },
  selectorInput: { borderWidth: 1, borderColor: '#D5D5D0', borderRadius: 8, width: 52, paddingVertical: 6,
    textAlign: 'center', fontSize: 16, backgroundColor: '#fff' },
  selectorIr: { backgroundColor: ACENTO, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18, marginLeft: 12 },
  selectorIrTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorFecha: { color: '#B91C1C', fontSize: 13, marginBottom: 8 },
  boton: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16, marginTop: 6 },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  enlace: { color: ACENTO, fontSize: 16, textAlign: 'center', marginTop: 18 },
  error: { color: '#B91C1C', textAlign: 'center', marginBottom: 16 },
});
