import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { pedir } from '../supabase';
import { etiquetaTipo, formatearMonto, inicioDeMes } from '../formato';

// Pantalla principal: saludo, código de la pareja, botón de añadir y lista de gastos del mes.
// pareja: { codigo, nombre0, nombre1, yo }. onAnadir: abrir el flujo. onSalir: cerrar sesión.
export default function Principal({ pareja, onAnadir, onSalir }) {
  const [copiado, setCopiado] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true); // primera carga
  const [refrescando, setRefrescando] = useState(false); // al arrastrar hacia abajo
  const [errorLista, setErrorLista] = useState('');

  // yo es 0 o 1: elegimos mi nombre y el de la otra persona
  const nombres = [pareja.nombre0, pareja.nombre1];
  const miNombre = nombres[pareja.yo];
  const otroNombre = nombres[pareja.yo === 0 ? 1 : 0];

  // Pide a Supabase los gastos de este mes, los más recientes primero.
  // "fecha=gte.2026-10-01" = "fecha mayor o igual al 1 del mes". "order" ordena el resultado.
  async function cargar() {
    try {
      const filas = await pedir(
        `movimientos?select=*&codigo=eq.${pareja.codigo}&fecha=gte.${inicioDeMes()}` +
          '&order=fecha.desc,creado.desc',
        { codigoPareja: pareja.codigo }
      );
      setMovimientos(filas);
      setErrorLista('');
    } catch (e) {
      setErrorLista('No se pudo cargar la lista: ' + String(e.message).slice(0, 150));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }

  // Al abrir la pantalla (y al volver de añadir un gasto) cargamos la lista
  useEffect(() => {
    cargar();
  }, []);

  async function copiarCodigo() {
    await Clipboard.setStringAsync(pareja.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // Una fila de la lista: descripción, quién pagó y tipo a la izquierda; monto a la derecha
  function Fila({ item }) {
    return (
      <View style={styles.fila}>
        <View style={{ flex: 1 }}>
          <Text style={styles.filaTitulo}>{item.descripcion}</Text>
          <Text style={styles.filaDetalle}>
            Pagó {nombres[item.pagador]} · {etiquetaTipo(item.tipo)} · {item.fecha.slice(8, 10)}/{item.fecha.slice(5, 7)}
          </Text>
        </View>
        <Text style={styles.filaMonto}>${formatearMonto(Number(item.monto))}</Text>
      </View>
    );
  }

  // Todo lo que va ARRIBA de la lista (la lista hace scroll junto con esto)
  const encabezado = (
    <View>
      <Text style={styles.titulo}>Hola, {miNombre}</Text>
      <Text style={styles.subtitulo}>Compartes gastos con {otroNombre}</Text>

      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Código de la pareja</Text>
        <Text style={styles.codigo} selectable>{pareja.codigo}</Text>
        <Pressable onPress={copiarCodigo}>
          <Text style={styles.copiar}>{copiado ? '¡Copiado!' : 'Copiar código'}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.botonAnadir} onPress={onAnadir}>
        <Text style={styles.textoAnadir}>+ Añadir gasto</Text>
      </Pressable>

      <Text style={styles.seccion}>Gastos del mes</Text>
      {cargando && <ActivityIndicator color={ACENTO} style={{ marginTop: 12 }} />}
      {errorLista !== '' && <Text style={styles.error}>{errorLista}</Text>}
      {!cargando && errorLista === '' && movimientos.length === 0 && (
        <Text style={styles.vacio}>Aún no hay gastos este mes. ¡Anota el primero!</Text>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.lista}
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      data={movimientos}
      keyExtractor={(m) => m.id}
      renderItem={Fila}
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
  );
}

const ACENTO = '#0F766E';

const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#FAFAF7' },
  titulo: { fontSize: 30, fontWeight: '700', color: ACENTO, textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1,
    borderColor: '#E5E5E0', alignItems: 'center' },
  etiqueta: { fontSize: 13, color: '#777', marginBottom: 6 },
  codigo: { fontSize: 28, fontWeight: '700', letterSpacing: 3, color: '#222', marginBottom: 10 },
  copiar: { color: ACENTO, fontSize: 16, fontWeight: '600' },
  botonAnadir: { backgroundColor: ACENTO, paddingVertical: 20, borderRadius: 16, marginTop: 24 },
  textoAnadir: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  seccion: { fontSize: 18, fontWeight: '700', color: '#222', marginTop: 28, marginBottom: 8 },
  vacio: { color: '#777', fontSize: 15, marginTop: 8 },
  error: { color: '#B91C1C', fontSize: 14, marginTop: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E5E0', padding: 14, marginTop: 8 },
  filaTitulo: { fontSize: 16, fontWeight: '600', color: '#222' },
  filaDetalle: { fontSize: 13, color: '#777', marginTop: 2 },
  filaMonto: { fontSize: 17, fontWeight: '700', color: '#222', marginLeft: 12 },
  salir: { color: '#B91C1C', fontSize: 15, textAlign: 'center', marginTop: 36 },
});
