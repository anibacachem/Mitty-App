import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pedir } from '../supabase';

// Pantalla de inicio: dos botones y un aviso de conexión.
// Recibe dos funciones desde App.js: qué hacer al tocar cada botón.
export default function Inicio({ onCrear, onUnirme }) {
  // 'probando' | 'listo' | 'error'
  const [conexion, setConexion] = useState('probando');

  // Al abrir la pantalla, hacemos una consulta mínima para comprobar URL y llave.
  // Sin el header x-pareja la base devuelve lista vacía (200): eso ya prueba que conecta.
  useEffect(() => {
    pedir('parejas?select=codigo&limit=1')
      .then(() => setConexion('listo'))
      .catch(() => setConexion('error'));
  }, []);

  const textoConexion = {
    probando: 'Probando conexión…',
    listo: 'Conectado a la base de datos',
    error: 'No hay conexión (revisa el .env)',
  }[conexion];

  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Mitty App</Text>
      <Text style={styles.subtitulo}>Los gastos de a dos, sin discusiones.</Text>

      <Pressable style={styles.botonPrincipal} onPress={onCrear}>
        <Text style={styles.textoPrincipal}>Crear nuestra pareja</Text>
      </Pressable>

      <Pressable style={styles.botonSecundario} onPress={onUnirme}>
        <Text style={styles.textoSecundario}>Unirme con código</Text>
      </Pressable>

      <Text style={[styles.conexion, conexion === 'error' && styles.conexionError]}>
        {textoConexion}
      </Text>
    </View>
  );
}

const ACENTO = '#0F766E'; // verde azulado

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#FAFAF7', padding: 24, justifyContent: 'center' },
  titulo: { fontSize: 40, fontWeight: '700', color: ACENTO, textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 48, marginTop: 8 },
  botonPrincipal: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16, marginBottom: 14 },
  textoPrincipal: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  botonSecundario: { borderWidth: 2, borderColor: ACENTO, paddingVertical: 16, borderRadius: 16 },
  textoSecundario: { color: ACENTO, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  conexion: { marginTop: 32, textAlign: 'center', color: '#777', fontSize: 13 },
  conexionError: { color: '#B91C1C' },
});
