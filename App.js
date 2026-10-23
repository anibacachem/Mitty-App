import { useState } from 'react';
import { SafeAreaView, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Inicio from './src/pantallas/Inicio';
import CrearPareja from './src/pantallas/CrearPareja';
import UnirmeConCodigo from './src/pantallas/UnirmeConCodigo';

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
            setPareja({ ...datos, yo: 0 }); // quien crea es la primera persona (nombre0)
            setPantalla('principal');
          }}
        />
      )}
      {pantalla === 'unirme' && (
        <UnirmeConCodigo
          onVolver={() => setPantalla('inicio')}
          onListo={(datos) => {
            setPareja(datos); // ya trae "yo" (0 o 1) según lo que elegiste
            setPantalla('principal');
          }}
        />
      )}
      {/* Pantalla aún no creada (paso 4): mensaje temporal */}
      {pantalla === 'principal' && (
        <Text style={{ padding: 24 }} onPress={() => setPantalla('inicio')}>
          Pantalla principal en construcción.
          {pareja ? ` Código: ${pareja.codigo}. Soy: ${pareja.yo === 0 ? pareja.nombre0 : pareja.nombre1}.` : ''}
          {' '}Toca aquí para volver.
        </Text>
      )}
    </SafeAreaView>
  );
}
