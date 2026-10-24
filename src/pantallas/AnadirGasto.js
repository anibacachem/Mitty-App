import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { fechaDeDiaMes, formatearMonto, hace, hoyISO, soloDigitos } from '../formato';
import { pedir } from '../supabase';
import { generarId } from '../codigo';
import { ACENTO } from '../colores';

// Las tres formas de repartir un gasto. "valor" es lo que luego se guarda en Supabase.
const TIPOS = [
  { valor: 'mitad', titulo: 'Mitad', detalle: '50% y 50%. La otra persona debe la mitad.' },
  { valor: 'fraccion', titulo: 'Fracción', detalle: 'Cada uno una parte distinta.' },
  { valor: 'invita', titulo: 'Invitación', detalle: 'Uno invitó. Si pagó el otro, se lo debe todo.' },
  { valor: 'personal', titulo: 'Gasto personal', detalle: 'Es de una sola persona. Si pagó el otro, se lo debe todo.' },
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

const MARCAS = [0, 25, 50, 75, 100]; // puntos donde la perilla "se pega" al arrastrar

// Barra deslizable para repartir un gasto en porcentajes. A la izquierda va tu nombre y a la derecha el del otro.
// Arrastra (o toca) la perilla: hacia la derecha, más para ti; hacia la izquierda, más para el otro.
//   pct: porcentaje de quien va a la izquierda (0 a 100). montoIzq / montoDer: lo que le toca a cada uno en $.
//   onCambio(p): avisa el nuevo porcentaje. onArrastre(bool): avisa si el dedo está arrastrando
//   (para frenar el scroll de la pantalla mientras tanto).
function BarraReparto({ pct, montoIzq, montoDer, nombreIzq, nombreDer, onCambio, onArrastre }) {
  const ancho = useRef(1); // ancho real de la barra, se mide al dibujarla
  // Guardamos las funciones más recientes en "refs": el gesto se crea una sola vez y así nunca usa versiones viejas
  const alCambiar = useRef(onCambio);
  alCambiar.current = onCambio;
  const alArrastrar = useRef(onArrastre);
  alArrastrar.current = onArrastre;

  // Posición del dedo dentro de la barra (en píxeles) -> porcentaje entero entre 0 y 100.
  // Imán: si caes a 2 puntos o menos de una marca (0, 25, 50, 75, 100), la perilla se pega a ella.
  // Para un valor exacto cerca de una marca (ej. 51%) están los botones − y +.
  const aPorcentaje = (x) => {
    const p = Math.max(0, Math.min(100, Math.round((x / ancho.current) * 100)));
    const marca = MARCAS.find((m) => Math.abs(p - m) <= 2);
    return marca === undefined ? p : marca;
  };
  // Ajuste fino de 1 punto con los botones (sin imán)
  const mover = (delta) => onCambio(Math.max(0, Math.min(100, pct + delta)));

  const gesto = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // nadie nos quita el gesto a mitad de arrastre
      onPanResponderGrant: (e) => {
        alArrastrar.current(true);
        alCambiar.current(aPorcentaje(e.nativeEvent.locationX)); // un toque también mueve la perilla
      },
      onPanResponderMove: (e) => alCambiar.current(aPorcentaje(e.nativeEvent.locationX)),
      onPanResponderRelease: () => alArrastrar.current(false),
      onPanResponderTerminate: () => alArrastrar.current(false),
    })
  ).current;

  return (
    <View style={styles.repartoCaja}>
      <View style={styles.repartoFila}>
        <Text style={styles.repartoNombre}>{nombreIzq}</Text>
        <Text style={[styles.repartoNombre, { textAlign: 'right' }]}>{nombreDer}</Text>
      </View>

      {/* Fila: botón −1%, la barra y botón +1% */}
      <View style={styles.pistaFila}>
        <Pressable style={styles.pasoBoton} onPress={() => mover(-1)} hitSlop={6}>
          <Text style={styles.pasoTexto}>−</Text>
        </Pressable>

        {/* Zona táctil. Los hijos tienen pointerEvents="none" para que la posición del dedo se mida sobre la barra */}
        <View
          style={styles.pistaToque}
          onLayout={(e) => { ancho.current = e.nativeEvent.layout.width || 1; }}
          {...gesto.panHandlers}
        >
          <View pointerEvents="none" style={styles.pistaFondo}>
            <View style={[styles.pistaIzq, { width: `${pct}%` }]} />
          </View>
          {/* Marcas de 25%, 50% y 75% */}
          {[25, 50, 75].map((m) => (
            <View key={m} pointerEvents="none" style={[styles.marca, { left: `${m}%` }]} />
          ))}
          <View pointerEvents="none" style={[styles.perilla, { left: `${pct}%` }]} />
        </View>

        <Pressable style={styles.pasoBoton} onPress={() => mover(1)} hitSlop={6}>
          <Text style={styles.pasoTexto}>+</Text>
        </Pressable>
      </View>

      <View style={styles.repartoFila}>
        <View>
          <Text style={styles.repartoPct}>{pct}%</Text>
          <Text style={styles.repartoMonto}>${formatearMonto(montoIzq)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.repartoPct}>{100 - pct}%</Text>
          <Text style={styles.repartoMonto}>${formatearMonto(montoDer)}</Text>
        </View>
      </View>
    </View>
  );
}

