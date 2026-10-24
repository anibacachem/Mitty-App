import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { cargarTodo } from '../datos';
import { pedir } from '../supabase';
import { etiquetaTipo, fechaConDia, hoyISO, pesos } from '../formato';
import { calcularBalance, describirSaldo, resultadoEnPalabras, textoReparto } from '../saldo';
import { EXITO_SEMANA, META_SEMANA, limitesDelMes, medirSemana, semanaCompleta } from '../habito';
import { guardarActivado, leerActivado, notificacionDePrueba, pedirPermiso } from '../notificaciones';
import { ACENTO } from '../colores';

const CADA_CUANTO_MS = 5000; // los datos se refrescan solos cada 5 segundos
// Filtros de la lista: qué tipos de movimiento muestra cada uno (null = todos)
const FILTROS = [
  { id: 'todos', texto: 'Todos', tipos: null },
  { id: 'compartidos', texto: 'Compartidos', tipos: ['mitad', 'fraccion', 'por_otro'] },
  { id: 'propios', texto: 'Personales e invitaciones', tipos: ['invita', 'personal'] },
  { id: 'pagos', texto: 'Pagos', tipos: ['pago'] },
];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ALTO_CAJA = 400; // alto de la caja de gastos: caben unos 5 gastos; el resto se ve con scroll

