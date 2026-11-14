import { METRIC_HELP, documentedMetricIds, metricHelp } from '../utils/metric-help.js';
import { RUNNER_KPI_ROWS } from '../utils/runner-kpis.js';

// El catálogo de ayuda es contenido puro: se puede validar sin montar la
// ventana. Estos tests cubren lo que se rompe en silencio —un bloque con un
// tipo que el renderer no conoce, una tabla con filas de distinto ancho, o una
// tarjeta con "Más información" que apunta a una guía inexistente— y no el
// texto en sí, que es decisión de producto.

const SECTION_KINDS = new Set(['heading', 'paragraph', 'formula', 'table', 'list', 'steps', 'note']);

describe('catálogo de ayuda de métricas', () => {
  test('cada entrada tiene título, resumen y secciones con forma válida', () => {
    for (const entry of Object.values(METRIC_HELP)) {
      expect(entry.title.trim()).not.toHaveLength(0);
      expect(entry.summary.trim()).not.toHaveLength(0);
      expect(entry.sections.length).toBeGreaterThan(0);

      for (const section of entry.sections) {
        expect(SECTION_KINDS.has(section.kind)).toBe(true);

        if (section.kind === 'table') {
          expect(section.columns.length).toBeGreaterThan(0);
          expect(section.rows.length).toBeGreaterThan(0);
          for (const row of section.rows) {
            expect(row).toHaveLength(section.columns.length);
          }
        }

        if (section.kind === 'list' || section.kind === 'steps') {
          expect(section.items.length).toBeGreaterThan(0);
          for (const item of section.items) expect(item.text.trim()).not.toHaveLength(0);
        }

        if (section.kind === 'formula' || section.kind === 'paragraph' || section.kind === 'note') {
          expect(section.text.trim()).not.toHaveLength(0);
        }
      }
    }
  });

  test('las métricas del Home del corredor tienen documentación', () => {
    for (const rows of Object.values(RUNNER_KPI_ROWS)) {
      for (const row of rows) {
        expect(metricHelp(row.field)).not.toBeNull();
      }
    }
  });

  test('las tarjetas de las dos paletas del dashboard tienen documentación', () => {
    const dashboardIds = [
      'achieved_speed_kph',
      'target_speed_kph',
      'delta',
      'compliance_rate',
      'cv',
      'best_time_met_ms',
      'best_time_ms',
      'distance_m',
      'sessions',
      'series',
      'time_ms',
      'no_target',
    ];

    for (const id of dashboardIds) {
      expect(metricHelp(id)).not.toBeNull();
    }
  });

  test('average_speed_kph resuelve a la guía de ritmo promedio', () => {
    expect(metricHelp('average_speed_kph').id).toBe('achieved_speed_kph');
  });

  test('un id desconocido no abre una ventana vacía', () => {
    expect(metricHelp('no_existe')).toBeNull();
    expect(metricHelp(null)).toBeNull();
  });

  test('documentedMetricIds coincide con las claves del catálogo', () => {
    expect(documentedMetricIds()).toEqual(Object.keys(METRIC_HELP));
  });
});
