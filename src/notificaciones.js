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
