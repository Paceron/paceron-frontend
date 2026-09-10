import { Redirect } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';

// Mismo patrón que components/guards/platform-gate.jsx#MobileOnlyRoute.
// Redirige a la landing si la sesión se cierra estando en una pantalla que
// la requiere (ej. logout mientras se está creando un equipo) — sin esto,
// la pantalla se queda montada mostrando datos de una sesión que ya no
// existe. Lee userId de la sesión (Zustand), no el perfil de Query — el
// perfil puede estar en loading sin que eso signifique "sin sesión".
export function RequireAuth({ children, redirectHref = '/' }) {
  const userId = useAuthStore((s) => s.userId);
  if (!userId) {
    return <Redirect href={redirectHref} />;
  }

  return <>{children}</>;
}
