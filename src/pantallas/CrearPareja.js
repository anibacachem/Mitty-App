import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { pedir } from '../supabase';
import { generarCodigo } from '../codigo';

// Pantalla para crear la pareja: pide dos nombres, guarda en Supabase y muestra el código.
// onVolver: regresar al inicio. onListo: entrar a la app con los datos de la pareja.
export default function CrearPareja({ onVolver, onListo }) {
  const [miNombre, setMiNombre] = useState('');
  const [nombrePareja, setNombrePareja] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [creada, setCreada] = useState(null); // al crear, guarda { codigo, nombre0, nombre1 }

  async function crear() {
    // Validación simple: los dos nombres son obligatorios
    if (!miNombre.trim() || !nombrePareja.trim()) {
      setError('Escribe los dos nombres.');
      return;
    }
    setError('');
    setGuardando(true);
    const codigo = generarCodigo();
    const fila = { codigo, nombre0: miNombre.trim(), nombre1: nombrePareja.trim() };
    try {
      // POST = crear una fila nueva en la tabla "parejas".
      // El header x-pareja lleva el código nuevo: así la regla de seguridad deja guardarla.
      await pedir('parejas', { metodo: 'POST', cuerpo: fila, codigoPareja: codigo });
      setCreada(fila);
    } catch (e) {
      setError('No se pudo crear: ' + String(e.message).slice(0, 150));
    } finally {
      setGuardando(false); // pase lo que pase, apagamos el "cargando"
    }
  }

  // Pantalla de éxito: muestra el código para compartirlo
  if (creada) {
    return (
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>¡Pareja creada!</Text>
        <Text style={styles.ayuda}>Comparte este código con {creada.nombre1} para que se una:</Text>
        <Text style={styles.codigo} selectable>{creada.codigo}</Text>
        <Pressable style={styles.boton} onPress={() => onListo(creada)}>
          <Text style={styles.textoBoton}>Continuar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Crear nuestra pareja</Text>

      <Text style={styles.etiqueta}>Tu nombre</Text>
      <TextInput style={styles.campo} value={miNombre} onChangeText={setMiNombre}
        placeholder="Ej: Ana" autoCapitalize="words" />

      <Text style={styles.etiqueta}>Nombre de tu pareja</Text>
      <TextInput style={styles.campo} value={nombrePareja} onChangeText={setNombrePareja}
        placeholder="Ej: Luis" autoCapitalize="words" />

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.boton, guardando && styles.botonApagado]} onPress={crear} disabled={guardando}>
        {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.textoBoton}>Crear</Text>}
      </Pressable>
      <Pressable onPress={onVolver} disabled={guardando}>
        <Text style={styles.volver}>Volver</Text>
      </Pressable>
    </View>
  );
}

const ACENTO = '#0F766E';

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FAFAF7', padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 28, fontWeight: '700', color: ACENTO, textAlign: 'center', marginBottom: 28 },
  etiqueta: { fontSize: 14, color: '#555', marginBottom: 6 },
  campo: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4D4D0', borderRadius: 12,
    padding: 14, fontSize: 17, marginBottom: 18 },
  error: { color: '#B91C1C', marginBottom: 12, textAlign: 'center' },
  boton: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16, marginTop: 8 },
  botonApagado: { opacity: 0.6 },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  volver: { color: ACENTO, fontSize: 16, textAlign: 'center', marginTop: 18 },
  ayuda: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 20 },
  codigo: { fontSize: 34, fontWeight: '700', letterSpacing: 4, color: '#222', textAlign: 'center',
    marginBottom: 32 },
});
