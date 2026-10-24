import { useState } from 'react';
import { Text, View } from 'react-native';
import { PALETTE_CASES, describePalette } from '../../utils/dashboard-palette.js';
import { ChartCard } from './charts/chart-surface.jsx';
import { AxisBars } from './charts/axis-bars.jsx';
import { BodyScanFigure } from './charts/body-scan-figure.jsx';
import { RadarChart, RADAR_MIN_SIZE, RADAR_SIZE } from './charts/radar-chart.jsx';

// La card del perfil de cinco ejes: figura, pentágono y las mismas cinco cifras
// en barritas. Es UNA sola card para los dos roles (entrenador y corredor) porque
// lo único que cambia entre ellos es el título: "del equipo" contra "tu perfil".
// Antes había dos copias casi iguales —una en la variante del entrenador y otra en
// la del corredor— con los mismos cuatro bloques y los mismos tres números
// medidos, y la del corredor se había quedado sin la figura.
//
// La regla de si hay radar o no es la de la PALETA, no la del rol: se muestra
// también en A reducido, donde el eje de Ritmo queda fuera del polígono por
// `target_speed_kph: null` en vez de inventarse. Por eso la decide acá adentro y
// el llamador no la repite.
//
// Las unidades salen siempre de `summary.units`: el backend manda el MISMO bloque
// `units` en las seis respuestas de métricas (domains/dashboard/units.go), así que
// la variante del entrenador no necesita pedir el leaderboard solo para formatear
// estas barritas.
export function ProfileRadarCard({ id, summary, kind, title = 'Perfil del equipo en cinco ejes' }) {
  // Anchos medidos al vuelo para alinear las barritas con el grupo de arriba
  // (figura + pentágono). Se clava además contra el ancho de la fila (= el de la
  // card): en web un flex item centrado NO se encoge como en Yoga, así que sin el
  // techo las barritas se irían con él.
  const [radarGroupWidth, setRadarGroupWidth] = useState(0);
  const [radarRowWidth, setRadarRowWidth] = useState(0);
  const palette = describePalette(summary, kind);

  if (palette.case === PALETTE_CASES.withoutTarget) {
    return (
      <Text className="text-[11px] text-slate-400 dark:text-slate-500" nativeID={`${id}-no-radar`} testID={`${id}-no-radar`}>
        Sin objetivo cargado no hay radar: la mayoría de los ejes no se pueden normalizar contra nada.
      </Text>
    );
  }

  const axesBarsWidth = radarGroupWidth > 0 && radarRowWidth > 0 ? Math.min(radarGroupWidth, radarRowWidth) : 0;

  return (
    <ChartCard
      icon="radar"
      id={`${id}-card`}
      description="El área del radar es un resumen del equilibrio, no el dato: los cinco valores reales están abajo, eje por eje, y cada uno va de 0 a 100 según su propia escala (la 'i' de cada eje explica contra qué se mide). En un ejercicio con objetivo solo de distancia, el eje de Ritmo sale del polígono en vez de inventarse."
      title={title}
    >
      {/* Figura y pentágono en fila, al mismo alto: la figura da el "de qué es
          esto" y el radar los cinco valores. El radar lleva ancho propio (el
          ChartSurface mide su layout y ya no tiene la tabla vieja que lo
          dimensionaba) y en angosto baja a una segunda fila en vez de salirse de
          la card. */}
      <View
        className="mb-4 w-full items-center"
        nativeID={`${id}-row`}
        onLayout={(event) => setRadarRowWidth(Math.round(event.nativeEvent.layout.width))}
        testID={`${id}-row`}
      >
        <View
          // `max-w-full`: en web un flex item centrado NO se encoge como en Yoga,
          // así que sin el techo el grupo se sale de la card en vez de envolver el
          // radar a una segunda fila.
          className="max-w-full flex-row flex-wrap items-center justify-center gap-6"
          nativeID={`${id}-group`}
          onLayout={(event) => setRadarGroupWidth(Math.round(event.nativeEvent.layout.width))}
          testID={`${id}-group`}
        >
          <BodyScanFigure id={`${id}-body-scan`} />
          <View
            className="shrink"
            nativeID={`${id}-slot`}
            style={{ flexBasis: RADAR_SIZE, minWidth: RADAR_MIN_SIZE }}
            testID={`${id}-slot`}
          >
            <RadarChart id={`${id}-chart`} summary={summary} units={summary?.units} />
          </View>
        </View>
      </View>

      {/* Los mismos cinco ejes del radar, en barritas. El radar contesta "el
          perfil es equilibrado" y las barras "cuánto vale cada eje": comparar 87
          contra 64 en dos barras es mucho más fácil que buscando un vértice en un
          polígono. Las barritas se acotan al ancho del grupo de arriba para que
          las dos piezas se lean como una sola columna: a ancho completo de card
          quedaban descolgadas del gráfico. */}
      <View className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700" nativeID={`${id}-bars`} testID={`${id}-bars`}>
        <View
          className="w-full self-center"
          nativeID={`${id}-bars-column`}
          style={axesBarsWidth ? { maxWidth: axesBarsWidth } : undefined}
          testID={`${id}-bars-column`}
        >
          <AxisBars id={`${id}-bars-chart`} summary={summary} units={summary?.units} />
        </View>
      </View>
    </ChartCard>
  );
}
