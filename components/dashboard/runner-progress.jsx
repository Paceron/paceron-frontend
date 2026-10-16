import { Text, View } from 'react-native';
import { ChartCard } from './charts/chart-surface.jsx';
import { RadarChart } from './charts/radar-chart.jsx';
import { PaletteSwitch } from './palette-switch.jsx';
import { PALETTE_CASES, describePalette } from '../../utils/dashboard-palette.js';

// Variante de la pantalla para el CORREDOR: KPIs, evolución, radar, cumplimiento
// y el detalle de series.
//
// Lo que la define es lo que NO importa: este archivo no importa
// `leaderboard-table.jsx` ni `comparison-strip.jsx`, y eso no es una preferencia
// de estilo sino la regla de la pantalla — con un solo corredor, un ranking de
// una fila y una comparación consigo mismo no son información, son ruido. Además
// el backend responde 403 a `/leaderboard` y a los dos `/comparisons` cuando el
// llamador no es el dueño del equipo, así que la regla no queda solo en la UI.
//
// El radar se muestra acá y no en la pantalla porque su condición (paleta A) es
// distinta de la del rol: se pinta también en A reducido, donde el eje de Ritmo
// queda fuera del polígono por `target_speed_kph: null` en vez de inventarse.
export function RunnerProgress({ id = 'dashboard-runner', summary, timeseries, kind, seriesSamples = null, granularity, onGranularityChange }) {
  const palette = describePalette(summary, kind);
  const showRadar = palette.case !== PALETTE_CASES.withoutTarget;

  return (
    <View nativeID={id} testID={id}>
      <PaletteSwitch
        granularity={granularity}
        onGranularityChange={onGranularityChange}
        id={`${id}-palette`}
        kind={kind}
        seriesSamples={seriesSamples}
        summary={summary}
        timeseries={timeseries}
      />
      {showRadar ? (
        <ChartCard
          icon="radar"
          id={`${id}-radar-card`}
          subtitle="Cada eje muestra su valor real al lado: el área del radar es un resumen, no el dato."
          title="Tu perfil en cinco ejes"
        >
          <RadarChart id={`${id}-radar`} summary={summary} units={summary?.units} />
        </ChartCard>
      ) : (
        <Text className="text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${id}-no-radar`} testID={`${id}-no-radar`}>
          Sin objetivo cargado no hay radar: la mayoría de los ejes no se pueden normalizar contra nada.
        </Text>
      )}
    </View>
  );
}
