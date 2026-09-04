import { useEffect } from 'react';
import { Platform } from 'react-native';
import { colorScheme, useColorScheme } from 'nativewind';
import * as SystemUI from 'expo-system-ui';
import { getItem, setItem } from '../services/storage.js';

const STORAGE_KEY = 'paceron-theme-mode';
const isWeb = Platform.OS === 'web';

// Mismos colores que app/_layout.jsx's Stack contentStyle — deben coincidir
// para que no haya discontinuidad entre el root view y el contenido de cada
// screen durante una transición.
const BACKGROUND_BY_MODE = { dark: '#0d1013', light: '#f8fafc' };

// Default oscuro. En web se respeta una elección explícita guardada en
// localStorage (síncrono, sin cambio de comportamiento). En nativo ahora
// también se respeta una elección guardada, vía services/storage.js
// (expo-secure-store) — antes siempre arrancaba en 'dark' sin leer nada,
// perdiendo la elección en cada reinicio de la app. La lectura nativa es
// async: puede haber un flash muy breve del tema default mientras resuelve
// — aceptado, mismo tipo de flash que casi cualquier app nativa tiene al
// hidratar una preferencia persistida, no amerita sumar una dependencia
// nueva (@react-native-async-storage/async-storage) solo para evitar eso.
async function readInitialThemeMode() {
  if (isWeb) {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  }
  const stored = await getItem(STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function applyWebClass(mode) {
  if (isWeb && typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
}

// Pinta el "root view" nativo de Android (por debajo de React Navigation).
// Sin esto, el fondo por defecto (blanco) se ve brevemente a través del
// hueco que se abre durante una transición de Stack con slide horizontal —
// el contentStyle del Stack por sí solo no lo cubre.
function applyNativeRootBackground(mode) {
  if (!isWeb) {
    SystemUI.setBackgroundColorAsync(BACKGROUND_BY_MODE[mode]);
  }
}

// Persiste en nativo — expo-secure-store, no localStorage (eso ya lo cubre
// applyWebClass del lado web). El dato no es sensible; se reusa
// services/storage.js porque ya es el único storage nativo disponible en
// el repo hoy.
function persistNative(mode) {
  if (!isWeb) setItem(STORAGE_KEY, mode);
}

// Aplica el tema predeterminado sincronizado (Settings) — pero SOLO si este
// dispositivo todavía no tiene ningún valor propio guardado. Se llama desde
// auth-store tras login/hydrate, nunca desde el toggle rápido (ese sigue
// siendo 100% local, ver theme-toggle.jsx). Una vez aplicado acá, el
// dispositivo ya tiene su propio valor persistido — un cambio posterior del
// default desde otro dispositivo no vuelve a pisarlo.
export async function seedDefaultTheme(defaultTheme) {
  if (!defaultTheme) return;
  const mode = defaultTheme === 'light' ? 'light' : 'dark';

  if (isWeb) {
    if (typeof window === 'undefined' || window.localStorage.getItem(STORAGE_KEY)) return;
    colorScheme.set(mode);
    applyWebClass(mode);
    applyNativeRootBackground(mode);
    return;
  }

  const existing = await getItem(STORAGE_KEY);
  if (existing) return;
  colorScheme.set(mode);
  applyNativeRootBackground(mode);
  persistNative(mode);
}

// Provider SIN suscripción al color scheme: solo fija el scheme inicial una vez
// con la API imperativa `colorScheme.set()`. Al no llamar `useColorScheme()`,
// el provider no re-renderiza en cada toggle, y por lo tanto no re-renderiza el
// árbol de navegación (evita "Couldn't find a navigation context" en native).
export function ThemeProvider({ children }) {
  useEffect(() => {
    readInitialThemeMode().then((initial) => {
      colorScheme.set(initial);
      applyWebClass(initial);
      applyNativeRootBackground(initial);
    });
  }, []);

  return children;
}

export function useThemeMode() {
  const { colorScheme: scheme } = useColorScheme();
  const themeMode = scheme === 'light' ? 'light' : 'dark';

  const setThemeMode = (mode) => {
    colorScheme.set(mode);
    applyWebClass(mode);
    applyNativeRootBackground(mode);
    persistNative(mode);
  };

  const toggleThemeMode = () => setThemeMode(themeMode === 'dark' ? 'light' : 'dark');

  return { colorScheme: themeMode, themeMode, setThemeMode, toggleThemeMode };
}
