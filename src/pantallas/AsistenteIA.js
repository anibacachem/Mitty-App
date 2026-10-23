import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { etiquetaTipo, fechaConDia, formatearMonto, hace, hoyISO } from '../formato';
import { textoReparto } from '../saldo';
import { interpretarGasto } from '../ia';
import { pedir } from '../supabase';
import { generarId } from '../codigo';

// Ejemplos que se pueden tocar para llenar el campo (ayudan a saber cómo hablarle al asistente)
const EJEMPLOS = [
  '42 mil en super, pagó Ana, a medias',
  'Ayer cine 12.000, invité yo',
  'Bencina 30 mil, 60% mío y 40% de Ana',
];

// Ventana de chat del asistente. Envía lo que escribes a la IA (vía una función de Supabase) y muestra
// lo que entendió, con botones Confirmar (guarda el gasto) y Corregir. Aún no recibe audio (paso 4).
// pareja: { codigo, nombre0, nombre1, yo }. onVolver: cerrar el chat y volver a la principal.
export default function AsistenteIA({ pareja, onVolver }) {
  const nombres = [pareja.nombre0, pareja.nombre1];
  const miNombre = nombres[pareja.yo];
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false); // true mientras esperamos la respuesta de la IA
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

  // Cambia el texto de un mensaje ya puesto (para convertir "Pensando…" en la respuesta).
  // "extra" suma campos al mensaje, por ejemplo la propuesta de gasto.
  function reemplazar(id, contenido, extra = {}) {
    setMensajes((previos) => previos.map((m) => (m.id === id ? { ...m, texto: contenido, ...extra } : m)));
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }

  // Cambia solo el estado de la propuesta de un mensaje: 'pendiente' | 'guardando' | 'guardado' | 'descartado' | 'error'
  function cambiarPropuesta(id, cambios) {
    setMensajes((previos) =>
      previos.map((m) => (m.id === id ? { ...m, propuesta: { ...m.propuesta, ...cambios } } : m))
    );
  }

  // Confirmar: guarda el gasto igual que el flujo normal de "Añadir gasto" (misma tabla, mismas reglas)
  async function confirmar(idMensaje) {
    const mensaje = mensajes.find((m) => m.id === idMensaje);
    if (!mensaje || !mensaje.propuesta) return;
    const { gasto, idGasto } = mensaje.propuesta;
    cambiarPropuesta(idMensaje, { estado: 'guardando', error: '' });
    const fila = {
      id: idGasto, // el mismo id en cada reintento: si un intento sí se guardó, no se duplica
      codigo: pareja.codigo,
      descripcion: gasto.descripcion,
      monto: gasto.monto,
      pagador: gasto.pagador,
      tipo: gasto.tipo,
      fecha: gasto.fecha,
    };
    if (gasto.tipo === 'fraccion') {
      fila.parte0 = gasto.parte0;
      fila.parte1 = gasto.parte1;
    }
    try {
      await pedir('movimientos', { metodo: 'POST', cuerpo: fila, codigoPareja: pareja.codigo });
      terminarGuardado(idMensaje);
    } catch (e) {
      // 23505 = "este id ya existe": un intento anterior sí se guardó. Lo damos por bueno.
      if (String(e.message).includes('23505')) {
        terminarGuardado(idMensaje);
      } else {
        cambiarPropuesta(idMensaje, { estado: 'error', error: String(e.message).slice(0, 120) });
      }
    }
  }

  function terminarGuardado(idMensaje) {
    cambiarPropuesta(idMensaje, { estado: 'guardado' });
    agregar('ia', 'Listo, ya quedó en tu lista. ¿Anotamos otro?');
  }

  // Corregir: descarta la propuesta y devuelve tu frase al campo para que la edites y la reenvíes
  function corregir(idMensaje) {
    const mensaje = mensajes.find((m) => m.id === idMensaje);
    if (!mensaje || !mensaje.propuesta) return;
    cambiarPropuesta(idMensaje, { estado: 'descartado' });
    setTexto(mensaje.propuesta.textoOriginal);
    agregar('ia', 'Sin problema. Edita el texto, o dime los cambios, y vuelve a enviarlo.');
  }

  // Arma el texto de lo que entendió la IA: "Entendí: $42.000 · Super · Mitad · pagó Ana · hoy"
  function describir(g) {
    const hoy = hoyISO();
    const cuando = g.fecha === hoy ? 'hoy' : g.fecha === hace(1) ? 'ayer' : fechaConDia(g.fecha);
    const linea = [`$${formatearMonto(g.monto)}`, g.descripcion, etiquetaTipo(g.tipo), `pagó ${nombres[g.pagador]}`, cuando];
    return `Entendí: ${linea.join(' · ')}\nReparto: ${textoReparto(g, nombres)}`;
  }

  // Envía la frase a la IA y muestra lo que entendió. (Guardarlo viene en el paso 3.)
  async function enviar() {
    const limpio = texto.trim();
    if (limpio === '' || pensando) return;
    agregar('yo', limpio);
    setTexto('');
    setPensando(true);
    const idPensando = 'pensando' + Date.now();
    setMensajes((previos) => [...previos, { id: idPensando, rol: 'ia', texto: 'Pensando…' }]);
    try {
      const r = await interpretarGasto({ codigo: pareja.codigo, yo: pareja.yo, texto: limpio });
      if (!r.ok) {
        reemplazar(idPensando, r.mensaje || 'No entendí el gasto.');
      } else {
        const supuestos = r.supuestos ? `\nAsumí: ${r.supuestos}` : '';
        // El mensaje lleva la propuesta: así se dibujan los botones Confirmar / Corregir debajo
        reemplazar(idPensando, `${describir(r.gasto)}${supuestos}\n\n¿Lo anoto?`, {
          propuesta: { gasto: r.gasto, idGasto: generarId(), estado: 'pendiente', textoOriginal: limpio, error: '' },
        });
      }
    } catch (e) {
      reemplazar(idPensando, 'No pude hablar con la IA: ' + String(e.message).slice(0, 120));
    } finally {
      setPensando(false);
    }
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

            {/* Si el mensaje trae una propuesta de gasto, mostramos sus botones según el estado */}
            {m.propuesta && (m.propuesta.estado === 'pendiente' || m.propuesta.estado === 'error') && (
              <View>
                {m.propuesta.estado === 'error' && (
                  <Text style={styles.propError}>No se pudo guardar: {m.propuesta.error}</Text>
                )}
                <View style={styles.propBotones}>
                  <Pressable style={styles.propConfirmar} onPress={() => confirmar(m.id)}>
                    <Text style={styles.propConfirmarTexto}>
                      {m.propuesta.estado === 'error' ? 'Reintentar' : 'Confirmar'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.propCorregir} onPress={() => corregir(m.id)}>
                    <Text style={styles.propCorregirTexto}>Corregir</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {m.propuesta?.estado === 'guardando' && <Text style={styles.propEstado}>Guardando…</Text>}
            {m.propuesta?.estado === 'guardado' && <Text style={[styles.propEstado, { color: '#16A34A' }]}>✓ Anotado</Text>}
            {m.propuesta?.estado === 'descartado' && <Text style={styles.propEstado}>Descartado</Text>}
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
        <Pressable style={[styles.enviar, (texto.trim() === '' || pensando) && { opacity: 0.4 }]} onPress={enviar}
          disabled={texto.trim() === '' || pensando}>
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
  propBotones: { flexDirection: 'row', marginTop: 10 },
  propConfirmar: { backgroundColor: ACENTO, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 18, marginRight: 8 },
  propConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  propCorregir: { borderWidth: 1.5, borderColor: ACENTO, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
  propCorregirTexto: { color: ACENTO, fontWeight: '700', fontSize: 15 },
  propEstado: { fontSize: 14, fontWeight: '700', color: '#777', marginTop: 8 },
  propError: { fontSize: 13, color: '#B91C1C', marginTop: 8 },
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
