import { getMockBankAlias, __lookupCatalogUser } from './user-mock.js';

// Datos fake con la MISMA shape que el backend real, para desarrollar sin backend.
export async function mockLogin(email, _password) {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
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

// Bug real encontrado 2026-10-16: devolvía "Demo User" sin importar qué
// `id` se pidiera -- correcto para "mi propio perfil" (id 1, el único uso
// original), pero useUser(team.ownerId) en team-detail-screen.jsx también
// pasa por acá para resolver el dueño de OTRO equipo -- con un id != 1
// mostraba al propio demo como "Entrenador a cargo" de un equipo ajeno
// (team 5, owner_id 99). Para cualquier id != 1 resuelve contra el mismo
// catálogo que ya usa el roster (__lookupCatalogUser, user-mock.js), con
// el mismo placeholder genérico de mockBatchLookupUsers si tampoco está
// ahí -- nunca el hardcode de Demo/User.
export async function mockGetUser({ id, email }) {
  const resolvedId = id ?? 1;
  if (resolvedId !== 1) {
    const known = __lookupCatalogUser(resolvedId);
    return {
      user_id: resolvedId,
      name: known?.name ?? 'Corredor',
      surname: known?.surname ?? String(resolvedId),
      email: known?.email ?? email ?? `corredor${resolvedId}@mail.com`,
      status: 'active',
    };
  }
  return {
    user_id: 1,
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

export async function mockRefresh(_refreshToken) {
  return {
    access_token: 'mock-access-token-refreshed',
    refresh_token: 'mock-refresh-token-refreshed',
    expires_in: 3600,
  };
}

export async function mockLogout(_refreshToken) {
  return { message: 'Sesión cerrada.' };
}
