import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatearMonto, hoyISO, soloDigitos } from '../formato';
import { pedir } from '../supabase';
import { generarId } from '../codigo';

// Las tres formas de repartir un gasto. "valor" es lo que luego se guarda en Supabase.
const TIPOS = [
  { valor: 'mitad', titulo: 'Mitad', detalle: '50% y 50%. La otra persona debe la mitad.' },
  { valor: 'fraccion', titulo: 'Fracción', detalle: 'Cada uno una parte distinta.' },
  { valor: 'invita', titulo: 'Invitación', detalle: 'Uno invitó. No se comparte ni genera deuda.' },
];

// Resumen fijo que aparece arriba en cada paso: "$42.000 · super · Mitad".
// Al tocarlo, vuelves a editar el monto.
// "detalle" es una línea chica opcional (en Fracción: lo que le toca a cada uno).
function Resumen({ monto, descripcion, extra, detalle, onEditar }) {
  const partes = [`$${formatearMonto(monto)}`];
  if (descripcion.trim()) partes.push(descripcion.trim());
  extra.forEach((e) => partes.push(e)); // lo elegido: tipo, quién pagó
  return (
    <Pressable style={styles.resumenCaja} onPress={onEditar}>
      <Text style={styles.resumen}>{partes.join(' · ')}</Text>
      {detalle ? <Text style={styles.resumenDetalle}>{detalle}</Text> : null}
      <Text style={styles.resumenEditar}>Toca para cambiar el monto</Text>
    </Pressable>
  );
}

