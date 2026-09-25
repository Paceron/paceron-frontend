import { formatStopwatch, pad2, toIsoUtc } from '../utils/time.js';

describe('pad2', () => {
  test('agrega cero a un dígito', () => {
    expect(pad2(5)).toBe('05');
  });

  test('deja pasar dos dígitos', () => {
    expect(pad2(42)).toBe('42');
  });

  test('no corta valores de tres dígitos', () => {
    expect(pad2(123)).toBe('123');
  });
});

describe('formatStopwatch', () => {
  test('cero', () => {
    expect(formatStopwatch(0)).toBe('00:00:00');
  });

  test('milésimas que no llegan a segundo', () => {
    expect(formatStopwatch(50)).toBe('00:00:05');
    expect(formatStopwatch(950)).toBe('00:00:95');
  });

  test('un minuto con un segundo y pico', () => {
    expect(formatStopwatch(61050)).toBe('01:01:05');
  });

  test('valores con centésimas altas', () => {
    expect(formatStopwatch(599999)).toBe('09:59:99');
  });

  test('minutos de tres dígitos', () => {
    expect(formatStopwatch(61 * 60000)).toBe('61:00:00');
  });
});

describe('toIsoUtc', () => {
  test('serializa como ISO 8601 UTC', () => {
    const iso = toIsoUtc(new Date('2026-09-24T10:00:00.000Z'));
    expect(iso).toBe('2026-09-24T10:00:00.000Z');
  });
});