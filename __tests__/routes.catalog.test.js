import { homeRoute, navigationRoutes, getRoutesByRole, teamsRoute } from '../routes/catalog.js';

describe('routes catalog', () => {
  test('exposes the home route as the first navigation route', () => {
    expect(navigationRoutes[0]).toBe(homeRoute);
  });

  test('returns home for any role', () => {
    const routes = getRoutesByRole(null);
    expect(routes).toContainEqual(homeRoute);
  });
});

describe('getRoutesByRole', () => {
  test('returns at least home for null role', () => {
    const routes = getRoutesByRole(null);
    expect(routes.length).toBeGreaterThanOrEqual(1);
    expect(routes[0]).toBe(homeRoute);
  });
});

describe('teamsRoute', () => {
  test('uses the English route key and href', () => {
    expect(teamsRoute.name).toBe('teams');
    expect(teamsRoute.href).toBe('/teams');
  });
});