// Flujo para anotar un gasto, de a un paso por pantalla:
// monto -> tipo (mitad / fracción / invitación / personal) -> [¿quién invitó? / ¿de quién es?] -> ¿quién pagó?
// pareja: { codigo, nombre0, nombre1, yo }. onCerrar: cancelar. onGuardado: gasto guardado, volver.
export default function AnadirGasto({ pareja, onCerrar, onGuardado, registrarAtras }) {
  // 'monto' | 'tipo' | 'fraccion' | 'dueno' | 'quien' | 'listo' (guardando o con error)
  const [paso, setPaso] = useState('monto');
  const [idGasto] = useState(generarId); // un id por gasto, creado una sola vez al abrir el flujo
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');
  const [textoMonto, setTextoMonto] = useState(''); // lo que se ve en el campo, con puntos
  const [descripcion, setDescripcion] = useState(''); // opcional
  const [tipo, setTipo] = useState(null); // 'mitad' | 'fraccion' | 'invita'
  const [pagador, setPagador] = useState(null); // 0 o 1, igual que en la base de datos
  const [dueno, setDueno] = useState(null); // 0 o 1: quién invitó / de quién es el gasto (solo Invitación y Personal)
  const [textoParte, setTextoParte] = useState(''); // lo que escribes: la parte tuya en la fracción
  const [partes, setPartes] = useState(null); // [parte de nombre0, parte de nombre1] ya calculadas
  const [modoFraccion, setModoFraccion] = useState('porcentaje'); // 'porcentaje' (barra, por defecto) o 'cantidad' ($)
  const [pct, setPct] = useState(50); // porcentaje que le toca a quien va a la izquierda de la barra (yo)
  const [arrastrando, setArrastrando] = useState(false); // mientras mueves la barra, la pantalla no hace scroll

  const [cuando, setCuando] = useState('hoy'); // 'hoy' | 'ayer' | 'otro'
  const [dia, setDia] = useState(''); // solo se usa con "Otro día"
  const [mes, setMes] = useState('');

  // Invitación y Personal preguntan primero de quién es el gasto; Fracción pide sus montos; Mitad viene del tipo
  const tieneDueno = tipo === 'invita' || tipo === 'personal';
  const pasoAntesDeQuien = tieneDueno ? 'dueno' : tipo === 'fraccion' ? 'fraccion' : 'tipo';

  // "Atrás" por gesto o botón del teléfono: retrocede UN paso del flujo en vez de salir de golpe.
  // Devuelve true si retrocedió un paso; false si estamos en el primero (entonces se cierra la pantalla).
  // Sin lista de dependencias a propósito: se vuelve a registrar en cada render con el paso actual.
  useEffect(() => {
    registrarAtras?.(() => {
      if (paso === 'listo') {
        if (!guardando) setPaso('quien'); // con error se puede volver; guardando, no
        return true;
      }
      if (paso === 'tipo') { setPaso('monto'); return true; }
      if (paso === 'dueno') { setPaso('tipo'); return true; }
      if (paso === 'fraccion') { setPaso('tipo'); return true; }
      if (paso === 'quien') { setPaso(pasoAntesDeQuien); return true; }
      return false;
    });
  });
  useEffect(() => () => registrarAtras?.(null), []); // al salir, la pantalla se desregistra

  const monto = soloDigitos(textoMonto); // el número real: 42000

  // La fecha del gasto ("2026-10-23"): hoy, ayer o la que escribas. null = fecha inválida.
  // Esta es la fecha en que OCURRIÓ el gasto; la columna "creado" guarda cuándo se anotó.
  let fecha = hoyISO();
  if (cuando === 'ayer') fecha = hace(1);
  if (cuando === 'otro') fecha = fechaDeDiaMes(Number(dia), Number(mes));
  const fechaInvalida = fecha === null;

  // Nombres según quién soy: yo = 0 o 1
  const nombres = [pareja.nombre0, pareja.nombre1];
  const miNombre = nombres[pareja.yo];
  const otroNombre = nombres[pareja.yo === 0 ? 1 : 0];

  // Lo elegido hasta ahora, para mostrarlo en el resumen de arriba
  const extra = [];
  if (cuando === 'ayer') extra.push('Ayer');
  if (cuando === 'otro' && fecha) extra.push(`${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`);
  if (tipo) extra.push(TIPOS.find((t) => t.valor === tipo).titulo);
  if (tieneDueno && dueno !== null) extra.push(`${tipo === 'invita' ? 'Invitó' : 'De'} ${nombres[dueno]}`);
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

  // Barra de porcentaje: al moverla, tu parte pasa a ser ese % del total (en pesos enteros)
  // y la del otro sigue siendo el resto, así las dos partes siempre suman el total.
  function cambiarPorcentaje(p) {
    setPct(p);
    setTextoParte(formatearMonto(Math.round((monto * p) / 100)));
  }

  // Abrir la barra: si ya escribiste un monto, la perilla parte donde corresponde; si no, en 50%
  function abrirPorcentaje() {
    Keyboard.dismiss();
    setModoFraccion('porcentaje');
    if (textoParte === '') cambiarPorcentaje(50);
    else setPct(Math.max(0, Math.min(100, Math.round((miParte / monto) * 100))));
  }

  // Abrir la cantidad en $ (el teclado se abre solo al aparecer el campo)
  function abrirCantidad() {
    setModoFraccion('cantidad');
  }

  // "Todo es del otro": tu parte es 0 (y la barra también se va a 0%)
  function todoDelOtro() {
    setTextoParte('0');
    setPct(0);
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
    setDueno(null);
    setPartes(null);
    setModoFraccion('porcentaje'); // la fracción abre con la barra, partiendo en 50% (la mitad)
    setPct(50);
    setTextoParte(formatearMonto(Math.round(monto / 2))); // así "Continuar" ya está listo con la mitad
    setPaso(valor === 'fraccion' ? 'fraccion' : valor === 'invita' || valor === 'personal' ? 'dueno' : 'quien');
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
      tipo,                   // 'mitad' | 'fraccion' | 'invita' | 'personal'
      fecha,                  // el día en que ocurrió el gasto (hoy, ayer u otro día)
    };
    // Solo la fracción guarda las dos partes; mitad e invitación no las necesitan
    if (tipo === 'fraccion') {
      fila.parte0 = partes[0];
      fila.parte1 = partes[1];
    }
    // Invitación y Personal guardan además de quién es el gasto (puede ser distinto de quien pagó)
    if (tieneDueno) fila.dueno = dueno;
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
      // ScrollView: con el teclado abierto o la barra desplegada, todo sigue alcanzable.
      // Mientras arrastras la barra se apaga el scroll para que la pantalla no se mueva.
      <ScrollView style={{ flex: 1, backgroundColor: '#FFF8F5' }} contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled" scrollEnabled={!arrastrando}>
        {resumen}
        <Text style={styles.pregunta}>¿Cómo se reparte entre ustedes?</Text>

        {/* Opción 1: porcentaje. Al tocarla se despliega la barra, justo arriba del botón de cantidad */}
        <Pressable
          style={[styles.modoBoton, modoFraccion === 'porcentaje' && styles.modoBotonActivo]}
          onPress={abrirPorcentaje}
        >
          <Text style={[styles.modoTexto, modoFraccion === 'porcentaje' && styles.modoTextoActivo]}>Porcentaje %</Text>
        </Pressable>
        {modoFraccion === 'porcentaje' && (
          <BarraReparto
            pct={pct}
            montoIzq={miParte}
            montoDer={parteOtro}
            nombreIzq={`${miNombre} (tú)`}
            nombreDer={otroNombre}
            onCambio={cambiarPorcentaje}
            onArrastre={setArrastrando}
          />
        )}

        {/* Opción 2: cantidad en pesos (lo de siempre) */}
        <Pressable
          style={[styles.modoBoton, modoFraccion === 'cantidad' && styles.modoBotonActivo]}
          onPress={abrirCantidad}
        >
          <Text style={[styles.modoTexto, modoFraccion === 'cantidad' && styles.modoTextoActivo]}>Cantidad $</Text>
        </Pressable>
        {modoFraccion === 'cantidad' && (
          <>
            <Text style={styles.etiqueta}>¿Cuánto le toca a {miNombre}?</Text>
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
          </>
        )}

        {/* Atajo para "era del otro": tu parte es 0 y la otra persona debe todo (sirve en las dos opciones) */}
        <Pressable onPress={todoDelOtro}>
          <Text style={styles.atajo}>Todo es de {otroNombre}</Text>
        </Pressable>

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
      </ScrollView>
    );
  }

  // ---- Paso: ¿quién invitó? / ¿de quién es el gasto? (solo Invitación y Personal) ----
  if (paso === 'dueno') {
    const otroIndice = pareja.yo === 0 ? 1 : 0;
    return (
      <View style={styles.contenedor}>
        {resumen}
        <Text style={styles.pregunta}>{tipo === 'invita' ? '¿Quién invitó?' : '¿De quién es el gasto?'}</Text>
        <Pressable style={styles.botonGrande} onPress={() => { setDueno(pareja.yo); setPaso('quien'); }}>
          <Text style={styles.textoBoton}>{miNombre} (tú)</Text>
        </Pressable>
        <Pressable style={styles.botonGrandeClaro} onPress={() => { setDueno(otroIndice); setPaso('quien'); }}>
          <Text style={styles.textoBotonClaro}>{otroNombre}</Text>
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
          ¿Quién pagó?
        </Text>
        <Pressable style={styles.botonGrande} onPress={() => elegirPagador(pareja.yo)}>
          <Text style={styles.textoBoton}>{miNombre} (tú)</Text>
        </Pressable>
        <Pressable style={styles.botonGrandeClaro} onPress={() => elegirPagador(pareja.yo === 0 ? 1 : 0)}>
          <Text style={styles.textoBotonClaro}>{otroNombre}</Text>
        </Pressable>
        <Pressable onPress={() => setPaso(pasoAntesDeQuien)}>
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
    // ScrollView: con el teclado abierto y el selector de fecha, todo sigue alcanzable
    <ScrollView style={{ flex: 1, backgroundColor: '#FFF8F5' }} contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled">
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

      {/* ¿Cuándo fue? "Hoy" ya viene marcado, así el caso normal no suma toques */}
      <Text style={styles.etiqueta}>¿Cuándo fue?</Text>
      <View style={styles.filaFecha}>
        {[['hoy', 'Hoy'], ['ayer', 'Ayer'], ['otro', 'Otro día']].map(([valor, texto]) => (
          <Pressable key={valor} onPress={() => setCuando(valor)}
            style={[styles.chip, cuando === valor && styles.chipActivo]}>
            <Text style={[styles.chipTexto, cuando === valor && styles.chipTextoActivo]}>{texto}</Text>
          </Pressable>
        ))}
      </View>
      {cuando === 'otro' && (
        <View style={styles.filaDiaMes}>
          <TextInput style={styles.campoFecha} value={dia} onChangeText={(t) => setDia(t.replace(/\D/g, ''))}
            placeholder="Día" keyboardType="number-pad" maxLength={2} />
          <Text style={styles.barra}>/</Text>
          <TextInput style={styles.campoFecha} value={mes} onChangeText={(t) => setMes(t.replace(/\D/g, ''))}
            placeholder="Mes" keyboardType="number-pad" maxLength={2} />
          {dia !== '' && mes !== '' && fechaInvalida && (
            <Text style={styles.errorFecha}>Fecha no válida o futura</Text>
          )}
        </View>
      )}

      <Pressable
        style={[styles.boton, (monto === 0 || fechaInvalida) && styles.botonApagado]}
        onPress={() => setPaso('tipo')}
        disabled={monto === 0 || fechaInvalida} // sin monto o con fecha inválida no se avanza
      >
        <Text style={styles.textoBoton}>Siguiente</Text>
      </Pressable>
      <Pressable onPress={onCerrar}>
        <Text style={styles.enlace}>Cancelar</Text>
      </Pressable>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  // Contenido arriba (no centrado) para que el teclado no lo tape
  contenedor: { flex: 1, backgroundColor: '#FFF8F5', padding: 24, paddingTop: 40 },
  scroll: { padding: 24, paddingTop: 40, paddingBottom: 60 },
  filaFecha: { flexDirection: 'row', marginBottom: 14 },
  chip: { flex: 1, borderWidth: 2, borderColor: ACENTO, borderRadius: 12, paddingVertical: 12,
    marginRight: 8, backgroundColor: '#fff' },
  chipActivo: { backgroundColor: ACENTO },
  chipTexto: { color: ACENTO, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  chipTextoActivo: { color: '#fff' },
  filaDiaMes: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 },
  campoFecha: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4D4D0', borderRadius: 12,
    padding: 12, fontSize: 17, width: 80, textAlign: 'center' },
  barra: { fontSize: 22, color: '#777', marginHorizontal: 10 },
  errorFecha: { color: '#B91C1C', fontSize: 13, marginLeft: 12 },
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
  // Botones de modo (Porcentaje % / Cantidad $)
  modoBoton: { borderWidth: 2, borderColor: ACENTO, borderRadius: 14, paddingVertical: 14, marginBottom: 12,
    backgroundColor: '#fff' },
  modoBotonActivo: { backgroundColor: ACENTO },
  modoTexto: { color: ACENTO, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  modoTextoActivo: { color: '#fff' },
  // Barra de reparto
  repartoCaja: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D4D4D0', borderRadius: 16,
    padding: 16, marginBottom: 14 },
  repartoFila: { flexDirection: 'row', justifyContent: 'space-between' },
  repartoNombre: { flex: 1, fontSize: 16, fontWeight: '700', color: '#222' },
  repartoPct: { fontSize: 22, fontWeight: '700', color: ACENTO },
  repartoMonto: { fontSize: 15, color: '#444', marginTop: 2 },
  pistaFila: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  pasoBoton: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: ACENTO,
    alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { color: ACENTO, fontSize: 22, fontWeight: '700', lineHeight: 26 },
  marca: { position: 'absolute', top: 14, width: 2, height: 20, marginLeft: -1, backgroundColor: '#E58AA3' },
  pistaToque: { flex: 1, height: 48, justifyContent: 'center', marginHorizontal: 16 },
  pistaFondo: { height: 14, borderRadius: 7, backgroundColor: '#FAC9D6', overflow: 'hidden' },
  pistaIzq: { height: 14, backgroundColor: ACENTO },
  perilla: { position: 'absolute', top: 10, width: 28, height: 28, borderRadius: 14, marginLeft: -14,
    backgroundColor: '#fff', borderWidth: 3, borderColor: ACENTO },
  resto: { backgroundColor: '#FFF0F3', borderRadius: 12, padding: 14, marginBottom: 20 },
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
