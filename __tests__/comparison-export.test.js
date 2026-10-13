import { buildRangeComparisonCsv, buildSessionComparisonCsv, rangeComparisonFileName, sessionComparisonFileName, toCsv } from '../utils/comparison-csv.js';
import { buildRangeComparisonHtml, buildSessionComparisonHtml, escapeHtml } from '../utils/comparison-pdf-html.js';
import { toComparisonListModel, toSessionComparisonModel } from '../services/normalizers.js';
import { __resetMockComparison, __setMockComparisonNow, mockGetComparisons, mockGetSessionComparison } from '../services/__mocks__/activity-comparison-mock.js';

const lines = (csv) => csv.replace(/^﻿/, '').trim().split('\r\n');

describe('comparison export', () => {
  beforeEach(() => __setMockComparisonNow(new Date(2026, 9, 13, 12, 0, 0)));
  afterEach(() => __resetMockComparison());

  it('escapes CSV cells and adds the BOM', () => {
    const csv = toCsv([['a;b', 'dijo "hola"', 'simple', null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines(csv)[0]).toBe('"a;b";"dijo ""hola""";simple;');
  });

  it('builds one CSV row per set plus the session total', async () => {
    const comparison = toSessionComparisonModel(await mockGetSessionComparison({ sessionInstanceId: 455 }));
    const rows = lines(buildSessionComparisonCsv(comparison));
    expect(rows[0]).toContain('Cumplimiento');
    expect(rows).toHaveLength(5); // header + 3 series + total
    expect(rows[1]).toContain('Entrada en calor');
    expect(rows[2]).toContain('−05:00');
    expect(rows[2]).toContain('50 %');
    expect(rows[3]).toContain('Salteada');
    expect(rows[4]).toContain('Total de la sesión');
    expect(rows[4]).toContain('50 %');
    expect(sessionComparisonFileName(comparison, 'csv')).toBe('comparacion-2026-10-12-455.csv');
  });

  it('marks extra sets and leaves their compliance empty', async () => {
    const comparison = toSessionComparisonModel(await mockGetSessionComparison({ sessionInstanceId: 300 }));
    const rows = lines(buildSessionComparisonCsv(comparison));
    const extra = rows.find((r) => r.includes('(extra)'));
    expect(extra).toBeDefined();
    expect(extra.endsWith(';')).toBe(true);
  });

  it('builds the range CSV with a summary row', async () => {
    const list = toComparisonListModel(await mockGetComparisons({ dateFrom: '2026-09-13', dateTo: '2026-10-13' }));
    const rows = lines(buildRangeComparisonCsv(list));
    expect(rows).toHaveLength(1 + list.sessions.length + 1);
    expect(rows[rows.length - 1]).toContain('Promedio del período');
    expect(rangeComparisonFileName(list, 'pdf')).toBe('comparacion-2026-09-13-a-2026-10-13.pdf');
  });

  it('escapes HTML coming from the backend', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    const html = buildSessionComparisonHtml({ sessionName: '<script>', kinds: [], exercises: [], totals: {}, compliancePct: 0 });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders the session PDF with every exercise', async () => {
    const comparison = toSessionComparisonModel(await mockGetSessionComparison({ sessionInstanceId: 455 }));
    const html = buildSessionComparisonHtml(comparison);
    expect(html).toContain('50 %');
    expect(html.match(/<h2>/g)).toHaveLength(3);
    expect(html).toContain('Sin objetivo');
  });

  it('renders the range PDF', async () => {
    const list = toComparisonListModel(await mockGetComparisons({ dateFrom: '2026-09-13', dateTo: '2026-10-13' }));
    const html = buildRangeComparisonHtml(list);
    expect(html).toContain('Cumplimiento del 13-09-2026 al 13-10-2026');
    expect(html.match(/<tr>/g)).toHaveLength(1 + list.sessions.length);
  });
});
