import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

// Pantalla principal: saluda, muestra el código de la pareja y permite salir.
// Aquí irán después el campo para anotar gastos, la lista y el saldo (Fases 2 y 3).
// pareja: { codigo, nombre0, nombre1, yo }. onSalir: cerrar sesión.
export default function Principal({ pareja, onSalir }) {
  const [copiado, setCopiado] = useState(false);

  // yo es 0 o 1: elegimos mi nombre y el de la otra persona
  const miNombre = pareja.yo === 0 ? pareja.nombre0 : pareja.nombre1;
  const otroNombre = pareja.yo === 0 ? pareja.nombre1 : pareja.nombre0;

  async function copiarCodigo() {
    await Clipboard.setStringAsync(pareja.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Hola, {miNombre}</Text>
      <Text style={styles.subtitulo}>Compartes gastos con {otroNombre}</Text>

      <View style={styles.tarjeta}>
        <Text style={styles.etiqueta}>Código de la pareja</Text>
        <Text style={styles.codigo} selectable>{pareja.codigo}</Text>
        <Pressable onPress={copiarCodigo}>
          <Text style={styles.copiar}>{copiado ? '¡Copiado!' : 'Copiar código'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onSalir}>
        <Text style={styles.salir}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const ACENTO = '#0F766E';

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FAFAF7', padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 30, fontWeight: '700', color: ACENTO, textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 6, marginBottom: 32 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1,
    borderColor: '#E5E5E0', alignItems: 'center' },
  etiqueta: { fontSize: 13, color: '#777', marginBottom: 6 },
  codigo: { fontSize: 28, fontWeight: '700', letterSpacing: 3, color: '#222', marginBottom: 10 },
  copiar: { color: ACENTO, fontSize: 16, fontWeight: '600' },
  salir: { color: '#B91C1C', fontSize: 15, textAlign: 'center', marginTop: 40 },
});
