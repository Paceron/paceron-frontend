// Simula GET /mercadopago/connect y /connect/status para
// EXPO_PUBLIC_USE_MOCKS=true. El backend real ya existe — esto sirve para
// recorrer la pantalla de alta de entrenador sin depender de una cuenta de
// Mercado Pago ni del cold start de Render.
//
// La autorización real pasa por fuera del mock (el navegador se va a MP y
// vuelve), así que el "conectarse" se dispara a mano con
// mockCompleteMpConnect() — es el equivalente a que el usuario haya
// completado el flujo.
let mockConnected = false;

export async function mockGetMpConnectAuthUrl(platform) {
  return {
    auth_url: `https://auth.mercadopago.com/authorization?client_id=mock&state=1-${Date.now()}000000-${platform}`,
    state: `1-${Date.now()}000000-${platform}`,
  };
}

export async function mockGetMpConnectStatus() {
  return {
    connected: mockConnected,
    account_status: mockConnected ? 'authorized' : 'deauthorized',
  };
}

// Simula que el entrenador completó la autorización en Mercado Pago.
export function mockCompleteMpConnect() {
  mockConnected = true;
}

export function resetMpConnectMock() {
  mockConnected = false;
}
