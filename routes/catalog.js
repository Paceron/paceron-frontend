export const homeRoute = {
  name: 'index',
  label: 'Inicio',
  href: '/',
  icon: 'home',
};

export const navigationRoutes = [homeRoute];

export function getRoutesByRole(role) {
  // A medida que se agreguen modulos, filtrar por rol aca.
  return navigationRoutes;
}
