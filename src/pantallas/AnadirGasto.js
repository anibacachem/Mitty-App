import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatearMonto, soloDigitos } from '../formato';

// Las tres formas de repartir un gasto. "valor" es lo que luego se guarda en Supabase.
const TIPOS = [
  { valor: 'mitad', titulo: 'Mitad', detalle: '50% y 50%. La otra persona debe la mitad.' },
  { valor: 'fraccion', titulo: 'Fracción', detalle: 'Cada uno una parte distinta.' },
  { valor: 'invita', titulo: 'Invitación', detalle: 'Uno invitó. No se comparte ni genera deuda.' },
];

// Resumen fijo que aparece arriba en cada paso: "$42.000 · super · Mitad".
// Al tocarlo, vuelves a editar el monto.
function Resumen({ monto, descripcion, extra, onEditar }) {
  const partes = [`$${formatearMonto(monto)}`];
  if (descripcion.trim()) partes.push(descripcion.trim());
  extra.forEach((e) => partes.push(e)); // lo elegido: tipo, quién pagó
  return (
    <Pressable style={styles.resumenCaja} onPress={onEditar}>
      <Text style={styles.resumen}>{partes.join(' · ')}</Text>
      <Text style={styles.resumenEditar}>Toca para cambiar el monto</Text>
    </Pressable>
  );
}

