import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { pedir } from '../supabase';
import { ACENTO } from '../colores';

// Pantalla para unirse: escribes el código, lo buscamos y eliges quién eres.
// onVolver: regresar al inicio. onListo: entrar con { codigo, nombre0, nombre1, yo }.
export default function UnirmeConCodigo({ onVolver, onListo }) {
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const [pareja, setPareja] = useState(null); // la pareja encontrada

  async function buscar() {
    // Limpiamos lo escrito: sin espacios y en mayúsculas (los códigos son así)
    const codigo = texto.replace(/\s/g, '').toUpperCase();
    if (codigo.length !== 10) {
      setError('El código tiene 10 caracteres.');
      return;
    }
    setError('');
    setBuscando(true);
    try {
      // GET con filtro: "codigo=eq.XXXX" significa "donde codigo es igual a XXXX".
      // El header x-pareja con el mismo código permite que la regla de seguridad deje leerla.
      const filas = await pedir(`parejas?codigo=eq.${codigo}&select=*`, { codigoPareja: codigo });
      if (filas.length === 0) {
        setError('No encontramos ese código. Revisa que esté bien escrito.');
      } else {
        setPareja(filas[0]); // pasamos a "¿quién eres?"
      }
    } catch (e) {
      setError('No se pudo buscar: ' + String(e.message).slice(0, 150));
    } finally {
      setBuscando(false);
    }
  }

  // Segunda parte: elegir quién eres entre los dos nombres.
  // yo = 0 si eres la primera persona (nombre0), 1 si eres la segunda (nombre1).
  if (pareja) {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>¿Quién eres?</Text>
        <Pressable style={styles.boton}
          onPress={() => onListo({ ...pareja, yo: 0 })}>
          <Text style={styles.textoBoton}>Soy {pareja.nombre0}</Text>
        </Pressable>
        <Pressable style={styles.boton}
          onPress={() => onListo({ ...pareja, yo: 1 })}>
          <Text style={styles.textoBoton}>Soy {pareja.nombre1}</Text>
        </Pressable>
        <Pressable onPress={() => setPareja(null)}>
          <Text style={styles.volver}>Cambiar código</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Unirme con código</Text>
      <Text style={styles.etiqueta}>Código de la pareja</Text>
      <TextInput style={styles.campo} value={texto} onChangeText={setTexto}
        placeholder="Ej: K7M4QX9TBW" autoCapitalize="characters" autoCorrect={false}
        maxLength={12} />

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.boton, buscando && styles.botonApagado]} onPress={buscar} disabled={buscando}>
        {buscando ? <ActivityIndicator color="#fff" /> : <Text style={styles.textoBoton}>Buscar</Text>}
      </Pressable>
      <Pressable onPress={onVolver} disabled={buscando}>
        <Text style={styles.volver}>Volver</Text>
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FFF8F5', padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 28, fontWeight: '700', color: ACENTO, textAlign: 'center', marginBottom: 28 },
  etiqueta: { fontSize: 14, color: '#555', marginBottom: 6 },
  campo: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4D4D0', borderRadius: 12,
    padding: 14, fontSize: 20, letterSpacing: 2, marginBottom: 18 },
  error: { color: '#B91C1C', marginBottom: 12, textAlign: 'center' },
  boton: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16, marginTop: 8 },
  botonApagado: { opacity: 0.6 },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  volver: { color: ACENTO, fontSize: 16, textAlign: 'center', marginTop: 18 },
});
