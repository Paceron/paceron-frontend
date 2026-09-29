import { toQrDataUri } from '../utils/attendance-qr-image.js';

describe('toQrDataUri', () => {
  test('prefija el base64 crudo del backend', () => {
    // El PNG 1x1 del mock (services/__mocks__/attendance-mock.js:104), que es
    // el mismo formato que devuelve GET /attendance/qr.
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    expect(toQrDataUri(base64)).toBe(`data:image/png;base64,${base64}`);
  });

  test('no toca un base64 que ya viene bien (no le mete espacios ni lo reescribe)', () => {
    const base64 = 'QUJD';
    expect(toQrDataUri(base64)).toBe('data:image/png;base64,QUJD');
  });

  // Sin dato no es un data URI vacío: devolver 'data:image/png;base64,' produce
  // una imagen de 0 bytes — un <Image> roto en el modal y un PDF sin QR, sin
  // ningún error visible. null deja la decisión en el caller, que sí sabe
  // mostrar "no se pudo generar el QR" (misma regla que utils/currency.js).
  test('null / undefined / vacío → null, no un data URI sin contenido', () => {
    expect(toQrDataUri(null)).toBeNull();
    expect(toQrDataUri(undefined)).toBeNull();
    expect(toQrDataUri('')).toBeNull();
    expect(toQrDataUri('   ')).toBeNull();
  });

  // Un \n final de un base64 (de un .txt, de un log, de un proxy) rompe la
  // imagen sin error visible, así que el trim es parte del contrato.
  test('recorta espacios al principio y al final antes de prefijar', () => {
    expect(toQrDataUri('  QUJD  ')).toBe('data:image/png;base64,QUJD');
    expect(toQrDataUri('\n QUJD \t\n')).toBe('data:image/png;base64,QUJD');
  });

  // El endpoint es preexistente (change `add-qr-attendance`) y lo único
  // garantizado es el formato actual. Prefijar de nuevo un data URI produce
  // 'data:image/png;base64,data:image/png;base64,...' → imagen que no carga.
  test('un data URI de entrada se devuelve tal cual, sin duplicar el prefijo', () => {
    const already = 'data:image/png;base64,QUJD';
    expect(toQrDataUri(already)).toBe(already);
    expect(toQrDataUri(already)).not.toContain('base64,data:');
    // Con espacios alrededor también, y con el esquema en mayúscula (RFC 2397
    // lo define case-insensitive).
    expect(toQrDataUri('  data:image/png;base64,QUJD ')).toBe(already);
    expect(toQrDataUri('DATA:image/png;base64,QUJD')).toBe('DATA:image/png;base64,QUJD');
  });

  test('no inventa un prefijo distinto si el data URI usa otro mime', () => {
    const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    expect(toQrDataUri(svg)).toBe(svg);
  });
});
