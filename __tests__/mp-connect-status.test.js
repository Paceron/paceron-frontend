import { mpConnectionState } from '../utils/mp-connect-status.js';

const NOW = new Date('2026-09-29T15:00:00Z');

describe('mpConnectionState', () => {
  test('conectada, con la fecha de vencimiento', () => {
    const s = mpConnectionState({ connected: true, accountStatus: 'authorized', tokenExpiresAt: '2027-03-28T15:00:00Z' }, NOW);
    expect(s.state).toBe('connected');
    expect(s.label).toBe('Conectada');
    expect(s.detail).toBe('Sincronizada hasta el 28/03/2027');
  });

  test('conectada sin fecha registrada no inventa un vencimiento', () => {
    const s = mpConnectionState({ connected: true, accountStatus: 'authorized', tokenExpiresAt: null }, NOW);
    expect(s.state).toBe('connected');
    expect(s.detail).toBe('');
  });

  test('vencida: autorizada pero con la fecha ya pasada', () => {
    const s = mpConnectionState({ connected: false, accountStatus: 'authorized', tokenExpiresAt: '2026-09-01T12:00:00Z' }, NOW);
    expect(s.state).toBe('expired');
    expect(s.label).toBe('Vencida');
    expect(s.detail).toBe('Venció el 01/09/2026. Volvé a conectarla para seguir cobrando.');
  });

  test('no conectada: sin conexión o desautorizada desde Mercado Pago', () => {
    ['deauthorized', null].forEach((accountStatus) => {
      const s = mpConnectionState({ connected: false, accountStatus, tokenExpiresAt: null }, NOW);
      expect(s.state).toBe('disconnected');
      expect(s.label).toBe('No conectada');
      expect(s.detail).toBe('Hace falta para cobrar las cuotas de tus equipos.');
    });
  });

  test('una fecha inválida se trata como sin fecha', () => {
    expect(mpConnectionState({ connected: true, accountStatus: 'authorized', tokenExpiresAt: 'x' }, NOW).detail).toBe('');
  });
});
