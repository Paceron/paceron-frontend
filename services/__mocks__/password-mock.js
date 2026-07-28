// Datos fake — no valida el código realmente, mismo criterio que el resto de
// los mocks del proyecto (no reimplementan lógica de negocio real).
export async function mockForgotPassword(_email) {
  return { message: 'Si el email está registrado, vas a recibir un código de recuperación.' };
}

export async function mockResetPassword(_payload) {
  return { message: 'Contraseña actualizada correctamente.' };
}
