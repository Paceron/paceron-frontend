import { Pressable, Text, View } from 'react-native';
import { isWeb } from '../../../utils/platform.js';
import { useThemeColors } from '../../../theme/colors.js';

// Tooltip de un segmento de la barra apilada.
//
// Misma estrategia que el de la línea: overlay `absolute` con `Pressable`
// invisibles encima del SVG, porque react-native-svg no expone `onMouseEnter`.
// Hover en web, tap en nativo.
//
// A diferencia de la línea, el hotspot es un RECTÁNGULO y no un punto: el
// segmento tiene ancho y alto propios, y un hit area circular en el medio de una
// banda angosta deja las partes de arriba y de abajo sin tocar. Con bandas del
// 8 % de una columna, el punto exacto sería casi imposible de acertar.
const MIN_HOTSPOT_H = 10;

const BAND_HEX = {
  met: '#8cc63e',
  near: '#f59e0b',
  missed: '#ba1a1a',
  unknown: '#8b949e',
};

export function StackedBarHotspots({ id, columns, width, plotHeight, active, onActive, onDeactivate }) {
  return (
    <View
      style={{ position: 'absolute', left: 0, top: 0, width, height: plotHeight, pointerEvents: 'box-none' }}
      nativeID={`${id}-hotspots`}
      testID={`${id}-hotspots`}
    >
      {columns.map((column, columnIndex) =>
        column.parts.map((part) => {
          // Una banda de 1 serie se dibuja de 2 px: sin un mínimo de alto el
          // hotspot sería inclicable. Se estira hacia arriba, que es el lado
          // donde está la barra y no la base.
          const hotspotH = Math.max(part.height, MIN_HOTSPOT_H);
          const hotspotY = part.y - (hotspotH - part.height);
          const key = `${columnIndex}-${part.band}`;
          const isActive = active?.columnIndex === columnIndex && active?.band === part.band;

          return (
            <Pressable
              accessibilityHint={`${part.count} ${part.count === 1 ? 'serie' : 'series'}`}
              accessibilityLabel={`${part.label}: ${part.count} ${part.count === 1 ? 'serie' : 'series'}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={key}
              nativeID={`${id}-hotspot-${key}`}
              onHoverIn={isWeb ? () => onActive?.(columnIndex, part.band) : undefined}
              onHoverOut={isWeb ? onDeactivate : undefined}
              onPress={() => onActive?.(columnIndex, part.band)}
              style={{
                position: 'absolute',
                left: column.x,
                top: Math.max(0, hotspotY),
                width: column.width,
                height: hotspotH,
              }}
              testID={`${id}-hotspot-${key}`}
            />
          );
        }),
      )}
      {/* Contorno del segmento activo: sin esto, en una columna con cuatro
          bandas del mismo color visual no se sabe cuál se está leyendo. */}
      {active && columns[active.columnIndex] ? (
        (() => {
          const column = columns[active.columnIndex];
          const part = column.parts.find((p) => p.band === active.band);
          if (!part) return null;
          return (
            <View
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                left: column.x,
                top: part.y,
                width: column.width,
                height: Math.max(part.height, 2),
                borderWidth: 2,
                borderColor: '#0f172a',
                borderRadius: 2,
              }}
              nativeID={`${id}-active-${active.columnIndex}-${active.band}`}
              testID={`${id}-active-${active.columnIndex}-${active.band}`}
            />
          );
        })()
      ) : null}
    </View>
  );
}

// El conteo y el porcentaje salen de `part`, que `stackedBar100` ya calcula: el
// gráfico es al 100 %, así que el alto del segmento es la proporción y el
// `share` es exactamente lo que el usuario está viendo.
export function StackedBarTooltip({ id, active, columns, buckets, width }) {
  if (!active || !columns[active.columnIndex]) return null;
  const column = columns[active.columnIndex];
  const part = column.parts.find((p) => p.band === active.band);
  if (!part) return null;

  const flip = column.x + column.width > width * 0.55;
  const count = part.count;
  const periodLabel = buckets?.[active.columnIndex]?.label ?? '';

  return (
    <View
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        top: Math.max(0, part.y - 8),
        left: flip ? undefined : column.x + column.width + 10,
        right: flip ? width - column.x + 10 : undefined,
        alignItems: flip ? 'flex-end' : 'flex-start',
      }}
      nativeID={`${id}-tooltip`}
      testID={`${id}-tooltip`}
    >
      <View
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm dark:border-slate-600 dark:bg-surface-2"
        nativeID={`${id}-tooltip-box`}
        testID={`${id}-tooltip-box`}
      >
        {periodLabel ? (
          <Text className="text-[11px] font-medium text-slate-500 dark:text-slate-400" nativeID={`${id}-tooltip-x`} testID={`${id}-tooltip-x`}>
            {periodLabel}
          </Text>
        ) : null}
        <View className="mt-0.5 flex-row items-center gap-1.5" nativeID={`${id}-tooltip-row`} testID={`${id}-tooltip-row`}>
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BAND_HEX[part.band] ?? '#8b949e' }}
            nativeID={`${id}-tooltip-dot`}
            testID={`${id}-tooltip-dot`}
          />
          <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID={`${id}-tooltip-value`} testID={`${id}-tooltip-value`}>
            {`${count} ${count === 1 ? 'serie' : 'series'}`}
          </Text>
        </View>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-tooltip-band`} testID={`${id}-tooltip-band`}>
          {`${part.label} · ${Math.round(part.share * 100)} %`}
        </Text>
      </View>
    </View>
  );
}
