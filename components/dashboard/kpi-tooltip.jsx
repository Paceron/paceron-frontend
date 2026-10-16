import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { EMPTY_METRIC, formatMetric, hasMetric } from '../../utils/dashboard-format.js';
import { isWeb } from '../../utils/platform.js';

// Tooltip de KPI: la fórmula con la que se calculó el número, la tolerancia
// EFECTIVA que se aplicó (`tolerance_applied` de la respuesta) y cuántas series
// entraron.
//
// Se abre por los tres caminos que hacen falta, no solo por hover:
//   - hover (web): `onHoverIn`/`onHoverOut`, que react-native-web reenvía y en
//     touch no-opean por sí solos.
//   - foco de teclado (web): `onFocus`/`onBlur`. Un tooltip que solo abre con el
//     mouse es invisible para quien navega con Tab.
//   - tap (touch): el primer toque abre, el segundo cierra.
//
// NO reusa `components/shared/icon-tooltip.jsx`: ese es web-only por decisión
// explícita (no hace nada en mobile) y no cubre teclado ni tap — que son
// justamente los dos caminos que la spec exige acá.
//
// El `accessibilityHint` del trigger lleva el valor y la unidad: en móvil el
// tooltip no se abre solo y hace falta que el lector de pantalla lo anuncie sin
// que el usuario tenga que descubrir que existe.
export function KpiTooltip({ id, hint, formula, tolerance, seriesCount, unit, value, children, onOpenChange }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tapped, setTapped] = useState(false);
  const open = hovered || focused || tapped;

  // El padre necesita saber si hay ALGUN tooltip abierto para subir la fila de
  // KPIs por encima de la card hermana de abajo. Sin esto el tooltip se dibuja
  // debajo de "Cumplimiento del objetivo".
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // `hovered` se pasa al hijo para que la card se ponga naranja: el tooltip
  // abriéndose ya es la señal, pero el color marca el área sensible sin tener
  // que acertar el punto. Los hijos que no son función siguen recibiendo el
  // nodo tal cual.
  const child = typeof children === 'function' ? children(hovered) : children;

  const valueLabel = hasMetric(value) ? formatMetric(value, unit) : EMPTY_METRIC;

  return (
    <View className="relative" nativeID={`${id}-root`} testID={`${id}-root`}>
      <Pressable
        accessibilityHint={hint ?? valueLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        nativeID={`${id}-trigger`}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onHoverIn={isWeb ? () => setHovered(true) : undefined}
        onHoverOut={isWeb ? () => setHovered(false) : undefined}
        onPress={() => setTapped((current) => !current)}
        testID={`${id}-trigger`}
      >
        {child}
      </Pressable>
      {open ? (
        <View
          // z-tooltip = 70 (tailwind.config.js), el mismo criterio que
          // IconTooltip: es la única capa que puede aparecer sobre contenido con
          // su propia superficie.
          className="absolute left-0 right-0 top-full z-tooltip mt-1.5 rounded-lg bg-slate-800 p-3 shadow-lg dark:bg-slate-700"
          nativeID={`${id}-bubble`}
          testID={`${id}-bubble`}
        >
          {formula ? (
            <Text className="text-[11px] leading-4 text-white" nativeID={`${id}-bubble-formula`} testID={`${id}-bubble-formula`}>
              {formula}
            </Text>
          ) : null}
          <Text className="mt-1 text-[11px] leading-4 text-slate-300 dark:text-slate-200" nativeID={`${id}-bubble-tolerance`} testID={`${id}-bubble-tolerance`}>
            {`Tolerancia aplicada: ${toleranceLabel(tolerance)}`}
          </Text>
          <Text className="text-[11px] leading-4 text-slate-300 dark:text-slate-200" nativeID={`${id}-bubble-series`} testID={`${id}-bubble-series`}>
            {seriesCount === null || seriesCount === undefined
              ? 'Series usadas: sin dato'
              : `Series usadas: ${seriesCount}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function toleranceLabel(tolerance) {
  const value = Number(tolerance);
  return Number.isFinite(value) ? `${Math.round(value * 1000) / 10} %` : EMPTY_METRIC;
}
