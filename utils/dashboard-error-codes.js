// Mapa de códigos de error del dashboard. Un mapa literal, sin strings sueltos:
// el backend responde con códigos UPPER_SNAKE (convención ya existente en
// constants/error_code.go) y cada uno de ellos decide QUÉ estado se pinta. Una
// typo en una clave — 'INVALID_TOLERANCE' escrito 'INVALID_TOLERANCE ' — no
// rompe nada: cae en el genérico y el usuario ve un mensaje que no explica qué
// corregir, sin ningún error visible. Por eso `__tests__/` recorre las claves.
//
// El `action` es lo que la pantalla tiene que hacer, no lo que tiene que decir:
//   pick_dates     → ofrecer elegir fechas
//   narrow_range   → ofrecer acotar el rango
//   reset_tolerance→ avisar y volver a la tolerancia por defecto
//   reset_param    → volver al valor por defecto sin pedir nada
//   none           → no hay nada que corregir del lado del filtro
//
// Los errores ya traen `status` y `data` en services/api.js:91-101, así que este
// mapa no necesita tocar la capa de API.

const GENERIC_400 = 'No pudimos leer esas métricas con el filtro actual. Revisá las fechas e intentá de nuevo.';
const GENERIC_FORBIDDEN = 'Este recurso no está entre los que podés ver. Si creés que debería estarlo, hablá con el entrenador del equipo.';
const GENERIC_NOT_FOUND = 'No encontramos ese recurso. Puede que se haya borrado.';

export const DASHBOARD_ERROR_CODES = {
  MISSING_FROM: {
    action: 'pick_dates',
    message: 'Falta la fecha desde la que empezar. Elegí un rango de fechas para ver las métricas.',
  },
  INVALID_RANGE: {
    action: 'narrow_range',
    message: 'Las fechas o los límites del rango no son válidos. Revisá los valores ingresados.',
  },
  INVALID_TOLERANCE: {
    action: 'reset_tolerance',
    message: 'La tolerancia usada no es válida. Volvemos a la tolerancia por defecto.',
  },
  INVALID_SORT: {
    action: 'reset_param',
    message: 'Ese ordenamiento no está disponible. Volvemos al orden por defecto.',
  },
  INVALID_GRANULARITY: {
    action: 'reset_param',
    message: 'Esa granularidad no está disponible para el período elegido. Volvemos a la por defecto.',
  },
  INVALID_PAGE_SIZE: {
    action: 'reset_param',
    message: 'Ese tamaño de página no está disponible. Volvemos al por defecto.',
  },
};

// kind es lo que la pantalla necesita para elegir el componente de estado:
//   invalid    → 400, sin botón de reintento (reintentar la misma request
//                devuelve el mismo 400: el botón solo arma un bucle)
//   forbidden  → 403, sin revelar si el recurso existe
//   not_found  → 404, sin reintento
//   transient  → red o 5xx, acá SÍ va botón de reintentar
export function resolveDashboardError(error) {
  const status = Number.isFinite(error?.status) ? error.status : null;
  const code = typeof error?.data?.code === 'string' ? error.data.code : null;

  if (status === 400) {
    const known = code && Object.prototype.hasOwnProperty.call(DASHBOARD_ERROR_CODES, code)
      ? DASHBOARD_ERROR_CODES[code]
      : null;
    const backendMessage = typeof error?.data?.message === 'string' ? error.data.message.trim() : '';
    return {
      status,
      code,
      kind: 'invalid',
      action: known?.action ?? 'none',
      message: (code === 'INVALID_RANGE' && backendMessage) || known?.message || GENERIC_400,
      retryable: false,
    };
  }

  if (status === 403) {
    return { status, code, kind: 'forbidden', action: 'none', message: GENERIC_FORBIDDEN, retryable: false };
  }

  if (status === 404) {
    return { status, code, kind: 'not_found', action: 'none', message: GENERIC_NOT_FOUND, retryable: false };
  }

  return {
    status,
    code,
    kind: 'transient',
    action: 'none',
    message: typeof error?.message === 'string' && error.message
      ? error.message
      : 'No pudimos cargar las métricas. Revisá tu conexión e intentá de nuevo.',
    retryable: true,
  };
}
