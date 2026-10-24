import { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

const UMBRAL = 80; // cuántos píxeles hay que arrastrar a la izquierda para pedir el borrado
const MAXIMO = 140; // la fila no se mueve más que esto

// Envuelve una fila para poder arrastrarla hacia la izquierda. Detrás aparece un fondo rojo "Eliminar".
// Al soltar pasado el umbral se llama a onBorrar (que debe pedir confirmación); la fila siempre vuelve a su lugar.
// Un toque normal o un scroll vertical no se interceptan: solo se activa con un arrastre claramente horizontal.
export default function FilaDeslizable({ children, onBorrar }) {
  const x = useRef(new Animated.Value(0)).current; // cuánto se corrió la fila (0 a -140)
  const alBorrar = useRef(onBorrar); // siempre la versión más reciente (el gesto se crea una sola vez)
  alBorrar.current = onBorrar;

  // 0 cuando la fila está en su lugar; sube a 1 en cuanto se corre unos píxeles a la izquierda
  const opacity = x.interpolate({ inputRange: [-24, -4, 0], outputRange: [1, 0, 0], extrapolate: 'clamp' });

  const volver = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();

  const gesto = useRef(
    PanResponder.create({
      // Solo tomamos el gesto si el dedo va hacia la izquierda y mucho más de lado que hacia arriba o abajo
      onMoveShouldSetPanResponder: (_, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false, // nadie nos quita el gesto a mitad de arrastre
      onPanResponderMove: (_, g) => x.setValue(Math.max(-MAXIMO, Math.min(0, g.dx))),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -UMBRAL) alBorrar.current();
        volver();
      },
      onPanResponderTerminate: volver,
    })
  ).current;

  return (
    <View style={styles.contenedor}>
      {/* El fondo rojo es invisible mientras la fila está quieta (opacidad 0) y aparece solo al arrastrar */}
      <Animated.View pointerEvents="none" style={[styles.fondo, { opacity }]}>
        <Text style={styles.fondoTexto}>Eliminar</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...gesto.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  fondo: { ...StyleSheet.absoluteFillObject, backgroundColor: '#B91C1C', alignItems: 'flex-end',
    justifyContent: 'center', paddingRight: 22 },
  fondoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
