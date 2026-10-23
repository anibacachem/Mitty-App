// Guarda en el teléfono quién eres, para no pedirlo cada vez que abres la app.
// Usamos AsyncStorage: un "cajón" de texto que sobrevive al cerrar la app.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLAVE = 'mitty_sesion'; // nombre del cajón

// Guarda { codigo, nombre0, nombre1, yo }. AsyncStorage solo guarda texto, por eso JSON.stringify.
export async function guardarSesion(pareja) {
  await AsyncStorage.setItem(CLAVE, JSON.stringify(pareja));
}

// Devuelve la sesión guardada, o null si no hay (o si algo falla).
export async function leerSesion() {
  try {
    const texto = await AsyncStorage.getItem(CLAVE);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null; // si falla la lectura, tratamos como "sin sesión"
  }
}

// Borra la sesión (para "Cerrar sesión").
export async function borrarSesion() {
  await AsyncStorage.removeItem(CLAVE);
}
