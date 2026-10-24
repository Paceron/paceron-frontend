import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EMPTY_METRIC, formatDelta, formatMetric, formatVerdict, hasMetric, verdictIcon } from '../../utils/dashboard-format.js';
import { useThemeColors } from '../../theme/colors.js';
import { InfoHint } from './info-hint.jsx';

// Período actual contra el anterior de la misma longitud.
//
// La diferencia de cumplimiento va en PUNTOS PORCENTUALES ("−6 pp") y no como
// porcentaje relativo ("−9,4 %"): son dos números distintos, el relativo
// exagera las caídas y subestima las subidas cerca de valores altos, y `pp` es lo
// que devuelve la API (design.md D6). `best_time_pct` ya viene con el signo
// invertido —bajar el tiempo es mejorar— y no se toca acá.
//
// `best_time_pct` también es un porcentaje RELATIVO y no un delta de tiempo: se
// rotula con su propio nombre para que no se lea como una magnitud comparable con
// los puntos porcentuales de al lado.
const METRICS = [
  { key: 'series', label: 'Series', unitKey: null },
  { key: 'distance_pct', label: 'Distancia', unitKey: 'delta' },
  { key: 'speed_pct', label: 'Ritmo', unitKey: 'delta' },
  { key: 'compliance_pp', label: 'Cumplimiento', unitKey: 'percentage_point' },
  { key: 'best_time_pct', label: 'Mejor tiempo', unitKey: 'delta' },
];

const VERDICT_STYLES = {
  improving: { text: 'text-[#3c6b12] dark:text-primary', icon: '#8cc63e' },
  stable: { text: 'text-slate-500 dark:text-slate-400', icon: null },
  regressing: { text: 'text-red-600 dark:text-red-400', icon: '#ba1a1a' },
};

const TITLE = 'Frente al período anterior';
// La bajada va en la "i" del título (ver `InfoHint`); el rango comparado sigue
// visible abajo, que es el dato sin el cual los deltas no significan nada.
const DESCRIPTION =
  'Compara el período elegido contra el anterior de la misma duración. La diferencia de cumplimiento va en puntos porcentuales (pp) y no como porcentaje relativo, que exagera las caídas cerca de valores altos; en Mejor tiempo el signo ya viene invertido, así que un número negativo es una mejora. El veredicto se marca con un umbral de 2 pp.';

export function ComparisonStrip({ id = 'dashboard-comparison', data, rangeLabel }) {
  const colors = useThemeColors();
  if (!data) return null;

  const current = data.current ?? null;
  const previous = data.previous ?? null;
  const delta = data.delta ?? null;
  const verdict = data.verdict ?? null;
  const units = data.units ?? {};
  const style = VERDICT_STYLES[verdict] ?? null;

  return (
    <View className="mb-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-surface" nativeID={id} testID={id}>
      <View className="flex-row items-center gap-2 border-b border-slate-100 p-4 dark:border-slate-800" nativeID={`${id}-header`} testID={`${id}-header`}>
        <MaterialCommunityIcons color={colors.primary} name="compare-horizontal" size={16} />
        <View className="min-w-0 flex-1 flex-row items-center gap-1.5" nativeID={`${id}-heading`} testID={`${id}-heading`}>
          <Text className="min-w-0 shrink text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-title`} testID={`${id}-title`}>
            {TITLE}
          </Text>
          <InfoHint description={DESCRIPTION} id={`${id}-info`} title={TITLE} />
        </View>
        {verdict ? (
          <View className="flex-row items-center gap-1" nativeID={`${id}-verdict`} testID={`${id}-verdict`}>
            <MaterialCommunityIcons color={style?.icon ?? colors.onSurfaceVariant} name={verdictIcon(verdict)} size={14} />
            <Text className={`text-xs font-semibold ${style?.text ?? 'text-slate-500 dark:text-slate-400'}`} nativeID={`${id}-verdict-label`} testID={`${id}-verdict-label`}>
              {formatVerdict(verdict)}
            </Text>
          </View>
        ) : null}
      </View>

      {rangeLabel ? (
        <Text className="px-4 pt-2 text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-range`} testID={`${id}-range`}>
          {rangeLabel}
        </Text>
      ) : null}

      {!delta || !previous ? (
        <Text className="p-4 text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-no-delta`} testID={`${id}-no-delta`}>
          No hay series válidas en los dos períodos como para comparar.
        </Text>
      ) : (
        METRICS.map((metric) => {
          const value = delta[metric.key];
          return (
            <View
              className="flex-row items-center justify-between border-b border-slate-50 px-4 py-2.5 last:border-b-0 dark:border-slate-800/60"
              key={metric.key}
              nativeID={`${id}-${metric.key}`}
              testID={`${id}-${metric.key}`}
            >
              <Text className="text-xs text-slate-600 dark:text-slate-300" nativeID={`${id}-${metric.key}-label`} testID={`${id}-${metric.key}-label`}>
                {metric.label}
              </Text>
              <View className="flex-row items-center gap-3" nativeID={`${id}-${metric.key}-values`} testID={`${id}-${metric.key}-values`}>
                <Text className="text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${id}-${metric.key}-previous`} testID={`${id}-${metric.key}-previous`}>
                  {previousValue(metric.key, previous, units)}
                </Text>
                <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-${metric.key}-delta`} testID={`${id}-${metric.key}-delta`}>
                  {hasMetric(value) ? formatDelta(value, units[metric.unitKey]) : EMPTY_METRIC}
                </Text>
              </View>
            </View>
          );
        })
      )}

      <View className="px-4 py-2" nativeID={`${id}-current-row`} testID={`${id}-current-row`}>
        <Text className="text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${id}-current-caption`} testID={`${id}-current-caption`}>
          {current ? `Período actual: ${current.series} series` : 'Sin datos del período actual'}
        </Text>
      </View>
    </View>
  );
}

// El valor del período ANTERIOR de la misma magnitud. `series` y el resto no son
// la misma magnitud con la misma clave (el conteo de series vive en
// `current.series`, no en `delta.series`), así que se resuelve a mano en vez de
// con un mapa que mentiría.
function previousValue(key, previous, units) {
  switch (key) {
    case 'series':
      return hasMetric(previous.series) ? `${previous.series} series` : EMPTY_METRIC;
    case 'distance_pct':
      return hasMetric(previous.total_distance_m) ? formatMetric(previous.total_distance_m, units.distance) : EMPTY_METRIC;
    case 'speed_pct':
      return hasMetric(previous.mean_speed_kph) ? formatMetric(previous.mean_speed_kph, units.speed) : EMPTY_METRIC;
    case 'compliance_pp':
      return hasMetric(previous.compliance_rate) ? formatMetric(previous.compliance_rate, units.compliance) : EMPTY_METRIC;
    case 'best_time_pct':
      return hasMetric(previous.best_time_ms) ? formatMetric(previous.best_time_ms, units.best_time) : EMPTY_METRIC;
    default:
      return EMPTY_METRIC;
  }
}
