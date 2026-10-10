import { cloneElement, useState } from 'react';
import { Text, View } from 'react-native';
import { isWeb } from '../../utils/platform.js';

// Tooltip solo-web para botones de solo-ícono -- confirmado decisión del
// usuario 2026-10-09: en mobile no hace nada especial (no hay hover
// táctil), el accessibilityLabel que ya llevan estos botones sigue siendo
// la única pista para lectores de pantalla ahí.
//
// No usa el `title` nativo del DOM porque react-native-web no lo
// reenvía -- confirmado leyendo `forwardedProps` (no está en
// `defaultProps` ni en ninguna otra lista de props permitidas), así que
// un `title="..."` en un `Pressable`/`View` de este repo simplemente se
// pierde en silencio. `onHoverIn`/`onHoverOut` sí son parte de la API
// real de `Pressable` (confirmado en su propia lista de props
// reenviadas) y no-opean en touch por sí solos, sin ninguna rama
// `isWeb` adentro del propio Pressable.
//
// `children` tiene que ser un único elemento Pressable (el botón de
// ícono ya existente en el call site) -- se le inyectan los handlers de
// hover sin que el caller tenga que reescribir su botón.
export function IconTooltip({ label, children, idPrefix, position = 'bottom' }) {
  const [hovered, setHovered] = useState(false);

  if (!isWeb) return children;

  const trigger = cloneElement(children, {
    onHoverIn: () => setHovered(true),
    onHoverOut: () => setHovered(false),
  });

  const positionClass = position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';

  return (
    <View className="relative" nativeID={idPrefix} testID={idPrefix}>
      {trigger}
      {hovered && (
        <View
          className={`absolute left-1/2 z-50 -translate-x-1/2 rounded-md bg-slate-800 px-2 py-1 dark:bg-slate-700 ${positionClass}`}
          nativeID={`${idPrefix}-bubble`}
          pointerEvents="none"
          testID={`${idPrefix}-bubble`}
        >
          <Text className="text-xs text-white" nativeID={`${idPrefix}-bubble-label`} numberOfLines={1} testID={`${idPrefix}-bubble-label`}>
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}
