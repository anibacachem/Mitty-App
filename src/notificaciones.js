// Recordatorios de Mitty: notificaciones LOCALES (las programa el propio teléfono, sin servidor).
// Este archivo concentra todo lo de notificaciones, así las pantallas solo llaman funciones simples.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'mitty_recordatorios'; // cajón donde guardamos si están activados ("1") o no ("0")
const CANAL = 'recordatorios'; // en Android toda notificación necesita un "canal"

// Qué hacer si llega una notificación con la app abierta: mostrarla igual, sin sonido
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ¿Están activados los recordatorios? Por defecto no: antes hay que pedir permiso.
export async function leerActivado() {
  try {
    return (await AsyncStorage.getItem(CLAVE)) === '1';
  } catch {
    return false;
  }
}

export async function guardarActivado(activado) {
  await AsyncStorage.setItem(CLAVE, activado ? '1' : '0');
}

// Pide permiso para avisar. Devuelve true si el usuario lo dio (o ya lo había dado).
export async function pedirPermiso() {
  if (Platform.OS === 'android') {
    // Crea el canal (si ya existe, no pasa nada)
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Recordatorios de gastos',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  const nuevo = await Notifications.requestPermissionsAsync();
  return nuevo.granted;
}

// Notificación de prueba: llega 5 segundos después, para comprobar que todo funciona.
export async function notificacionDePrueba(nombre) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Mitty',
      body: `${nombre}, así se verán tus recordatorios. ¿Anotamos un gasto?`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: CANAL,
    },
  });
}

// ---- Recordatorios diarios fijos ----
// Tres avisos al día, a la misma hora todos los días. Los programa el teléfono (no hace falta internet ni servidor).
// Cada uno tiene un "id" fijo: si se vuelve a programar con el mismo id, REEMPLAZA al anterior (nunca se duplican).
const HORARIOS = [
  { id: 'mitty-recordatorio-10', hora: 10, minuto: 0,
    texto: (n) => `${n}, ¿ya hubo algún gasto esta mañana? Anótalo ahora, toma segundos.` },
  { id: 'mitty-recordatorio-15', hora: 15, minuto: 0,
    texto: (n) => `${n}, ¿almuerzo, café o transporte? Anótalo antes de que se te pase.` },
  { id: 'mitty-recordatorio-20', hora: 20, minuto: 0,
    texto: (n) => `${n}, cierra el día: ¿quedó algún gasto sin anotar?` },
];

// Apaga los tres avisos diarios (si alguno no existía, no pasa nada)
export async function cancelarRecordatorios() {
  for (const h of HORARIOS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(h.id);
    } catch {
      // no existía: seguimos con el siguiente
    }
  }
}

// Programa los tres avisos diarios (10:00, 15:00 y 20:00, hora del teléfono). Es seguro llamarla varias veces.
export async function programarRecordatorios(nombre) {
  await cancelarRecordatorios();
  for (const h of HORARIOS) {
    await Notifications.scheduleNotificationAsync({
      identifier: h.id,
      content: { title: 'Mitty', body: h.texto(nombre) },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: h.hora,
        minute: h.minuto,
        channelId: CANAL,
      },
    });
  }
}