// Flujo para anotar un gasto, de a un paso por pantalla:
// monto -> tipo (mitad / fracción / invitación) -> ¿quién pagó?
// pareja: { codigo, nombre0, nombre1, yo }. onCerrar: volver a la pantalla principal.
export default function AnadirGasto({ pareja, onCerrar }) {
  // 'monto' | 'tipo' | 'fraccion' (paso 3) | 'quien' | 'listo' (paso 4 guardará)
  const [paso, setPaso] = useState('monto');
  const [textoMonto, setTextoMonto] = useState(''); // lo que se ve en el campo, con puntos
  const [descripcion, setDescripcion] = useState(''); // opcional
  const [tipo, setTipo] = useState(null); // 'mitad' | 'fraccion' | 'invita'
  const [pagador, setPagador] = useState(null); // 0 o 1, igual que en la base de datos

  const monto = soloDigitos(textoMonto); // el número real: 42000

  // Nombres según quién soy: yo = 0 o 1
  const nombres = [pareja.nombre0, pareja.nombre1];
  const miNombre = nombres[pareja.yo];
  const otroNombre = nombres[pareja.yo === 0 ? 1 : 0];

  // Lo elegido hasta ahora, para mostrarlo en el resumen de arriba
  const extra = [];
  if (tipo) extra.push(TIPOS.find((t) => t.valor === tipo).titulo);
  if (pagador !== null) extra.push(`Pagó ${nombres[pagador]}`);

  // Mientras escribes, mostramos el monto con puntos de miles (42.000)
  function cambiarMonto(texto) {
    const numero = soloDigitos(texto);
    setTextoMonto(numero === 0 ? '' : formatearMonto(numero));
  }

  // Al elegir el tipo: Mitad e Invitación saltan a "¿quién pagó?"; Fracción pide montos antes.
  function elegirTipo(valor) {
    setTipo(valor);
    setPagador(null);
    setPaso(valor === 'fraccion' ? 'fraccion' : 'quien');
  }

  // Al elegir quién pagó, el gasto queda completo.
  function elegirPagador(indice) {
    setPagador(indice);
    setPaso('listo');
  }

  // Encabezado común de los pasos después del monto: el resumen siempre visible
  const resumen = (
    <Resumen monto={monto} descripcion={descripcion} extra={extra} onEditar={() => setPaso('monto')} />
  );

  // ---- Paso: tipo de gasto ----
  if (paso === 'tipo') {
    return (
      <View style={styles.contenedor}>
        {resumen}
        <Text style={styles.pregunta}>¿Cómo se reparte?</Text>
        {TIPOS.map((t) => (
          <Pressable key={t.valor} style={styles.opcion} onPress={() => elegirTipo(t.valor)}>
            <Text style={styles.opcionTitulo}>{t.titulo}</Text>
            <Text style={styles.opcionDetalle}>{t.detalle}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setPaso('monto')}>
          <Text style={styles.enlace}>Atrás</Text>
        </Pressable>
      </View>
    );
  }

  // ---- Paso: montos de la fracción (se construye en el Paso 3) ----
  if (paso === 'fraccion') {
    return (
      <View style={styles.contenedor}>
        {resumen}
        <Text style={styles.ayuda}>Los montos por persona se agregan en el Paso 3.</Text>
        <Pressable style={styles.boton} onPress={() => setPaso('quien')}>
          <Text style={styles.textoBoton}>Seguir (temporal)</Text>
        </Pressable>
        <Pressable onPress={() => setPaso('tipo')}>
          <Text style={styles.enlace}>Atrás</Text>
        </Pressable>
      </View>
    );
  }

  // ---- Paso: ¿quién pagó? (tú primero y resaltado, porque casi siempre pagas tú) ----
  if (paso === 'quien') {
    return (
      <View style={styles.contenedor}>
        {resumen}
        <Text style={styles.pregunta}>
          {tipo === 'invita' ? '¿Quién invitó y pagó?' : '¿Quién pagó?'}
        </Text>
        <Pressable style={styles.botonGrande} onPress={() => elegirPagador(pareja.yo)}>
          <Text style={styles.textoBoton}>{miNombre} (tú)</Text>
        </Pressable>
        <Pressable style={styles.botonGrandeClaro} onPress={() => elegirPagador(pareja.yo === 0 ? 1 : 0)}>
          <Text style={styles.textoBotonClaro}>{otroNombre}</Text>
        </Pressable>
        <Pressable onPress={() => setPaso(tipo === 'fraccion' ? 'fraccion' : 'tipo')}>
          <Text style={styles.enlace}>Atrás</Text>
        </Pressable>
      </View>
    );
  }

  // ---- Paso: gasto completo (el Paso 4 lo guardará en Supabase) ----
  if (paso === 'listo') {
    return (
      <View style={styles.contenedor}>
        {resumen}
        <Text style={styles.ayuda}>Gasto completo. Guardarlo en la base de datos se agrega en el Paso 4.</Text>
        <Pressable onPress={() => setPaso('quien')}>
          <Text style={styles.enlace}>Cambiar quién pagó</Text>
        </Pressable>
        <Pressable onPress={onCerrar}>
          <Text style={styles.enlace}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  // ---- Paso: monto ----
  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>Añadir gasto</Text>

      <Text style={styles.etiqueta}>¿Cuánto fue?</Text>
      <View style={styles.filaMonto}>
        <Text style={styles.signo}>$</Text>
        <TextInput
          style={styles.monto}
          value={textoMonto}
          onChangeText={cambiarMonto}
          placeholder="0"
          keyboardType="number-pad" // teclado de números
          autoFocus // el teclado se abre solo: ahorra un toque
          maxLength={11}
        />
      </View>

      <Text style={styles.etiqueta}>¿En qué? (opcional)</Text>
      <TextInput
        style={styles.campo}
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Ej: super, cine, bencina"
        returnKeyType="next"
        maxLength={60}
      />

      <Pressable
        style={[styles.boton, monto === 0 && styles.botonApagado]}
        onPress={() => setPaso('tipo')}
        disabled={monto === 0} // sin monto no se puede avanzar
      >
        <Text style={styles.textoBoton}>Siguiente</Text>
      </Pressable>
      <Pressable onPress={onCerrar}>
        <Text style={styles.enlace}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const ACENTO = '#0F766E';

const styles = StyleSheet.create({
  // Contenido arriba (no centrado) para que el teclado no lo tape
  contenedor: { flex: 1, backgroundColor: '#FAFAF7', padding: 24, paddingTop: 40 },
  titulo: { fontSize: 26, fontWeight: '700', color: ACENTO, textAlign: 'center', marginBottom: 28 },
  etiqueta: { fontSize: 14, color: '#555', marginBottom: 6 },
  filaMonto: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2,
    borderBottomColor: ACENTO, marginBottom: 28 },
  signo: { fontSize: 40, fontWeight: '700', color: ACENTO, marginRight: 8 },
  monto: { flex: 1, fontSize: 40, fontWeight: '700', color: '#222', paddingVertical: 8 },
  campo: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4D4D0', borderRadius: 12,
    padding: 14, fontSize: 17, marginBottom: 24 },
  boton: { backgroundColor: ACENTO, paddingVertical: 18, borderRadius: 16 },
  botonApagado: { opacity: 0.4 },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  enlace: { color: ACENTO, fontSize: 16, textAlign: 'center', marginTop: 18 },
  resumenCaja: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4D4D0', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 28 },
  resumen: { fontSize: 22, fontWeight: '700', color: '#222', textAlign: 'center' },
  resumenEditar: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 4 },
  ayuda: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 20 },
  pregunta: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 14 },
  opcion: { backgroundColor: '#fff', borderWidth: 2, borderColor: ACENTO, borderRadius: 16,
    padding: 18, marginBottom: 12 },
  opcionTitulo: { fontSize: 20, fontWeight: '700', color: ACENTO },
  opcionDetalle: { fontSize: 14, color: '#555', marginTop: 4 },
  botonGrande: { backgroundColor: ACENTO, paddingVertical: 24, borderRadius: 16, marginBottom: 12 },
  botonGrandeClaro: { borderWidth: 2, borderColor: ACENTO, paddingVertical: 22, borderRadius: 16 },
  textoBotonClaro: { color: ACENTO, fontSize: 18, fontWeight: '600', textAlign: 'center' },
});
