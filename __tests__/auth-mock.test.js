import { mockLogin, mockRegister, mockRefresh, mockLogout } from '../services/__mocks__/auth-mock.js';

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
