import { getMockBankAlias } from './user-mock.js';

// Datos fake con la MISMA shape que el backend real, para desarrollar sin backend.
export async function mockLogin(email, _password) {
  return {
    user: {
      user_id: 1,
      name: 'Demo',
      surname: 'User',
      email,
      dni: '12345678',
      birth_date: '01/01/1990',
      status: 'active',
      bank_alias: null,
    },
    authorization: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
    },
  };
}

export async function mockRegister(payload) {
  return {
    user_id: 2,
    name: payload.name,
    surname: payload.surname,
    email: payload.email,
    dni: payload.dni,
    birth_date: payload.birth_date,
    status: 'active',
  };
}

export async function mockGetUser({ id, email }) {
  return {
    user_id: id ?? 1,
    name: 'Demo',
    surname: 'User',
    email: email ?? 'demo@paceron.com',
    dni: '12345678',
    birth_date: '01/01/1990',
    status: 'active',
    bank_alias: getMockBankAlias(),
    country: 'ARG',
    province: 'BA',
    city: 'La Plata',
    street: 'Av. Siempre Viva',
    number: '742',
    phone: '+54 11 1234 5678',
    phone_contact: '+54 11 8765 4321',
  };
}
