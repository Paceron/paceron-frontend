import {
  CSV_BOM,
  CSV_EOL,
  CSV_SEPARATOR,
  DASHBOARD_SERIES_COLUMNS,
  toCsv,
} from '../utils/dashboard-export.js';

const SERIES = [
  {
    session_date: '2026-09-25',
    athlete_user_id: 41,
    feedback_owner_user_id: 41,
    set_number: 1,
    started_at: '2026-09-25T08:15:00Z',
    ended_at: '2026-09-25T08:16:35Z',
    duration_ms: 95000,
    active_duration_ms: 90000,
    distance_meters: 412.5,
    band: 'met',
    report_source: 'corredor',
  },
];

// Parser mínimo de RFC 4180 para el test. `split(';')` no sirve: una celda
// entrecomillada puede contener el separador, que es justamente el caso que hay
// que verificar.
const parseRow = (line) => {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === CSV_SEPARATOR) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
};

const lines = (csv) => csv.slice(CSV_BOM.length).split(CSV_EOL).map(parseRow);

describe('toCsv — forma del archivo', () => {
  test('arranca con BOM UTF-8, para que la planilla no rompa los acentos', () => {
    expect(toCsv(SERIES).startsWith(CSV_BOM)).toBe(true);
    expect(CSV_BOM).toBe('\uFEFF');
  });

  test('usa ";" porque el destino real es una planilla en español', () => {
    const csv = toCsv(SERIES);
    expect(CSV_SEPARATOR).toBe(';');
    expect(lines(csv)[0]).toHaveLength(DASHBOARD_SERIES_COLUMNS.length);
    // La coma sigue siendo el separador DECIMAL: "412,5" no parte la fila.
    expect(lines(csv)[1]).toContain('412.5');
  });

  test('las filas se separan con CRLF, que es lo que espera Excel', () => {
    expect(toCsv(SERIES)).toContain('\r\n');
    expect(lines(toCsv(SERIES))).toHaveLength(2);
  });

  test('sin filas emite igual el encabezado', () => {
    const csv = toCsv([]);
    expect(lines(csv)).toHaveLength(1);
    expect(lines(csv)[0]).toContain('Fecha');
  });

  test('una entrada que no es una lista no rompe nada', () => {
    expect(lines(toCsv(null))).toHaveLength(1);
    expect(lines(toCsv(undefined))).toHaveLength(1);
    expect(toCsv([null, 'x'])).toContain(CSV_BOM);
  });
});

describe('toCsv — encabezados', () => {
  test('van en español', () => {
    const header = lines(toCsv(SERIES))[0];
    expect(header).toContain('Fecha');
    expect(header).toContain('Número de serie');
    expect(header).toContain('Origen del reporte');
    expect(header).not.toContain('session_date');
  });

  test('la unidad de `units` va en el nombre de la columna', () => {
    expect(lines(toCsv(SERIES))[0]).toContain('Duración (ms)');
    expect(lines(toCsv(SERIES))[0]).toContain('Tiempo activo (ms)');
    expect(lines(toCsv(SERIES))[0]).toContain('Distancia (m)');
  });

  test('lo que declara la API manda sobre la unidad por defecto', () => {
    const header = lines(toCsv(SERIES, { units: { time: 'ms', distance: 'km' } }))[0];
    expect(header).toContain('Duración (ms)');
    expect(header).toContain('Distancia (km)');
  });

  test('distingue quién ejecutó de quién reportó', () => {
    // El leaderboard agrupa por ejecutor: un CSV que no diga quién corrió
    // quién no se puede reconciliar con la pantalla.
    const header = lines(toCsv(SERIES))[0];
    expect(header).toContain('Corredor (user_id)');
    expect(header).toContain('Reportó (user_id)');
    const row = lines(toCsv(SERIES))[1];
    expect(row[header.indexOf('Corredor (user_id)')]).toBe('41');
    expect(row[header.indexOf('Reportó (user_id)')]).toBe('41');
  });

  test('el entrenador y el corredor quedan en filas distintas de verdad', () => {
    const csv = toCsv([
      { athlete_user_id: 41, feedback_owner_user_id: 41, band: 'met' },
      { athlete_user_id: 42, feedback_owner_user_id: 7, band: 'near' },
    ]);
    const [head, first, second] = lines(csv);
    expect(first[head.indexOf('Corredor (user_id)')]).toBe('41');
    expect(second[head.indexOf('Reportó (user_id)')]).toBe('7');
  });

  test('el caller puede pasar sus propias columnas', () => {
    const csv = toCsv([{ ritmo_kph: 12.4 }], {
      columns: [{ key: 'ritmo_kph', header: 'Ritmo', unitKey: 'speed', defaultUnit: 'km/h' }],
    });
    expect(lines(csv)[0]).toEqual(['Ritmo (km/h)']);
    expect(lines(csv)[1]).toEqual(['12.4']);
  });
});

