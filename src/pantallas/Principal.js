import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { cargarTodo } from '../datos';
import { etiquetaTipo, hoyISO, inicioDeMes, pesos } from '../formato';
import { calcularBalance, describirSaldo, resultadoEnPalabras, textoReparto } from '../saldo';
import { limitesDelMes, medirPeriodo } from '../habito';
import DiaDeclarable from '../componentes/DiaDeclarable';

const CADA_CUANTO_MS = 5000; // los datos se refrescan solos cada 5 segundos
const ALTO_CAJA = 400; // alto de la caja de gastos: caben unos 5 gastos; el resto se ve con scroll

// Pantalla principal: saludo, saldo, detalle, botón de añadir y lista de gastos del mes.
// pareja: { codigo, nombre0, nombre1, yo }. aviso: mensaje corto arriba (ej. "Gasto anotado").
export default function Principal({ pareja, aviso, onAnadir, onRitual, onCierre, onSalir }) {
  const [copiado, setCopiado] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [declaraciones, setDeclaraciones] = useState([]); // días declarados con menos de 3 gastos
  const [metasDisponible, setMetasDisponible] = useState(true); // false si falta la tabla metas_dia
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
      const datos = await cargarTodo(pareja.codigo); // gastos + días declarados, en paralelo
      setMovimientos(datos.movimientos);
      setDeclaraciones(datos.declaraciones);
      setMetasDisponible(datos.metasDisponible);
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

  // Cómo va el día de hoy: gastos compartidos anotados contra la meta (3, o lo declarado)
  const hoy = hoyISO();
  const diaHoy = medirPeriodo(movimientos, declaraciones, hoy, hoy, hoy).dias[0];
  const declaracionHoy = declaraciones.find((d) => d.fecha === hoy);
  const esFinDeMes = hoy === limitesDelMes(hoy).hasta; // último día del mes: toca el cierre

  // Solo los gastos de este mes van en la lista (el saldo usa todos)
  const delMes = movimientos.filter((m) => m.fecha >= inicioDeMes());

  // Filas del Detalle: yo primero. "pagos" solo aparece si ya hubo pagos entre ustedes.
  const orden = [yo, otro];
  const hayPagos = balance.pagosEnviados[0] + balance.pagosEnviados[1] > 0;
  const filasDetalle = [
    { texto: 'Gasto total', valores: orden.map((i) => pesos(balance.gastado[i])) },
    { texto: 'Le correspondía', valores: orden.map((i) => pesos(balance.corresponde[i])) },
  ];
  if (hayPagos) {
    // Dos filas con solo el monto (o "—"), así todo queda alineado a la derecha:
    // "Pagó" = dinero que envió para saldar la deuda; "Recibió" = dinero que le llegó.
    filasDetalle.push({
      texto: 'Pagó',
      valores: orden.map((i) => (balance.pagosEnviados[i] >= 0.5 ? pesos(balance.pagosEnviados[i]) : '—')),
    });
    filasDetalle.push({
      texto: 'Recibió',
      valores: orden.map((i) => (balance.pagosRecibidos[i] >= 0.5 ? pesos(balance.pagosRecibidos[i]) : '—')),
    });
  }

  // Lista del mes: del más nuevo anotado al más antiguo (por la hora en que se anotó)
  const listaMes = [...delMes].sort((a, b) =>
    String(b.creado ?? b.fecha).localeCompare(String(a.creado ?? a.fecha))
  );

  // Una fila de la lista. Al tocarla se abre y muestra el reparto.
  function renderFila({ item }) {
    const expandida = abierto === item.id;
    return (
      <Pressable style={styles.fila} onPress={() => setAbierto(expandida ? null : item.id)}>
        <View style={styles.filaArriba}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filaTitulo}>{item.descripcion}</Text>
            <Text style={styles.filaDetalle}>
              {item.tipo === 'pago' ? 'Pagó' : 'Gastó'} {nombres[item.pagador]} · {etiquetaTipo(item.tipo)} · {item.fecha.slice(8, 10)}/{item.fecha.slice(5, 7)}
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

      {/* Hoy: gastos compartidos anotados contra la meta, con punto por gasto y opción de declarar menos */}
      <View style={styles.tarjetaHoy}>
        <View style={styles.hoyFila}>
          <Text style={styles.hoyTitulo}>Hoy</Text>
          <View style={styles.puntos}>
            {Array.from({ length: diaHoy.objetivo }).map((_, i) => (
              <View key={i} style={[styles.puntoHoy, i < diaHoy.contados && styles.puntoHoyLleno]} />
            ))}
          </View>
          <Text style={[styles.hoyConteo, diaHoy.completo ? styles.verde : styles.ambar]}>
            {diaHoy.objetivo === 0
              ? 'Sin gastos hoy'
              : `${diaHoy.contados}/${diaHoy.objetivo}${diaHoy.extra > 0 ? '+' : ''}`}
          </Text>
        </View>
        <Text style={styles.hoySub}>Gastos compartidos anotados</Text>
        <DiaDeclarable
          compacto
          pareja={pareja}
          fecha={hoy}
          dia={diaHoy}
          declaracion={declaracionHoy}
          disponible={metasDisponible}
          onCambio={cargar}
        />
      </View>

      {/* Ritual de domingo: siempre disponible; los domingos se resalta */}
      <Pressable style={[styles.botonRitual, esDomingo && styles.botonRitualHoy]} onPress={onRitual}>
        <Text style={[styles.textoRitual, esDomingo && styles.textoRitualHoy]}>
          {esDomingo ? 'Hoy toca el ritual de domingo' : 'Ritual de domingo'}
        </Text>
      </Pressable>

      {/* Cierre de mes: siempre disponible; el último día del mes se resalta */}
      <Pressable style={[styles.botonRitual, esFinDeMes && styles.botonRitualHoy]} onPress={onCierre}>
        <Text style={[styles.textoRitual, esFinDeMes && styles.textoRitualHoy]}>
          {esFinDeMes ? 'Hoy toca el cierre de mes' : 'Cierre de mes'}
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
          <Text style={[styles.detalleTexto, { fontWeight: '700' }]}>Resultado</Text>
          {orden.map((i) => (
            <Text
              key={i}
              style={[styles.detalleCol, { fontWeight: '700' },
                balance.neto[i] <= -0.5 ? styles.rojo : balance.neto[i] >= 0.5 ? styles.verde : null]}
            >
              {resultadoEnPalabras(balance.neto[i])}
            </Text>
          ))}
        </View>
        <Text style={styles.nota}>
          Gasto total = todo lo que anotó como gasto suyo, incluidas las invitaciones. Le correspondía = su parte
          (en una invitación, todo es de quien invita). Pagó / Recibió = dinero entregado entre ustedes para
          saldar la deuda. Resultado = gasto total − lo que le correspondía ± pagos.
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

      {/* Caja con scroll propio: se ven unos 5 gastos (los más nuevos arriba); al bajar aparecen los más antiguos */}
      {listaMes.length > 0 && (
        <View style={styles.cajaLista}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: ALTO_CAJA }}>
            {listaMes.map((item) => (
              <View key={item.id}>{renderFila({ item })}</View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={styles.lista}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        data={[]} // los gastos van dentro de la caja con scroll del encabezado
        renderItem={null}
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
  tarjetaHoy: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1,
    borderColor: '#E5E5E0', marginTop: 12 },
  hoyFila: { flexDirection: 'row', alignItems: 'center' },
  hoyTitulo: { fontSize: 17, fontWeight: '700', color: '#222', marginRight: 12 },
  puntos: { flexDirection: 'row', flex: 1 },
  puntoHoy: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: ACENTO, marginRight: 6 },
  puntoHoyLleno: { backgroundColor: ACENTO },
  hoyConteo: { fontSize: 17, fontWeight: '700' },
  hoySub: { fontSize: 12, color: '#888', marginTop: 4 },
  ambar: { color: '#D97706' }, // ("verde" ya existe más abajo, en el detalle del saldo)
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
  cajaLista: { backgroundColor: '#F3F3EE', borderRadius: 16, borderWidth: 1, borderColor: '#E5E5E0',
    paddingHorizontal: 8, paddingBottom: 8, marginTop: 4 },
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
