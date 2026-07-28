import { validateOtpCode } from '../utils/otp-validators.js';

describe('validateOtpCode', () => {
  test('accepts a 6-digit code', () => {
    expect(validateOtpCode('123456')).toBeNull();
  });

  test('rejects empty', () => {
    expect(validateOtpCode('')).toBe('El código es requerido.');
  });

  test('rejects fewer than 6 digits', () => {
    expect(validateOtpCode('12345')).toBe('El código debe tener 6 dígitos.');
  });

  test('rejects more than 6 digits', () => {
    expect(validateOtpCode('1234567')).toBe('El código debe tener 6 dígitos.');
  });

  test('rejects non-numeric characters', () => {
    expect(validateOtpCode('12a456')).toBe('El código debe tener 6 dígitos.');
  });
});
