import { getUserInitials } from '../utils/user-initials.js';

describe('getUserInitials', () => {
  test('objeto {name, surname} -> iniciales de cada uno', () => {
    expect(getUserInitials({ name: 'Lucía', surname: 'Fernández' })).toBe('LF');
  });

  test('objeto sin surname -> solo la inicial del nombre', () => {
    expect(getUserInitials({ name: 'Lucía' })).toBe('L');
  });

  test('string de nombre completo -> primera letra de las dos primeras palabras', () => {
    expect(getUserInitials('Lucía Fernández')).toBe('LF');
  });

  test('string de una sola palabra -> solo esa inicial', () => {
    expect(getUserInitials('Lucía')).toBe('L');
  });

  test('string con espacios extra -> ignora espacios de más', () => {
    expect(getUserInitials('  Lucía   Fernández  ')).toBe('LF');
  });

  test('sin valor -> string vacío, sin tirar', () => {
    expect(getUserInitials(null)).toBe('');
    expect(getUserInitials(undefined)).toBe('');
  });
});
