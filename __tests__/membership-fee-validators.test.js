import { validateMembershipFee } from '../utils/membership-fee-validators.js';

describe('validateMembershipFee', () => {
  const MINIMUM = 20000;

  test('el campo es opcional: vacío, null y undefined son válidos', () => {
    expect(validateMembershipFee('', MINIMUM)).toBeNull();
    expect(validateMembershipFee('   ', MINIMUM)).toBeNull();
    expect(validateMembershipFee(null, MINIMUM)).toBeNull();
    expect(validateMembershipFee(undefined, MINIMUM)).toBeNull();
  });

  // 0 es un valor con significado (equipo gratis), no un campo sin llenar —
  // nunca tiene que chocar contra el mínimo.
  test('0 es válido y no se compara contra el mínimo', () => {
    expect(validateMembershipFee(0, MINIMUM)).toBeNull();
    expect(validateMembershipFee('0', MINIMUM)).toBeNull();
  });

  test('rechaza texto que no es un número', () => {
    expect(validateMembershipFee('abc', MINIMUM)).toBe('Ingresá un monto válido.');
  });

  test('rechaza montos negativos', () => {
    expect(validateMembershipFee(-1, MINIMUM)).toBe('La cuota no puede ser negativa.');
  });

  test('rechaza un monto por debajo del mínimo, nombrando el mínimo', () => {
    const error = validateMembershipFee(5000, MINIMUM);
    expect(error).toContain('20.000');
  });

  test('acepta el mínimo exacto y cualquier monto mayor', () => {
    expect(validateMembershipFee(MINIMUM, MINIMUM)).toBeNull();
    expect(validateMembershipFee(MINIMUM + 1, MINIMUM)).toBeNull();
  });

  // GET /team-configuration puede no haber resuelto todavía. Bloquear el form
  // por un dato que no cargó sería peor que dejar que el backend valide: el
  // entrenador no puede hacer nada para desbloquearse.
  test('sin mínimo conocido no valida contra el piso', () => {
    expect(validateMembershipFee(1, null)).toBeNull();
    expect(validateMembershipFee(1, undefined)).toBeNull();
    expect(validateMembershipFee(1, 0)).toBeNull();
  });
});
