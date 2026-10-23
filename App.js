import { useState } from 'react';
import { SafeAreaView, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Inicio from './src/pantallas/Inicio';
import CrearPareja from './src/pantallas/CrearPareja';

// App.js decide qué pantalla se ve según la variable "pantalla":
// 'inicio' | 'crear' | 'unirme' (paso 3) | 'principal' (paso 4)
export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [pareja, setPareja] = useState(null); // { codigo, nombre0, nombre1 } al entrar

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      <StatusBar style="dark" />
      {pantalla === 'inicio' && (
        <Inicio
          onCrear={() => setPantalla('crear')}
          onUnirme={() => setPantalla('unirme')}
        />
      )}
      {pantalla === 'crear' && (
        <CrearPareja
          onVolver={() => setPantalla('inicio')}
          onListo={(datos) => {
            setPareja(datos);
            setPantalla('principal');
          }}
        />
      )}
      {/* Pantallas aún no creadas: mensaje temporal */}
      {(pantalla === 'unirme' || pantalla === 'principal') && (
        <Text style={{ padding: 24 }} onPress={() => setPantalla('inicio')}>
          Pantalla "{pantalla}" en construcción.
          {pareja ? ` Pareja: ${pareja.codigo}.` : ''} Toca aquí para volver.
        </Text>
      )}
    </SafeAreaView>
  );
}
