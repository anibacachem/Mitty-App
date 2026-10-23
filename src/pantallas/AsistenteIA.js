import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

// Ejemplos que se pueden tocar para llenar el campo (ayudan a saber cómo hablarle al asistente)
const EJEMPLOS = [
  '42 mil en super, pagó Ana, a medias',
  'Ayer cine 12.000, invité yo',
  'Bencina 30 mil, 60% mío y 40% de Ana',
];

// Ventana de chat del asistente. En este paso solo está la pantalla (los mensajes y el campo de texto):
// las respuestas son un aviso fijo. En los pasos siguientes se conecta a la IA y se agrega el audio.
// pareja: { codigo, nombre0, nombre1, yo }. onVolver: cerrar el chat y volver a la principal.
export default function AsistenteIA({ pareja, onVolver }) {
  const miNombre = [pareja.nombre0, pareja.nombre1][pareja.yo];
  const [texto, setTexto] = useState('');
  const [mensajes, setMensajes] = useState([
    {
      id: 'saludo',
      rol: 'ia',
      texto: `Hola ${miNombre}. Cuéntame el gasto con tus palabras y lo anoto por ti. Por ejemplo: "42 mil en super, pagó Ana, a medias".`,
    },
  ]);
  const scroll = useRef(null);

  // Agrega un mensaje al final y baja el chat hasta él
  function agregar(rol, contenido) {
    setMensajes((previos) => [...previos, { id: String(Date.now()) + rol, rol, texto: contenido }]);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }

  function enviar() {
    const limpio = texto.trim();
    if (limpio === '') return;
    agregar('yo', limpio);
    setTexto('');
    // Paso 1: todavía no hay IA conectada. Esta respuesta se reemplaza en el paso 2.
    setTimeout(() => agregar('ia', 'Todavía no estoy conectado a la IA. Te lo explicaré en el próximo paso.'), 400);
  }

  return (
    <KeyboardAvoidingView style={styles.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Encabezado */}
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Asistente</Text>
        <Pressable onPress={onVolver} hitSlop={10}>
          <Text style={styles.cerrar}>Cerrar</Text>
        </Pressable>
      </View>

      {/* Mensajes: los tuyos a la derecha, los del asistente a la izquierda */}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {mensajes.map((m) => (
          <View key={m.id} style={[styles.burbuja, m.rol === 'yo' ? styles.burbujaYo : styles.burbujaIA]}>
            <Text style={[styles.burbujaTexto, m.rol === 'yo' && { color: '#fff' }]}>{m.texto}</Text>
          </View>
        ))}

        {/* Ejemplos tocables, solo mientras no hayas escrito nada */}
        {mensajes.length === 1 && (
          <View style={{ marginTop: 6 }}>
            <Text style={styles.ejemplosTitulo}>Toca un ejemplo:</Text>
            {EJEMPLOS.map((e) => (
              <Pressable key={e} style={styles.ejemplo} onPress={() => setTexto(e)}>
                <Text style={styles.ejemploTexto}>{e}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Campo de texto y botón enviar (el botón de voz llega en el paso 4) */}
      <View style={styles.barra}>
        <TextInput
          style={styles.campo}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe el gasto…"
          multiline
          maxLength={300}
        />
        <Pressable style={[styles.enviar, texto.trim() === '' && { opacity: 0.4 }]} onPress={enviar}
          disabled={texto.trim() === ''}>
          <Text style={styles.enviarTexto}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const ACENTO = '#0F766E';

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#FAFAF7' },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E0' },
  titulo: { fontSize: 24, fontWeight: '700', color: ACENTO },
  cerrar: { fontSize: 16, color: ACENTO, fontWeight: '600' },
  burbuja: { maxWidth: '85%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10 },
  burbujaIA: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5E0' },
  burbujaYo: { alignSelf: 'flex-end', backgroundColor: ACENTO },
  burbujaTexto: { fontSize: 16, color: '#222', lineHeight: 22 },
  ejemplosTitulo: { fontSize: 13, color: '#777', marginBottom: 6 },
  ejemplo: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: ACENTO, borderRadius: 14,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, backgroundColor: '#fff' },
  ejemploTexto: { color: ACENTO, fontSize: 14, fontWeight: '600' },
  barra: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1,
    borderTopColor: '#E5E5E0', backgroundColor: '#fff' },
  campo: { flex: 1, maxHeight: 110, backgroundColor: '#F6F6F3', borderRadius: 18, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 16 },
  enviar: { backgroundColor: ACENTO, borderRadius: 18, paddingVertical: 11, paddingHorizontal: 18, marginLeft: 8 },
  enviarTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
