import {
  DASHBOARD_ERROR_CODES,
  resolveDashboardError,
} from '../utils/dashboard-error-codes.js';

const err = (status, code) => ({ status, data: code ? { code } : {} });

describe('DASHBOARD_ERROR_CODES', () => {
  // Una typo en una clave no rompe nada: cae en el genérico y el mensaje deja
  // de explicar qué corregir. Este test es el que la delata.
  test('las claves son exactamente las del contrato, sin typos ni espacios', () => {
    expect(Object.keys(DASHBOARD_ERROR_CODES).sort()).toEqual([
      'INVALID_GRANULARITY',
      'INVALID_PAGE_SIZE',
      'INVALID_RANGE',
      'INVALID_SORT',
      'INVALID_TOLERANCE',
      'MISSING_FROM',
    ]);
  });

  test('cada código declara una acción y un mensaje', () => {
    Object.entries(DASHBOARD_ERROR_CODES).forEach(([code, entry]) => {
      expect(typeof entry.message).toBe('string');
      expect(entry.message.length).toBeGreaterThan(0);
      expect(['pick_dates', 'narrow_range', 'reset_tolerance', 'reset_param']).toContain(entry.action);
      expect(code).toMatch(/^[A-Z][A-Z_]*$/);
    });
  });
});

describe('resolveDashboardError con 400', () => {
  test('MISSING_FROM ofrece elegir fechas', () => {
    const resolved = resolveDashboardError(err(400, 'MISSING_FROM'));
    expect(resolved).toEqual(expect.objectContaining({ kind: 'invalid', action: 'pick_dates', code: 'MISSING_FROM' }));
  });

  test('INVALID_RANGE ofrece acotar el rango', () => {
    expect(resolveDashboardError(err(400, 'INVALID_RANGE')).action).toBe('narrow_range');
  });

  test('INVALID_TOLERANCE avisa y vuelve al valor por defecto', () => {
    const resolved = resolveDashboardError(err(400, 'INVALID_TOLERANCE'));
    expect(resolved.action).toBe('reset_tolerance');
    expect(resolved.message).toMatch(/tolerancia/i);
  });

  test('los parámetros no admitidos vuelven al valor por defecto sin pedir nada', () => {
    ['INVALID_SORT', 'INVALID_GRANULARITY', 'INVALID_PAGE_SIZE'].forEach((code) => {
      expect(resolveDashboardError(err(400, code)).action).toBe('reset_param');
    });
  });

  test('un 400 no es reintentable: reintentar la misma request vuelve a fallar', () => {
    ['MISSING_FROM', 'INVALID_RANGE', 'INVALID_TOLERANCE', 'INVALID_SORT'].forEach((code) => {
      expect(resolveDashboardError(err(400, code)).retryable).toBe(false);
    });
  });

  test('un código desconocido cae en el genérico sin inventar una acción', () => {
    const resolved = resolveDashboardError(err(400, 'TEAPOT'));
    expect(resolved.kind).toBe('invalid');
    expect(resolved.code).toBe('TEAPOT');
    expect(resolved.action).toBe('none');
    expect(resolved.retryable).toBe(false);
    expect(resolved.message).not.toMatch(/TEAPOT/);
  });

  test('un 400 sin código también resuelve', () => {
    expect(resolveDashboardError(err(400)).action).toBe('none');
    expect(resolveDashboardError({ status: 400, data: null }).kind).toBe('invalid');
  });
});

describe('resolveDashboardError con el resto de los estados', () => {
  test('403 sin código es "sin permisos" y no revela si el recurso existe', () => {
    const resolved = resolveDashboardError(err(403));
    expect(resolved.kind).toBe('forbidden');
    expect(resolved.action).toBe('none');
    expect(resolved.retryable).toBe(false);
    expect(resolved.message).not.toMatch(/existe|existencia|no se encontró/i);
  });

  test('404 es recurso inexistente, sin reintento', () => {
    const resolved = resolveDashboardError(err(404));
    expect(resolved.kind).toBe('not_found');
    expect(resolved.retryable).toBe(false);
  });

  test('5xx es transitorio y sí se puede reintentar', () => {
    [500, 502, 503].forEach((status) => {
      expect(resolveDashboardError(err(status))).toEqual(expect.objectContaining({
        kind: 'transient', retryable: true, status,
      }));
    });
  });

  test('un error de red no tiene status y también es transitorio', () => {
    const resolved = resolveDashboardError(new Error('Sin conexión'));
    expect(resolved.status).toBeNull();
    expect(resolved.kind).toBe('transient');
    expect(resolved.retryable).toBe(true);
    expect(resolved.message).toBe('Sin conexión');
  });

  test('sin error del todo igual resuelve en transitorio, sin romper la pantalla', () => {
    const resolved = resolveDashboardError(undefined);
    expect(resolved.kind).toBe('transient');
    expect(resolved.message).toMatch(/conexión/i);
  });

  test('nunca devuelve undefined en ningún campo que la pantalla use', () => {
    [
      err(400, 'INVALID_RANGE'), err(403), err(404), err(500), new Error('x'), undefined,
    ].forEach((error) => {
      const resolved = resolveDashboardError(error);
      expect(['invalid', 'forbidden', 'not_found', 'transient']).toContain(resolved.kind);
      expect(typeof resolved.message).toBe('string');
      expect(typeof resolved.retryable).toBe('boolean');
      expect(typeof resolved.action).toBe('string');
    });
  });
});