// Flujo para anotar un gasto, de a un paso por pantalla:
// monto -> tipo (mitad / fracción / invitación) -> ¿quién pagó?
// pareja: { codigo, nombre0, nombre1, yo }. onCerrar: cancelar. onGuardado: gasto guardado, volver.
export default function AnadirGasto({ pareja, onCerrar, onGuardado }) {
  // 'monto' | 'tipo' | 'fraccion' | 'quien' | 'listo' (guardando o con error)
  const [paso, setPaso] = useState('monto');
  const [idGasto] = useState(generarId); // un id por gasto, creado una sola vez al abrir el flujo
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');
  const [textoMonto, setTextoMonto] = useState(''); // lo que se ve en el campo, con puntos
  const [descripcion, setDescripcion] = useState(''); // opcional
  const [tipo, setTipo] = useState(null); // 'mitad' | 'fraccion' | 'invita'
  const [pagador, setPagador] = useState(null); // 0 o 1, igual que en la base de datos
  const [textoParte, setTextoParte] = useState(''); // lo que escribes: la parte tuya en la fracción
  const [partes, setPartes] = useState(null); // [parte de nombre0, parte de nombre1] ya calculadas

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

  // Fracción: lo que escribes es TU parte; la del otro es el resto (monto - tu parte).
  // Aquí el texto vacío es "sin escribir" y "0" es un valor válido (todo es del otro).
  const miParte = soloDigitos(textoParte);
  const parteOtro = monto - miParte;
  const parteValida = textoParte !== '' && miParte <= monto; // no puedes pasarte del total

  function cambiarParte(texto) {
    const digitos = texto.replace(/\D/g, '');
    setTextoParte(digitos === '' ? '' : formatearMonto(Number(digitos)));
  }

  // Al continuar, ordenamos las partes según nombre0 y nombre1 (como las guarda la base de datos)
  function continuarFraccion() {
    const resultado = [0, 0];
    resultado[pareja.yo] = miParte;
    resultado[pareja.yo === 0 ? 1 : 0] = parteOtro;
    setPartes(resultado);
    setPaso('quien');
  }

  // Línea chica para el resumen: "Ana $12.000 · Luis $30.000"
  const detalleFraccion =
    tipo === 'fraccion' && partes
      ? `${nombres[0]} $${formatearMonto(partes[0])} · ${nombres[1]} $${formatearMonto(partes[1])}`
      : '';

  // Al elegir el tipo: Mitad e Invitación saltan a "¿quién pagó?"; Fracción pide montos antes.
  function elegirTipo(valor) {
    setTipo(valor);
    setPagador(null);
    setPartes(null);
    setTextoParte('');
    setPaso(valor === 'fraccion' ? 'fraccion' : 'quien');
  }

  // Al elegir quién pagó, el gasto queda completo y se guarda de inmediato (sin botón extra).
  function elegirPagador(indice) {
    setPagador(indice);
    guardar(indice);
  }

  // Guarda el gasto como una fila nueva en la tabla "movimientos" de Supabase.
  async function guardar(indicePagador) {
    setPaso('listo');
    setGuardando(true);
    setErrorGuardar('');
    const fila = {
      id: idGasto,
      codigo: pareja.codigo,
      descripcion: descripcion.trim() || 'Gasto', // la columna no admite vacío
      monto,
      pagador: indicePagador, // 0 o 1
      tipo,                   // 'mitad' | 'fraccion' | 'invita'
      fecha: hoyISO(),        // el día en que ocurrió el gasto (hoy)
    };
    // Solo la fracción guarda las dos partes; mitad e invitación no las necesitan
    if (tipo === 'fraccion') {
      fila.parte0 = partes[0];
      fila.parte1 = partes[1];
    }
    try {
      await pedir('movimientos', { metodo: 'POST', cuerpo: fila, codigoPareja: pareja.codigo });
      onGuardado(); // listo: volvemos a la pantalla principal
    } catch (e) {
      // 23505 = "este id ya existe": significa que un intento anterior sí se guardó. Lo damos por bueno.
      if (String(e.message).includes('23505')) {
        onGuardado();
        return;
      }
      setErrorGuardar(String(e.message).slice(0, 200));
      setGuardando(false);
    }
  }

  // Encabezado común de los pasos después del monto: el resumen siempre visible
  const resumen = (
    <Resumen monto={monto} descripcion={descripcion} extra={extra} detalle={detalleFraccion}
      onEditar={() => setPaso('monto')} />
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

  // ---- Paso: montos de la fracción. Escribes lo tuyo y el resto se calcula solo ----
  if (paso === 'fraccion') {
    return (
      <View style={styles.contenedor}>
        {resumen}
        <Text style={styles.pregunta}>¿Cuánto le toca a {miNombre}?</Text>
        <View style={styles.filaMonto}>
          <Text style={styles.signo}>$</Text>
          <TextInput
            style={styles.monto}
            value={textoParte}
            onChangeText={cambiarParte}
            placeholder="0"
            keyboardType="number-pad"
            autoFocus
            maxLength={11}
          />
        </View>

        {/* Atajo para "era del otro": tu parte es 0 y la otra persona debe todo */}
        <Pressable onPress={() => setTextoParte('0')}>
          <Text style={styles.atajo}>Todo es de {otroNombre}</Text>
        </Pressable>

        {/* La parte del otro se calcula sola: total menos lo tuyo */}
        {textoParte !== '' && (
          <View style={styles.resto}>
            {parteValida ? (
              <Text style={styles.restoTexto}>
                A {otroNombre} le toca <Text style={styles.restoMonto}>${formatearMonto(parteOtro)}</Text>
              </Text>
            ) : (
              <Text style={styles.errorTexto}>
                No puede ser más que el total (${formatearMonto(monto)}).
              </Text>
            )}
          </View>
        )}

        <Pressable
          style={[styles.boton, !parteValida && styles.botonApagado]}
          onPress={continuarFraccion}
          disabled={!parteValida}
        >
          <Text style={styles.textoBoton}>Continuar</Text>
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

  // ---- Paso: guardando (o con error y opción de reintentar) ----
  if (paso === 'listo') {
    return (
      <View style={styles.contenedor}>
        {resumen}
        {guardando ? (
          <>
            <ActivityIndicator color={ACENTO} size="large" />
            <Text style={styles.ayuda}>Guardando…</Text>
          </>
        ) : (
          <>
            <Text style={styles.errorTexto}>No se pudo guardar: {errorGuardar}</Text>
            <Pressable style={[styles.boton, { marginTop: 20 }]} onPress={() => guardar(pagador)}>
              <Text style={styles.textoBoton}>Reintentar</Text>
            </Pressable>
            <Pressable onPress={() => setPaso('quien')}>
              <Text style={styles.enlace}>Cambiar quién pagó</Text>
            </Pressable>
            <Pressable onPress={onCerrar}>
              <Text style={styles.enlace}>Cancelar</Text>
            </Pressable>
          </>
        )}
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
  resumenDetalle: { fontSize: 14, color: ACENTO, textAlign: 'center', marginTop: 6, fontWeight: '600' },
  atajo: { color: ACENTO, fontSize: 15, fontWeight: '600', marginBottom: 16 },
  resto: { backgroundColor: '#ECF6F4', borderRadius: 12, padding: 14, marginBottom: 20 },
  restoTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
  restoMonto: { fontWeight: '700', color: ACENTO },
  errorTexto: { fontSize: 15, color: '#B91C1C', textAlign: 'center' },
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
