import { View } from 'react-native';

// Relleno de izquierda a derecha dentro de un botón, según `fraction` (0-1,
// estimado -- ver hooks/use-estimated-progress.js). El Pressable que lo
// envuelve necesita `overflow-hidden` para que el relleno quede recortado a
// su forma (rounded-full no recorta hijos por sí solo en RN); se monta como
// PRIMER hijo para que quede detrás del label/spinner (RN pinta hijos en
// orden de declaración).
export function ProgressFillOverlay({ fraction, idPrefix }) {
  if (!fraction) return null;
  return (
    <View
      className="absolute bottom-0 left-0 top-0 bg-white/25"
      nativeID={`${idPrefix}-progress-fill`}
      style={{ width: `${Math.round(fraction * 100)}%` }}
      testID={`${idPrefix}-progress-fill`}
    />
  );
}
