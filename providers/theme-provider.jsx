import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useColorScheme } from 'nativewind';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'paceron-theme-mode';
const isWeb = Platform.OS === 'web';

// Default oscuro. En web se respeta una elección explícita de 'light' guardada;
// sin preferencia guardada (o en native) arranca en 'dark'.
function readInitialThemeMode() {
  if (!isWeb || typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(readInitialThemeMode);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(themeMode);
    if (isWeb && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, themeMode);
      document.documentElement.classList.toggle('dark', themeMode === 'dark');
    }
  }, [themeMode, setColorScheme]);

  const toggleThemeMode = () => {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme: themeMode,
        themeMode,
        setThemeMode,
        toggleThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeMode must be used within ThemeProvider');
  return context;
}
