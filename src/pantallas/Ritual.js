import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cargarTodo } from '../datos';
import DiaDeclarable from '../componentes/DiaDeclarable';
import { hoyISO, pesos } from '../formato';
import { calcularBalance, describirSaldo } from '../saldo';
import {
  META_DIARIA, META_PORCENTAJE, diaDeSemana, diasEntre, limitesDelMes, medirPeriodo, semanasDelMes,
} from '../habito';
import { mensajeRitual } from '../mensajes';

// "2026-10-23" -> "23/10"
const corta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const LETRAS_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // indexadas por diaDeSemana (0 = domingo)
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Medidor de un período: "6/9", el porcentaje y una barra con una raya en la meta (80%).
// Verde si llega a la meta; ámbar si no (nunca rojo: el ritual es sin culpas).
function Medidor({ medida }) {
  const color = medida.estado === 'logrado' ? '#16A34A' : '#D97706';
  if (medida.estado === 'sin_datos') {
    return <Text style={styles.habitoVacio}>Todavía no hay días que medir.</Text>;
  }
  return (
    <View>
      <View style={styles.habitoFila}>
        <Text style={styles.habitoGrande}>{medida.anotados}/{medida.esperados}</Text>
        <Text style={[styles.habitoPct, { color }]}>{medida.porcentaje}%</Text>
      </View>
      <View style={styles.barraHabitoFondo}>
        <View style={[styles.barraHabito, { width: `${medida.porcentaje}%`, backgroundColor: color }]} />
        <View style={[styles.marcaMeta, { left: `${META_PORCENTAJE}%` }]} />
      </View>
      {medida.extra > 0 && (
        <Text style={styles.habitoMeta}>+{medida.extra} de más (no compensan otros días)</Text>
      )}
    </View>
  );
}

