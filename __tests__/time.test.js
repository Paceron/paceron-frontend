import { formatClock, formatStopwatch, pad2, parseClockToMs, toIsoUtc } from '../utils/time.js';

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

describe('parseClockToMs', () => {
  test('mm:ss → milisegundos', () => {
    expect(parseClockToMs('3:30')).toBe(210000);
    expect(parseClockToMs('0:05')).toBe(5000);
    expect(parseClockToMs('12:00')).toBe(720000);
  });

  test('hh:mm:ss → milisegundos', () => {
    expect(parseClockToMs('1:02:03')).toBe(3723000);
  });

  test('tolerante a espacios', () => {
    expect(parseClockToMs('  4:10  ')).toBe(250000);
  });

  test('inválido → null', () => {
    expect(parseClockToMs('')).toBeNull();
    expect(parseClockToMs('abc')).toBeNull();
    expect(parseClockToMs('3:aa')).toBeNull();
    expect(parseClockToMs('a:30')).toBeNull();
    expect(parseClockToMs('3:30:10:5')).toBeNull();
    expect(parseClockToMs('-1:30')).toBeNull();
  });
});

describe('formatClock', () => {
  test('mm:ss sin horas', () => {
    expect(formatClock(210000)).toBe('03:30');
    expect(formatClock(5000)).toBe('00:05');
    expect(formatClock(0)).toBe('00:00');
  });

  test('h:mm:ss cuando pasa la hora', () => {
    expect(formatClock(3723000)).toBe('1:02:03');
  });

  test('clampa negativos y NaN a cero', () => {
    expect(formatClock(-1000)).toBe('00:00');
    expect(formatClock(undefined)).toBe('00:00');
  });

  test('redondea milésimas hacia abajo (sin centésimas que el editor no edita)', () => {
    expect(formatClock(210999)).toBe('03:30');
  });
});