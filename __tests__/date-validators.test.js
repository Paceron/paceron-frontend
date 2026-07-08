import { validateBirthDate } from '../utils/date-validators.js';

describe('validateBirthDate', () => {
  test('accepts DD/MM/YYYY (mobile input)', () => {
    expect(validateBirthDate('01/01/1988')).toBeNull();
  });

  test('accepts YYYY-MM-DD (web date input)', () => {
    expect(validateBirthDate('1988-01-01')).toBeNull();
  });

  test('rejects empty', () => {
    expect(validateBirthDate('')).toBe('La fecha de nacimiento es requerida.');
  });

  test('rejects malformed', () => {
    expect(validateBirthDate('01-1988')).toBe('Formato inválido. Usá DD/MM/AAAA.');
  });

  test('rejects impossible day', () => {
    expect(validateBirthDate('31/02/1988')).toBe('El día no es válido para ese mes.');
  });

  test('rejects future date', () => {
    expect(validateBirthDate('01/01/3000')).toBe('La fecha debe ser en el pasado.');
  });
});
