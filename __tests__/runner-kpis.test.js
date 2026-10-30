import {
  MONTHS_ES,
  PERIOD_OPTIONS,
  RUNNER_KPI_ROWS,
  RUNNER_KPI_TABS,
  buildPeriodTitle,
  formatDistanceM,
  formatRunnerKpiValue,
  runnerKpisQueryKey,
} from '../utils/runner-kpis.js';
import { formatMetric } from '../utils/dashboard-format.js';

describe('runner-kpis — títulos de período', () => {
  test('los doce meses salen de MONTHS_ES, en capitalizado y sin preposición', () => {
    MONTHS_ES.forEach((month, index) => {
      const mm = String(index + 1).padStart(2, '0');
      const title = buildPeriodTitle({
        period: 'month',
        from: `2026-${mm}-01`,
        to: `2026-${mm}-28`,
        daysConsidered: 28,
      });
      expect(title).toBe(`${month} 2026 · 28 días considerados`);
    });
  });

  test('febrero bisiesto usa los días que devuelve el backend, sin recalcular', () => {
    expect(buildPeriodTitle({
      period: 'month',
      from: '2028-02-01',
      to: '2028-02-29',
      daysConsidered: 29,
    })).toBe('Febrero 2028 · 29 días considerados');
  });

  test('la semana que cruza de mes muestra los dos extremos', () => {
    expect(buildPeriodTitle({
      period: 'week',
      from: '2026-10-26',
      to: '2026-11-01',
      daysConsidered: 7,
    })).toBe('26/10/2026 al 01/11/2026 · 7 días considerados');
  });

  test('un solo día usa el singular', () => {
    expect(buildPeriodTitle({
      period: 'day',
      from: '2026-10-28',
      to: '2026-10-28',
      daysConsidered: 1,
    })).toBe('28/10/2026 · 1 día considerado');
  });

  test('el mes completo usa plural', () => {
    expect(buildPeriodTitle({
      period: 'month',
      from: '2026-10-01',
      to: '2026-10-31',
      daysConsidered: 31,
    })).toBe('Octubre 2026 · 31 días considerados');
  });

  test('sin fechas no inventa un rango: solo informa los días', () => {
    expect(buildPeriodTitle({ period: 'month', daysConsidered: 31 })).toBe('31 días considerados');
  });
});

describe('runner-kpis — contrato de tabs y filas', () => {
  test('las cuatro pestañas respetan orden, label y tab', () => {
    expect(RUNNER_KPI_TABS).toEqual([
      { tab: 'general', label: 'Números generales' },
      { tab: 'ritmo_continuo', label: 'Ritmo continuo' },
      { tab: 'velocidad_tiempo', label: 'Velocidad en tiempo' },
      { tab: 'velocidad_distancia', label: 'Velocidad en distancia' },
    ]);
  });

  test('el selector de período ofrece Mes, Semana y Día', () => {
    expect(PERIOD_OPTIONS).toEqual([
      { period: 'month', label: 'Mes' },
      { period: 'week', label: 'Semana' },
      { period: 'day', label: 'Día' },
    ]);
  });

  test('cada pestaña muestra exactamente sus filas', () => {
    expect(RUNNER_KPI_ROWS.general.map((row) => row.field)).toEqual([
      'total_distance_m',
      'best_day_distance_m',
      'best_day_date',
      'best_speed_kph',
      'average_speed_kph',
    ]);
    expect(RUNNER_KPI_ROWS.ritmo_continuo.map((row) => row.field)).toEqual([
      'total_distance_m',
      'average_speed_kph',
      'best_speed_kph',
      'best_distance_m',
    ]);
    expect(RUNNER_KPI_ROWS.velocidad_tiempo.map((row) => row.field)).toEqual([
      'total_distance_m',
      'average_speed_kph',
      'best_time_ms',
    ]);
    expect(RUNNER_KPI_ROWS.velocidad_distancia.map((row) => row.field)).toEqual([
      'total_distance_m',
      'average_speed_kph',
      'best_speed_kph',
    ]);
  });

  test('el label del promedio general es corto y el alcance vive en la fórmula', () => {
    const row = RUNNER_KPI_ROWS.general.find((candidate) => candidate.field === 'average_speed_kph');
    expect(row.label).toBe('Velocidad promedio');
    expect(row.formula).toMatch(/solo con series de ritmo continuo/);
  });

  test('cada fila trae ícono y fórmula para la card y su tooltip', () => {
    Object.values(RUNNER_KPI_ROWS).flat().forEach((row) => {
      expect(typeof row.icon).toBe('string');
      expect(row.icon.length).toBeGreaterThan(0);
      expect(typeof row.formula).toBe('string');
      expect(row.formula.length).toBeGreaterThan(0);
    });
  });

  test('la pestaña de distancia se llama "Velocidad en distancia"', () => {
    expect(RUNNER_KPI_TABS[3].label).toBe('Velocidad en distancia');
  });
});

