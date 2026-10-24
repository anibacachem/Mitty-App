import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { pedir } from '../supabase';
import { META_DIARIA } from '../habito';
import { ACENTO } from '../colores';

const ETIQUETA = { 0: 'Ninguno', 1: 'Solo 1', 2: 'Solo 2' };

// Permite declarar "ese día hubo menos de 3 gastos compartidos" (0, 1 o 2), y quitar la declaración.
// Cualquiera de los dos puede declarar; se guarda quién lo hizo y se muestra.
//   fecha:       el día ("2026-10-23")
//   dia:         lo calculado para ese día por medirPeriodo (undefined si el día aún no llega)
//   declaracion: la fila de metas_dia de ese día, si ya la declararon
//   disponible:  false si la tabla metas_dia todavía no existe en Supabase
//   onCambio:    se llama tras guardar o quitar, para recargar los datos
//   compacto:    true = solo un enlace que despliega las opciones (pantalla principal)
export default function DiaDeclarable({ pareja, fecha, dia, declaracion, disponible, onCambio, compacto }) {
  const [abierto, setAbierto] = useState(!compacto);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const nombres = [pareja.nombre0, pareja.nombre1];

  if (!dia) return <Text style={styles.nota}>Este día todavía no llega.</Text>;

  // Solo ofrecemos valores coherentes: si ya anotaron 2 gastos, no pueden declarar que hubo solo 1.
  const opciones = [0, 1, 2].filter((v) => v >= dia.anotados);
  const yaLlegoALaMeta = dia.anotados >= META_DIARIA && !declaracion;

  // "Crear o actualizar" la declaración del día (upsert: si ya existe, la reemplaza)
  async function declarar(valor) {
    setGuardando(true);
    setError('');
    try {
      await pedir('metas_dia', {
        metodo: 'POST',
        cuerpo: { codigo: pareja.codigo, fecha, esperados: valor, declarado_por: pareja.yo },
        codigoPareja: pareja.codigo,
        prefer: 'resolution=merge-duplicates,return=representation',
      });
      await onCambio();
      if (compacto) setAbierto(false);
    } catch (e) {
      setError('No se pudo guardar: ' + String(e.message).slice(0, 150));
    } finally {
      setGuardando(false);
    }
  }

  // Borra la declaración: el día vuelve a tener la meta de 3
  async function quitar() {
    setGuardando(true);
    setError('');
    try {
      await pedir(`metas_dia?codigo=eq.${pareja.codigo}&fecha=eq.${fecha}`, {
        metodo: 'DELETE',
        codigoPareja: pareja.codigo,
      });
      await onCambio();
      if (compacto) setAbierto(false);
    } catch (e) {
      setError('No se pudo quitar: ' + String(e.message).slice(0, 150));
    } finally {
      setGuardando(false);
    }
  }

  // Quién declaró y qué declaró, para mostrarlo ("Declarado: solo hubo 2 · por Luis")
  const autor = declaracion
    ? `${nombres[declaracion.declarado_por]}${declaracion.declarado_por === pareja.yo ? ' (tú)' : ''}`
    : '';
  const textoDeclarado = declaracion
    ? `Declarado: ${declaracion.esperados === 0 ? 'no hubo gastos compartidos' : `solo hubo ${declaracion.esperados}`} · por ${autor}`
    : '';

  // Modo compacto cerrado: la declaración (si existe) con su autor, y el enlace para cambiarla.
  // Si el día ya está completo sin declarar, no se muestra nada.
  if (compacto && !abierto) {
    if (yaLlegoALaMeta) return null;
    return (
      <View style={{ marginTop: 6 }}>
        {declaracion && <Text style={styles.declarado}>{textoDeclarado}</Text>}
        <Pressable onPress={() => setAbierto(true)}>
          <Text style={styles.enlace}>{declaracion ? 'Cambiar la declaración de hoy' : 'Hoy hubo menos de 3'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 6 }}>
      {declaracion ? (
        <Text style={styles.declarado}>{textoDeclarado}</Text>
      ) : yaLlegoALaMeta ? (
        <Text style={styles.declarado}>Este día ya llegó a la meta de {META_DIARIA}.</Text>
      ) : (
        <Text style={styles.pregunta}>¿Ese día hubo menos de {META_DIARIA} gastos compartidos?</Text>
      )}

      {!disponible ? (
        <Text style={styles.aviso}>
          Para declarar días falta crear la tabla en Supabase: pega el archivo supabase/metas_dia.sql en el SQL Editor.
        </Text>
      ) : (
        <>
          {opciones.length > 0 && !yaLlegoALaMeta && (
            <View style={styles.fila}>
              {opciones.map((v) => {
                const activa = declaracion && declaracion.esperados === v;
                return (
                  <Pressable
                    key={v}
                    disabled={guardando}
                    onPress={() => declarar(v)}
                    style={[styles.opcion, activa && styles.opcionActiva, guardando && { opacity: 0.5 }]}
                  >
                    <Text style={[styles.opcionTexto, activa && styles.opcionTextoActiva]}>{ETIQUETA[v]}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {declaracion && (
            <Pressable disabled={guardando} onPress={quitar}>
              <Text style={styles.quitar}>Quitar declaración (vuelve a la meta de {META_DIARIA})</Text>
            </Pressable>
          )}
        </>
      )}

      {guardando && <ActivityIndicator color={ACENTO} style={{ marginTop: 8 }} />}
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {compacto && (
        <Pressable onPress={() => setAbierto(false)}>
          <Text style={styles.cerrar}>Cerrar</Text>
        </Pressable>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  nota: { fontSize: 13, color: '#888', marginTop: 6 },
  enlace: { color: ACENTO, fontSize: 14, fontWeight: '600', marginTop: 8 },
  pregunta: { fontSize: 14, color: '#444', marginBottom: 8 },
  declarado: { fontSize: 14, color: '#444', fontWeight: '600', marginBottom: 8 },
  aviso: { fontSize: 13, color: '#B45309', marginTop: 4 },
  fila: { flexDirection: 'row' },
  opcion: { flex: 1, borderWidth: 2, borderColor: ACENTO, borderRadius: 12, paddingVertical: 10,
    marginRight: 8, backgroundColor: '#fff' },
  opcionActiva: { backgroundColor: ACENTO },
  opcionTexto: { color: ACENTO, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  opcionTextoActiva: { color: '#fff' },
  quitar: { color: '#B91C1C', fontSize: 13, marginTop: 10 },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 8 },
  cerrar: { color: '#777', fontSize: 13, marginTop: 10 },
});
