import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { pedir } from '../supabase';
import { conSigno, etiquetaTipo, inicioDeMes, pesos } from '../formato';
import { calcularBalance, describirSaldo, textoReparto } from '../saldo';

const CADA_CUANTO_MS = 5000; // los datos se refrescan solos cada 5 segundos

// Pantalla principal: saludo, saldo, detalle, botón de añadir y lista de gastos del mes.
// pareja: { codigo, nombre0, nombre1, yo }. aviso: mensaje corto arriba (ej. "Gasto anotado").
export default function Principal({ pareja, aviso, onAnadir, onRitual, onSalir }) {
  const [copiado, setCopiado] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true); // primera carga
  const [refrescando, setRefrescando] = useState(false); // al arrastrar hacia abajo
  const [conexion, setConexion] = useState('probando'); // 'probando' | 'ok' | 'sin'
  const [abierto, setAbierto] = useState(null); // id de la fila expandida
  const enCurso = useRef(false); // evita pedir de nuevo si la petición anterior no terminó

  // yo es 0 o 1: elegimos mi nombre y el de la otra persona
  const nombres = [pareja.nombre0, pareja.nombre1];
  const yo = pareja.yo;
  const otro = yo === 0 ? 1 : 0;
  const miNombre = nombres[yo];
  const otroNombre = nombres[otro];

  // Pide TODOS los gastos de la pareja (el saldo cuenta todo lo no saldado, no solo este mes).
  // Si falla, dejamos los datos que ya teníamos y marcamos "Sin conexión".
  async function cargar() {
    if (enCurso.current) return;
    enCurso.current = true;
    try {
      const filas = await pedir(
        `movimientos?select=*&codigo=eq.${pareja.codigo}&order=fecha.desc,creado.desc`,
        { codigoPareja: pareja.codigo }
      );
      setMovimientos(filas);
      setConexion('ok');
    } catch (e) {
      setConexion('sin');
    } finally {
      enCurso.current = false;
      setCargando(false);
      setRefrescando(false);
    }
  }

  // Al abrir la pantalla cargamos, y desde ahí repetimos cada 5 segundos.
  // El "return" apaga el reloj al salir de la pantalla, para no pedir datos de más.
  useEffect(() => {
    cargar();
    const reloj = setInterval(cargar, CADA_CUANTO_MS);
    return () => clearInterval(reloj);
  }, []);

  async function copiarCodigo() {
    await Clipboard.setStringAsync(pareja.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // El balance se recalcula solo cuando cambian los movimientos
  const balance = useMemo(() => calcularBalance(movimientos), [movimientos]);
  // La frase y su color salen de la misma función que usa el ritual, así nunca se contradicen
  const saldo = describirSaldo(balance.neto, yo, nombres);
  const textoSaldo = saldo.texto;
  const estiloSaldo = { debo: styles.saldoDebo, medeben: styles.saldoMeDeben, amano: styles.saldoAMano }[saldo.clase];

  const esDomingo = new Date().getDay() === 0; // 0 = domingo

  // Solo los gastos de este mes van en la lista (el saldo usa todos)
  const delMes = movimientos.filter((m) => m.fecha >= inicioDeMes());

  // Filas del Detalle: yo primero. "pagos" solo aparece si ya hubo pagos entre ustedes.
  const orden = [yo, otro];
  const hayPagos = balance.pagosEnviados[0] + balance.pagosEnviados[1] > 0;
  const filasDetalle = [
    { texto: 'Pagó', valores: orden.map((i) => pesos(balance.gastado[i])) },
    { texto: 'Le tocaba', valores: orden.map((i) => pesos(balance.corresponde[i])) },
  ];
  if (hayPagos) {
    filasDetalle.push({
      texto: 'Pagos entre ustedes',
      valores: orden.map((i) => conSigno(balance.pagosEnviados[i] - balance.pagosRecibidos[i])),
    });
  }

  // Una fila de la lista. Al tocarla se abre y muestra el reparto.
  function renderFila({ item }) {
    const expandida = abierto === item.id;
    return (
      <Pressable style={styles.fila} onPress={() => setAbierto(expandida ? null : item.id)}>
        <View style={styles.filaArriba}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filaTitulo}>{item.descripcion}</Text>
            <Text style={styles.filaDetalle}>
              Pagó {nombres[item.pagador]} · {etiquetaTipo(item.tipo)} · {item.fecha.slice(8, 10)}/{item.fecha.slice(5, 7)}
            </Text>
          </View>
          <Text style={styles.filaMonto}>{pesos(Number(item.monto))}</Text>
        </View>
        {expandida && <Text style={styles.reparto}>Reparto: {textoReparto(item, nombres)}</Text>}
      </Pressable>
    );
  }

  // Indicador de sincronización
  const indicador = (
    <View style={styles.estado}>
      <View
        style={[
          styles.punto,
          conexion === 'ok' && styles.puntoOk,
          conexion === 'sin' && styles.puntoMal,
        ]}
      />
      <Text style={styles.estadoTexto}>
        {conexion === 'ok' ? 'Sincronizado' : conexion === 'sin' ? 'Sin conexión' : 'Sincronizando…'}
      </Text>
    </View>
  );

  // Todo lo que va ARRIBA de la lista (la lista hace scroll junto con esto)
  const encabezado = (
    <View>
      <Text style={styles.titulo}>Hola, {miNombre}</Text>
      <Text style={styles.subtitulo}>Compartes gastos con {otroNombre}</Text>

      {/* Tarjeta de saldo: quién le debe cuánto a quién */}
      <View style={styles.tarjeta}>
        <View style={styles.tarjetaArriba}>
          <Text style={styles.etiqueta}>Saldo</Text>
          {indicador}
        </View>
        <Text style={[styles.saldoTexto, estiloSaldo]}>{textoSaldo}</Text>
      </View>

      <Pressable style={styles.botonAnadir} onPress={onAnadir}>
        <Text style={styles.textoAnadir}>+ Añadir gasto</Text>
      </Pressable>

      {/* Ritual de domingo: siempre disponible; los domingos se resalta */}
      <Pressable style={[styles.botonRitual, esDomingo && styles.botonRitualHoy]} onPress={onRitual}>
        <Text style={[styles.textoRitual, esDomingo && styles.textoRitualHoy]}>
          {esDomingo ? 'Hoy toca el ritual de domingo' : 'Ritual de domingo'}
        </Text>
      </Pressable>

      {/* Tarjeta de detalle: los números que explican el saldo */}
      <View style={[styles.tarjeta, { marginTop: 20 }]}>
        <Text style={styles.etiqueta}>Detalle del saldo</Text>
        <View style={styles.detalleFila}>
          <Text style={styles.detalleTexto} />
          {orden.map((i) => (
            <Text key={i} style={[styles.detalleCol, styles.detalleNombre]}>
              {i === yo ? `${nombres[i]} (tú)` : nombres[i]}
            </Text>
          ))}
        </View>
        {filasDetalle.map((f) => (
          <View key={f.texto} style={styles.detalleFila}>
            <Text style={styles.detalleTexto}>{f.texto}</Text>
            {f.valores.map((v, k) => (
              <Text key={k} style={styles.detalleCol}>{v}</Text>
            ))}
          </View>
        ))}
        <View style={[styles.detalleFila, styles.detalleTotal]}>
          <Text style={[styles.detalleTexto, { fontWeight: '700' }]}>Diferencia</Text>
          {orden.map((i) => (
            <Text
              key={i}
              style={[styles.detalleCol, { fontWeight: '700' },
                balance.neto[i] <= -0.5 ? styles.rojo : balance.neto[i] >= 0.5 ? styles.verde : null]}
            >
              {conSigno(balance.neto[i])}
            </Text>
          ))}
        </View>
        <Text style={styles.nota}>
          Diferencia = lo que pagó − lo que le tocaba. Quien queda en negativo es quien debe.
        </Text>
      </View>

      {/* Código de la pareja, compacto */}
      <Pressable style={styles.codigoFila} onPress={copiarCodigo}>
        <Text style={styles.codigoTexto}>
          Código: <Text style={styles.codigoValor} selectable>{pareja.codigo}</Text>
        </Text>
        <Text style={styles.copiar}>{copiado ? '¡Copiado!' : 'Copiar'}</Text>
      </Pressable>

      <Text style={styles.seccion}>Gastos del mes</Text>
      {cargando && <ActivityIndicator color={ACENTO} style={{ marginTop: 12 }} />}
      {!cargando && conexion === 'sin' && movimientos.length === 0 && (
        <Text style={styles.error}>No se pudo cargar. Se reintenta solo cada 5 segundos.</Text>
      )}
      {!cargando && delMes.length === 0 && (conexion === 'ok' || movimientos.length > 0) && (
        <Text style={styles.vacio}>Aún no hay gastos este mes. ¡Anota el primero!</Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={styles.lista}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        data={delMes}
        extraData={abierto}
        keyExtractor={(m) => m.id}
        renderItem={renderFila}
        ListHeaderComponent={encabezado}
        ListFooterComponent={
          <Pressable onPress={onSalir}>
            <Text style={styles.salir}>Cerrar sesión</Text>
          </Pressable>
        }
        refreshing={refrescando}
        onRefresh={() => {
          setRefrescando(true);
          cargar();
        }}
      />
      {/* Aviso flotante arriba, por ejemplo "Gasto anotado" */}
      {aviso ? (
        <View style={styles.aviso} pointerEvents="none">
          <Text style={styles.avisoTexto}>✓ {aviso}</Text>
        </View>
      ) : null}
    </View>
  );
}

const ACENTO = '#0F766E';

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#FAFAF7' },
  titulo: { fontSize: 30, fontWeight: '700', color: ACENTO, textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1,
    borderColor: '#E5E5E0' },
  tarjetaArriba: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etiqueta: { fontSize: 13, color: '#777', marginBottom: 6 },
  saldoTexto: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  saldoDebo: { color: '#B91C1C' },
  saldoMeDeben: { color: ACENTO },
  saldoAMano: { color: '#555' },
  estado: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  punto: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#BBB', marginRight: 6 },
  puntoOk: { backgroundColor: '#16A34A' },
  puntoMal: { backgroundColor: '#B91C1C' },
  estadoTexto: { fontSize: 12, color: '#777' },
  botonAnadir: { backgroundColor: ACENTO, paddingVertical: 20, borderRadius: 16, marginTop: 16 },
  textoAnadir: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  botonRitual: { borderWidth: 2, borderColor: ACENTO, paddingVertical: 16, borderRadius: 16,
    marginTop: 12, backgroundColor: '#fff' },
  botonRitualHoy: { backgroundColor: '#D7EEEA' },
  textoRitual: { color: ACENTO, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  textoRitualHoy: { fontWeight: '700' },
  detalleFila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  detalleTexto: { flex: 1.3, fontSize: 14, color: '#555' },
  detalleCol: { flex: 1, fontSize: 14, color: '#222', textAlign: 'right' },
  detalleNombre: { fontWeight: '700', color: ACENTO },
  detalleTotal: { borderTopWidth: 1, borderTopColor: '#E5E5E0', marginTop: 4, paddingTop: 10 },
  rojo: { color: '#B91C1C' },
  verde: { color: '#16A34A' },
  nota: { fontSize: 12, color: '#888', marginTop: 8 },
  codigoFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingHorizontal: 4 },
  codigoTexto: { fontSize: 13, color: '#777' },
  codigoValor: { fontWeight: '700', letterSpacing: 1, color: '#444' },
  copiar: { color: ACENTO, fontSize: 14, fontWeight: '600' },
  seccion: { fontSize: 18, fontWeight: '700', color: '#222', marginTop: 24, marginBottom: 8 },
  vacio: { color: '#777', fontSize: 15, marginTop: 8 },
  error: { color: '#B91C1C', fontSize: 14, marginTop: 8 },
  fila: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E0',
    padding: 14, marginTop: 8 },
  filaArriba: { flexDirection: 'row', alignItems: 'center' },
  filaTitulo: { fontSize: 16, fontWeight: '600', color: '#222' },
  filaDetalle: { fontSize: 13, color: '#777', marginTop: 2 },
  filaMonto: { fontSize: 17, fontWeight: '700', color: '#222', marginLeft: 12 },
  reparto: { fontSize: 14, color: ACENTO, fontWeight: '600', marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#EEE' },
  salir: { color: '#B91C1C', fontSize: 15, textAlign: 'center', marginTop: 36 },
  aviso: { position: 'absolute', top: 12, left: 24, right: 24, backgroundColor: ACENTO,
    borderRadius: 12, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  avisoTexto: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
