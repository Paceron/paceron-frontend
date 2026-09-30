import { buildAttendanceQrHtml } from '../utils/attendance-qr-pdf.js';
import { toQrDataUri } from '../utils/attendance-qr-image.js';

// El PNG 1x1 de services/__mocks__/attendance-mock.js:104, pasado por el util
// de 7.1: el PDF consume el data URI, no el base64 crudo.
const QR_DATA_URI = toQrDataUri('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
const LOGO_DATA_URI = toQrDataUri('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

// Sesión 503 del mock de asistencia (attendance-mock.js:58-64): presencial CON
// horario y lugar.
const FULL_SESSION = {
  name: 'Fondo suave',
  date: '2026-09-27T19:00:00.000Z',
  presencial_time_from: '19:00',
  presencial_time_to: '20:15',
  presencial_location: { lat: -32.8895, lng: -68.8458, label: 'Parque General San Martín' },
};

// Sesión 502 del mismo mock (attendance-mock.js:66-72): `is_presencial` es un
// booleano del día, independiente del horario, así que los tres campos vienen en
// null. Es el caso real que el spec obliga a no dejar en blanco.
const SESSION_WITHOUT_SCHEDULE = {
  name: 'Rodaje largo',
  date: '2026-09-25T08:00:00.000Z',
  presencial_time_from: null,
  presencial_time_to: null,
  presencial_location: null,
};

const build = (overrides = {}) =>
  buildAttendanceQrHtml({
    team: { name: 'Runners Mendoza' },
    session: FULL_SESSION,
    qrDataUri: QR_DATA_URI,
    logoDataUri: LOGO_DATA_URI,
    ...overrides,
  });

describe('buildAttendanceQrHtml', () => {
  test('es un documento A4 completo, con el equipo, la fecha y el QR', () => {
    const html = build();

    expect(typeof html).toBe('string');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('@page { size: A4; margin: 0; }');
    expect(html).toContain('Runners Mendoza');
    // DD-MM-AAAA, el mismo formato que muestra la pantalla (formatSessionDate).
    expect(html).toContain('27-09-2026');
    expect(html).toContain(QR_DATA_URI);
  });

  // El requirement del PDF pide equipo, logo, NOMBRE de la sesión, fecha,
  // horario, lugar y QR. El nombre de la sesión no es un extra: es lo que
  // identifica el cartel colgado en la pared.
  test('incluye el nombre de la sesión y el logo', () => {
    const html = build();

    expect(html).toContain('Fondo suave');
    expect(html).toContain(`<img class="logo" src="${LOGO_DATA_URI}"`);
  });

  test('con horario y lugar, imprime las dos filas con sus labels', () => {
    const html = build();

    expect(html).toContain('Horario');
    expect(html).toContain('19:00 – 20:15');
    expect(html).toContain('Lugar');
    expect(html).toContain('Parque General San Martín');
  });

  // Scenario "El PDF omite horario y lugar cuando no existen": el documento se
  // genera igual y SIN esas dos líneas. El assert de 'null' es el que importa
  // acá — es el síntoma del `${session.presencial_time_from}` ingenuo.
  test('sin horario ni lugar, no imprime las filas ni deja "null" o campos vacíos', () => {
    const html = build({ session: SESSION_WITHOUT_SCHEDULE });

    expect(html).toContain('Runners Mendoza');
    expect(html).toContain(QR_DATA_URI);
    expect(html).not.toContain('Horario');
    expect(html).not.toContain('Lugar');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
    // El bloque entero no se arma: ni contenedor con padding vacío ni separador.
    // (Los asserts miran el atributo class, no el nombre de la clase: los
    // selectores viven en el <style> del documento y matchearían siempre.)
    expect(html).not.toContain('<section class="details">');
    expect(html).not.toContain('<div class="detail-label">');
  });

  test('con uno solo de los dos: imprime el que existe, sin inventar el otro', () => {
    const onlyFrom = build({ session: { ...FULL_SESSION, presencial_time_to: null } });
    expect(onlyFrom).toContain('19:00');
    expect(onlyFrom).not.toContain('–');

    const onlyTo = build({ session: { ...FULL_SESSION, presencial_time_from: '' } });
    expect(onlyTo).toContain('20:15');
    expect(onlyTo).not.toContain('–');
  });

  test('cada dato faltante se omite por separado (horario sin lugar y al revés)', () => {
    const noLocation = build({ session: { ...FULL_SESSION, presencial_location: null } });
    expect(noLocation).toContain('Horario');
    expect(noLocation).not.toContain('Lugar');

    const noSchedule = build({ session: { ...FULL_SESSION, presencial_time_from: null, presencial_time_to: null } });
    expect(noSchedule).not.toContain('Horario');
    expect(noSchedule).toContain('Lugar');
  });

  // `label` del jsonb {lat, lng, label?} es opcional: un día presencial puede
  // tener solo el pin en el mapa. Sin label no se imprime la fila, porque una
  // línea "Lugar:" sin nada al lado es el campo vacío que el spec prohíbe.
  test('lugar sin label (solo coordenadas) no imprime la fila del lugar', () => {
    const html = build({ session: { ...FULL_SESSION, presencial_location: { lat: -32.8895, lng: -68.8458 } } });

    expect(html).toContain('Horario');
    expect(html).not.toContain('Lugar');
    expect(html).not.toContain('-32.8895');
  });

  // Los nombres los escribe el entrenador: es contenido, no markup. Sin
  // escapar, un `<` en un nombre rompe el documento y un `</div><script>` inyecta
  // markup en el HTML que se imprime.
  test('escapa el HTML de los nombres que vienen de datos', () => {
    const html = build({
      team: { name: 'Runners <b>Mendoza</b>' },
      session: { ...FULL_SESSION, name: 'Fondo "suave" & rápido <img src=x>' },
    });

    expect(html).toContain('Runners &lt;b&gt;Mendoza&lt;/b&gt;');
    expect(html).toContain('Fondo &quot;suave&quot; &amp; rápido &lt;img src=x&gt;');
    expect(html).not.toContain('<b>Mendoza</b>');
    expect(html).not.toContain('<img src=x>');
    // El nombre escapado sigue siendo legible como texto en el documento.
    expect(html).toContain('Fondo &quot;suave&quot; &amp; rápido');
  });

  test('escapa también el label del lugar y el nombre en el <title>', () => {
    const html = build({
      team: { name: "O'Brien & Cía <script>" },
      session: { ...FULL_SESSION, presencial_location: { lat: 1, lng: 2, label: 'Plaza "Norte" <sur>' } },
    });

    expect(html).toContain('O&#39;Brien &amp; Cía &lt;script&gt;');
    expect(html).toContain('Plaza &quot;Norte&quot; &lt;sur&gt;');
    expect(html).not.toContain('<script>');
    // El <title> es de donde el navegador saca el nombre de archivo del PDF.
    expect(html).toContain('<title>O&#39;Brien &amp; Cía &lt;script&gt; — Fondo suave</title>');
  });

  // El QR va dentro de un atributo entre comillas dobles: un valor con `"` lo
  // cierra y rompe el documento. El base64 real nunca trae estos caracteres, así
  // que escaparlo no cambia nada del camino bueno y evita que uno malo rompa todo.
  test('escapa el data URI del QR y del logo (van en atributos con comillas)', () => {
    const html = build({ qrDataUri: 'data:image/png;base64,QUJD" onerror="alert(1)', logoDataUri: 'x" onload="alert(2)' });

    expect(html).not.toContain('" onerror="');
    expect(html).not.toContain('" onload="');
    expect(html).toContain('&quot; onerror=&quot;');
  });

  // El logo es opcional: si utils/attendance-qr-logo.js no resolvió el asset,
  // el documento sale igual con el wordmark de texto, nunca con un <img> de src
  // vacío (que según el renderer es un ícono de imagen rota o un request a la
  // propia URL del documento).
  test('sin logoDataUri, el documento se arma igual con el wordmark de texto', () => {
    const html = build({ logoDataUri: undefined });

    expect(html).toContain('PACERON');
    expect(html).not.toContain('<img class="logo"');
    expect(html).not.toContain('src=""');
    expect(html).toContain(QR_DATA_URI);
  });

  // Falla ruidoso: el documento se imprime y se cuelga en la pared, así que un
  // PDF sin QR es un fallo que el entrenador descubre tarde. El throw lo corta
  // acá y lo toma el camino de error de 7.6.
  test('sin QR lanza, en vez de imprimir un cartel sin código', () => {
    expect(() => build({ qrDataUri: null })).toThrow(/QR/);
    expect(() => build({ qrDataUri: '   ' })).toThrow(/QR/);
  });

  test('equipo y fecha ausentes no rompen el documento', () => {
    const html = buildAttendanceQrHtml({ session: { ...FULL_SESSION, date: null }, qrDataUri: QR_DATA_URI });

    expect(html).toContain('Fondo suave');
    expect(html).toContain(QR_DATA_URI);
    expect(html).not.toContain('null');
    expect(html).not.toContain('<div class="header-date">');
  });

  // Estos dos tests existen por un bug real: el modal preformateaba la fecha a
  // DD-MM-AAAA antes de pasarla, y `formatAttendanceDate` la formatea OTRA vez
  // esperando un ISO. El regex no matcheaba, devolvía null, y el guard "si no
  // parece una fecha, no imprimir" se tragaba el fallo en silencio: el PDF salía
  // sin fecha y sin error. Los tests previos pasaban igual porque llamaban al
  // util con el ISO crudo — el input que el util espera, pero NO el que le daba
  // el caller real.
  test('la fecha de la sesión va junto al nombre, como "Sesión del DD-MM-AAAA"', () => {
    const html = buildAttendanceQrHtml({ session: FULL_SESSION, qrDataUri: QR_DATA_URI });

    // FULL_SESSION tiene date 2026-09-27. Se asserta sobre el ELEMENTO, no sobre
    // la cadena "Sesión del": esa frase estaba también en un comentario del CSS
    // y hacía que un test de "no debe aparecer" pasara en falso.
    expect(html).toContain('27-09-2026');
    expect(html).toMatch(/<p class="session-date">Sesión del 27-09-2026<\/p>/);
  });

  test('sin fecha no se imprime el renglón, y no queda un "del" colgado', () => {
    const html = buildAttendanceQrHtml({
      session: { ...FULL_SESSION, date: null },
      qrDataUri: QR_DATA_URI,
    });

    expect(html).not.toContain('class="session-date"');
    expect(html).not.toMatch(/<p class="session-date">/);
  });

  // Contrato con el caller: el modal tiene que pasar el ISO CRUDO. Este test es
  // el que habría atrapado el bug de producción — el modal preformateaba a
  // DD-MM-AAAA, `formatAttendanceDate` lo formateaba OTRA vez, el regex no
  // matcheaba, y el guard "si no parece fecha, no imprimir" se tragaba el
  // fallo en silencio (PDF sin fecha, sin error). El test anterior con
  // FULL_SESSION pasaba igual porque el ISO crudo SÍ es lo que el util espera.
  test('una fecha YA formateada no se imprime: el doble formateo queda expuesto', () => {
    const html = buildAttendanceQrHtml({
      session: { ...FULL_SESSION, date: '27-09-2026' },
      qrDataUri: QR_DATA_URI,
    });

    expect(html).not.toMatch(/<p class="session-date">/);
    expect(html).not.toContain('27-09-2026');
  });
});
