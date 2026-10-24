import { Pressable, StyleSheet, Text } from 'react-native';
import { ACENTO } from '../colores';

// Botón redondo pequeño con una "i". Quien lo usa guarda si la explicación está abierta (activo)
// y decide qué mostrar; así las pantallas ahorran espacio y la explicación aparece solo cuando se pide.
// activo: true/false. onPress: función que alterna el estado.
export default function BotonInfo({ activo, onPress }) {
  return (
    <Pressable
      style={[styles.boton, activo && styles.botonActivo]}
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel="Ver explicación"
    >
      <Text style={[styles.texto, activo && { color: '#fff' }]}>i</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  boton: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: ACENTO,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  botonActivo: { backgroundColor: ACENTO },
  texto: { color: ACENTO, fontSize: 13, fontWeight: '700', fontStyle: 'italic' },
});
