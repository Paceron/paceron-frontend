// Mensajes de la pantalla de retorno del OAuth de Mercado Pago.
//
// Los `reason` son un contrato del backend: slugs ASCII estables que salen de
// mapCallbackReason (cmd/api/controllers/mp_connect_controller.go). El backend
// los usa justamente para NO filtrar el texto crudo del error a una URL que
// termina en el historial del navegador — así que acá nunca hay que mostrar el
// slug tal cual, siempre este mapeo.

const REASON_MESSAGES = {
  bad_request: 'La respuesta de Mercado Pago llegó incompleta. Probá de nuevo.',
  missing_params: 'La respuesta de Mercado Pago llegó incompleta. Probá de nuevo.',
  invalid_state: 'El enlace de conexión no es válido. Volvé a intentarlo desde la app.',
  expired_state: 'El enlace de conexión venció. Tenés 10 minutos para completar la autorización en Mercado Pago.',
  authorization_denied: 'No autorizaste a Paceron en Mercado Pago. Podés intentarlo de nuevo cuando quieras.',
  config_error: 'Hay un problema de configuración de nuestro lado. Escribinos si sigue pasando.',
  exchange_failed: 'Mercado Pago no pudo confirmar la conexión. Probá de nuevo en unos minutos.',
  save_failed: 'No pudimos guardar la conexión. Probá de nuevo en unos minutos.',
  unknown_error: 'No pudimos conectar tu cuenta de Mercado Pago.',
};

const FALLBACK_DETAIL = REASON_MESSAGES.unknown_error;

// Devuelve {ok, title, detail} para el status/reason que llegan por la query
// de la URL de retorno. Un status distinto de 'success' se trata como error,
// incluido el caso de que no venga ninguno.
export function resolveMpConnectMessage(status, reason) {
  if (status === 'success') {
    return {
      ok: true,
      title: 'Configuración de cobros exitosa',
      detail: 'Tu cuenta de Mercado Pago quedó conectada. Ya podés activar tu perfil de entrenador.',
    };
  }

  return {
    ok: false,
    title: 'Algo salió mal',
    detail: REASON_MESSAGES[reason] ?? FALLBACK_DETAIL,
  };
}

// Texto para un Error que viene del botón de conectar. Su `message` puede ser
// un slug del backend (cuando el fallo lo reportó el callback) o un mensaje
// real de red/servidor — en el primer caso se traduce, en el segundo se muestra
// tal cual, que ya viene en español desde utils/network-errors.js.
export function resolveMpConnectErrorText(error) {
  const message = error?.message;
  if (message && Object.prototype.hasOwnProperty.call(REASON_MESSAGES, message)) {
    return REASON_MESSAGES[message];
  }
  return message || FALLBACK_DETAIL;
}
