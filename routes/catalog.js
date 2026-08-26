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

export const invitationsRoute = {
  name: 'invitations',
  label: 'Invitaciones',
  href: '/invitations',
  icon: 'email-outline',
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
  label: 'Planes de entrenamiento',
  href: '/training-plans',
  icon: 'clipboard-list-outline',
  role: 'trainer',
};

export const navigationRoutes = [homeRoute, teamsRoute, invitationsRoute, myPlansRoute, trainingPlansRoute];

// `role` es el activeRole actual ('runner'/'trainer'/null) — no el rol
// asignado, el que se está viendo ahora mismo (ver store/auth-store.js,
// mismo criterio que canManageTeam/isTrainerView en team-detail-screen.jsx).
// Una ruta sin `role` propio se muestra siempre; una con `role` solo cuando
// coincide con el activeRole actual.
export function getRoutesByRole(role) {
  return navigationRoutes.filter((route) => !route.role || route.role === role);
}
