import { formatDMY } from './datetime-parts.js';

// Estado de la conexión de Mercado Pago del entrenador, para mostrarlo en Mi
// perfil. Sale de GET /mercadopago/connect/status (useMpConnectStatus):
// - `connected` ya viene en false si el token venció (el backend lo decide).
// - `tokenExpiresAt` es el vencimiento del access token. Mercado Pago lo emite
//   por 180 días y nada lo renueva: pasada esa fecha hay que volver a conectar.
// "Vencida" es una conexión autorizada cuya fecha ya pasó; "no conectada" es no
// haberla hecho nunca o haberla desautorizado desde Mercado Pago.
export function mpConnectionState({ connected, accountStatus, tokenExpiresAt }, now = new Date()) {
  const parsed = tokenExpiresAt ? new Date(tokenExpiresAt) : null;
  const expiresAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

  if (connected) {
    return {
      state: 'connected',
      label: 'Conectada',
      detail: expiresAt ? `Sincronizada hasta el ${formatDMY(expiresAt)}` : '',
      expiresAt,
    };
  }
  if (accountStatus === 'authorized' && expiresAt && expiresAt <= now) {
    return {
      state: 'expired',
      label: 'Vencida',
      detail: `Venció el ${formatDMY(expiresAt)}. Volvé a conectarla para seguir cobrando.`,
      expiresAt,
    };
  }
  return {
    state: 'disconnected',
    label: 'No conectada',
    detail: 'Hace falta para cobrar las cuotas de tus equipos.',
    expiresAt: null,
  };
}
