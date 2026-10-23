import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatearMonto, soloDigitos } from '../formato';

// Flujo para anotar un gasto, de a un paso por pantalla:
// monto -> tipo (mitad / fracción / invitación) -> ¿quién pagó?
// Por ahora solo existe el paso "monto"; los demás se agregan en los pasos 2 a 4.
// pareja: { codigo, nombre0, nombre1, yo }. onCerrar: volver a la pantalla principal.
export default function AnadirGasto({ pareja, onCerrar }) {
  const [paso, setPaso] = useState('monto'); // 'monto' | 'tipo' (próximamente)
  const [textoMonto, setTextoMonto] = useState(''); // lo que se ve en el campo, con puntos
  const [descripcion, setDescripcion] = useState(''); // opcional

  const monto = soloDigitos(textoMonto); // el número real: 42000

  // Mientras escribes, mostramos el monto con puntos de miles (42.000)
  function cambiarMonto(texto) {
    const numero = soloDigitos(texto);
    setTextoMonto(numero === 0 ? '' : formatearMonto(numero));
  }

  if (paso === 'tipo') {
    // Marcador temporal hasta el Paso 2
    return (
      <View style={styles.contenedor}>
        <Text style={styles.resumen}>
          ${formatearMonto(monto)}{descripcion.trim() ? ` · ${descripcion.trim()}` : ''}
        </Text>
        <Text style={styles.ayuda}>El paso "tipo de gasto" está en construcción.</Text>
        <Pressable onPress={() => setPaso('monto')}>
          <Text style={styles.enlace}>Volver al monto</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Añadir gasto</Text>

      <Text style={styles.etiqueta}>¿Cuánto fue?</Text>
      <View style={styles.filaMonto}>
        <Text style={styles.signo}>$</Text>
        <TextInput
          style={styles.monto}
          value={textoMonto}
          onChangeText={cambiarMonto}
          placeholder="0"
          keyboardType="number-pad" // teclado de números
          autoFocus // el teclado se abre solo: ahorra un toque
          maxLength={11}
        />
      </View>

      <Text style={styles.etiqueta}>¿En qué? (opcional)</Text>
      <TextInput
        style={styles.campo}
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Ej: super, cine, bencina"
        returnKeyType="next"
        maxLength={60}
      />

      <Pressable
        style={[styles.boton, monto === 0 && styles.botonApagado]}
        onPress={() => setPaso('tipo')}
        disabled={monto === 0} // sin monto no se puede avanzar
      >
        <Text style={styles.textoBoton}>Siguiente</Text>
      </Pressable>
      <Pressable onPress={onCerrar}>
        <Text style={styles.enlace}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const ACENTO = '#0F766E';

const styles = StyleSheet.create({
  // Contenido arriba (no centrado) para que el teclado no lo tape
  contenedor: { flex: 1, backgroundColor: '#FAFAF7', padding: 24, paddingTop: 40 },
  titulo: { fontSize: 26, fontWeight: '700', color: ACENTO, textAlign: 'center', marginBottom: 28 },
  etiqueta: { fontSize: 14, color: '#555', marginBottom: 6 },
  filaMonto: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2,
    borderBottomColor: ACENTO, marginBottom: 28 },
  signo: { fontSize: 40, fontWeight: '700', color: ACENTO, marginRight: 8 },
  monto: { flex: 1, fontSize: 40, fontWeight: '700', color: '#222', paddingVertical: 8 },
  campo: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4D4D0', borderRadius: 12,
    padding: 14, fontSize: 17, marginBottom: 24 },
  boton: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16 },
  botonApagado: { opacity: 0.4 },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  enlace: { color: ACENTO, fontSize: 16, textAlign: 'center', marginTop: 18 },
  resumen: { fontSize: 28, fontWeight: '700', color: '#222', textAlign: 'center', marginBottom: 12 },
  ayuda: { fontSize: 15, color: '#555', textAlign: 'center' },
});
