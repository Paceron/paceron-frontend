import { URL as RNURL } from 'react-native/Libraries/Blob/URL';
import { parseCheckinQrPayload } from '../utils/checkin-qr-url.js';

// La URL que el backend codifica hoy (ver commit 9c0dfe5 en paceron-backend):
// `ATTENDANCE_BASE_URL` + `/attendance/register?team_id=%d&session_instance_id=%d`.
const REAL = 'https://paceron-frontend.vercel.app/attendance/register?team_id=4&session_instance_id=501';

describe('parseCheckinQrPayload', () => {
  test('lee la URL real que emite el backend', () => {
    expect(parseCheckinQrPayload(REAL)).toEqual({ teamId: '4', sessionInstanceId: '501' });
  });

  // El host cambia por ambiente —prod, preview de develop, localhost:8081, la IP
  // de la máquina— así que el parser no puede depender de él.
  test('acepta cualquier host: prod, preview, localhost y LAN', () => {
    const hosts = [
      'https://paceron-frontend.vercel.app',
      'https://paceron-frontend-git-develop-paceron.vercel.app',
      'http://localhost:8081',
      'http://192.168.100.66:8081',
    ];
    for (const host of hosts) {
      expect(parseCheckinQrPayload(`${host}/attendance/register?team_id=7&session_instance_id=99`))
        .toEqual({ teamId: '7', sessionInstanceId: '99' });
    }
  });

  test('acepta barra final, http, query reordenado y params extra', () => {
    const base = 'https://a.dev/attendance/register';
    const q = '?team_id=4&session_instance_id=501';
    expect(parseCheckinQrPayload(`${base}/${q}`)).not.toBeNull();
    expect(parseCheckinQrPayload(base.replace('https', 'http') + q)).not.toBeNull();
    expect(parseCheckinQrPayload(`${base}?session_instance_id=501&team_id=4`)).toEqual({ teamId: '4', sessionInstanceId: '501' });
    expect(parseCheckinQrPayload(`${base}?team_id=4&session_instance_id=501&otro=x`)).not.toBeNull();
  });

  // ── Rechazos ────────────────────────────────────────────────────────────
  // El parser nunca lanza: devuelve null y la pantalla muestra el error. Si alguno
  // de estos tests falla porque empezó a tirar, el catch de la pantalla no alcanza
  // y el crash se lleva la pantalla.

  test('rechaza basura que no es URL', () => {
    // El polyfill de URL de react-native NO lanza con esto: devuelve protocol
    // vacío. Por eso la validación es explícita y no un try/catch.
    ['hola que tal', 'escaneame el QR', '12345', '   ', '', null, undefined, {}]
      .forEach((bad) => expect(parseCheckinQrPayload(bad)).toBeNull());
  });

  test('rechaza paths relativos: el polyfill de RN los descarta y deja "/"', () => {
    expect(parseCheckinQrPayload('/attendance/register?team_id=4&session_instance_id=501')).toBeNull();
  });

  test('rechaza esquemas que no son http(s)', () => {
    // `javascript:` y `mailto:` son los dos casos reales de un QR malicioso. No
    // llegan a openURL nunca porque el parser corta antes.
    expect(parseCheckinQrPayload('javascript:alert(1)')).toBeNull();
    expect(parseCheckinQrPayload('mailto:alguien@ejemplo.com')).toBeNull();
    expect(parseCheckinQrPayload('ftp://x.dev/attendance/register?team_id=4&session_instance_id=501')).toBeNull();
  });

  test('rechaza nuestra URL pero de otra pantalla', () => {
    const b = 'https://a.dev';
    expect(parseCheckinQrPayload(`${b}/attendance?team_id=4&session_instance_id=501`)).toBeNull();
    expect(parseCheckinQrPayload(`${b}/teams`)).toBeNull();
    expect(parseCheckinQrPayload(`${b}/attendance/register/extra?team_id=4&session_instance_id=501`)).toBeNull();
  });

  test('rechaza si falta alguno de los dos ids', () => {
    const b = 'https://a.dev/attendance/register';
    expect(parseCheckinQrPayload(`${b}?team_id=4`)).toBeNull();
    expect(parseCheckinQrPayload(`${b}?session_instance_id=501`)).toBeNull();
    expect(parseCheckinQrPayload(`${b}?team_id=&session_instance_id=501`)).toBeNull();
    expect(parseCheckinQrPayload(`${b}?team_id=4&session_instance_id=`)).toBeNull();
    expect(parseCheckinQrPayload(b)).toBeNull();
  });

  test('rechaza ids que no son enteros positivos', () => {
    const b = 'https://a.dev/attendance/register?session_instance_id=501&team_id=';
    for (const bad of ['0', '-1', '4.5', 'abc', '1e3', '+4', ' 4', '٤', '']) {
      expect(parseCheckinQrPayload(`${b}${bad}`)).toBeNull();
    }
  });

  // El id vuelve como STRING, sin castear. El `Number()` va en el service
  // (regla del CLAUDE.md sobre ids no numéricos en el body del request), y el
  // comparador del proyecto es `isSameId`, que tolera number-vs-string.
  test('devuelve los ids como string, sin castear ni perder ceros', () => {
    const r = parseCheckinQrPayload('https://a.dev/attendance/register?team_id=04&session_instance_id=0501');
    expect(r).toEqual({ teamId: '04', sessionInstanceId: '0501' });
    expect(typeof r.teamId).toBe('string');
  });
});

