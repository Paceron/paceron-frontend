import { formatClock, formatDurationInput, formatStopwatch, pad2, parseClockToMs, toIsoUtc } from '../utils/time.js';

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
describe('formatDurationInput', () => {
  test('sin dígitos → string vacío', () => {
    expect(formatDurationInput('')).toBe('');
    expect(formatDurationInput(null)).toBe('');
    expect(formatDurationInput(undefined)).toBe('');
  });

  test('1-2 dígitos todavía sin separador', () => {
    expect(formatDurationInput('3')).toBe('3');
    expect(formatDurationInput('33')).toBe('33');
  });

  test('3 dígitos → M:SS', () => {
    expect(formatDurationInput('330')).toBe('3:30');
  });

  test('4 dígitos → MM:SS', () => {
    expect(formatDurationInput('0330')).toBe('03:30');
    expect(formatDurationInput('1230')).toBe('12:30');
  });

  test('5 dígitos → H:MM:SS (minutos > 59)', () => {
    expect(formatDurationInput('13045')).toBe('1:30:45');
  });

  test('6 dígitos → HH:MM:SS', () => {
    expect(formatDurationInput('013045')).toBe('01:30:45');
  });

  test('ignora los no dígitos que llegan del input y reformatea', () => {
    expect(formatDurationInput('12a30b')).toBe('12:30');
  });

  test('idempotente: reprocesar el valor ya formateado no lo cambia', () => {
    // El campo re-formatea en cada tecla, así que el string que vuelve a
    // entrar ya trae ':' — tiene que devolver exactamente lo mismo.
    expect(formatDurationInput(formatDurationInput('330'))).toBe('3:30');
    expect(formatDurationInput(formatDurationInput('13045'))).toBe('1:30:45');
  });

  test('corta a 6 dígitos (HH:MM:SS es el máximo)', () => {
    expect(formatDurationInput('1234567')).toBe('12:34:56');
  });

  test('ida y vuelta con formatClock: lo que muestra, lo que se guarda', () => {
    expect(parseClockToMs(formatDurationInput('0330'))).toBe(210000);
    expect(parseClockToMs(formatDurationInput('13045'))).toBe(5445000);
  });
});