// Ritual de domingo: el mensaje, cómo va la semana y el mes, y un resumen corto.
// pareja: { codigo, nombre0, nombre1, yo }. onVolver: regresar a la pantalla principal.
export default function Ritual({ pareja, onVolver }) {
  const [movimientos, setMovimientos] = useState(null); // null = todavía cargando
  const [declaraciones, setDeclaraciones] = useState([]); // días declarados con menos de 3 gastos
  const [metasDisponible, setMetasDisponible] = useState(true); // false si falta la tabla metas_dia
  const [diaSel, setDiaSel] = useState(null); // día tocado en la tira (null = hoy)
  const [error, setError] = useState('');

  // Pedimos todos los movimientos y los días declarados: la semana sale de filtrarlos y el saldo usa todos
  async function cargar() {
    setError('');
    try {
      const datos = await cargarTodo(pareja.codigo);
      setMovimientos(datos.movimientos);
      setDeclaraciones(datos.declaraciones);
      setMetasDisponible(datos.metasDisponible);
    } catch (e) {
      setError('No se pudo cargar el resumen: ' + String(e.message).slice(0, 150));
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const nombres = [pareja.nombre0, pareja.nombre1];
  const yo = pareja.yo;
  const orden = [yo, yo === 0 ? 1 : 0]; // yo primero

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

  // ---- Semana fija (lunes a domingo, recortada al mes) y mes calendario ----
  const hoy = hoyISO();
  const semanaActual = semanasDelMes(hoy).find((s) => hoy >= s.desde && hoy <= s.hasta);
  const medSemana = medirPeriodo(movimientos, declaraciones, semanaActual.desde, semanaActual.hasta, hoy);
  const limitesMes = limitesDelMes(hoy);
  const medMes = medirPeriodo(movimientos, declaraciones, limitesMes.desde, limitesMes.hasta, hoy);
  const indiceMes = Number(hoy.slice(5, 7)) - 1;
  const nombreMes = MESES[indiceMes];
  const mesSiguiente = MESES[(indiceMes + 1) % 12];

  // Mensaje amable según cómo va la semana
  const semanaTerminada = hoy >= semanaActual.hasta;
  const mensaje = mensajeRitual(medSemana, semanaTerminada, hoy);
  const fondoMensaje = medSemana.estado === 'logrado' ? '#E7F5EC' : '#FDF6E8';

  // Día seleccionado en la tira (por defecto, hoy) y lo que sabemos de él
  const seleccionado = diaSel ?? hoy;
  const dSel = medSemana.dias.find((x) => x.fecha === seleccionado); // undefined = día que aún no llega
  const declSel = declaraciones.find((x) => x.fecha === seleccionado);

  // ---- Resumen corto de la misma semana ----
  const semana = movimientos.filter((m) => m.fecha >= semanaActual.desde && m.fecha <= semanaActual.hasta);
  const gastosSemana = semana.filter((m) => m.tipo !== 'pago'); // un pago entre ustedes no es un gasto
  const total = gastosSemana.reduce((suma, m) => suma + Number(m.monto), 0);
  const pagoPorPersona = calcularBalance(semana).gastado; // cuánto pagó cada uno esta semana
  const saldo = describirSaldo(calcularBalance(movimientos).neto, yo, nombres); // saldo de siempre, no solo de la semana
  const colorSaldo = { debo: '#B91C1C', medeben: ACENTO, amano: '#555' }[saldo.clase];

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <Text style={styles.titulo}>Ritual de domingo</Text>
      <Text style={styles.subtitulo}>Semana del {corta(semanaActual.desde)} al {corta(semanaActual.hasta)}</Text>

      {/* 1. El mensaje: lo primero que ven */}
      <View style={[styles.tarjeta, { backgroundColor: fondoMensaje }]}>
        <Text style={styles.heroTitulo}>{mensaje.titulo}</Text>
        <Text style={styles.heroTexto}>{mensaje.texto}</Text>
        {mensaje.pista !== '' && <Text style={styles.heroPista}>{mensaje.pista}</Text>}
      </View>

      {/* 2. Cómo va la semana: medidor, tira de días y declaración del día elegido */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Gastos compartidos anotados esta semana</Text>
        <Medidor medida={medSemana} />

        {/* Tira de la semana: cada día con lo anotado contra su meta */}
        <View style={styles.tiraDias}>
          {diasEntre(semanaActual.desde, semanaActual.hasta).map((f) => {
            const d = medSemana.dias.find((x) => x.fecha === f); // undefined = día que aún no llega
            return (
              // Tocar un día lo selecciona para declararlo (los días que aún no llegan no se pueden tocar)
              <Pressable key={f} style={styles.dia} onPress={() => d && setDiaSel(f)}>
                <Text style={styles.diaLetra}>{LETRAS_DIA[diaDeSemana(f)]}</Text>
                <View
                  style={[
                    styles.diaCaja,
                    !d && styles.diaFuturo,
                    d && (d.completo ? styles.diaOk : styles.diaPoco),
                    d && d.declarado && styles.diaDeclarado, // borde punteado: la meta del día fue declarada
                    f === seleccionado && styles.diaSel,
                  ]}
                >
                  <Text style={styles.diaTexto}>{d ? `${d.contados}/${d.objetivo}${d.extra > 0 ? '+' : ''}` : '–'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Panel del día seleccionado: declarar que hubo menos de 3 gastos compartidos */}
        <View style={styles.panelDia}>
          <Text style={styles.panelTitulo}>
            {NOMBRES_DIA[diaDeSemana(seleccionado)]} {corta(seleccionado)}
            {dSel ? ` · ${dSel.anotados} ${dSel.anotados === 1 ? 'gasto anotado' : 'gastos anotados'}` : ''}
          </Text>
          <DiaDeclarable
            key={seleccionado}
            pareja={pareja}
            fecha={seleccionado}
            dia={dSel}
            declaracion={declSel}
            disponible={metasDisponible}
            onCambio={cargar}
          />
        </View>

        <Text style={styles.nota}>
          Meta: {META_DIARIA} gastos compartidos por día. "Logrado" desde {META_PORCENTAJE}%. El borde punteado marca
          los días declarados.
        </Text>
      </View>

      {/* 3. El mes: arranca de cero el día 1 */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Mes de {nombreMes}</Text>
        <Medidor medida={medMes} />
        <Text style={styles.nota}>El conteo vuelve a cero el 1 de {mesSiguiente}.</Text>
      </View>

      {/* 4. Resumen corto */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Resumen de la semana</Text>
        {gastosSemana.length === 0 ? (
          <Text style={styles.vacio}>Todavía no hay gastos esta semana.</Text>
        ) : (
          <>
            <View style={styles.filaResumen}>
              <Text style={styles.resumenEtiqueta}>
                Total gastado ({gastosSemana.length} {gastosSemana.length === 1 ? 'gasto' : 'gastos'})
              </Text>
              <Text style={styles.resumenTotal}>{pesos(total)}</Text>
            </View>
            {orden.map((i) => (
              <View key={i} style={styles.filaResumen}>
                <Text style={styles.resumenEtiqueta}>{i === yo ? `${nombres[i]} (tú) pagó` : `${nombres[i]} pagó`}</Text>
                <Text style={styles.resumenValor}>{pesos(pagoPorPersona[i])}</Text>
              </View>
            ))}
          </>
        )}
        <View style={styles.separador} />
        <Text style={styles.resumenEtiqueta}>Saldo actual</Text>
        <Text style={[styles.saldo, { color: colorSaldo }]}>{saldo.texto}</Text>
      </View>

      <Pressable style={styles.boton} onPress={onVolver}>
        <Text style={styles.textoBoton}>Volver</Text>
      </Pressable>
    </ScrollView>
  );
}

const ACENTO = '#0F766E';

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FAFAF7' },
  titulo: { fontSize: 28, fontWeight: '700', color: ACENTO, textAlign: 'center' },
  subtitulo: { fontSize: 15, color: '#555', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1,
    borderColor: '#E5E5E0', marginBottom: 14 },
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
  diaDeclarado: { borderStyle: 'dashed', borderColor: '#9A9A95' },
  diaSel: { borderStyle: 'solid', borderColor: ACENTO }, // contorno en el día seleccionado (por defecto, hoy)
  diaTexto: { fontSize: 12, fontWeight: '700', color: '#333' },
  panelDia: { backgroundColor: '#F6F6F3', borderRadius: 12, padding: 12, marginTop: 14 },
  panelTitulo: { fontSize: 15, fontWeight: '700', color: '#222' },
  nota: { fontSize: 12, color: '#888', marginTop: 10 },
  // Resumen
  filaResumen: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5 },
  resumenEtiqueta: { fontSize: 15, color: '#555', flexShrink: 1, paddingRight: 8 },
  resumenValor: { fontSize: 16, fontWeight: '700', color: '#222' },
  resumenTotal: { fontSize: 20, fontWeight: '700', color: '#222' },
  separador: { height: 1, backgroundColor: '#E5E5E0', marginVertical: 12 },
  saldo: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  vacio: { fontSize: 15, color: '#777' },
  boton: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16, marginTop: 6 },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  enlace: { color: ACENTO, fontSize: 16, textAlign: 'center', marginTop: 18 },
  error: { color: '#B91C1C', textAlign: 'center', marginBottom: 16 },
});
