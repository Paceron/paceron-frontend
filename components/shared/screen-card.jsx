import { View } from 'react-native';
import { isWeb } from '../../utils/platform.js';

// Card de contenido genérica para toda pantalla -- ver docs/superpowers/specs/
// 2026-10-31-visual-design-refresh-design.md. Resuelve SOLO el nivel de
// adentro (bg/borde/redondeo/padding/ancho máximo en web ancho); el fondo de
// página (bg-paper dark:bg-ink) lo sigue poniendo cada pantalla como hoy.
//
// Claro: sin borde (blanco sobre el nuevo fondo gris ya se distingue solo).
// Oscuro: borde mínimo (`surface-2`) -- el salto `ink`->`surface` es más
// sutil, necesita el borde para leerse como superficie separada.
export function ScreenCard({ children, padded = true, nativeID, testID }) {
  return (
    <View
      className={`w-full self-center rounded-2xl bg-white dark:border dark:border-surface-2 dark:bg-surface ${padded ? 'p-4' : ''} ${isWeb ? 'max-w-3xl' : ''}`}
      nativeID={nativeID}
      testID={testID}
    >
      {children}
    </View>
  );
}
