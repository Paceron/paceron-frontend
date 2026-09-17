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

// La URL apunta a NUESTRA página de retorno, no a auth.mercadopago.com. Una
// versión anterior devolvía la URL real de MP con client_id=mock y sin
// response_type ni redirect_uri: la ventana emergente salía a Mercado Pago de
// verdad y volvía con {"error":"Invalid request parameters"}. Un mock no tiene
// que pegarle a un servicio externo — el ida y vuelta se queda acá.
//
// Se marca conectado en este paso (y no al volver) porque la autorización real
// ocurre fuera de la app y el mock no tiene cómo enterarse. Es el atajo que
// hace que el flujo completo sea recorrible en preview: la pantalla termina
// consultando el status, que es lo que decide de verdad.
export async function mockGetMpConnectAuthUrl(platform) {
  const state = `1-${Date.now()}000000-${platform}`;
  mockConnected = true;

  // En nativo no hay window; bajo jest-expo window existe pero sin location,
  // así que no alcanza con chequear window a secas.
  const origin = globalThis.window?.location?.origin ?? 'https://mock.paceron.local';
  return {
    auth_url: `${origin}/mp-connect/callback?status=success&mock=1`,
    state,
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
