import { toISODate, formatDateInput, fromISODate } from '../utils/date-field-format.js';

describe('toISODate', () => {
  test('convierte DD/MM/YYYY (valor de DateField en cualquier plataforma) a YYYY-MM-DD', () => {
    expect(toISODate('15/03/2026')).toBe('2026-03-15');
  });

  test('deja YYYY-MM-DD sin cambios (red de seguridad para otros orígenes)', () => {
    expect(toISODate('2026-03-15')).toBe('2026-03-15');
  });

  test('devuelve string vacío si el valor es vacío o inválido', () => {
    expect(toISODate('')).toBe('');
    expect(toISODate(undefined)).toBe('');
    expect(toISODate('no es una fecha')).toBe('');
  });
});

describe('formatDateInput', () => {
  test('string vacío/null/undefined da string vacío', () => {
    expect(formatDateInput('')).toBe('');
    expect(formatDateInput(null)).toBe('');
    expect(formatDateInput(undefined)).toBe('');
  });

  test('sin barra todavía con 1-2 dígitos (día)', () => {
    expect(formatDateInput('1')).toBe('1');
    expect(formatDateInput('15')).toBe('15');
  });

  test('inserta la primera barra al llegar al mes', () => {
    expect(formatDateInput('153')).toBe('15/3');
    expect(formatDateInput('1503')).toBe('15/03');
  });

  test('inserta la segunda barra al llegar al año', () => {
    expect(formatDateInput('15032')).toBe('15/03/2');
    expect(formatDateInput('15032026')).toBe('15/03/2026');
  });

  test('corta en 8 dígitos (DDMMAAAA) — un noveno dígito no entra', () => {
    expect(formatDateInput('150320269')).toBe('15/03/2026');
  });

  test('descarta cualquier caracter que no sea dígito antes de formatear', () => {
    expect(formatDateInput('15/03/2026')).toBe('15/03/2026');
    expect(formatDateInput('15-03-2026')).toBe('15/03/2026');
  });
});

describe('fromISODate', () => {
  test('convierte el YYYY-MM-DD de la API al DD/MM/YYYY que muestra DateField', () => {
    expect(fromISODate('2026-03-15')).toBe('15/03/2026');
  });

  test('deja DD/MM/YYYY sin cambios (red de seguridad)', () => {
    expect(fromISODate('15/03/2026')).toBe('15/03/2026');
  });

  test('devuelve string vacío si el valor está vacío o no es una fecha', () => {
    expect(fromISODate('')).toBe('');
    expect(fromISODate(null)).toBe('');
    expect(fromISODate(undefined)).toBe('');
    expect(fromISODate('01-09-2026')).toBe('');
    expect(fromISODate('2026/03/15')).toBe('');
  });

  test('es el inverso exacto de toISODate para una fecha completa', () => {
    expect(toISODate(fromISODate('2026-09-01'))).toBe('2026-09-01');
    expect(fromISODate(toISODate('01/09/2026'))).toBe('01/09/2026');
  });
});
