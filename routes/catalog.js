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

export const navigationRoutes = [homeRoute, teamsRoute];

export function getRoutesByRole(role) {
  // A medida que se agreguen modulos, filtrar por rol aca.
  return navigationRoutes;
}
