import { toUserModel, toRegisterPayload } from '../services/normalizers.js';

describe('toUserModel', () => {
  test('maps snake_case fields to camelCase', () => {
    const dto = {
      user_id: 3, name: 'pepe', surname: 'lota', email: 'pepa@lota.com',
      dni: '33703637', birth_date: '01/01/1988', status: 'active', phone_contact: '111',
    };
    expect(toUserModel(dto)).toEqual(
      expect.objectContaining({
        userId: 3, name: 'pepe', surname: 'lota', email: 'pepa@lota.com',
        dni: '33703637', birthDate: '01/01/1988', status: 'active', phoneContact: '111',
      }),
    );
  });

  test('returns null for falsy dto', () => {
    expect(toUserModel(null)).toBeNull();
    expect(toUserModel(undefined)).toBeNull();
  });

  test('tolerates absent fields (sparse response)', () => {
    const dto = { user_id: 3, name: 'pepe', email: 'a@b.com' };
    const model = toUserModel(dto);
    expect(model.userId).toBe(3);
    expect(model.city).toBeUndefined();
    expect(model.street).toBeUndefined();
  });
});

describe('toRegisterPayload', () => {
  const base = {
    firstName: 'pepe', lastName: 'lota', email: 'a@b.com',
    password: 'secret123', dni: '33703637',
  };

  test('maps required fields to snake_case', () => {
    const out = toRegisterPayload({ ...base, birthDate: '01/01/1988' });
    expect(out).toEqual({
      name: 'pepe', surname: 'lota', email: 'a@b.com',
      password: 'secret123', dni: '33703637', birth_date: '01/01/1988',
    });
  });

  test('converts ISO birthDate (web input) to DD/MM/YYYY', () => {
    const out = toRegisterPayload({ ...base, birthDate: '1988-01-01' });
    expect(out.birth_date).toBe('01/01/1988');
  });

  test('includes only non-empty optional fields', () => {
    const out = toRegisterPayload({
      ...base, birthDate: '01/01/1988',
      country: 'AR', province: '', city: '  ', phoneContact: '111',
    });
    expect(out.country).toBe('AR');
    expect(out.phone_contact).toBe('111');
    expect(out).not.toHaveProperty('province');
    expect(out).not.toHaveProperty('city');
  });
});
