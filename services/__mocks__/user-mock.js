// Estado in-memory para simular persistencia del alias entre updateUser y
// getUser durante una sesión mock — igual que roles-mock.js con
// mockAssignedRoles, necesario para probar de punta a punta el flujo de
// baja/reactivación de entrenador con EXPO_PUBLIC_USE_MOCKS=true (sin esto,
// refreshUser() pisaría el alias recién guardado con el null fijo de
// mockGetUser).
let mockBankAlias = null;

export function getMockBankAlias() {
  return mockBankAlias;
}

// Mock del update: devuelve el usuario con los cambios aplicados (shape UserUpdateResponse).
export async function mockUpdateUser(id, payload) {
  if ('bank_alias' in payload) mockBankAlias = payload.bank_alias;
  return {
    user_id: id,
    status: 'active',
    ...payload,
  };
}

// Mock del cambio de status: devuelve el usuario con el nuevo status (shape UserUpdateResponse).
export async function mockChangeStatus(id, status) {
  return {
    user_id: id,
    name: 'Demo',
    surname: 'User',
    email: 'demo@paceron.com',
    status,
  };
}

// Catálogo fijo chico para probar el autocomplete con EXPO_PUBLIC_USE_MOCKS=true
// — coincidencia parcial case-insensitive por nombre, apellido o email,
// mismo criterio que documenta el backend real (mínimo 3 caracteres, hasta
// 5 resultados).
//
// user_id 1 (Demo User) y 99 -- sumados 2026-10-16. Bug real encontrado:
// sin la entrada de 1 acá, cualquier resolución de nombre que pasara por
// este catálogo (roster de team 5, participantes de competencia) caía al
// placeholder genérico "Corredor 1" para la propia cuenta demo, en vez de
// mostrar "Demo User" -- el usuario lo leyó como "no estoy en el roster"
// cuando en realidad sí estaba, solo mal etiquetado. user_id 99 es el
// owner_id real de teams 2/3/5 (services/__mocks__/teams-mock.js) --
// sin esto, mockGetUser (auth-mock.js, ver __lookupCatalogUser) no tenía
// de dónde sacar su nombre y devolvía "Demo User" para CUALQUIER id
// pedido, haciendo que "Entrenador a cargo" de team 5 mostrara
// incorrectamente al propio demo en vez del dueño real.
const SEARCH_CATALOG = [
  { user_id: 1, name: 'Demo', surname: 'User', email: 'demo@paceron.com' },
  { user_id: 99, name: 'Carla', surname: 'Suárez', email: 'carla.suarez@mail.com' },
  { user_id: 101, name: 'Lucía', surname: 'Fernández', email: 'lucia.fernandez@mail.com' },
  { user_id: 102, name: 'Martín', surname: 'Gómez', email: 'martin.gomez@mail.com' },
  { user_id: 103, name: 'Sofía', surname: 'Rodríguez', email: 'sofia.rodriguez@mail.com' },
  { user_id: 104, name: 'Nicolás', surname: 'López', email: 'nicolas.lopez@mail.com' },
  { user_id: 105, name: 'Valentina', surname: 'Díaz', email: 'valentina.diaz@mail.com' },
  { user_id: 106, name: 'Tomás', surname: 'Martínez', email: 'tomas.martinez@mail.com' },
];

// Usado por mockGetUser (auth-mock.js) para resolver el perfil de OTRO
// usuario (ej. el dueño de un equipo que no es el propio demo) contra el
// mismo catálogo que ya resuelve el roster -- sin esto mockGetUser
// hardcodeaba "Demo User" sin importar qué id se pidiera.
export function __lookupCatalogUser(id) {
  return SEARCH_CATALOG.find((u) => u.user_id === Number(id)) ?? null;
}

export async function mockSearchUsers(query) {
  const q = (query ?? '').trim().toLowerCase();
  if (q.length < 3) return { results: [] };
  const results = SEARCH_CATALOG.filter((u) => (
    u.name.toLowerCase().includes(q) || u.surname.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  )).slice(0, 5);
  return { results };
}

// Devuelve un resultado por cada id pedido — si coincide con alguien del
// catálogo de arriba usa esos datos, si no arma un placeholder genérico
// (los ids de roster mock no necesariamente coinciden con SEARCH_CATALOG).
export async function mockBatchLookupUsers(ids) {
  const results = ids.map((id) => {
    const known = SEARCH_CATALOG.find((u) => u.user_id === Number(id));
    if (known) return known;
    return { user_id: Number(id), name: 'Corredor', surname: String(id), email: `corredor${id}@mail.com` };
  });
  return { results };
}

// Contraseña "actual" simulada para probar el flujo de cambio de contraseña
// con EXPO_PUBLIC_USE_MOCKS=true, ya que no hay backend real detrás para
// verificarla de verdad.
const MOCK_CURRENT_PASSWORD = 'password123';

// Simula la verificación de user.ChangePasswordRequest del backend real —
// error con .status análogo a services/api.js para que el caller (mock o
// real) maneje el error de la misma forma.
export async function mockChangePassword(id, { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword }) {
  if (currentPassword !== MOCK_CURRENT_PASSWORD) {
    const error = new Error('La contraseña actual es incorrecta.');
    error.status = 401;
    throw error;
  }
  if (newPassword !== confirmPassword) {
    const error = new Error('Las contraseñas no coinciden.');
    error.status = 400;
    throw error;
  }
  return { message: 'Contraseña actualizada correctamente.' };
}

// Estado in-memory para simular que la foto "quedó subida" entre
// uploadUserPhoto y cualquier getUser() posterior durante una sesión mock
// — mismo patrón que mockBankAlias arriba. El mock devuelve el mismo URI
// local recibido como si fuera la URL ya subida (no hay bucket real
// detrás en modo mock).
let mockPhotoUrl = null;

export async function mockUploadUserPhoto(id, uri) {
  mockPhotoUrl = uri;
  return { photo_url: uri };
}

export async function mockDeleteUserPhoto(_id) {
  mockPhotoUrl = null;
  return null;
}

export function getMockPhotoUrl() {
  return mockPhotoUrl;
}
