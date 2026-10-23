import { useState } from 'react';
import { SafeAreaView, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Inicio from './src/pantallas/Inicio';

// App.js decide qué pantalla se ve según la variable "pantalla".
// Por ahora: 'inicio'. Las pantallas de crear y unirme se agregan en los pasos 2 y 3.
export default function App() {
  const [pantalla, setPantalla] = useState('inicio');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      <StatusBar style="dark" />
      {pantalla === 'inicio' && (
        <Inicio
          onCrear={() => setPantalla('crear')}
          onUnirme={() => setPantalla('unirme')}
        />
      )}
      {/* Pantallas aún no creadas: mensaje temporal para poder probar los botones */}
      {pantalla !== 'inicio' && (
        <Text style={{ padding: 24 }} onPress={() => setPantalla('inicio')}>
          Pantalla "{pantalla}" en construcción. Toca aquí para volver.
        </Text>
      )}
    </SafeAreaView>
  );
}
