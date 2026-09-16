import {
  mockCompleteMpConnect,
  mockGetMpConnectAuthUrl,
  mockGetMpConnectStatus,
  resetMpConnectMock,
} from '../services/__mocks__/mp-connect-mock.js';

describe('mp-connect mock', () => {
  beforeEach(() => {
    resetMpConnectMock();
  });

  it('arranca desconectado', async () => {
    const status = await mockGetMpConnectStatus();
    expect(status.connected).toBe(false);
    expect(status.account_status).toBe('deauthorized');
  });

  it('queda conectado tras completar la autorización', async () => {
    mockCompleteMpConnect();
    const status = await mockGetMpConnectStatus();
    expect(status.connected).toBe(true);
    expect(status.account_status).toBe('authorized');
  });

  it('resetMpConnectMock vuelve al estado inicial', async () => {
    mockCompleteMpConnect();
    resetMpConnectMock();
    expect((await mockGetMpConnectStatus()).connected).toBe(false);
  });

  // El target va en el tercer segmento del state: es lo que el backend real
  // usa para decidir a dónde redirige el navegador después del callback.
  it.each(['web', 'app'])('codifica el target %s en el state', async (platform) => {
    const { auth_url: authUrl, state } = await mockGetMpConnectAuthUrl(platform);
    expect(state.split('-')).toHaveLength(3);
    expect(state.endsWith(`-${platform}`)).toBe(true);
    expect(authUrl).toContain(state);
  });
});
