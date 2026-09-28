import { homeRoute, navigationRoutes, getRoutesByRole, teamsRoute, notificationsRoute, myPlansRoute, trainingPlansRoute, attendanceRoute } from '../routes/catalog.js';

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

  test('excludes role-gated routes (Mis planes / Planes de entrenamiento) when there is no active role', () => {
    const routes = getRoutesByRole(null);
    expect(routes).not.toContainEqual(myPlansRoute);
    expect(routes).not.toContainEqual(trainingPlansRoute);
  });

  test('shows "Mis planes" for runner, not "Planes de entrenamiento"', () => {
    const routes = getRoutesByRole('runner');
    expect(routes).toContainEqual(myPlansRoute);
    expect(routes).not.toContainEqual(trainingPlansRoute);
  });

  test('shows "Planes de entrenamiento" for trainer, not "Mis planes"', () => {
    const routes = getRoutesByRole('trainer');
    expect(routes).toContainEqual(trainingPlansRoute);
    expect(routes).not.toContainEqual(myPlansRoute);
  });

  test('routes without a role restriction (home, teams, notifications) show for every role', () => {
    ['runner', 'trainer', null].forEach((role) => {
      const routes = getRoutesByRole(role);
      expect(routes).toContainEqual(homeRoute);
      expect(routes).toContainEqual(teamsRoute);
      expect(routes).toContainEqual(notificationsRoute);
    });
  });
});

describe('teamsRoute', () => {
  test('uses the English route key and href', () => {
    expect(teamsRoute.name).toBe('teams');
    expect(teamsRoute.href).toBe('/teams');
  });
});

describe('notificationsRoute', () => {
  test('uses the English route key and href', () => {
    expect(notificationsRoute.name).toBe('notifications');
    expect(notificationsRoute.href).toBe('/notifications');
  });
});

describe('myPlansRoute', () => {
  test('is scoped to the runner role', () => {
    expect(myPlansRoute.name).toBe('plans');
    expect(myPlansRoute.href).toBe('/plans');
    expect(myPlansRoute.role).toBe('runner');
  });
});

describe('trainingPlansRoute', () => {
  test('is scoped to the trainer role', () => {
    expect(trainingPlansRoute.name).toBe('training-plans');
    expect(trainingPlansRoute.href).toBe('/training-plans');
    expect(trainingPlansRoute.role).toBe('trainer');
  });
});

describe('attendanceRoute', () => {
  test('is scoped to the trainer role', () => {
    expect(attendanceRoute.name).toBe('attendance');
    expect(attendanceRoute.href).toBe('/attendance');
    expect(attendanceRoute.icon).toBe('clipboard-check-outline');
    expect(attendanceRoute.role).toBe('trainer');
  });

  test('shows for trainer, not for runner', () => {
    expect(getRoutesByRole('trainer')).toContainEqual(attendanceRoute);
    expect(getRoutesByRole('runner')).not.toContainEqual(attendanceRoute);
  });

  test('is excluded when there is no active role', () => {
    expect(getRoutesByRole(null)).not.toContainEqual(attendanceRoute);
  });
});