describe('runner-kpis — formato de valores', () => {
  test('la distancia corta queda en metros enteros', () => {
    expect(formatDistanceM(850)).toBe('850 m');
    expect(formatDistanceM(999)).toBe('999 m');
    expect(formatDistanceM(0)).toBe('0 m');
  });

  test('desde 1000 m se muestra en km con un decimal', () => {
    expect(formatDistanceM(1000)).toBe('1,0 km');
    expect(formatDistanceM(12400)).toBe('12,4 km');
    expect(formatDistanceM(84250)).toBe('84,3 km');
  });

  test('un null de distancia es "—", nunca 0', () => {
    expect(formatDistanceM(null)).toBe('—');
    expect(formatDistanceM(undefined)).toBe('—');
    expect(formatRunnerKpiValue('total_distance_m', null)).toBe('—');
  });

  test('la velocidad se escribe en km/h, no en porcentaje', () => {
    expect(formatRunnerKpiValue('best_speed_kph', 16.4)).toBe('16,4 km/h');
    expect(formatRunnerKpiValue('best_speed_kph', 112.4)).toBe('112,4 km/h');
    expect(formatRunnerKpiValue('best_speed_kph', 112.4)).not.toContain('%');
  });

  test('la velocidad siempre muestra un decimal, también en enteros', () => {
    expect(formatRunnerKpiValue('best_speed_kph', 20)).toBe('20,0 km/h');
    expect(formatRunnerKpiValue('average_speed_kph', 0)).toBe('0,0 km/h');
    expect(formatRunnerKpiValue('best_speed_kph', null)).toBe('—');
  });

  test('el tiempo se escribe como reloj', () => {
    expect(formatRunnerKpiValue('best_time_ms', 1380000)).toBe('23:00');
    expect(formatRunnerKpiValue('best_time_ms', 3930000)).toBe('1:05:30');
  });

  test('la fecha del mejor día se muestra DD/MM/YYYY', () => {
    expect(formatRunnerKpiValue('best_day_date', '2026-10-11')).toBe('11/10/2026');
  });

  test('una fecha nula no rompe la tabla: muestra "—"', () => {
    expect(formatRunnerKpiValue('best_day_date', null)).toBe('—');
    expect(formatRunnerKpiValue('best_day_date', '')).toBe('—');
  });

  test('el formato heredado del dashboard sigue escribiendo porcentajes con coma', () => {
    // La tarjeta no tiene métricas de porcentaje; este caso fija el formateador
    // compartido que usa para velocidad y tiempo.
    expect(formatMetric(112.4, '%')).toBe('112,4 %');
  });
});

describe('runner-kpis — query key', () => {
  const BASE = { period: 'month', referenceDate: '2026-10-28', tab: 'general' };

  test('la key base tiene el prefijo que invalida el Home', () => {
    const key = runnerKpisQueryKey(BASE);
    expect(key).toEqual(['runner-kpis', 'month', '2026-10-28', 'general']);
    expect(key[0]).toBe('runner-kpis');
  });

  test('cambiar período, fecha o pestaña cambia la key', () => {
    const base = runnerKpisQueryKey(BASE);
    expect(runnerKpisQueryKey({ ...BASE, period: 'week' })).not.toEqual(base);
    expect(runnerKpisQueryKey({ ...BASE, referenceDate: '2026-10-27' })).not.toEqual(base);
    expect(runnerKpisQueryKey({ ...BASE, tab: 'ritmo_continuo' })).not.toEqual(base);
  });

  test('las tres keys comparten el prefijo runner-kpis', () => {
    const keys = [
      runnerKpisQueryKey(BASE),
      runnerKpisQueryKey({ ...BASE, period: 'week' }),
      runnerKpisQueryKey({ ...BASE, tab: 'velocidad_tiempo' }),
    ];
    keys.forEach((key) => expect(key[0]).toBe('runner-kpis'));
  });
});
