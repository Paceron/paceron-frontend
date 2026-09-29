// Armado del data URI del QR de asistencia. PURA a propósito — sin fetch, sin
// plataforma, sin React — porque los casos borde de este valor, que son los que
// vienen de una respuesta externa y se tienen que poder testear con Jest: el QR
// es lo único que se muestra en el modal, se imprime en el PDF y se comparte, y
// un data URI mal armado no da ningún error visible, solo un <Image> roto (y un
// PDF sin QR, que es el peor resultado posible: se cuelga en la pared y no
// escanea).
//
// El backend (`GET /api/v1/attendance/qr`, services/attendance.js:66) devuelve
// `qr_code_base64` como base64 CRUDO de un PNG, NO como data URI — es el mismo
// formato del PNG 1x1 del mock (services/__mocks__/attendance-mock.js:104).
// `<Image source={{uri}}>` y el <img> del HTML del PDF (D8) necesitan el prefijo
// completo, y el prefijo es lo único que esta función agrega.

const DATA_URI_PREFIX = 'data:image/png;base64,';

// Sin dato no es un data URI vacío: la misma regla de utils/currency.js y del
// `toFiniteNumber` de utils/attendance-payload.js ("sin dato no es 0"). Devolver
// 'data:image/png;base64,' (lo que saldría de un `?? ''` ingenuo) produce una
// URI que el renderer interpreta como imagen de 0 bytes: el modal muestra un
// cuadro vacío y el PDF imprime un marco sin código, sin una sola palabra de
// error. `null` deja la decisión donde corresponde — que es el caller (7.2/7.3),
// que sí sabe mostrar "no se pudo generar el QR".
//
// El chequeo es por trim, no por `=== ''`: un valor que solo tiene espacios es
// tan vacío como uno vacío, y `String(value).trim() === ''` ya cubre null /
// undefined / '' en el mismo lugar (mismo criterio que attendance-payload.js:16).
export function toQrDataUri(base64) {
  if (base64 === null || base64 === undefined) return null;

  const value = String(base64).trim();
  if (value === '') return null;

  // Ya viene como data URI → se devuelve TAL CUAL, sin prefijar de nuevo.
  //
  // No es paranoia: el endpoint es preexistente del change `add-qr-attendance` y
  // lo único garantizado hoy es lo que devuelve el mock y el backend actual
  // (base64 crudo). Si mañana el backend cambia a devolver el data URI completo
  // (o si un service/proxy en el medio lo envuelve), prefijar de nuevo produce
  // 'data:image/png;base64,data:image/png;base64,...' y el QR no carga — un
  // fallo silencioso y confuso. La detección es por el prefijo `data:` y no por
  // un regex del prefijo completo a propósito: el esquema de un data URI es
  // case-insensitive (RFC 2397) y hay variantes legítimas (otro mime, `;utf8` en
  // vez de `;base64`) que un regex estricto rechazaría. Si el valor no es
  // base64 utilizable, la imagen no carga y no hay forma de distinguirlo acá sin
  // decodificar PNGs — la validación de "es una imagen válida" no es de esta
  // función.
  if (/^data:/i.test(value)) return value;

  return `${DATA_URI_PREFIX}${value}`;
}
