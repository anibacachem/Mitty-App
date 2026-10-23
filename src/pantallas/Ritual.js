import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pedir } from '../supabase';
import { hace, hoyISO, pesos } from '../formato';
import { calcularBalance, describirSaldo } from '../saldo';
import {
  META_DIARIA, META_PORCENTAJE, diaDeSemana, diasEntre, limitesDelMes, medirPeriodo, semanasDelMes,
} from '../habito';

// "2026-10-23" -> "23/10"
const corta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const LETRAS_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // indexadas por diaDeSemana (0 = domingo)
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Medidor de un período: "6/9", el porcentaje y una barra con una raya en la meta (80%).
// Verde si llega a la meta; ámbar si no (nunca rojo: el ritual es sin culpas).
function Medidor({ titulo, medida }) {
  const color = medida.estado === 'logrado' ? '#16A34A' : '#D97706';
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.tituloMedidor}>{titulo}</Text>
      {medida.estado === 'sin_datos' ? (
        <Text style={styles.habitoVacio}>Todavía no hay días que medir.</Text>
      ) : (
        <>
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
        </>
      )}
    </View>
  );
}

// Ritual de domingo: resumen de los últimos 7 días (hoy y los 6 días anteriores).
// pareja: { codigo, nombre0, nombre1, yo }. onVolver: regresar a la pantalla principal.
export default function Ritual({ pareja, onVolver }) {
  const [movimientos, setMovimientos] = useState(null); // null = todavía cargando
  const [error, setError] = useState('');

  // Pedimos todos los movimientos: la semana sale de filtrarlos y el saldo usa todos (igual que en Principal)
  async function cargar() {
    setError('');
    try {
      const filas = await pedir(
        `movimientos?select=*&codigo=eq.${pareja.codigo}&order=fecha.desc,creado.desc`,
        { codigoPareja: pareja.codigo }
      );
      setMovimientos(filas);
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

  // ---- Cálculos de la semana ----
  const desde = hace(6); // hace 6 días + hoy = 7 días
  const hasta = hoyISO();
  const semana = movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta); // fechas ISO se comparan como texto
  const gastosSemana = semana.filter((m) => m.tipo !== 'pago'); // un pago entre ustedes no es un gasto
  const total = gastosSemana.reduce((suma, m) => suma + Number(m.monto), 0);
  const pagoPorPersona = calcularBalance(semana).gastado; // cuánto pagó cada uno esta semana
  const saldo = describirSaldo(calcularBalance(movimientos).neto, yo, nombres); // saldo de siempre, no solo de la semana
  const colorSaldo = { debo: '#B91C1C', medeben: ACENTO, amano: '#555' }[saldo.clase];

  // Indicador de éxito (conteo): semana fija de lunes a domingo recortada al mes, y mes calendario
  const hoy = hoyISO();
  const semanaActual = semanasDelMes(hoy).find((s) => hoy >= s.desde && hoy <= s.hasta);
  const declaraciones = []; // Paso 2: aquí llegarán los días en que declararon "ese día hubo menos de 3"
  const medSemana = medirPeriodo(movimientos, declaraciones, semanaActual.desde, semanaActual.hasta, hoy);
  const limitesMes = limitesDelMes(hoy);
  const medMes = medirPeriodo(movimientos, declaraciones, limitesMes.desde, limitesMes.hasta, hoy);
  const nombreMes = MESES[Number(hoy.slice(5, 7)) - 1];

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <Text style={styles.titulo}>Ritual de domingo</Text>
      <Text style={styles.subtitulo}>Últimos 7 días · {corta(desde)} al {corta(hasta)}</Text>

      {/* Indicador de éxito: gastos compartidos anotados contra lo esperado (3 por día) */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Gastos compartidos anotados</Text>

        <Medidor titulo={`Semana ${corta(semanaActual.desde)} al ${corta(semanaActual.hasta)}`} medida={medSemana} />

        {/* Tira de la semana: cada día con lo anotado contra su meta */}
        <View style={styles.tiraDias}>
          {diasEntre(semanaActual.desde, semanaActual.hasta).map((f) => {
            const d = medSemana.dias.find((x) => x.fecha === f); // undefined = día que aún no llega
            return (
              <View key={f} style={styles.dia}>
                <Text style={styles.diaLetra}>{LETRAS_DIA[diaDeSemana(f)]}</Text>
                <View
                  style={[
                    styles.diaCaja,
                    !d && styles.diaFuturo,
                    d && (d.completo ? styles.diaOk : styles.diaPoco),
                    f === hoy && styles.diaHoy,
                  ]}
                >
                  <Text style={styles.diaTexto}>{d ? `${d.contados}/${d.objetivo}${d.extra > 0 ? '+' : ''}` : '–'}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Medidor titulo={`Mes de ${nombreMes}`} medida={medMes} />

        <Text style={styles.nota}>
          Meta: {META_DIARIA} gastos compartidos por día (mitad y fracción). "Logrado" desde {META_PORCENTAJE}%.
          Pronto podrás declarar los días en que hubo menos.
        </Text>
      </View>

      {gastosSemana.length === 0 ? (
        <View style={styles.tarjeta}>
          <Text style={styles.vacio}>No hay gastos en los últimos 7 días.</Text>
        </View>
      ) : (
        <>
          {/* Total gastado */}
          <View style={styles.tarjeta}>
            <Text style={styles.etiqueta}>Total gastado</Text>
            <Text style={styles.total}>{pesos(total)}</Text>
            <Text style={styles.detalle}>
              {gastosSemana.length} {gastosSemana.length === 1 ? 'gasto' : 'gastos'}
            </Text>
          </View>

          {/* Cuánto pagó cada uno, con una barra proporcional al total */}
          <View style={styles.tarjeta}>
            <Text style={styles.etiqueta}>Cuánto pagó cada uno</Text>
            {orden.map((i) => {
              const porcentaje = total > 0 ? Math.round((pagoPorPersona[i] / total) * 100) : 0;
              return (
                <View key={i} style={{ marginTop: 12 }}>
                  <View style={styles.filaPago}>
                    <Text style={styles.nombre}>{i === yo ? `${nombres[i]} (tú)` : nombres[i]}</Text>
                    <Text style={styles.monto}>{pesos(pagoPorPersona[i])}</Text>
                  </View>
                  <View style={styles.barraFondo}>
                    <View style={[styles.barra, { width: `${porcentaje}%` }]} />
                  </View>
                  <Text style={styles.porcentaje}>{porcentaje}% del total</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Saldo actual */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Saldo actual</Text>
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
  etiqueta: { fontSize: 13, color: '#777' },
  total: { fontSize: 38, fontWeight: '700', color: '#222', marginTop: 4 },
  detalle: { fontSize: 14, color: '#777', marginTop: 2 },
  filaPago: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  nombre: { fontSize: 16, fontWeight: '600', color: '#222' },
  monto: { fontSize: 16, fontWeight: '700', color: '#222' },
  barraFondo: { height: 10, backgroundColor: '#E8F0EE', borderRadius: 5, overflow: 'hidden' },
  barra: { height: 10, backgroundColor: ACENTO, borderRadius: 5 },
  porcentaje: { fontSize: 12, color: '#888', marginTop: 4 },
  habitoFila: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  habitoGrande: { fontSize: 38, fontWeight: '700', color: '#222' },
  habitoPct: { fontSize: 28, fontWeight: '700' },
  barraHabitoFondo: { height: 12, backgroundColor: '#EEE', borderRadius: 6, marginTop: 10 },
  barraHabito: { height: 12, borderRadius: 6 },
  // Raya vertical que marca dónde está la meta (80%)
  marcaMeta: { position: 'absolute', top: -3, width: 3, height: 18, backgroundColor: '#444', borderRadius: 2 },
  habitoMeta: { fontSize: 12, color: '#777', marginTop: 6 },
  habitoVacio: { fontSize: 15, color: '#555', marginTop: 6 },
  tituloMedidor: { fontSize: 15, fontWeight: '600', color: '#444' },
  tiraDias: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  dia: { alignItems: 'center', flex: 1 },
  diaLetra: { fontSize: 12, color: '#888', marginBottom: 4 },
  diaCaja: { width: 40, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent' },
  diaOk: { backgroundColor: '#DDF3E4' },
  diaPoco: { backgroundColor: '#FDEBC8' },
  diaFuturo: { backgroundColor: '#F0F0EE' },
  diaHoy: { borderColor: ACENTO }, // contorno en el día de hoy
  diaTexto: { fontSize: 12, fontWeight: '700', color: '#333' },
  nota: { fontSize: 12, color: '#888', marginTop: 10 },
  saldo: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  vacio: { fontSize: 15, color: '#777', textAlign: 'center' },
  boton: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16, marginTop: 6 },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  enlace: { color: ACENTO, fontSize: 16, textAlign: 'center', marginTop: 18 },
  error: { color: '#B91C1C', textAlign: 'center', marginBottom: 16 },
});
