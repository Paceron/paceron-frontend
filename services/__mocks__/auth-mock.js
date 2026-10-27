import { getMockBankAlias, __lookupCatalogUser } from './user-mock.js';

// Dos cuentas demo, y la diferencia importa: la de arriba es la dueña de los
// equipos 1/4 (id 1) y la de abajo es una CORREDORA del equipo 4 (id 101, Lucía,
// miembro del roster en teams-mock) que NO es dueña de nada. Sin la segunda no
// había forma de ver en el preview lo que ve un corredor de verdad: con la cuenta
// dueña, el backend simulado recorta el scope a "todo el equipo" (porque el
// llamador ES dueño) aunque `activeRole` sea 'runner', así que la pantalla de
// rendimiento mostraba la variante del corredor con los datos de todos.
//
// Elegir el email es lo que elige la cuenta: cualquier otro email sigue siendo la
// cuenta demo de siempre (id 1), que es la que usan los demás flujos. El nombre y
// el apellido no se repiten acá: salen del mismo catálogo del que los saca el
// roster (user-mock.js), así no hay dos lugares que se puedan desincronizar.
const RUNNER_DEMO = {
  email: 'corredor@paceron.com',
  user_id: 101,
};

export async function mockLogin(email, _password) {
  const isRunnerDemo = String(email ?? '').trim().toLowerCase() === RUNNER_DEMO.email;
  const runnerDemoUser = isRunnerDemo ? __lookupCatalogUser(RUNNER_DEMO.user_id) : null;
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    user: {
      user_id: isRunnerDemo ? RUNNER_DEMO.user_id : 1,
      name: runnerDemoUser?.name ?? 'Demo',
      surname: runnerDemoUser?.surname ?? 'User',
      email,
      dni: isRunnerDemo ? '30111222' : '12345678',
      birth_date: isRunnerDemo ? '14/03/1990' : '01/01/1990',
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
