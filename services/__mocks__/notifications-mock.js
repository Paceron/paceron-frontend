// Simula POST /api/v1/push-tokens para EXPO_PUBLIC_USE_MOCKS=true. Upsert
// por token real es responsabilidad del backend — acá solo se valida que
// vengan los dos campos requeridos, igual que hace el backend real
// (pushtoken.RegisterPushTokenRequest, ambos campos "required").
export async function mockRegisterPushToken(token, platform) {
  if (!token || !platform) {
    const error = new Error('token y platform son requeridos.');
    error.status = 400;
    throw error;
  }
  return { message: 'Token registrado correctamente.' };
}
