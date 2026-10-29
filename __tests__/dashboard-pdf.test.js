import { buildDashboardPdfHtml, escapeHtml } from '../utils/dashboard-pdf.js';

// El documento es lo único del PDF que se puede testear sin un navegador o un
// device: `expo-print`/`expo-sharing` y el iframe de impresión son código de
// plataforma. Acá se verifica lo que un cambio silencioso rompería —el escapado
// y que la tabla use las mismas columnas que el CSV—, no el diseño visual.

const MODEL = {
  title: 'Rendimiento — Pasadas 100 m',
  subtitle: 'Ritmo continuo · Pasadas 100 m',
  meta: [
    { label: 'Grupo', value: 'Grupo A' },
    { label: 'Rango', value: '21/07/2026 → 19/10/2026' },
  ],
  kpis: [
    { label: 'Ritmo promedio', value: '12,4 km/h' },
    { label: 'Cumplimiento', value: '—' },
  ],
  series: [
    { session_date: '2026-09-25', duration_ms: 95000, distance_meters: 412.5, band: 'met' },
  ],
  units: { time: 'ms', distance: 'm' },
  generatedAt: '19/10/2026, 10:00:00',
};

describe('buildDashboardPdfHtml', () => {
  test('es un documento HTML en español con charset explícito', () => {
    const html = buildDashboardPdfHtml(MODEL);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<meta charset="utf-8" />');
    expect(html).toContain('</html>');
  });

  test('incluye título, subtítulo, meta y KPIs', () => {
    const html = buildDashboardPdfHtml(MODEL);
    expect(html).toContain('Rendimiento — Pasadas 100 m');
    expect(html).toContain('Ritmo continuo · Pasadas 100 m');
    expect(html).toContain('Grupo A');
    expect(html).toContain('Ritmo promedio');
    expect(html).toContain('12,4 km/h');
    // `—` es un valor del contrato (null), no una celda que se omite.
    expect(html).toContain('—');
  });

  test('la tabla de series usa las mismas columnas que el CSV, con unidad', () => {
    const html = buildDashboardPdfHtml(MODEL);
    expect(html).toContain('<table class="series">');
    expect(html).toContain('Distancia (m)');
    expect(html).toContain('Duración (ms)');
    expect(html).toContain('412.5');
    expect(html).toContain('2026-09-25');
  });

  test('sin series no imprime la tabla ni su título', () => {
    const html = buildDashboardPdfHtml({ ...MODEL, series: [] });
    expect(html).not.toContain('<table class="series">');
    expect(html).not.toContain('Series del período');
  });

  test('un meta sin valor no deja una etiqueta suelta', () => {
    const html = buildDashboardPdfHtml({ ...MODEL, meta: [{ label: 'Grupo', value: '' }, { label: 'Rango', value: 'a → b' }] });
    expect(html).not.toContain('<span class="meta-label">Grupo</span>');
    expect(html).toContain('a → b');
  });

  test('el pie con la fecha solo aparece si se sella al generar', () => {
    expect(buildDashboardPdfHtml(MODEL)).toContain('Generado el 19/10/2026, 10:00:00');
    expect(buildDashboardPdfHtml({ ...MODEL, generatedAt: '' })).not.toContain('<footer>');
  });

  test('escapa lo que escribe el usuario: un "<" no puede romper el documento', () => {
    const html = buildDashboardPdfHtml({
      title: '<script>alert("x")</script>',
      meta: [{ label: 'Ejercicio', value: 'A & B' }],
      kpis: [{ label: 'Grupo', value: '<img src=x onerror=1>' }],
      series: [{ report_source: '"comillas" & <etiquetas>' }],
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
    expect(html).toContain('&quot;comillas&quot; &amp; &lt;etiquetas&gt;');
  });

  test('un modelo vacío no tira: devuelve un documento mínimo', () => {
    const html = buildDashboardPdfHtml();
    expect(html).toContain('<h1>Rendimiento</h1>');
    expect(html).not.toContain('class="kpis"');
  });

  test('lista los filtros aplicados y omite los que no tienen valor', () => {
    const html = buildDashboardPdfHtml({
      ...MODEL,
      filters: [
        { label: 'Corredor', value: 'Lucía Fernández' },
        { label: 'Grupo', value: '' },
        { label: 'Distancia', value: null },
        { label: 'Período', value: '21/07/2026 – 19/10/2026' },
      ],
    });
    expect(html).toContain('<h2>Filtros aplicados</h2>');
    expect(html).toContain('Lucía Fernández');
    expect(html).toContain('21/07/2026 – 19/10/2026');
    // Un filtro sin valor no deja una fila con la etiqueta sola: en el
    // documento se leería como un filtro activo que recorta a "nada".
    expect(html).not.toContain('>Grupo</th>');
    expect(html).not.toContain('>Distancia</th>');
  });

  test('sin filtros no imprime su sección', () => {
    expect(buildDashboardPdfHtml(MODEL)).not.toContain('Filtros aplicados');
    expect(buildDashboardPdfHtml({ ...MODEL, filters: [] })).not.toContain('Filtros aplicados');
  });

  test('embebe la captura solo si es un data URI de imagen', () => {
    const withShot = buildDashboardPdfHtml({ ...MODEL, screenshotDataUri: 'data:image/png;base64,AAAA' });
    expect(withShot).toContain('<figure class="screenshot">');
    expect(withShot).toContain('src="data:image/png;base64,AAAA"');

    // La captura es opcional (best-effort): sin ella el documento sale igual,
    // y un valor que no sea una imagen no se interpola en el `src`.
    expect(buildDashboardPdfHtml(MODEL)).not.toContain('class="screenshot"');
    expect(buildDashboardPdfHtml({ ...MODEL, screenshotDataUri: 'javascript:alert(1)' }))
      .not.toContain('class="screenshot"');
  });

  test('imprime las capturas del reporte en páginas consecutivas y omite las inválidas', () => {
    const html = buildDashboardPdfHtml({
      ...MODEL,
      screenshotDataUris: [
        'data:image/png;base64,KPIS',
        'not-an-image',
        'data:image/jpeg;base64,CHARTS',
      ],
    });

    expect(html).toContain('src="data:image/png;base64,KPIS"');
    expect(html).toContain('class="screenshot screenshot-next-page"');
    expect(html).toContain('src="data:image/jpeg;base64,CHARTS"');
    expect(html).not.toContain('src="not-an-image"');
  });

  test('el logo se embebe si es un data URI de imagen; si no, cae al wordmark de texto', () => {
    const withLogo = buildDashboardPdfHtml({ ...MODEL, logoDataUri: 'data:image/png;base64,LOGO' });
    expect(withLogo).toContain('<img class="logo" src="data:image/png;base64,LOGO"');
    expect(withLogo).not.toContain('class="wordmark"');

    const noLogo = buildDashboardPdfHtml({ ...MODEL, logoDataUri: 'https://example.com/logo.png' });
    expect(noLogo).toContain('class="wordmark"');
    expect(noLogo).not.toContain('class="logo"');
  });
});

describe('escapeHtml', () => {
  test('escapa los cinco caracteres que rompen el markup', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  test('null y undefined quedan vacíos, no "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
