import { MIN_WAITING_MS, waitMinimum } from '../utils/checkin-waiting.js';

describe('piso del overlay de espera', () => {
  test('el piso es 2 segundos', () => {
    expect(MIN_WAITING_MS).toBe(2000);
  });

  // El caso que motiva el piso: request instantánea → sin espera, el GIF
  // aparecería un flash.
  test('una request que no llega a nada espera lo que falta', async () => {
    const startedAt = Date.now();
    await waitMinimum(MIN_WAITING_MS, startedAt);
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(MIN_WAITING_MS - 30);
    expect(elapsed).toBeLessThan(MIN_WAITING_MS + 400);
  });

  // Y el caso contrario, que es el que hace que sea un PISO y no un tiempo fijo:
  // una request lenta no se alarga, porque el overlay ya estuvo visible.
  test('una request que ya superó el piso no agrega espera', async () => {
    const startedAt = Date.now() - 5000;
    const before = Date.now();
    await waitMinimum(MIN_WAITING_MS, startedAt);
    expect(Date.now() - before).toBeLessThan(50);
  });

  test('exacto en el límite resuelve ya', async () => {
    const startedAt = Date.now() - MIN_WAITING_MS;
    const before = Date.now();
    await waitMinimum(MIN_WAITING_MS, startedAt);
    expect(Date.now() - before).toBeLessThan(50);
  });

  // Con un reloj que se adelanta, `remaining` da 12 s. Lo que importa es que la
  // espera NUNCA supere el piso: sin el `Math.min` de la implementación esto
  // colgaba 12 s y el corredor miraba el GIF sin poder hacer nada.
  test('un arranque en el futuro no cuelga más allá del piso', async () => {
    const startedAt = Date.now() + 10_000;
    const before = Date.now();
    await waitMinimum(MIN_WAITING_MS, startedAt);
    const elapsed = Date.now() - before;
    expect(elapsed).toBeLessThanOrEqual(MIN_WAITING_MS + 100);
  });
});
