import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, BackHandler, Dimensions, Image, PanResponder, SafeAreaView, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import Inicio from './src/pantallas/Inicio';
import CrearPareja from './src/pantallas/CrearPareja';
import UnirmeConCodigo from './src/pantallas/UnirmeConCodigo';
import Principal from './src/pantallas/Principal';
import AnadirGasto from './src/pantallas/AnadirGasto';
import Ritual from './src/pantallas/Ritual';
import CierreMes from './src/pantallas/CierreMes';
import AsistenteIA from './src/pantallas/AsistenteIA';
import { ACENTO, FONDO } from './src/colores';
import { borrarSesion, guardarSesion, leerSesion } from './src/sesion';
import { cancelarRecordatorios, guardarActivado } from './src/notificaciones';

// A qué pantalla se vuelve desde cada una. Las que no están aquí (inicio y principal) son "raíz": no hay atrás.
const DESTINO_ATRAS = {
  crear: 'inicio',
  unirme: 'inicio',
  anadir: 'principal',
  ritual: 'principal',
  cierre: 'principal',
  asistente: 'principal',
};
const ANCHO_PANTALLA = Dimensions.get('window').width;
const ZONA_BORDE = 24; // ancho (en píxeles) de la franja del borde izquierdo donde empieza el gesto

// App.js decide qué pantalla se ve según la variable "pantalla":
// 'inicio' | 'crear' | 'unirme' | 'principal' | 'anadir' | 'ritual' | 'cierre' | 'asistente'
export default function App() {
  const [pantalla, setPantalla] = useState('inicio');
  const [pareja, setPareja] = useState(null); // { codigo, nombre0, nombre1, yo }
  const [cargando, setCargando] = useState(true); // true mientras leemos la sesión guardada
  // Letra redondeada y ancha para el saludo. Si no logra cargar, la app sigue con la letra normal.
  const [fuentesListas, errorFuentes] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold });
  const esperando = cargando || !(fuentesListas || errorFuentes); // mostramos el logo hasta tener sesión y letra
  const [aviso, setAviso] = useState(''); // mensaje corto en la pantalla principal ("Gasto anotado")

  // ---- Volver atrás arrastrando desde el borde izquierdo (como en el iPhone) ----
  // Usamos "refs" porque el gesto se crea una sola vez y necesita ver siempre el valor más reciente.
  const pantallaRef = useRef(pantalla);
  pantallaRef.current = pantalla;
  const atrasInterno = useRef(null); // una pantalla con pasos propios (Añadir gasto) registra aquí su "atrás"
  const desliz = useRef(new Animated.Value(0)).current; // cuánto se ha desplazado la pantalla hacia la derecha

  // Intenta volver. Devuelve true si hizo algo (retrocedió un paso interno o cambió de pantalla).
  // (Lo usa el botón "atrás" de Android; el gesto de arrastre hace lo mismo pero con animación.)
  function irAtras() {
    // 1) Si la pantalla tiene pasos propios (monto -> tipo -> quién pagó), primero retrocede un paso
    if (atrasInterno.current && atrasInterno.current()) return true;
    // 2) Si no, vuelve a la pantalla anterior
    const destino = DESTINO_ATRAS[pantallaRef.current];
    if (!destino) return false;
    setPantalla(destino);
    return true;
  }

  const gestoAtras = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => desliz.setValue(Math.max(0, g.dx)), // la pantalla sigue al dedo
      onPanResponderRelease: (_, g) => {
        const suficiente = g.dx > ANCHO_PANTALLA * 0.3 || g.vx > 0.6; // arrastró lejos o rápido
        const volverAlLugar = () =>
          Animated.spring(desliz, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        if (!suficiente) {
          volverAlLugar();
          return;
        }
        // ¿Hay un paso interno que retroceder? Si sí, la pantalla se queda y solo cambia de paso
        if (atrasInterno.current && atrasInterno.current()) {
          volverAlLugar();
          return;
        }
        const destino = DESTINO_ATRAS[pantallaRef.current];
        if (!destino) {
          volverAlLugar();
          return;
        }
        // Se desliza hasta salir y recién entonces cambia de pantalla
        Animated.timing(desliz, { toValue: ANCHO_PANTALLA, duration: 160, useNativeDriver: true }).start(() => {
          setPantalla(destino);
          desliz.setValue(0);
        });
      },
      onPanResponderTerminate: () =>
        Animated.spring(desliz, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
    })
  ).current;

  // Botón/gesto "atrás" de Android: hace lo mismo. En las pantallas raíz deja que Android cierre la app.
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!DESTINO_ATRAS[pantallaRef.current]) return false;
      irAtras();
      return true;
    });
    return () => suscripcion.remove();
  }, []);

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
    // Al salir se apagan los recordatorios: no deben seguir llegando a quien ya no tiene la sesión abierta
    await cancelarRecordatorios().catch(() => {});
    await guardarActivado(false).catch(() => {});
    await borrarSesion();
    setPareja(null);
    setPantalla('inicio');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: FONDO }}>
      <StatusBar style="dark" />
      {/* Mientras leemos la sesión guardada se ve el logo de Mitty */}
      {esperando && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('./assets/logo.png')} style={{ width: 140, height: 140 }} />
          <ActivityIndicator style={{ marginTop: 24 }} color={ACENTO} />
        </View>
      )}
      {/* Todas las pantallas van dentro de esta vista, que se desliza con el dedo al volver atrás */}
      <Animated.View style={{ flex: 1, backgroundColor: FONDO, transform: [{ translateX: desliz }] }}>
      {!esperando && pantalla === 'inicio' && (
        <Inicio
          onCrear={() => setPantalla('crear')}
          onUnirme={() => setPantalla('unirme')}
        />
      )}
      {!esperando && pantalla === 'crear' && (
        <CrearPareja
          onVolver={() => setPantalla('inicio')}
          onListo={(datos) => entrar({ ...datos, yo: 0 })} // quien crea es la primera persona
        />
      )}
      {!esperando && pantalla === 'unirme' && (
        <UnirmeConCodigo
          onVolver={() => setPantalla('inicio')}
          onListo={entrar} // ya trae "yo" (0 o 1) según lo que elegiste
        />
      )}
      {!esperando && pantalla === 'principal' && (
        <Principal
          pareja={pareja}
          aviso={aviso}
          onAnadir={() => setPantalla('anadir')}
          onRitual={() => setPantalla('ritual')}
          onCierre={() => setPantalla('cierre')}
          onAsistente={() => setPantalla('asistente')}
          onSalir={salir}
        />
      )}
      {!esperando && pantalla === 'asistente' && (
        <AsistenteIA pareja={pareja} onVolver={() => setPantalla('principal')} />
      )}
      {!esperando && pantalla === 'cierre' && (
        <CierreMes pareja={pareja} onVolver={() => setPantalla('principal')} />
      )}
      {!esperando && pantalla === 'ritual' && (
        <Ritual pareja={pareja} onVolver={() => setPantalla('principal')} />
      )}
      {!esperando && pantalla === 'anadir' && (
        <AnadirGasto
          pareja={pareja}
          onCerrar={() => setPantalla('principal')}
          onGuardado={gastoGuardado} // al volver, Principal recarga la lista y muestra el aviso
          registrarAtras={(fn) => { atrasInterno.current = fn; }} // para que "atrás" retroceda un paso del flujo
        />
      )}
      </Animated.View>

      {/* Franja invisible en el borde izquierdo: ahí empieza el gesto de volver. Solo existe en pantallas con "atrás". */}
      {!esperando && DESTINO_ATRAS[pantalla] && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: ZONA_BORDE }}
          {...gestoAtras.panHandlers} />
      )}
    </SafeAreaView>
  );
}
