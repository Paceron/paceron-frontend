import { ALREADY_REGISTERED, toOutcome } from '../utils/checkin-outcome.js';

// El mapeo status -> lo que ve el corredor es lo único que separa un mensaje útil
// de uno que manda a soporte. Se prueba aparte del componente porque es lógica
// pura: un 404 mostrado como "no pertenecés al equipo" hace que el的用户 llame
// al entrenador en vez de que revise si la sesión sigue en pie.
describe('toOutcome', () => {
  test('201: registrado', () => {
    expect(toOutcome({ message: 'asistencia registrada' }, null)).toEqual({ kind: 'registered' });
  });

  // El 200 NO lleva X: la asistencia quedó registrada igual, que es lo que el
  // corredor quería. Ponerle error mentiría sobre si su sesión está en el cartel.
  test('200: ya registrada, con check verde y no con error', () => {
    const o = toOutcome({ message: 'esta asistencia fue previamente registrada' }, null);
    expect(o.kind).toBe('duplicate');
    expect(o.kind).not.toBe('invalid');
  });

  test('403: el corredor no es del equipo', () => {
    expect(toOutcome(null, { status: 403, message: 'x' })).toEqual({ kind: 'forbidden' });
  });

  test('400: el QR no es registrable', () => {
    expect(toOutcome(null, { status: 400, message: 'x' })).toEqual({ kind: 'invalid' });
  });

  test('404: la sesión ya no existe', () => {
    expect(toOutcome(null, { status: 404, message: 'x' })).toEqual({ kind: 'gone' });
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
    expect(toOutcome({ message: 'ya estabas anotado' }, null)).toEqual({ kind: 'registered' });
  });
});
