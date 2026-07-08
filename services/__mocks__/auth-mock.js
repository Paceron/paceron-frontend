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
