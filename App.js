import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Inicio from './src/pantallas/Inicio';
import CrearPareja from './src/pantallas/CrearPareja';
import UnirmeConCodigo from './src/pantallas/UnirmeConCodigo';
import Principal from './src/pantallas/Principal';
import AnadirGasto from './src/pantallas/AnadirGasto';
import Ritual from './src/pantallas/Ritual';
import { borrarSesion, guardarSesion, leerSesion } from './src/sesion';

// App.js decide qué pantalla se ve según la variable "pantalla":
// 'inicio' | 'crear' | 'unirme' | 'principal' | 'anadir' | 'ritual'
export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [pareja, setPareja] = useState(null); // { codigo, nombre0, nombre1, yo }
  const [cargando, setCargando] = useState(true); // true mientras leemos la sesión guardada
  const [aviso, setAviso] = useState(''); // mensaje corto en la pantalla principal ("Gasto anotado")

  // Tras guardar un gasto: volvemos a la lista y mostramos el aviso 3 segundos
  function gastoGuardado() {
    setPantalla('principal');
    setAviso('Gasto anotado');
    setTimeout(() => setAviso(''), 3000);
  }

  // Al abrir la app: si hay sesión guardada, entramos directo a la pantalla principal.
  useEffect(() => {
    leerSesion().then((sesion) => {
      if (sesion) {
        setPareja(sesion);
        setPantalla('principal');
      }
      setCargando(false);
    });
  }, []);

  // Entrar a la app: guarda la sesión en el teléfono y muestra la pantalla principal.
  async function entrar(datos) {
    await guardarSesion(datos);
    setPareja(datos);
    setPantalla('principal');
  }

  // Salir: borra la sesión y vuelve al inicio.
  async function salir() {
    await borrarSesion();
    setPareja(null);
    setPantalla('inicio');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAF7' }}>
      <StatusBar style="dark" />
      {cargando && <ActivityIndicator style={{ flex: 1 }} color="#0F766E" />}
      {!cargando && pantalla === 'inicio' && (
        <Inicio
          onCrear={() => setPantalla('crear')}
          onUnirme={() => setPantalla('unirme')}
        />
      )}
      {!cargando && pantalla === 'crear' && (
        <CrearPareja
          onVolver={() => setPantalla('inicio')}
          onListo={(datos) => entrar({ ...datos, yo: 0 })} // quien crea es la primera persona
        />
      )}
      {!cargando && pantalla === 'unirme' && (
        <UnirmeConCodigo
          onVolver={() => setPantalla('inicio')}
          onListo={entrar} // ya trae "yo" (0 o 1) según lo que elegiste
        />
      )}
      {!cargando && pantalla === 'principal' && (
        <Principal
          pareja={pareja}
          aviso={aviso}
          onAnadir={() => setPantalla('anadir')}
          onRitual={() => setPantalla('ritual')}
          onSalir={salir}
        />
      )}
      {!cargando && pantalla === 'ritual' && (
        <Ritual pareja={pareja} onVolver={() => setPantalla('principal')} />
      )}
      {!cargando && pantalla === 'anadir' && (
        <AnadirGasto
          pareja={pareja}
          onCerrar={() => setPantalla('principal')}
          onGuardado={gastoGuardado} // al volver, Principal recarga la lista y muestra el aviso
        />
      )}
    </SafeAreaView>
  );
}
