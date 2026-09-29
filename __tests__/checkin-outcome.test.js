import { ALREADY_REGISTERED, destinationForOutcome, isCheckinSuccess, toOutcome } from '../utils/checkin-outcome.js';

// El mapeo status -> lo que ve el corredor es lo único que separa un mensaje útil
// de uno que manda a soporte. Se prueba aparte del componente porque es lógica
// pura: un 404 mostrado como "no pertenecés al equipo" hace que el的用户 llame
// al entrenador en vez de que revise si la sesión sigue en pie.
describe('toOutcome', () => {
  test('201: registrado', () => {
    expect(toOutcome({ message: 'asistencia registrada' }, null)).toEqual({ kind: 'registered', sessionDate: null });
  });

  // El 200 NO lleva X: la asistencia quedó registrada igual, que es lo que el
  // corredor quería. Ponerle error mentiría sobre si su sesión está en el cartel.
  test('200: ya registrada, con check verde y no con error', () => {
    const o = toOutcome({ message: 'esta asistencia fue previamente registrada' }, null);
    expect(o.kind).toBe('duplicate');
    expect(o.kind).not.toBe('invalid');
  });

  test('403: el corredor no es del equipo', () => {
    expect(toOutcome(null, { status: 403, message: 'x' })).toEqual({ kind: 'forbidden', sessionDate: null });
  });

  test('400: el QR no es registrable', () => {
    expect(toOutcome(null, { status: 400, message: 'x' })).toEqual({ kind: 'invalid', sessionDate: null });
  });

  test('404: la sesión ya no existe', () => {
    expect(toOutcome(null, { status: 404, message: 'x' })).toEqual({ kind: 'gone', sessionDate: null });
  });

  // El caso que NO está en el mapa es el de red (sin status) y el de un 5xx.
  // No puede caer en un mensaje concreto inventado: se muestra el detail real
  // para que se pueda reportar, y el ícono es el de error genérico.
  test('error de red (sin status) cae en unknown con el detail', () => {
    const o = toOutcome(null, { message: 'Network request failed' });
    expect(o.kind).toBe('unknown');
    expect(o.detail).toBe('Network request failed');
  });

  test('un 500 también es unknown, no un mensaje de sesión', () => {
    const o = toOutcome(null, { status: 500, message: 'internal' });
    expect(o.kind).toBe('unknown');
    expect(o.detail).toBe('internal');
  });

  test('nunca devuelve kind undefined, pase lo que pase', () => {
    for (const [r, e] of [[undefined, null], [{}, null], [null, {}], [null, undefined], [null, { status: 401 }]]) {
      expect(toOutcome(r, e).kind).toBeTruthy();
    }
  });
});

// El 200 se detecta COMPARANDO TEXTO contra el mensaje del backend
// (`attendance.MessageAlreadyExists`). Eso es un contrato implícito entre dos
// repos: si el backend cambia la redacción, el front deja de distinguir el
// duplicado del registro nuevo y el corredor que ya estaba registrado ve
// "registrada" como si fuera la primera vez. No hay forma de que un test de
// este repo detecte un cambio hecho en el otro, así que al menos queda escrito
// acá de qué string depende, con el valor exacto.
describe('contrato con el backend para el 200 idempotente', () => {
  test('el string duplicado es exactamente attendance.MessageAlreadyExists', () => {
    expect(ALREADY_REGISTERED).toBe('esta asistencia fue previamente registrada');
  });

  test('cualquier otra redacción se trata como registro nuevo', () => {
    // Documenta la consecuencia: si el backend reescribe el mensaje, el
    // duplicado pasa por `registered`. No es un bug de este repo, es la
    // dependencia de que ese string no cambie.
    expect(toOutcome({ message: 'ya estabas anotado' }, null).kind).toBe('registered');
  });
});

// A dónde va el corredor cuando toca ACEPTAR. La pantalla de calendario ya sabe
// abrir un día por deep link (`?date=`: salta al mes y abre el modal), así que la
// ruta se arma acá y no con un push ciego a la pestaña.
describe('destinationForOutcome', () => {
  test('registro nuevo: directo al día recién escaneado', () => {
    expect(destinationForOutcome({ kind: 'registered', sessionDate: '2026-09-28' }))
      .toBe('/calendar?date=2026-09-28');
  });

  // El 200 también es éxito: el corredor quedó registrado igual, y va al mismo
  // lugar. Mandarlo al home después de un "ya estabas" sería contradictorio.
  test('ya registrada: al mismo día, no al home', () => {
    expect(destinationForOutcome({ kind: 'duplicate', sessionDate: '2026-09-28' }))
      .toBe('/calendar?date=2026-09-28');
  });

  test('todos los errores van al home', () => {
    for (const kind of ['invalid', 'forbidden', 'gone', 'unknown']) {
      expect(destinationForOutcome({ kind, sessionDate: null })).toBe('/');
    }
  });

  // Un error con fecha igual va al home: la fecha sola no vuelve el registro
  // válido, y abrir el calendario de un día que no era suyo es peor que el home.
  test('un error con sessionDate no abre el calendario', () => {
    expect(destinationForOutcome({ kind: 'forbidden', sessionDate: '2026-09-28' })).toBe('/');
  });

  test('éxito sin fecha: al calendario, sin romperse', () => {
    expect(destinationForOutcome({ kind: 'registered', sessionDate: null })).toBe('/calendar');
  });

  test('sin outcome, al home', () => {
    expect(destinationForOutcome(null)).toBe('/');
    expect(destinationForOutcome(undefined)).toBe('/');
  });

  test('la fecha va escapada en el query', () => {
    expect(destinationForOutcome({ kind: 'registered', sessionDate: '2026-09-28&x=1' }))
      .toBe('/calendar?date=2026-09-28%26x%3D1');
  });
});

describe('sessionDate viaja desde la respuesta del backend', () => {
  test('201 y 200 lo traen', () => {
    expect(toOutcome({ message: 'asistencia registrada', session_date: '2026-09-28' }, null).sessionDate)
      .toBe('2026-09-28');
    expect(toOutcome({ message: 'esta asistencia fue previamente registrada', session_date: '2026-09-28' }, null).sessionDate)
      .toBe('2026-09-28');
  });

  // Si el backend no la manda, o la manda con otra forma, el front tiene que
  // degradar a la pestaña sin fecha en vez de armar una ruta rota.
  test('sin session_date, o con un tipo raro, queda null', () => {
    for (const body of [{}, { session_date: null }, { session_date: 20260928 }, { session_date: { d: 1 } }]) {
      expect(toOutcome(body, null).sessionDate).toBeNull();
    }
  });

  test('los errores nunca traen sessionDate', () => {
    expect(toOutcome(null, { status: 403 }).sessionDate).toBeNull();
    expect(toOutcome(null, { message: 'offline' }).sessionDate).toBeNull();
  });
});
