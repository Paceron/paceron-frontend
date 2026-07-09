import { useEffect } from 'react';
import { Platform } from 'react-native';
import { colorScheme, useColorScheme } from 'nativewind';

const STORAGE_KEY = 'paceron-theme-mode';
const isWeb = Platform.OS === 'web';

// Default oscuro. En web se respeta una elección explícita de 'light' guardada;
// sin preferencia guardada (o en native) arranca en 'dark'.
function readInitialThemeMode() {
  if (isWeb && typeof window !== 'undefined') {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  }
  return 'dark';
}

function applyWebClass(mode) {
  if (isWeb && typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }
}

// Provider SIN suscripción al color scheme: solo fija el scheme inicial una vez
// con la API imperativa `colorScheme.set()`. Al no llamar `useColorScheme()`,
// el provider no re-renderiza en cada toggle, y por lo tanto no re-renderiza el
// árbol de navegación (evita "Couldn't find a navigation context" en native).
export function ThemeProvider({ children }) {
  useEffect(() => {
    const initial = readInitialThemeMode();
    colorScheme.set(initial);
    applyWebClass(initial);
  }, []);

  return children;
}

export function useThemeMode() {
  const { colorScheme: scheme } = useColorScheme();
  const themeMode = scheme === 'light' ? 'light' : 'dark';

  const setThemeMode = (mode) => {
    colorScheme.set(mode);
    applyWebClass(mode);
  };

  const toggleThemeMode = () => setThemeMode(themeMode === 'dark' ? 'light' : 'dark');

  return { colorScheme: themeMode, themeMode, setThemeMode, toggleThemeMode };
}