// Pantalla principal: saludo, saldo, detalle, botón de añadir y lista de gastos del mes.
// pareja: { codigo, nombre0, nombre1, yo }. aviso: mensaje corto arriba (ej. "Gasto anotado").
export default function Principal({ pareja, aviso, onAnadir, onAsistente, onRitual, onCierre, onSalir }) {
  const [copiado, setCopiado] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true); // primera carga
  const [refrescando, setRefrescando] = useState(false); // al arrastrar hacia abajo
  const [conexion, setConexion] = useState('probando'); // 'probando' | 'ok' | 'sin'
  const [abierto, setAbierto] = useState(null); // id de la fila expandida
  const [recientePrimero, setRecientePrimero] = useState(true); // orden de la lista: true = más reciente arriba
  const [mesOffset, setMesOffset] = useState(0); // mes de la lista: 0 = actual, -1 = anterior...
  const [filtro, setFiltro] = useState('todos'); // filtro activo de la lista del mes
  const [modoSeleccion, setModoSeleccion] = useState(false); // ¿estamos eligiendo gastos para eliminar?
  const [seleccion, setSeleccion] = useState([]); // ids de los gastos marcados
  const [infoAbierta, setInfoAbierta] = useState(false); // explicación del Detalle (botón i)
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false); // ventana flotante del engranaje
  const [recordatorios, setRecordatorios] = useState(false); // ¿están activados los recordatorios?
  const [notaRecord, setNotaRecord] = useState(''); // mensaje bajo el interruptor ("Te enviamos una de prueba")
  const enCurso = useRef(false); // evita pedir de nuevo si la petición anterior no terminó

  // yo es 0 o 1: elegimos mi nombre y el de la otra persona
  const nombres = [pareja.nombre0, pareja.nombre1];
  const yo = pareja.yo;
  const otro = yo === 0 ? 1 : 0;
  const miNombre = nombres[yo];
  const otroNombre = nombres[otro];

  // Pide TODOS los gastos de la pareja (el saldo cuenta todo lo no saldado, no solo este mes).
  // Si falla, dejamos los datos que ya teníamos y marcamos "Sin conexión".
  async function cargar() {
    if (enCurso.current) return;
    enCurso.current = true;
    try {
      const datos = await cargarTodo(pareja.codigo);
      setMovimientos(datos.movimientos);
      setConexion('ok');
    } catch (e) {
      setConexion('sin');
    } finally {
      enCurso.current = false;
      setCargando(false);
      setRefrescando(false);
    }
  }

  // Al abrir la pantalla cargamos, y desde ahí repetimos cada 5 segundos.
  // El "return" apaga el reloj al salir de la pantalla, para no pedir datos de más.
  useEffect(() => {
    cargar();
    leerActivado().then(setRecordatorios); // recordamos lo que eligió la última vez
    const reloj = setInterval(cargar, CADA_CUANTO_MS);
    return () => clearInterval(reloj);
  }, []);

  // Interruptor de recordatorios. Al activar: pedimos permiso y mandamos una notificación de prueba.
  async function cambiarRecordatorios(quiere) {
    setNotaRecord('');
    if (!quiere) {
      setRecordatorios(false);
      await guardarActivado(false);
      return;
    }
    try {
      const permitido = await pedirPermiso();
      if (!permitido) {
        setNotaRecord('Sin permiso. Actívalo en los ajustes del teléfono para recibir recordatorios.');
        return; // el interruptor se queda apagado
      }
      await notificacionDePrueba(miNombre);
      setRecordatorios(true);
      await guardarActivado(true);
      setNotaRecord('Listo. En unos segundos te llegará una notificación de prueba.');
    } catch (e) {
      setNotaRecord('No se pudo activar: ' + String(e.message).slice(0, 120));
    }
  }

  // Cerrar sesión pide confirmación: como no hay usuario y contraseña, el código de la pareja es la única
  // llave para volver a entrar. Los gastos no se borran: siguen guardados en Supabase.
  function pedirSalir() {
    Alert.alert(
      'Cerrar sesión',
      `Para volver a entrar necesitarás el código de tu pareja: ${pareja.codigo}. Tus gastos no se borran, quedan guardados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir sin copiar', style: 'destructive', onPress: onSalir },
        {
          text: 'Copiar código y salir',
          onPress: async () => {
            await Clipboard.setStringAsync(pareja.codigo);
            onSalir();
          },
        },
      ]
    );
  }

  async function copiarCodigo() {
    await Clipboard.setStringAsync(pareja.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // El balance se recalcula solo cuando cambian los movimientos
  const balance = useMemo(() => calcularBalance(movimientos), [movimientos]);
  // La frase y su color salen de la misma función que usa el ritual, así nunca se contradicen
  const saldo = describirSaldo(balance.neto, yo, nombres);
  const textoSaldo = saldo.texto;
  const estiloSaldo = { debo: styles.saldoDebo, medeben: styles.saldoMeDeben, amano: styles.saldoAMano }[saldo.clase];

  const esDomingo = new Date().getDay() === 0; // 0 = domingo

  // Cómo va la semana (lunes a domingo): gastos anotados contra la meta, igual que en el Ritual
  const hoy = hoyISO();
  const semanaHoy = semanaCompleta(hoy);
  const medSemana = medirSemana(movimientos, semanaHoy.desde, semanaHoy.hasta);
  const anotadosHoy = medSemana.porDia[hoy] || 0;
  const esFinDeMes = hoy === limitesDelMes(hoy).hasta; // último día del mes: toca el cierre

  // Mes que muestra la lista: 0 = el actual, -1 = el anterior, etc. (el saldo siempre usa todo)
  const primeroDelMesVisto = (() => {
    const [a, m] = hoy.split('-').map(Number);
    const d = new Date(a, m - 1 + mesOffset, 1); // JS ajusta solo el año al pasar de enero a diciembre
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  })();
  const limitesVistos = limitesDelMes(primeroDelMesVisto);
  const esMesActual = mesOffset === 0;
  const nombreMesVisto = `${MESES[Number(primeroDelMesVisto.slice(5, 7)) - 1]} ${primeroDelMesVisto.slice(0, 4)}`;
  const hayMesesAnteriores = movimientos.some((m) => m.fecha < limitesVistos.desde); // sin datos antes, no hay a dónde ir
  const delMes = movimientos.filter((m) => m.fecha >= limitesVistos.desde && m.fecha <= limitesVistos.hasta);

  // El Detalle usa SOLO los movimientos del mes en curso (la tarjeta "Saldo" de arriba sigue usando todo)
  const limitesActual = limitesDelMes(hoy);
  const nombreMesActual = `${MESES[Number(hoy.slice(5, 7)) - 1]} ${hoy.slice(0, 4)}`;
  const balanceMes = useMemo(
    () => calcularBalance(movimientos.filter((m) => m.fecha >= limitesActual.desde && m.fecha <= limitesActual.hasta)),
    [movimientos, hoy]
  );

  // Detalle en dos grupos, yo primero:
  //   Gastos compartidos (mitad, fracción, era del otro) y Gastos personales e invitaciones.
  // Cada grupo muestra lo que pagó cada uno y lo que le correspondía. Los pagos entre ustedes
  // (solo si los hubo) y el Resultado final van abajo, y ese Resultado suma los dos grupos.
  const orden = [yo, otro];
  const hayPagos = balanceMes.pagosEnviados[0] + balanceMes.pagosEnviados[1] > 0;
  const filasGrupo = (g) => [
    { texto: 'Gasto total', valores: orden.map((i) => pesos(g.gastado[i])) },
    { texto: 'Le correspondía', valores: orden.map((i) => pesos(g.corresponde[i])) },
  ];
  const hayPropios = balanceMes.secciones.propios.gastado[0] + balanceMes.secciones.propios.gastado[1]
    + balanceMes.secciones.propios.corresponde[0] + balanceMes.secciones.propios.corresponde[1] > 0;
  const gruposDetalle = [{ titulo: 'Gastos compartidos', filas: filasGrupo(balanceMes.secciones.compartidos) }];
  if (hayPropios) {
    gruposDetalle.push({ titulo: 'Gastos personales e invitaciones', filas: filasGrupo(balanceMes.secciones.propios) });
  }
  // Pagos entre ustedes: dos filas con solo el monto (o "—"), alineadas a la derecha.
  // "Pagó" = dinero que envió para saldar la deuda; "Recibió" = dinero que le llegó.
  if (hayPagos) {
    gruposDetalle.push({
      titulo: 'Pagos entre ustedes',
      filas: [
        { texto: 'Pagó', valores: orden.map((i) => (balanceMes.pagosEnviados[i] >= 0.5 ? pesos(balanceMes.pagosEnviados[i]) : '—')) },
        { texto: 'Recibió', valores: orden.map((i) => (balanceMes.pagosRecibidos[i] >= 0.5 ? pesos(balanceMes.pagosRecibidos[i]) : '—')) },
      ],
    });
  }

  // Lista del mes ordenada por la FECHA DEL GASTO (cuándo ocurrió). Si dos gastos son del mismo día,
  // desempata la hora en que se anotaron. Por defecto, el más reciente arriba; el botón invierte el orden.
  const listaMes = [...delMes].sort((a, b) => {
    const porFecha = String(b.fecha).localeCompare(String(a.fecha)); // negativo = a va primero
    const orden = porFecha !== 0 ? porFecha : String(b.creado ?? '').localeCompare(String(a.creado ?? ''));
    return recientePrimero ? orden : -orden;
  });

  // Aplicamos el filtro elegido sobre la lista del mes
  const tiposFiltro = FILTROS.find((f) => f.id === filtro).tipos;
  const listaVista = tiposFiltro ? listaMes.filter((m) => tiposFiltro.includes(m.tipo)) : listaMes;

  // Borra gastos de Supabase por su id y los saca de la lista al tiro (sin esperar el próximo refresco).
  // La condición codigo=eq.… es un seguro extra: nunca toca gastos de otra pareja.
  async function borrarGastos(ids) {
    try {
      const lista = ids.map((id) => `"${id}"`).join(',');
      await pedir(`movimientos?id=in.(${lista})&codigo=eq.${pareja.codigo}`, {
        metodo: 'DELETE',
        codigoPareja: pareja.codigo,
      });
      setMovimientos((previos) => previos.filter((m) => !ids.includes(m.id)));
      setAbierto(null);
      salirSeleccion();
    } catch (e) {
      Alert.alert('No se pudo eliminar', String(e.message).slice(0, 150));
    }
  }

  // ---- Seleccionar varios gastos para eliminarlos ----
  // Los pagos del cierre no se pueden seleccionar (protegen el historial del saldo).
  const seleccionables = listaVista.filter((m) => m.tipo !== 'pago');
  // Solo cuentan los marcados que siguen a la vista (si cambias de filtro o mes, lo oculto no se borra)
  const marcados = seleccionables.filter((m) => seleccion.includes(m.id));
  const todosMarcados = seleccionables.length > 0 && marcados.length === seleccionables.length;

  function salirSeleccion() {
    setModoSeleccion(false);
    setSeleccion([]);
  }
  function alternarMarca(id) {
    setSeleccion((previa) => (previa.includes(id) ? previa.filter((x) => x !== id) : [...previa, id]));
  }

  // Pide confirmación antes de borrar (el saldo cambia). Cancelar no hace nada.
  function confirmarBorrado() {
    if (marcados.length === 0) return;
    const total = marcados.reduce((suma, m) => suma + Number(m.monto), 0);
    Alert.alert(
      marcados.length === 1 ? '¿Eliminar este gasto?' : `¿Eliminar ${marcados.length} gastos?`,
      marcados.length === 1
        ? `${marcados[0].descripcion} · ${pesos(total)}\nEsto cambia el saldo.`
        : `Suman ${pesos(total)}.\nEsto cambia el saldo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => borrarGastos(marcados.map((m) => m.id)) },
      ]
    );
  }

  // Una fila de la lista. Al tocarla se abre y muestra el reparto.
  // En modo selección, tocarla la marca o desmarca (los pagos no se pueden marcar).
  function renderFila({ item }) {
    const expandida = abierto === item.id;
    const marcable = modoSeleccion && item.tipo !== 'pago';
    const marcada = marcable && seleccion.includes(item.id);
    return (
      <Pressable
        style={[styles.fila, marcada && styles.filaMarcada, modoSeleccion && item.tipo === 'pago' && { opacity: 0.45 }]}
        onPress={() => {
          if (modoSeleccion) {
            if (item.tipo !== 'pago') alternarMarca(item.id);
          } else {
            setAbierto(expandida ? null : item.id);
          }
        }}
      >
        <View style={styles.filaArriba}>
          {marcable && (
            <View style={[styles.casilla, marcada && styles.casillaMarcada]}>
              {marcada && <Text style={styles.casillaCheck}>✓</Text>}
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.filaTitulo}>{item.descripcion}</Text>
            <Text style={styles.filaDetalle}>
              {item.tipo === 'pago' ? 'Pagó' : 'Gastó'} {nombres[item.pagador]} · {etiquetaTipo(item.tipo)} · {fechaConDia(item.fecha)}
            </Text>
          </View>
          <Text style={styles.filaMonto}>{pesos(Number(item.monto))}</Text>
        </View>
        {expandida && !modoSeleccion && <Text style={styles.reparto}>Reparto: {textoReparto(item, nombres)}</Text>}
      </Pressable>
    );
  }

  // Indicador de sincronización
  const indicador = (
    <View style={styles.estado}>
      <View
        style={[
          styles.punto,
          conexion === 'ok' && styles.puntoOk,
          conexion === 'sin' && styles.puntoMal,
        ]}
      />
      <Text style={styles.estadoTexto}>
        {conexion === 'ok' ? 'Sincronizado' : conexion === 'sin' ? 'Sin conexión' : 'Sincronizando…'}
      </Text>
    </View>
  );

  // Todo lo que va ARRIBA de la lista (la lista hace scroll junto con esto)
  const encabezado = (
    <View>
      {/* Engranaje arriba a la derecha: abre la ventana con el código de enlace y los recordatorios */}
      <View>
        {/* Logo de Mitty arriba a la izquierda */}
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Pressable style={styles.engranaje} onPress={() => setAjustesAbiertos(true)} hitSlop={10}
          accessibilityLabel="Ajustes">
          <Text style={styles.engranajeTexto}>{'⚙︎'}</Text>
        </Pressable>
        <Text style={styles.titulo}>Hola, {miNombre}</Text>
        <Text style={styles.subtitulo}>Compartes gastos con {otroNombre}</Text>
      </View>

      {/* Tarjeta de saldo: quién le debe cuánto a quién */}
      <View style={styles.tarjeta}>
        <View style={styles.tarjetaArriba}>
          <Text style={styles.etiqueta}>Saldo</Text>
          {indicador}
        </View>
        <Text style={[styles.saldoTexto, estiloSaldo]}>{textoSaldo}</Text>
      </View>

      {/* Dos formas de anotar, lado a lado: Mitty AI (a la izquierda, con símbolo de IA) y el flujo normal */}
      <View style={styles.filaAnadir}>
        {/* Mitty AI: abre el chat para anotar un gasto escribiendo o hablando */}
        <Pressable style={styles.botonIA} onPress={onAsistente}>
          <Text style={styles.textoIADos}>Añadir gasto con</Text>
          <Text style={styles.textoIAUno}>✦ Mitty AI</Text>
        </Pressable>
        <Pressable style={styles.botonAnadir} onPress={onAnadir}>
          <Text style={styles.textoAnadir}>+ Añadir gasto manual</Text>
        </Pressable>
      </View>

      {/* Esta semana: gastos anotados contra la meta (8 de 10), una barra de 10 tramos. Al tocarla abre el Ritual */}
      <Pressable style={[styles.tarjetaHoy, esDomingo && styles.tarjetaHoyDomingo]} onPress={onRitual}>
        <View style={styles.hoyFila}>
          <Text style={styles.hoyTitulo}>Esta semana</Text>
          <Text style={[styles.hoyConteo, medSemana.estado === 'logrado' ? styles.verde : styles.ambar]}>
            {medSemana.anotados}/{META_SEMANA}
          </Text>
        </View>
        <View style={styles.tramos}>
          {Array.from({ length: META_SEMANA }).map((_, i) => (
            <View key={i} style={[styles.tramo, i < medSemana.anotados && styles.tramoLleno,
              i === EXITO_SEMANA - 1 && styles.tramoMeta]} />
          ))}
        </View>
        <Text style={styles.hoySub}>
          {medSemana.estado === 'logrado'
            ? '¡Semana lograda!'
            : `Faltan ${medSemana.faltan} para lograr la semana (${EXITO_SEMANA})`}
          {` · Hoy: ${anotadosHoy} ${anotadosHoy === 1 ? 'anotado' : 'anotados'}`}
        </Text>
        <Text style={styles.hoyVer}>{esDomingo ? 'Hoy es domingo: toca para revisar tu semana' : 'Toca para ver tu semana y el mes'}</Text>
      </Pressable>

      {/* Cierre de mes. Siempre disponible; el último día del mes se resalta y dice "Hoy toca". */}
      <Pressable style={[styles.botonCierre, esFinDeMes && styles.botonRitualHoy]} onPress={onCierre}>
        {esFinDeMes && <Text style={styles.textoHoyToca}>Hoy toca</Text>}
        <Text style={[styles.textoRitual, esFinDeMes && styles.textoRitualHoy]}>Cierre de mes</Text>
      </Pressable>

      {/* Tarjeta de detalle: los números que explican el saldo */}
      <View style={[styles.tarjeta, { marginTop: 20 }]}>
        <View style={styles.tarjetaArriba}>
          <Text style={styles.etiqueta}>Detalle del saldo · {nombreMesActual}</Text>
          {/* Botón (i): muestra u oculta la explicación para ahorrar espacio */}
          <Pressable
            style={[styles.botonInfo, infoAbierta && styles.botonInfoActivo]}
            onPress={() => setInfoAbierta(!infoAbierta)}
            hitSlop={10}
            accessibilityLabel="Explicación del detalle"
          >
            <Text style={[styles.botonInfoTexto, infoAbierta && { color: '#fff' }]}>i</Text>
          </Pressable>
        </View>
        <View style={styles.detalleFila}>
          <Text style={styles.detalleTexto} />
          {orden.map((i) => (
            <Text key={i} style={[styles.detalleCol, styles.detalleNombre]}>
              {i === yo ? `${nombres[i]} (tú)` : nombres[i]}
            </Text>
          ))}
        </View>
        {gruposDetalle.map((g) => (
          <View key={g.titulo}>
            <Text style={styles.detalleSeccion}>{g.titulo}</Text>
            {g.filas.map((f) => (
              <View key={f.texto} style={styles.detalleFila}>
                <Text style={styles.detalleTexto}>{f.texto}</Text>
                {f.valores.map((v, k) => (
                  <Text key={k} style={styles.detalleCol}>{v}</Text>
                ))}
              </View>
            ))}
          </View>
        ))}
        <View style={[styles.detalleFila, styles.detalleTotal]}>
          <Text style={[styles.detalleTexto, { fontWeight: '700' }]}>Resultado</Text>
          {orden.map((i) => (
            <Text
              key={i}
              style={[styles.detalleCol, { fontWeight: '700' },
                balanceMes.neto[i] <= -0.5 ? styles.rojo : balanceMes.neto[i] >= 0.5 ? styles.verde : null]}
            >
              {resultadoEnPalabras(balanceMes.neto[i])}
            </Text>
          ))}
        </View>
        {infoAbierta && <Text style={styles.nota}>
          Solo cuenta los movimientos de este mes. Gasto total = lo que cada uno puso de su bolsillo; Le correspondía =
          su parte. En gastos compartidos se reparten (mitad, fracción); en invitaciones y gastos personales todo es
          de quien invitó o de quien es el gasto, y si pagó el otro se lo debe. Pagó / Recibió = dinero entregado entre
          ustedes para saldar la deuda. Resultado = suma de ambos grupos ± pagos.
        </Text>}
      </View>

      {/* (El código de la pareja y los recordatorios ahora están en la ventana del engranaje, arriba a la derecha) */}

      <Text style={styles.seccion}>
        Gastos del mes ({filtro === 'todos' ? listaMes.length : `${listaVista.length} de ${listaMes.length}`})
      </Text>
      {/* Mes: flecha izquierda = mes anterior (si hay datos), flecha derecha = mes siguiente (hasta el actual) */}
      <View style={styles.navMes}>
        <Pressable
          style={[styles.flechaMes, !hayMesesAnteriores && styles.flechaMesOff]}
          disabled={!hayMesesAnteriores}
          hitSlop={8}
          onPress={() => { setMesOffset(mesOffset - 1); setAbierto(null); }}
        >
          <Text style={styles.flechaMesTexto}>‹</Text>
        </Pressable>
        <Text style={styles.navMesTexto}>
          {nombreMesVisto[0].toUpperCase() + nombreMesVisto.slice(1)}{esMesActual ? ' · actual' : ''}
        </Text>
        <Pressable
          style={[styles.flechaMes, esMesActual && styles.flechaMesOff]}
          disabled={esMesActual}
          hitSlop={8}
          onPress={() => { setMesOffset(mesOffset + 1); setAbierto(null); }}
        >
          <Text style={styles.flechaMesTexto}>›</Text>
        </Pressable>
      </View>
      {/* Filtros: un toque para ver solo un tipo de movimiento */}
      {listaMes.length > 0 && (
        <View style={styles.filtros}>
          {FILTROS.map((f) => (
            <Pressable
              key={f.id}
              style={[styles.chip, filtro === f.id && styles.chipActivo]}
              onPress={() => setFiltro(f.id)}
            >
              <Text style={[styles.chipTexto, filtro === f.id && styles.chipTextoActivo]}>{f.texto}</Text>
            </Pressable>
          ))}
          {/* Seleccionar: activa las casillas para elegir gastos y eliminarlos */}
          {!modoSeleccion && seleccionables.length > 0 && (
            <Pressable style={[styles.botonOrden, { marginLeft: 'auto' }]} onPress={() => setModoSeleccion(true)}>
              <Text style={styles.botonOrdenTexto}>☑ Seleccionar</Text>
            </Pressable>
          )}
          {/* Botón pequeño que invierte el orden de la lista */}
          <Pressable style={[styles.botonOrden, { marginLeft: modoSeleccion || seleccionables.length === 0 ? 'auto' : 0 }]} onPress={() => setRecientePrimero(!recientePrimero)}>
            <Text style={styles.botonOrdenTexto}>{recientePrimero ? '↓ Recientes' : '↑ Antiguos'}</Text>
          </Pressable>
        </View>
      )}
      {cargando && <ActivityIndicator color={ACENTO} style={{ marginTop: 12 }} />}
      {!cargando && conexion === 'sin' && movimientos.length === 0 && (
        <Text style={styles.error}>No se pudo cargar. Se reintenta solo cada 5 segundos.</Text>
      )}
      {!cargando && delMes.length === 0 && (conexion === 'ok' || movimientos.length > 0) && (
        <Text style={styles.vacio}>
          {esMesActual ? 'Aún no hay gastos este mes. ¡Anota el primero!' : 'No hay movimientos en este mes.'}
        </Text>
      )}

      {/* Barra del modo selección: cuántos hay marcados, marcar todos, cancelar y eliminar */}
      {modoSeleccion && (
        <View style={styles.barraSeleccion}>
          <Text style={styles.barraSeleccionTexto}>
            {marcados.length === 0 ? 'Toca los gastos que quieres eliminar' : `${marcados.length} ${marcados.length === 1 ? 'seleccionado' : 'seleccionados'}`}
          </Text>
          <View style={styles.barraSeleccionBotones}>
            <Pressable onPress={() => setSeleccion(todosMarcados ? [] : seleccionables.map((m) => m.id))} hitSlop={6}>
              <Text style={styles.barraEnlace}>{todosMarcados ? 'Quitar todos' : 'Todos'}</Text>
            </Pressable>
            <Pressable onPress={salirSeleccion} hitSlop={6}>
              <Text style={styles.barraEnlace}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.botonEliminar, marcados.length === 0 && { opacity: 0.4 }]}
              disabled={marcados.length === 0}
              onPress={confirmarBorrado}
            >
              <Text style={styles.botonEliminarTexto}>Eliminar{marcados.length > 0 ? ` (${marcados.length})` : ''}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Caja con scroll propio: se ven unos 5 gastos (los más nuevos arriba); al bajar aparecen los más antiguos */}
      {listaMes.length > 0 && listaVista.length === 0 && (
        <Text style={styles.vacio}>No hay movimientos de este tipo en el mes.</Text>
      )}
      {listaVista.length > 0 && (
        <View style={styles.cajaLista}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: ALTO_CAJA }}>
            {listaVista.map((item) => (
              <View key={item.id}>{renderFila({ item })}</View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        style={styles.lista}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        data={[]} // los gastos van dentro de la caja con scroll del encabezado
        renderItem={null}
        ListHeaderComponent={encabezado}
        refreshing={refrescando}
        onRefresh={() => {
          setRefrescando(true);
          cargar();
        }}
      />
      {/* Ventana flotante del engranaje: código de enlace y recordatorios diarios.
          Tocar fuera de la ventana la cierra. */}
      <Modal visible={ajustesAbiertos} transparent animationType="fade" onRequestClose={() => setAjustesAbiertos(false)}>
        <Pressable style={styles.fondoModal} onPress={() => setAjustesAbiertos(false)}>
          {/* Este Pressable interno frena el toque para que tocar DENTRO de la ventana no la cierre */}
          <Pressable style={styles.ventanaAjustes} onPress={() => {}}>
            <Text style={styles.ajustesTitulo}>Código de enlace</Text>
            <Text style={styles.ajustesAyuda}>Compártelo con tu pareja para que se una desde su teléfono.</Text>
            <View style={styles.codigoCaja}>
              <Text style={styles.codigoValor} selectable>{pareja.codigo}</Text>
              <Pressable onPress={copiarCodigo} hitSlop={8}>
                <Text style={styles.copiar}>{copiado ? '¡Copiado!' : 'Copiar'}</Text>
              </Pressable>
            </View>

            <View style={styles.ajustesSeparador} />

            {/* Recordatorios: interruptor para recibir avisos que invitan a anotar los gastos */}
            <View style={styles.recordFila}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.recordTitulo}>Recordatorios diarios</Text>
                <Text style={styles.recordSub}>Te avisamos para que anotes tus gastos en pareja</Text>
              </View>
              <Switch
                value={recordatorios}
                onValueChange={cambiarRecordatorios}
                trackColor={{ false: '#D4D4D0', true: ACENTO }}
              />
            </View>
            {notaRecord !== '' && <Text style={styles.recordNota}>{notaRecord}</Text>}

            <View style={styles.ajustesSeparador} />

            {/* Cerrar sesión: primero cerramos esta ventana y luego mostramos la confirmación.
                En iPhone, un aviso no puede abrirse encima de otra ventana, por eso la pequeña espera. */}
            <Pressable
              onPress={() => {
                setAjustesAbiertos(false);
                setTimeout(pedirSalir, 350);
              }}
            >
              <Text style={styles.salirAjustes}>Cerrar sesión</Text>
            </Pressable>

            <Pressable style={styles.cerrarAjustes} onPress={() => setAjustesAbiertos(false)}>
              <Text style={styles.cerrarAjustesTexto}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Aviso flotante arriba, por ejemplo "Gasto anotado" */}
      {aviso ? (
        <View style={styles.aviso} pointerEvents="none">
          <Text style={styles.avisoTexto}>✓ {aviso}</Text>
        </View>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  lista: { flex: 1, backgroundColor: '#FFF8F5' },
  titulo: { fontSize: 30, fontWeight: '700', color: ACENTO, textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  tarjeta: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1,
    borderColor: '#F0E4E0' },
  tarjetaArriba: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  etiqueta: { fontSize: 13, color: '#777', marginBottom: 6 },
  saldoTexto: { fontSize: 24, fontWeight: '700', marginTop: 4 },
  saldoDebo: { color: '#B91C1C' },
  saldoMeDeben: { color: ACENTO },
  saldoAMano: { color: '#555' },
  estado: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  punto: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#BBB', marginRight: 6 },
  puntoOk: { backgroundColor: '#16A34A' },
  puntoMal: { backgroundColor: '#B91C1C' },
  estadoTexto: { fontSize: 12, color: '#777' },
  filaAnadir: { flexDirection: 'row', marginTop: 16 },
  // Los dos botones comparten tamaño: mismo flex, mismo alto mínimo y mismo relleno
  botonAnadir: { flex: 1, minHeight: 68, backgroundColor: ACENTO, paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  textoAnadir: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  // Mitty AI: oscuro y con el símbolo ✦ para que se lea como "la opción de IA"
  botonIA: { flex: 1, minHeight: 68, backgroundColor: '#4A1633', paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 16, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  textoIAUno: { color: '#fff', fontSize: 18, fontWeight: '800' },
  textoIADos: { color: '#FFB3C6', fontSize: 12, fontWeight: '600', marginBottom: 1 },
  tarjetaHoy: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1,
    borderColor: '#F0E4E0', marginTop: 12 },
  hoyFila: { flexDirection: 'row', alignItems: 'center' },
  hoyTitulo: { fontSize: 17, fontWeight: '700', color: '#222' },
  tramos: { flexDirection: 'row', marginTop: 10 },
  tramo: { flex: 1, height: 10, borderRadius: 5, marginRight: 4, borderWidth: 1.5, borderColor: '#F0E4E0',
    backgroundColor: '#FFF3EF' },
  tramoLleno: { backgroundColor: ACENTO, borderColor: ACENTO },
  tramoMeta: { borderColor: '#16A34A' }, // el tramo 8 marca la meta de éxito
  hoyConteo: { fontSize: 17, fontWeight: '700', marginLeft: 'auto' },
  hoySub: { fontSize: 12, color: '#888', marginTop: 8 },
  ambar: { color: '#D97706' }, // ("verde" ya existe más abajo, en el detalle del saldo)
  tarjetaHoyDomingo: { borderColor: ACENTO, borderWidth: 2 }, // el domingo, la tarjeta de la semana se resalta
  hoyVer: { fontSize: 12, color: ACENTO, fontWeight: '600', marginTop: 4 },
  botonCierre: { borderWidth: 2, borderColor: ACENTO, paddingVertical: 14, borderRadius: 16, marginTop: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  botonRitualHoy: { backgroundColor: '#FFD9E3' },
  textoHoyToca: { color: ACENTO, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  textoRitual: { color: ACENTO, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  textoRitualHoy: { fontWeight: '700' },
  detalleFila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  detalleTexto: { flex: 1.3, fontSize: 14, color: '#555' },
  detalleCol: { flex: 1, fontSize: 14, color: '#222', textAlign: 'right' },
  detalleSeccion: { fontSize: 12, fontWeight: '700', color: '#555', marginTop: 10, marginBottom: 2, textTransform: 'uppercase' },
  detalleNombre: { fontWeight: '700', color: ACENTO },
  detalleTotal: { borderTopWidth: 1, borderTopColor: '#F0E4E0', marginTop: 4, paddingTop: 10 },
  rojo: { color: '#B91C1C' },
  verde: { color: '#16A34A' },
  nota: { fontSize: 12, color: '#888', marginTop: 8 },
  botonInfo: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: ACENTO,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  botonInfoActivo: { backgroundColor: ACENTO },
  botonInfoTexto: { color: ACENTO, fontSize: 13, fontWeight: '700', fontStyle: 'italic' },
  // Engranaje y ventana de ajustes
  logo: { position: 'absolute', left: 0, top: 0, width: 40, height: 40 },
  engranaje: { position: 'absolute', right: 0, top: 0, width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F1EC', zIndex: 2 },
  engranajeTexto: { fontSize: 20, color: '#555', lineHeight: 24 },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'flex-end', paddingTop: 70, paddingHorizontal: 16 },
  ventanaAjustes: { width: '90%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 18, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  ajustesTitulo: { fontSize: 16, fontWeight: '700', color: '#222' },
  ajustesAyuda: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 10 },
  codigoCaja: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF3EF', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  codigoValor: { fontSize: 18, fontWeight: '700', letterSpacing: 2, color: '#333' },
  copiar: { color: ACENTO, fontSize: 15, fontWeight: '700' },
  ajustesSeparador: { height: 1, backgroundColor: '#F0E4E0', marginVertical: 16 },
  cerrarAjustes: { marginTop: 8, paddingVertical: 10 },
  cerrarAjustesTexto: { color: ACENTO, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  recordFila: { flexDirection: 'row', alignItems: 'center' },
  recordTitulo: { fontSize: 15, fontWeight: '700', color: '#222' },
  recordSub: { fontSize: 12, color: '#888', marginTop: 2 },
  recordNota: { fontSize: 12, color: '#666', marginTop: 8 },
  seccion: { fontSize: 18, fontWeight: '700', color: '#222', marginTop: 24, marginBottom: 8 },
  vacio: { color: '#777', fontSize: 15, marginTop: 8 },
  error: { color: '#B91C1C', fontSize: 14, marginTop: 8 },
  navMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF3EF', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 6, marginBottom: 10 },
  flechaMes: { width: 40, height: 34, alignItems: 'center', justifyContent: 'center' },
  flechaMesOff: { opacity: 0.25 },
  flechaMesTexto: { fontSize: 28, color: ACENTO, fontWeight: '700', lineHeight: 32 },
  navMesTexto: { fontSize: 15, fontWeight: '700', color: '#222' },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { borderWidth: 1.5, borderColor: ACENTO, borderRadius: 16, paddingVertical: 6,
    paddingHorizontal: 12, marginRight: 8, marginBottom: 6, backgroundColor: '#fff' },
  botonOrden: { paddingVertical: 6, paddingHorizontal: 8, marginBottom: 6, marginLeft: 'auto' },
  botonOrdenTexto: { color: '#555', fontSize: 13, fontWeight: '600' },
  filaMarcada: { borderColor: ACENTO, backgroundColor: '#FFF0F3' },
  casilla: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D5D5D0', marginRight: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  casillaMarcada: { backgroundColor: ACENTO, borderColor: ACENTO },
  casillaCheck: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  barraSeleccion: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: ACENTO, padding: 12,
    marginBottom: 6 },
  barraSeleccionTexto: { fontSize: 14, fontWeight: '700', color: '#222' },
  barraSeleccionBotones: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  barraEnlace: { color: ACENTO, fontSize: 14, fontWeight: '700', marginRight: 18 },
  botonEliminar: { marginLeft: 'auto', backgroundColor: '#B91C1C', borderRadius: 10, paddingVertical: 8,
    paddingHorizontal: 16 },
  botonEliminarTexto: { color: '#fff', fontSize: 14, fontWeight: '700' },
  chipActivo: { backgroundColor: ACENTO },
  chipTexto: { color: ACENTO, fontSize: 14, fontWeight: '600' },
  chipTextoActivo: { color: '#fff' },
  cajaLista: { backgroundColor: '#F3F3EE', borderRadius: 16, borderWidth: 1, borderColor: '#F0E4E0',
    paddingHorizontal: 8, paddingBottom: 8, marginTop: 4 },
  fila: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F0E4E0',
    padding: 14, marginTop: 8 },
  filaArriba: { flexDirection: 'row', alignItems: 'center' },
  filaTitulo: { fontSize: 16, fontWeight: '600', color: '#222' },
  filaDetalle: { fontSize: 13, color: '#777', marginTop: 2 },
  filaMonto: { fontSize: 17, fontWeight: '700', color: '#222', marginLeft: 12 },
  reparto: { fontSize: 14, color: ACENTO, fontWeight: '600', marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#EEE' },
  salirAjustes: { color: '#B91C1C', fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },
  aviso: { position: 'absolute', top: 12, left: 24, right: 24, backgroundColor: ACENTO,
    borderRadius: 12, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.2,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  avisoTexto: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
