import { mockLogin, mockRegister, mockRefresh, mockLogout, mockGetUser } from '../services/__mocks__/auth-mock.js';

describe('auth mock adapter', () => {
  test('mockLogin returns login response shape', async () => {
    const res = await mockLogin('a@b.com', 'pw');
    expect(res.user).toEqual(expect.objectContaining({ email: 'a@b.com', status: 'active' }));
    expect(res.access_token).toEqual(expect.any(String));
    expect(res.refresh_token).toEqual(expect.any(String));
    expect(res.expires_in).toEqual(expect.any(Number));
  });

  test('mockRegister echoes payload without a token', async () => {
    const res = await mockRegister({ name: 'pepe', surname: 'lota', email: 'a@b.com', dni: '1', birth_date: '01/01/1988' });
    expect(res).toEqual(expect.objectContaining({ name: 'pepe', email: 'a@b.com', status: 'active' }));
    expect(res).not.toHaveProperty('access_token');
  });
});

describe('mockRefresh', () => {
  test('returns a new access/refresh token pair', async () => {
    const res = await mockRefresh('some-refresh-token');
    expect(res.access_token).toEqual(expect.any(String));
    expect(res.refresh_token).toEqual(expect.any(String));
    expect(res.expires_in).toEqual(expect.any(Number));
  });
});

describe('mockLogout', () => {
  test('returns a confirmation message', async () => {
    const res = await mockLogout('some-refresh-token');
    expect(res).toEqual(expect.objectContaining({ message: expect.any(String) }));
  });
});

describe('mockGetUser', () => {
  test('id propio (1) o sin id -> perfil completo de Demo User', async () => {
    const res = await mockGetUser({});
    expect(res).toEqual(expect.objectContaining({ user_id: 1, name: 'Demo', surname: 'User' }));
    const res2 = await mockGetUser({ id: 1 });
    expect(res2.name).toBe('Demo');
  });

  test('id de otro usuario conocido en el catálogo -> su nombre real, no Demo User', async () => {
    // Bug real, 2026-10-16: devolvía "Demo User" sin importar el id --
    // team-detail-screen.jsx usa esto para resolver el dueño de CUALQUIER
    // equipo (useUser(team.ownerId)), no solo el propio.
    const res = await mockGetUser({ id: 99 });
    expect(res.user_id).toBe(99);
    expect(res.name).not.toBe('Demo');
    expect(res.surname).not.toBe('User');
  });

  test('id desconocido -> placeholder genérico, mismo criterio que mockBatchLookupUsers', async () => {
    const res = await mockGetUser({ id: 55555 });
    expect(res.name).toBe('Corredor');
    expect(res.surname).toBe('55555');
  });
});