// El resto del archivo corre contra el `URL` GLOBAL, que en Jest es el de Node.
// En el device es el polyfill propio de react-native (Libraries/Blob/URL), que
// es otra implementación, minimalista y deliberadamente no-spec: no lanza con
// basura (por eso el parser valida a mano) y su soporte de `searchParams` no es
// el de Node. Este bloque corre los mismos casos con el polyfill inyectado como
// global, para que una diferencia entre las dos no pueda colarse hasta el
// teléfono — que es donde no hay forma de probar rápido.
describe('con el polyfill de URL de react-native (lo que corre en el device)', () => {
  const realURL = global.URL;

  beforeAll(() => { global.URL = RNURL; });
  afterAll(() => { global.URL = realURL; });

  test('el default del backend local (http://localhost:PORT) lo acepta', () => {
    // El host NO se valida a propósito, así que el puerto y el host local no
    // pueden filtrar el QR que emite el backend sin ATTENDANCE_BASE_URL seteado.
    expect(parseCheckinQrPayload('http://localhost:8081/attendance/register?team_id=4&session_instance_id=503'))
      .toEqual({ teamId: '4', sessionInstanceId: '503' });
    expect(parseCheckinQrPayload('http://192.168.100.66:8081/attendance/register?team_id=4&session_instance_id=501'))
      .toEqual({ teamId: '4', sessionInstanceId: '501' });
  });

  test('sigue aceptando https y los hosts de Vercel', () => {
    expect(parseCheckinQrPayload('https://paceron-frontend.vercel.app/attendance/register?team_id=1&session_instance_id=2'))
      .toEqual({ teamId: '1', sessionInstanceId: '2' });
  });

  test('el contrato de "nunca lanza" se sostiene también acá', () => {
    // El riesgo concreto: si el polyfill no tuviera `searchParams`, la línea que
    // lee los query params tiraría TypeError y rompería el scanner, que promises
    // que un QR malo no lo tira abajo.
    for (const basura of ['', '   ', 'hola que tal', '/attendance/register?team_id=4', 'javascript:alert(1)',
      'mailto:a@b.dev', 'not:a/url', 'https://', 'http://', 'https://a.dev/otra/4?team_id=4&session_instance_id=5',
      'https://a.dev/attendance/register', null, undefined, 123, {}]) {
      expect(() => parseCheckinQrPayload(basura)).not.toThrow();
      expect(parseCheckinQrPayload(basura)).toBeNull();
    }
  });
});
