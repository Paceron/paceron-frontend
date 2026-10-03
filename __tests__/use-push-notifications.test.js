import { renderHook, waitFor } from '@testing-library/react-native';

// isAndroid se calcula a import-time desde Platform.OS — se mockea el
// módulo completo en vez de Platform, es el punto de entrada real que usa
// el hook.
jest.mock('../utils/platform.js', () => ({ isAndroid: true }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('../store/auth-store.js', () => ({ useAuthStore: (selector) => selector({ userId: 1 }) }));
jest.mock('../services/notifications.js', () => ({ registerPushToken: jest.fn() }));
// ESM puro, Jest no lo transforma por default — no hace falta para este test
// (el Toast de foreground es comportamiento existente, no lo que se cubre acá).
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));

const mockGetLastNotificationResponseAsync = jest.fn();
const mockClearLastNotificationResponseAsync = jest.fn();
const mockAddNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
const mockAddNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'tok' })),
  getLastNotificationResponseAsync: (...args) => mockGetLastNotificationResponseAsync(...args),
  clearLastNotificationResponseAsync: (...args) => mockClearLastNotificationResponseAsync(...args),
  addNotificationReceivedListener: (...args) => mockAddNotificationReceivedListener(...args),
  addNotificationResponseReceivedListener: (...args) => mockAddNotificationResponseReceivedListener(...args),
}));

jest.mock('expo-constants', () => ({
  executionEnvironment: 'standalone', // no Expo Go, para que el hook corra entero
  expoConfig: { extra: { eas: { projectId: 'test-project' } } },
}));

// Import diferido: el mock de expo-notifications tiene que estar armado
// antes de que el módulo del hook corra su `if (isAndroid) { setNotificationHandler(...) }`
// de nivel de módulo.
const { usePushNotifications } = require('../hooks/use-push-notifications.js');

function lastResponseWithRoute(route) {
  return { notification: { request: { identifier: 'n1', content: { data: route ? { route } : {} } } } };
}

describe('usePushNotifications — tap con la app cerrada (cold start)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGetLastNotificationResponseAsync.mockReset();
    mockClearLastNotificationResponseAsync.mockClear();
  });

  // Regresión: antes de este fix, un tap con la app cerrada se perdía
  // (el listener en vivo no llega a suscribirse a tiempo) y el usuario
  // terminaba en la ruta inicial (Home) en vez de en data.route.
  test('navega a data.route de la última respuesta ya pendiente al montar', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(lastResponseWithRoute('/notifications'));

    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/notifications'));
  });

  // Sin este clear, CUALQUIER apertura futura de la app (no solo la causada
  // por el tap) repetiría la navegación a esa misma ruta vieja para siempre.
  test('limpia la respuesta después de navegar, para no reprocesarla en la próxima apertura', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(lastResponseWithRoute('/notifications'));

    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockClearLastNotificationResponseAsync).toHaveBeenCalled());
  });

  test('sin respuesta pendiente, no navega ni limpia', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(null);

    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockGetLastNotificationResponseAsync).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockClearLastNotificationResponseAsync).not.toHaveBeenCalled();
  });

  test('con respuesta pero sin route, no navega, igual limpia (no la deja repitiéndose)', async () => {
    mockGetLastNotificationResponseAsync.mockResolvedValue(lastResponseWithRoute(undefined));

    renderHook(() => usePushNotifications());

    await waitFor(() => expect(mockClearLastNotificationResponseAsync).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('un error de getLastNotificationResponseAsync (ej. UnavailabilityError) no rompe el hook', async () => {
    mockGetLastNotificationResponseAsync.mockRejectedValue(new Error('unavailable'));

    expect(() => renderHook(() => usePushNotifications())).not.toThrow();
    await waitFor(() => expect(mockGetLastNotificationResponseAsync).toHaveBeenCalled());
  });
});
