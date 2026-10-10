import { Redirect } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';

// Mismo patrón que RequireAuth/MobileOnlyRoute -- acá para rutas cuyo
// contenido es de gestión exclusiva de un rol (ej. GroupCalendarDayScreen,
// que edita/borra el día de un grupo) pero cuya URL puede llegar igual
// desde una ruta COMPARTIDA entre roles (ej. el banner "Próximo
// entrenamiento" de Home, que se muestra tanto a entrenador como a
// corredor). Sin este guard, cualquier usuario autenticado que llegara a
// esa URL (por el banner, un deep link, o escribiéndola a mano) veía la UI
// de gestión completa -- bug real reportado, 2026-10-08, "gravísimo": un
// corredor terminaba en la pantalla de edición del día con botones de
// guardar/cancelar/vaciar que son exclusivos del entrenador. Filtrar solo
// en el call site (ej. a qué ruta navega el banner) no alcanza -- la URL
// sigue siendo alcanzable igual, este guard es la defensa real.
export function RequireRole({ role, children, redirectHref = '/' }) {
  const activeRole = useAuthStore((s) => s.activeRole);
  if (activeRole !== role) {
    return <Redirect href={redirectHref} />;
  }

  return <>{children}</>;
}
