import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cargarTodo } from '../datos';
import { pedir } from '../supabase';
import { generarId } from '../codigo';
import { hoyISO, pesos } from '../formato';
import { calcularBalance, describirSaldo } from '../saldo';
import { limitesDelMes } from '../habito';
import { ACENTO } from '../colores';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Cuánto debe pagarse hoy para dejar el saldo en cero, y quién lo paga.
// Devuelve { deudor: 0 o 1, monto } o null si están al día.
function deudaActual(movimientos) {
  const neto = calcularBalance(movimientos).neto; // [neto0, neto1]; negativo = debe
  const monto = Math.round(Math.abs(neto[0]) * 100) / 100; // monto exacto (2 decimales), sin redondear a pesos
  if (monto < 0.5) return null; // mismo criterio que el saldo de la pantalla: menos de medio peso es "Al día"
  return { deudor: neto[0] < 0 ? 0 : 1, monto };
}

// Cierre de mes: resumen del mes y botón para registrar el pago que deja el saldo en cero.
// pareja: { codigo, nombre0, nombre1, yo }. onVolver: regresar a la pantalla principal.
export default function CierreMes({ pareja, onVolver }) {
  const [movimientos, setMovimientos] = useState(null); // null = todavía cargando
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');
  // Un id por intento de pago: si se reintenta tras un corte de red, no se duplica el pago
  const idPago = useRef(generarId());

  async function cargar() {
    try {
      const datos = await cargarTodo(pareja.codigo);
      setMovimientos(datos.movimientos);
      return datos.movimientos;
    } catch (e) {
      setError('No se pudo cargar el cierre: ' + String(e.message).slice(0, 150));
      return null;
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const nombres = [pareja.nombre0, pareja.nombre1];
  const yo = pareja.yo;
  const orden = [yo, yo === 0 ? 1 : 0]; // yo primero

  // ---- Carga y error ----
  if (movimientos === null) {
    return (
      <View style={[styles.pantalla, { justifyContent: 'center', padding: 24 }]}>
        {error === '' ? (
          <ActivityIndicator color={ACENTO} size="large" />
        ) : (
          <>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.boton} onPress={() => { setError(''); cargar(); }}>
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

  // ---- Resumen del mes ----
  const hoy = hoyISO();
  const { desde, hasta } = limitesDelMes(hoy);
  const delMes = movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta);
  const gastosMes = delMes.filter((m) => m.tipo !== 'pago'); // un pago entre ustedes no es un gasto
  const totalMes = gastosMes.reduce((suma, m) => suma + Number(m.monto), 0);
  const pagoPorPersona = calcularBalance(delMes).gastado; // cuánto pagó cada uno este mes
  const pagosDelMes = delMes.filter((m) => m.tipo === 'pago').reduce((suma, m) => suma + Number(m.monto), 0);
  const nombreMes = MESES[Number(hoy.slice(5, 7)) - 1];

  // ---- Saldo y pago ----
  const saldo = describirSaldo(calcularBalance(movimientos).neto, yo, nombres);
  const colorSaldo = { debo: '#B91C1C', medeben: ACENTO, amano: '#555' }[saldo.clase];
  const deuda = deudaActual(movimientos);

  // Paso 1: pedir confirmación antes de registrar nada
  function pedirConfirmacion() {
    if (!deuda) return;
    const deudor = nombres[deuda.deudor];
    const acreedor = nombres[deuda.deudor === 0 ? 1 : 0];
    Alert.alert(
      'Registrar pago',
      `¿${deudor} le pagó ${pesos(deuda.monto)} a ${acreedor}? El saldo quedará en cero.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, registrar', onPress: registrar },
      ]
    );
  }

  // Paso 2: registrar el pago como un movimiento de tipo "pago" hecho por quien debe
  async function registrar() {
    setGuardando(true);
    setError('');
    setExito('');
    try {
      // Volvemos a pedir los datos: si la otra persona anotó algo justo ahora, el saldo pudo cambiar
      const datos = await cargarTodo(pareja.codigo);
      setMovimientos(datos.movimientos);
      const fresca = deudaActual(datos.movimientos);
      if (!fresca || fresca.deudor !== deuda.deudor || Math.abs(fresca.monto - deuda.monto) > 0.005) {
        setError('El saldo cambió mientras confirmabas. Revisa el nuevo monto y vuelve a intentar.');
        return;
      }

      await pedir('movimientos', {
        metodo: 'POST',
        cuerpo: {
          id: idPago.current,
          codigo: pareja.codigo,
          descripcion: 'Pago de cierre de mes',
          monto: deuda.monto,
          pagador: deuda.deudor, // paga el que debe
          tipo: 'pago',
          fecha: hoy,
        },
        codigoPareja: pareja.codigo,
      });
      idPago.current = generarId(); // el próximo pago tendrá otro id
      await cargar();
      setExito('Pago registrado. Están al día.');
    } catch (e) {
      // 23505 = "este id ya existe": un intento anterior sí se guardó. Lo damos por bueno.
      if (String(e.message).includes('23505')) {
        idPago.current = generarId();
        await cargar();
        setExito('Pago registrado. Están al día.');
      } else {
        setError('No se pudo registrar el pago: ' + String(e.message).slice(0, 150));
      }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.pantalla} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <Text style={styles.titulo}>Cierre de mes</Text>
      <Text style={styles.subtitulo}>{nombreMes[0].toUpperCase() + nombreMes.slice(1)}</Text>

      {exito !== '' && (
        <View style={styles.exito}>
          <Text style={styles.exitoTexto}>✓ {exito}</Text>
        </View>
      )}

      {/* Resumen del mes */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Resumen del mes</Text>
        {gastosMes.length === 0 ? (
          <Text style={styles.vacio}>Todavía no hay gastos este mes.</Text>
        ) : (
          <>
            <View style={styles.fila}>
              <Text style={styles.filaEtiqueta}>
                Total gastado ({gastosMes.length} {gastosMes.length === 1 ? 'gasto' : 'gastos'})
              </Text>
              <Text style={styles.filaTotal}>{pesos(totalMes)}</Text>
            </View>
            {orden.map((i) => (
              <View key={i} style={styles.fila}>
                <Text style={styles.filaEtiqueta}>{i === yo ? `${nombres[i]} (tú) pagó` : `${nombres[i]} pagó`}</Text>
                <Text style={styles.filaValor}>{pesos(pagoPorPersona[i])}</Text>
              </View>
            ))}
          </>
        )}
        {pagosDelMes > 0 && (
          <View style={styles.fila}>
            <Text style={styles.filaEtiqueta}>Pagos entre ustedes este mes</Text>
            <Text style={styles.filaValor}>{pesos(pagosDelMes)}</Text>
          </View>
        )}
      </View>

      {/* Saldo y botón de pago */}
      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Saldo a pagar</Text>
        <Text style={[styles.saldo, { color: colorSaldo }]}>{saldo.texto}</Text>

        {error !== '' && <Text style={styles.error}>{error}</Text>}

        {deuda ? (
          <>
            <Pressable style={[styles.boton, guardando && { opacity: 0.6 }]} onPress={pedirConfirmacion} disabled={guardando}>
              {guardando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.textoBoton}>Registrar pago de {pesos(deuda.monto)}</Text>
              )}
            </Pressable>
            <Text style={styles.nota}>
              Se registra como pago de {nombres[deuda.deudor]} a {nombres[deuda.deudor === 0 ? 1 : 0]}, aunque
              lo toque cualquiera de los dos. Se pide confirmación antes de registrar.
            </Text>
          </>
        ) : (
          <Text style={styles.nota}>Están al día: no hay nada que pagar.</Text>
        )}
      </View>

      <Pressable onPress={onVolver} disabled={guardando}>
        <Text style={styles.enlace}>Volver</Text>
      </Pressable>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FFF8F5' },
  titulo: { fontSize: 28, fontWeight: '700', color: ACENTO, textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1,
    borderColor: '#F0E4E0', marginBottom: 14 },
  etiqueta: { fontSize: 13, color: '#777', marginBottom: 6 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  filaEtiqueta: { fontSize: 15, color: '#555', flexShrink: 1, paddingRight: 8 },
  filaValor: { fontSize: 16, fontWeight: '700', color: '#222' },
  filaTotal: { fontSize: 20, fontWeight: '700', color: '#222' },
  saldo: { fontSize: 24, fontWeight: '700', marginTop: 4, marginBottom: 14 },
  vacio: { fontSize: 15, color: '#777' },
  nota: { fontSize: 13, color: '#888', marginTop: 10 },
  exito: { backgroundColor: '#E7F5EC', borderRadius: 12, padding: 14, marginBottom: 14 },
  exitoTexto: { color: '#166534', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  boton: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16, marginTop: 6 },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  enlace: { color: ACENTO, fontSize: 16, textAlign: 'center', marginTop: 10 },
  error: { color: '#B91C1C', fontSize: 14, marginBottom: 10 },
});
