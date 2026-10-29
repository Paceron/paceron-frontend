import { useState } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BAND_LABELS, DASHBOARD_BANDS } from '../../utils/dashboard-chart.js';
import { formatDelta, formatMetric, hasMetric } from '../../utils/dashboard-format.js';
import { useThemeColors } from '../../theme/colors.js';
import { ChartGrid, ChartGridItem } from './chart-grid.jsx';
import { BoxPlot } from './charts/box-plot.jsx';
import { BulletChart } from './charts/bullet-chart.jsx';
import { ComplianceDonut } from './charts/compliance-donut.jsx';
import { ComplianceTrendChart } from './charts/compliance-trend.jsx';
import { LineChart } from './charts/line-chart.jsx';
import { GranularitySelect } from './granularity-select.jsx';
import { KpiTile } from './kpi-tile.jsx';
import { KpiTooltip } from './kpi-tooltip.jsx';

// Paleta A COMPLETO: hay objetivo de ritmo. Ritmo como número principal, delta
// semántico, cumplimiento, consistencia, evolución y reparto de bandas.
//
// `pacePieces` es lo que separa A completo de A reducido: en false desaparecen el
// gauge y la velocidad esperada, que son las dos piezas que dependen de
// `target_speed_kph`. El resto —cumplimiento, delta, evolución, bandas— es el
// MISMO código en los dos casos: por eso el caso reducido envuelve a este
// componente en vez de duplicar el árbol, que es la vía directa a que las dos
// piezas se desincronicen (design.md D3).
export function PaletteWithTarget({
  id,
  summary,
  timeseries,
  kind,
  pacePieces = true,
  seriesSamples = null,
  granularity,
  onGranularityChange,
  section = 'all',
  forceExpandCharts = false,
}) {
  const colors = useThemeColors();
  // Sube la fila entera mientras haya un tooltip abierto: el de cada KPI vive
  // dentro de la fila y sin esto compite contra la card hermana de abajo.
  //
  // Quien sube es la CELDA y, con ella, la FILA — no el bubble. En web
  // react-native-web le pone `position: relative; z-index: 0` a todo `View`, o
  // sea que cada una es un stacking context: un `z-index` alto en el bubble
  // queda encerrado en su celda y la celda de al lado (o la card de abajo, que
  // se pinta despues) lo tapa igual.
  const [openTooltip, setOpenTooltip] = useState(null);
  // Ancho del cuerpo de la card de cumplimiento: decide si la curva y el anillo
  // van en fila. Se mide la card y no el viewport porque el dashboard vive dentro
  // del shell con sidebar, así que la ventana no es el ancho disponible (mismo
  // criterio que la tabla del ranking).
  const [periodsWidth, setPeriodsWidth] = useState(0);
  const units = summary?.units ?? {};
  const totals = summary?.totals ?? {};
  const buckets = timeseries?.buckets ?? [];
  const speedBuckets = buckets.map((bucket) => ({ label: bucket.period_start, value: bucket.achieved_speed_kph }));
  const targetBuckets = buckets.map((bucket) => ({ label: bucket.period_start, value: bucket.target_speed_kph }));
  const periodBuckets = buckets.map((bucket) => ({ label: shortLabel(bucket.period_start), counts: bucket.band_counts }));
  // Totales del anillo: la suma de los conteos que ya vienen calculados por la
  // API, uno por banda. El front no reclasifica nada.
  const bandTotals = DASHBOARD_BANDS.reduce((acc, band) => {
    acc[band] = buckets.reduce((sum, bucket) => sum + (Number(bucket?.band_counts?.[band]) || 0), 0);
    return acc;
  }, {});
  const periodsWide = periodsWidth >= 620;
  // La bajada de la evolución depende de la paleta: en A reducido no hay
  // `target_speed_kph`, así que hablar de la referencia punteada sería describir
  // una línea que no existe.
  const evolutionDescription = pacePieces
    ? 'Ritmo logrado período a período, agrupado según la granularidad elegida (sesión, semana, mes o trimestre). Los períodos sin series válidas cortan la línea en vez de caer a cero, y la referencia punteada es la velocidad esperada del objetivo vigente.'
    : 'Ritmo logrado período a período, agrupado según la granularidad elegida (sesión, semana, mes o trimestre). Este ejercicio no tiene velocidad esperada cargada, así que la línea va sin referencia contra la que compararse.';

  return (
    <View nativeID={`${id}-root`} testID={`${id}-root`}>
      {section !== 'charts' ? (
        <>
      {/* Las SEIS cifras de la pantalla, del mismo tamaño y en dos filas de tres.
          Ritmo promedio y Velocidad esperada son dos tarjetas y no un velocímetro:
          el gauge mostraba exactamente esos dos números en un dial, o sea que la
          unificación de la cifra con el gauge terminó siendo redundante — el
          velocímetro queda afuera y con él un widget entero.

          2×3 y no 6 en fila: el contenedor es `max-w-3xl` (768 px), así que seis
          en fila darían 128 px cada una. Tres por fila dan ~250 px.

          `w-1/3` + `p-1` con márgenes negativos en el padre: los gutters son el
          padding de cada celda y los márgenes negativos lo cancelan, así el
          container mide exacto su ancho sin sumar los gaps.

          `relative` + `zIndex` es lo que saca el tooltip de debajo de la card
          siguiente, que es su HERMANA y se pinta después en el orden del árbol.
          En web el `z-index` solo cuenta si hay `position`, por eso van juntos. */}
      <View
        className="-mx-1 -my-1 mb-6 flex-row flex-wrap"
        style={{ position: 'relative', zIndex: openTooltip ? 1 : 0 }}
        nativeID={`${id}-kpis`}
        testID={`${id}-kpis`}
      >
        {[
          {
            key: 'pace',
            label: 'Ritmo promedio',
            value: totals.achieved_speed_kph,
            unit: units.speed,
            icon: 'speedometer',
          },
          {
            key: 'target_speed',
            label: 'Velocidad esperada',
            value: totals.target_speed_kph,
            unit: units.speed,
            icon: 'target',
            // Sin objetivo no hay contra qué comparar: se muestra "—" con su
            // etiqueta en vez de esconder la tarjeta, para que se entienda que
            // el número existe pero no está cargado.
            hint: hasMetric(totals.target_speed_kph)
              ? 'Velocidad esperada del objetivo congelado de este ejercicio.'
              : 'Este ejercicio no tiene velocidad esperada cargada.',
          },
          {
            key: 'delta',
            label: 'Delta contra objetivo',
            value: totals.delta_pct,
            unit: units.delta,
            icon: 'swap-vertical',
          },
          {
            key: 'compliance',
            label: 'Cumplimiento',
            value: totals.compliance_rate,
            unit: units.compliance,
            icon: 'check-decagram-outline',
          },
          {
            key: 'consistency',
            // La fórmula del cv se indexa por `cv`, que es como se llama el campo
            // en el contrato (`consistency.cv`).
            label: 'Consistencia',
            value: summary?.consistency?.cv,
            icon: 'chart-bell-curve',
          },
          {
            key: 'best_time',
            label: 'Mejor tiempo',
            value: totals.best_time_ms,
            unit: units.best_time,
            icon: 'timer-outline',
          },
        ].map((kpi) => (
          <View
            className="w-1/3 p-1"
            key={kpi.key}
            nativeID={`${id}-kpi-cell-${kpi.key}`}
            style={{ zIndex: openTooltip === kpi.key ? 1 : 0 }}
            testID={`${id}-kpi-cell-${kpi.key}`}
          >
          <KpiTooltip
            formula={FORMULAS[kpi.key === 'consistency' ? 'cv' : kpi.key]}
            hint={kpi.hint}
            id={`${id}-kpi-${kpi.key}-tooltip`}
            onOpenChange={(open) =>
              setOpenTooltip((current) => (open ? kpi.key : current === kpi.key ? null : current))
            }
            seriesCount={summary?.series_count ?? null}
            tolerance={summary?.tolerance_applied}
            unit={kpi.unit}
            value={kpi.value}
          >
            {(hovered) => (
              <KpiTile
                delta={kpi.key === 'delta' ? totals.delta_pct : undefined}
                deltaUnit={units.delta}
                hovered={hovered}
                icon={kpi.icon}
                id={`${id}-kpi-${kpi.key}`}
                label={kpi.label}
                unit={kpi.unit}
                value={kpi.value}
              />
            )}
          </KpiTooltip>
          </View>
        ))}
      </View>

      <Text className="text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${id}-footnote`} testID={`${id}-footnote`}>
        {hasMetric(totals.delta_pct)
          ? `Delta ${formatDelta(totals.delta_pct, units.delta)} contra el objetivo (positivo es mejora).`
          : 'Sin objetivo cargado en el período: el delta no se calcula.'}
      </Text>
      {!hasTarget(summary) ? (
        <View className="mt-1 flex-row items-center gap-1" nativeID={`${id}-no-target-note`} testID={`${id}-no-target-note`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="information-outline" size={13} />
          <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-no-target-note-text`} testID={`${id}-no-target-note-text`}>
            El objetivo de este ejercicio no está cargado en el período.
          </Text>
        </View>
      ) : null}
        </>
      ) : null}

      {/* Los gráficos arrancan minimizados en una grilla de dos columnas. El
          estado de qué está maximizado vive en `ChartGrid` y no en cada tarjeta:
          el control "Maximizar todos" necesita el conjunto completo. */}
      {section !== 'kpis' ? (
      <ChartGrid
        forceExpanded={forceExpandCharts}
        id={`${id}-chart-grid`}
        ids={chartGridIds(id, seriesSamples)}
        initialExpandedId={`${id}-evolution-card`}
      >
        <ChartGridItem
          description="Porcentaje de las series con objetivo cargado que lo cumplieron dentro de la tolerancia aplicada. La barra no se estira más allá del objetivo: la escala termina en 100 %, y las muescas del track marcan 80 % (falta) y 95 % (cerca)."
          icon="gauge"
          id={`${id}-compliance-card`}
          preview={(
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-compliance-preview`} testID={`${id}-compliance-preview`}>
              {`Cumplimiento ${formatMetric(totals.compliance_rate, units.compliance)}`}
            </Text>
          )}
          subtitle={hasMetric(summary?.tolerance_applied) ? `Tolerancia aplicada ${Math.round(summary.tolerance_applied * 1000) / 10} %` : undefined}
          title="Cumplimiento del objetivo"
        >
          <BulletChart
            id={`${id}-bullet`}
            label={`Cumplimiento del objetivo: ${formatMetric(totals.compliance_rate, units.compliance)}`}
            target={100}
            unit={units.compliance}
            value={totals.compliance_rate}
          />
        </ChartGridItem>

        <ChartGridItem
          action={onGranularityChange ? (
            <GranularitySelect enabled={Boolean(timeseries)} id={`${id}-granularity`} onChange={onGranularityChange} value={granularity} />
          ) : null}
          description={evolutionDescription}
          icon="chart-line"
          id={`${id}-evolution-card`}
          mobileOrder={-1}
          preview={(
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-evolution-preview`} testID={`${id}-evolution-preview`}>
              {`${formatMetric(totals.achieved_speed_kph, units.speed)} · ${speedBuckets.length} ${speedBuckets.length === 1 ? 'período' : 'períodos'}`}
            </Text>
          )}
          subtitle={pacePieces ? 'Línea continua: ritmo logrado. Línea punteada: velocidad esperada.' : undefined}
          title="Evolución del ritmo"
        >
          <LineChart
            formatX={shortLabel}
            id={`${id}-line`}
            label={`Evolución del ritmo en ${speedBuckets.length} ${speedBuckets.length === 1 ? 'período' : 'períodos'}`}
            primary={speedBuckets}
            secondary={pacePieces ? targetBuckets : []}
            secondaryLabel={pacePieces ? 'La línea punteada es la velocidad esperada del objetivo vigente.' : undefined}
            unit={units.speed}
          />
        </ChartGridItem>

        {seriesSamples && seriesSamples.length ? (
          <ChartGridItem
            description="Cómo se reparten las velocidades de las series del período: la caja abarca el 50 % central de las marcas, la línea del medio es la mediana y los bigotes llegan hasta el resto (los valores atípicos quedan marcados fuera). Es la geometría de la misma distribución de la que sale la consistencia del KPI."
            icon="chart-bell-curve"
            id={`${id}-box-card`}
            preview={(
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-box-preview`} testID={`${id}-box-preview`}>
                {`${seriesSamples.length} ${seriesSamples.length === 1 ? 'serie medida' : 'series medidas'}`}
              </Text>
            )}
            title="Distribución del ritmo por serie"
          >
            <BoxPlot
              id={`${id}-box`}
              label={`Distribución de ${seriesSamples.length} velocidades medidas`}
              unit={units.speed}
              values={seriesSamples}
            />
          </ChartGridItem>
        ) : null}

        <ChartGridItem
          description="El área apilada reparte cada período entre cumplió, cerca, no cumplió y sin dato sobre el total de series con objetivo de ese período; la línea que la recorre es el cumplimiento y el anillo, el total del rango. El eje vertical está fijo en 0–100 % para que dos períodos planos se comparen de verdad, y 'sin dato' se apila contra el techo porque es lo que no se pudo evaluar. Las bandas llegan calculadas por la API: el front no reclasifica nada."
          icon="chart-donut-variant"
          id={`${id}-periods-card`}
          preview={(
            <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-periods-preview`} testID={`${id}-periods-preview`}>
              {`${buckets.length} ${buckets.length === 1 ? 'período' : 'períodos'} con bandas`}
            </Text>
          )}
          title="Cumplimiento por período"
        >
          <View
            nativeID={`${id}-periods-body`}
            onLayout={(event) => setPeriodsWidth(Math.floor(event.nativeEvent.layout.width))}
            testID={`${id}-periods-body`}
          >
            <View
              className={periodsWide ? 'flex-row items-center gap-4' : ''}
              nativeID={`${id}-periods-row`}
              testID={`${id}-periods-row`}
            >
              <View
                className={periodsWide ? 'flex-1' : ''}
                nativeID={`${id}-trend-cell`}
                testID={`${id}-trend-cell`}
              >
                <ComplianceTrendChart
                  buckets={periodBuckets}
                  id={`${id}-trend`}
                  label={`Cumplimiento por período: series que cumplieron, quedaron cerca, no cumplieron y sin dato, ${buckets.length} ${buckets.length === 1 ? 'período' : 'períodos'}`}
                />
              </View>
              <View
                nativeID={`${id}-donut-cell`}
                style={periodsWide ? { width: 176 } : { marginTop: 12 }}
                testID={`${id}-donut-cell`}
              >
                <ComplianceDonut
                  counts={bandTotals}
                  id={`${id}-donut`}
                  label={`Reparto de cumplimiento del período: ${DASHBOARD_BANDS.map((band) => `${BAND_LABELS[band]} ${bandTotals[band]}`).join(', ')}`}
                />
              </View>
            </View>
          </View>
        </ChartGridItem>
      </ChartGrid>
      ) : null}
    </View>
  );
}

// La fórmula de cada KPI, tal como la calcula el backend. Va en el tooltip y NO
// se recalcula acá: el front no reimplementa ni una fórmula, solo muestra de dónde
// sale el número (spec, "indicar la fuente de cada número"). Los nombres de los
// campos son los del dominio del backend (domains/dashboard/*.go).
const FORMULAS = {
  achieved_speed_kph: 'Velocidad ponderada por distancia: suma(distancia × velocidad) ÷ suma(distancia), sobre las series válidas del período.',
  distance_m: 'Suma de la distancia de las series válidas del período.',
  time_ms: 'Suma del tiempo alcanzado de las series válidas del período.',
  best_time_ms: 'El menor tiempo alcanzado entre las series válidas del período.',
  delta: 'Diferencia contra el objetivo en porcentaje. Positivo es mejora: en el eje temporal el signo viene invertido.',
  compliance_rate: 'Series válidas que cumplen el objetivo según la tolerancia aplicada, sobre las series válidas que tienen objetivo cargado.',
  cv: 'Coeficiente de variación de la velocidad (σ ÷ μ) de las series válidas del período. Sin dato con menos de 2 series.',
};

// Los ids de las tarjetas que participan del "maximizar todas". El box plot
// aparece solo cuando hay muestras, así que también entra o sale de la lista.
function chartGridIds(id, seriesSamples) {
  return [
    `${id}-compliance-card`,
    `${id}-evolution-card`,
    ...(seriesSamples && seriesSamples.length ? [`${id}-box-card`] : []),
    `${id}-periods-card`,
  ];
}

function hasTarget(summary) {
  return Boolean(summary?.has_target);
}

// 'YYYY-MM-DD' → 'DD/MM': los buckets llegan en ISO y mostrarlos crudos en el eje
//X suma un año de cuatro dígitos a un gráfico que tiene 180 px de ancho.
function shortLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match ? `${match[3]}/${match[2]}` : String(value ?? '');
}