describe('toCsv — celdas ausentes', () => {
  test('un null es celda vacía, nunca la palabra "null" ni un 0', () => {
    const csv = toCsv([{ duration_ms: null, distance_meters: undefined, band: null }]);
    const [head, row] = lines(csv);
    expect(row[head.indexOf('Duración (ms)')]).toBe('');
    expect(row[head.indexOf('Distancia (m)')]).toBe('');
    expect(row[head.indexOf('Cumplimiento')]).toBe('');
    expect(csv).not.toMatch(/null/i);
    // La celda es exactamente el separador de columnas: vacía, no un "0" que
    // la planilla leería como un resultado.
    expect(lines(toCsv([{ duration_ms: 0 }]))[1][lines(toCsv([{ duration_ms: 0 }]))[0].indexOf('Duración (ms)')]).toBe('0');
  });

  test('una serie sin ninguno de los campos exportados sale con la fila vacía', () => {
    const [, row] = lines(toCsv([{}]));
    expect(row.every((cell) => cell === '')).toBe(true);
  });

  test('un cero de verdad se escribe como cero', () => {
    const csv = toCsv([{ duration_ms: 0, distance_meters: 0 }]);
    const [head, row] = lines(csv);
    expect(row[head.indexOf('Duración (ms)')]).toBe('0');
    expect(row[head.indexOf('Distancia (m)')]).toBe('0');
  });

  test('un no-finito no se escribe: NaN en una planilla es texto que alguien suma', () => {
    const csv = toCsv([{ duration_ms: NaN, distance_meters: Infinity }]);
    expect(csv).not.toMatch(/NaN|Infinity/);
    const [head, row] = lines(csv);
    expect(row[head.indexOf('Duración (ms)')]).toBe('');
  });

  test('los enums del backend se copian crudos, sin traducir', () => {
    // Traducirlos haría que el archivo deje de reconciliarse con la respuesta.
    const csv = toCsv([{ band: 'near', report_source: 'entrenador' }]);
    const [head, row] = lines(csv);
    expect(row[head.indexOf('Cumplimiento')]).toBe('near');
    expect(row[head.indexOf('Origen del reporte')]).toBe('entrenador');
  });
});

describe('toCsv — escaping', () => {
  test('entrecomilla lo que tiene separador y duplica las comillas internas', () => {
    const csv = toCsv([{ report_source: 'a;b', band: 'dijo "ok"' }]);
    // En el texto crudo van entrecomilladas...
    expect(csv).toContain('"a;b"');
    expect(csv).toContain('"dijo ""ok"""');
    // ...y al releerlo vuelven a ser las dos celdas de una columna.
    const [head, row] = lines(csv);
    expect(row).toHaveLength(head.length);
    expect(row[head.indexOf('Origen del reporte')]).toBe('a;b');
    expect(row[head.indexOf('Cumplimiento')]).toBe('dijo "ok"');
  });

  test('una coma también va entrecomillada, porque hay lectores que la tratan como separador', () => {
    const csv = toCsv([{ report_source: 'elapsed, 12,4 s' }]);
    expect(csv).toContain('"elapsed, 12,4 s"');
    const [head, row] = lines(csv);
    expect(row[head.indexOf('Origen del reporte')]).toBe('elapsed, 12,4 s');
  });

  test('un salto de línea va entrecomillado y no parte la fila', () => {
    const csv = toCsv([{ report_source: 'primera\nsegunda' }]);
    expect(lines(csv)).toHaveLength(2);
    expect(csv).toContain('"primera\nsegunda"');
  });

  test('un texto simple no lleva comillas de más', () => {
    const csv = toCsv([{ report_source: 'corredor' }]);
    expect(csv).not.toContain('"corredor"');
    expect(lines(csv)[1][lines(csv)[0].indexOf('Origen del reporte')]).toBe('corredor');
  });

  test('un objeto o un array no ensucian la celda con [object Object]', () => {
    const csv = toCsv([{ report_source: { a: 1 }, band: [1, 2] }]);
    expect(csv).not.toMatch(/object Object/);
    const [head, row] = lines(csv);
    expect(row[head.indexOf('Cumplimiento')]).toBe('');
  });
});