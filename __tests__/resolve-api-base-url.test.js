import { resolveApiBaseUrl } from '../utils/resolve-api-base-url.js';

describe('resolveApiBaseUrl', () => {
  test('redirige loopback de Android Emulator al host Mac', () => {
    expect(resolveApiBaseUrl('http://localhost:8080/api/v1', 'android'))
      .toBe('http://10.0.2.2:8080/api/v1');
    expect(resolveApiBaseUrl('http://127.0.0.1:8080/api/v1', 'android'))
      .toBe('http://10.0.2.2:8080/api/v1');
  });

  test('no modifica una URL explícita ni direcciones fuera del emulador Android', () => {
    expect(resolveApiBaseUrl('http://192.168.1.10:8080/api/v1', 'android'))
      .toBe('http://192.168.1.10:8080/api/v1');
    expect(resolveApiBaseUrl('http://localhost:8080/api/v1', 'ios'))
      .toBe('http://localhost:8080/api/v1');
    expect(resolveApiBaseUrl('http://localhost:8080/api/v1', 'web'))
      .toBe('http://localhost:8080/api/v1');
  });
});
