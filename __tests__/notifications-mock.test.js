import { mockRegisterPushToken } from '../services/__mocks__/notifications-mock.js';

describe('mockRegisterPushToken', () => {
  test('registra un token válido', async () => {
    const result = await mockRegisterPushToken('ExponentPushToken[abc]', 'android');
    expect(result).toEqual({ message: 'Token registrado correctamente.' });
  });

  test('rechaza si falta el token', async () => {
    await expect(mockRegisterPushToken(null, 'android')).rejects.toMatchObject({ status: 400 });
  });

  test('rechaza si falta la plataforma', async () => {
    await expect(mockRegisterPushToken('ExponentPushToken[abc]', null)).rejects.toMatchObject({ status: 400 });
  });
});
