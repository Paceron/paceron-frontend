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
//
// Reutilizable fuera del dashboard (Home del corredor): `valueLabel` permite
// pasar el valor YA formateado (el Home formatea fechas y relojes, no solo
// números), `meta` agrega líneas de contexto propias y `showTolerance`/
// `showSeries` apagan las del dashboard cuando no aplican. Los defaults
// mantienen intactos a los consumidores actuales.
export function KpiTooltip({
  id,
  hint,
  formula,
  tolerance,
  seriesCount,
  unit,
  value,
  valueLabel,
  meta = [],
  showTolerance = true,
  showSeries = true,
  children,
  onOpenChange,
}) {
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

  const valueLabelResolved = valueLabel ?? (hasMetric(value) ? formatMetric(value, unit) : EMPTY_METRIC);

  return (
    <View className="relative" nativeID={`${id}-root`} testID={`${id}-root`}>
      <Pressable
        accessibilityHint={hint ?? valueLabelResolved}
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
          // Un solo tema para el bubble, sin `dark:`. Gris oscuro + borde azul
          // + texto blanco funciona igual sobre las tarjetas KPI, que son
          // ambar en los dos modos: un bubble claro se perdia sobre amber-50 en
          // modo claro, y las variantes `dark:` lo hacian translucido sobre el
          // fondo oscuro. Sin ramas de tema no hay nada que sincronizar.
          //
          // El fondo va TAMBIEN inline y opaco: `bg-slate-800` solo dejo pasar
          // el fondo en oscuro en su momento, y este color no depende del tema,
          // asi que fijarlo en `style` no tiene contraindicaciones.
          className="absolute left-0 right-0 top-full mt-1.5 rounded-lg border-2 border-blue-500 bg-slate-800 p-3 shadow-2xl"
          // `zIndex` aca solo ordena el bubble dentro de su celda. En web NO
          // alcanza para salir de ella: react-native-web le pone `position:
          // relative; z-index: 0` a TODO `View`, asi que cada una es su propio
          // stacking context y un z-index maximo queda encerrado. Quien tiene
          // que subir es la celda (y su fila) — ver `openCell`/`openRow` en las
          // paletas.
          style={{ backgroundColor: '#1e293b', zIndex: 2147483647 }}
          nativeID={`${id}-bubble`}
          testID={`${id}-bubble`}
        >
          {formula ? (
            <Text className="text-[11px] leading-4 text-white" nativeID={`${id}-bubble-formula`} testID={`${id}-bubble-formula`}>
              {formula}
            </Text>
          ) : null}
          {showTolerance ? (
            <Text className="mt-1 text-[11px] leading-4 text-slate-100" nativeID={`${id}-bubble-tolerance`} testID={`${id}-bubble-tolerance`}>
              {`Tolerancia aplicada: ${toleranceLabel(tolerance)}`}
            </Text>
          ) : null}
          {showSeries ? (
            <Text className="text-[11px] leading-4 text-slate-100" nativeID={`${id}-bubble-series`} testID={`${id}-bubble-series`}>
              {seriesCount === null || seriesCount === undefined
                ? 'Series usadas: sin dato'
                : `Series usadas: ${seriesCount}`}
            </Text>
          ) : null}
          {meta.length ? (
            <View className="mt-1" nativeID={`${id}-bubble-meta`} testID={`${id}-bubble-meta`}>
              {meta.map((line, index) => (
                <Text
                  className="text-[11px] leading-4 text-slate-300"
                  key={`${line}-${index}`}
                  nativeID={`${id}-bubble-meta-${index}`}
                  testID={`${id}-bubble-meta-${index}`}
                >
                  {line}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function toleranceLabel(tolerance) {
  const value = Number(tolerance);
  return Number.isFinite(value) ? `${Math.round(value * 1000) / 10} %` : EMPTY_METRIC;
}
