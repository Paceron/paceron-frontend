import { isMobile } from '../utils/platform.js';

export const homeRoute = {
  name: 'index',
  label: 'Inicio',
  href: '/',
  icon: 'home',
};

// href no se usa para navegar directo: al presionar este item se abre un
// submenu (equipos + Crear equipo) en vez de ir a una pantalla propia.
export const teamsRoute = {
  name: 'teams',
  label: 'Equipos',
  href: '/teams',
  icon: 'account-group',
};

export const notificationsRoute = {
  name: 'notifications',
  label: 'Notificaciones',
  href: '/notifications',
  icon: 'bell-outline',
};

// Sin dominio de planes de entrenamiento todavía (ver FUNCTIONAL_PROPOSE.md,
// "Planificación de entrenamientos" sigue siendo un módulo reservado) — por
// ahora son pantallas "Próximamente", mismo patrón que ya usa
// TierUpgradeScreen. `role` filtra por activeRole ('runner'/'trainer'),
// nunca los dos a la vez: un corredor ve sus propios planes asignados, un
// entrenador ve los planes que arma para sus equipos — son conceptos
// distintos, no la misma pantalla con otro título.
export const myPlansRoute = {
  name: 'plans',
  label: 'Mis planes',
  href: '/plans',
  icon: 'clipboard-text-outline',
  role: 'runner',
};

export const trainingPlansRoute = {
  name: 'training-plans',
  label: 'Catálogo',
  href: '/training-plans',
  icon: 'clipboard-list-outline',
  role: 'trainer',
};

export const myCalendarRoute = {
  name: 'calendar',
  label: 'Entrenamientos',
  href: '/calendar',
  icon: 'calendar-month-outline',
  role: 'runner',
};

export const administeredCalendarRoute = {
  name: 'administered-calendar',
  label: 'Entrenamientos',
  href: '/administered-calendar',
  icon: 'calendar-month-outline',
  role: 'trainer',
};

export const attendanceRoute = {
  name: 'attendance',
  label: 'Asistencia',
  href: '/attendance',
  icon: 'clipboard-check-outline',
  role: 'trainer',
};

// Registro de asistencia por QR del corredor. `mobileOnly` y NO aparece en la
// navegación web a propósito (spec del change
// registro-asistencia-correedor, requisito 1): el escaneo por cámara en
// react-native-web no es confiable y el caso real es el teléfono. La ruta sigue
// siendo alcanzable por URL directa en web, para poder depurar — lo que cambia
// es la visibilidad del ítem de navegación, no la existencia de la ruta.
//
// El ícono va verificado contra el glyphmap de MaterialCommunityIcons
// instalado: `qrcode-scan` existe (y `qrcode-scan-helper`, que es el que uno
// escribiría por costumbre, NO).
export const checkinRoute = {
  name: 'checkin',
  label: 'Registrar asistencia',
  href: '/attendance/register',
  icon: 'qrcode-scan',
  role: 'runner',
  mobileOnly: true,
};

// Historial de pagos de cualquier usuario (y, con el rol entrenador activo,
// también sus cobros): sin `role`, va último para los dos, en todas las
// plataformas. La ruta vive bajo /profile porque se llega también desde la
// tarjeta de Mi perfil.
export const paymentsRoute = {
  name: 'payments',
  label: 'Pagos',
  href: '/profile/payments',
  icon: 'cash-multiple',
};

export const navigationRoutes = [homeRoute, teamsRoute, notificationsRoute, myPlansRoute, trainingPlansRoute, myCalendarRoute, administeredCalendarRoute, attendanceRoute, checkinRoute, paymentsRoute];

// `role` es el activeRole actual ('runner'/'trainer'/null) — no el rol
// asignado, el que se está viendo ahora mismo (ver store/auth-store.js,
// mismo criterio que canManageTeam/isTrainerView en team-detail-screen.jsx).
// Una ruta sin `role` propio se muestra siempre; una con `role` solo cuando
// coincide con el activeRole actual.
//
// `isNative` es un SEGUNDO criterio, para rutas que además son de una sola
// plataforma. Va como parámetro con default en vez de leerse de `isMobile`
// adentro por dos razones: los callers no cambian (`getRoutesByRole(role)`), y
// sobre todo los tests pueden simular web sin mockear un módulo entero — bajo
// jest-expo `Platform.OS` es siempre `ios`, así que leerlo internamente haría
// imposible testear la rama de web.
export function getRoutesByRole(role, isNative = isMobile) {
  return navigationRoutes.filter((route) => {
    if (route.role && route.role !== role) return false;
    if (route.mobileOnly && !isNative) return false;
    return true;
  });
}
