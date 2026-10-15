import { View } from 'react-native';
import { levelMeta } from '../../utils/achievement-level-meta.js';

// Escala de puntitos 1..N para un logro `leveled` -- nivel actual y los
// que faltan hasta el máximo, pedido 2026-10-14 para ver de un vistazo
// cuánto falta sin tener que abrir el detalle. Lleno con el color del
// nivel (`levelMeta`) si ya se alcanzó, contorno vacío si todavía no.
export function LevelPips({ levels, currentLevel, idPrefix }) {
  if (!levels?.length) return null;

  return (
    <View className="flex-row items-center gap-1" nativeID={idPrefix} testID={idPrefix}>
      {levels.map((level) => {
        const reached = level.level <= currentLevel;
        const meta = levelMeta(level.level);
        const pipId = `${idPrefix}-${level.level}`;
        return (
          <View
            key={level.level}
            nativeID={pipId}
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: reached ? meta.color : 'transparent',
              borderWidth: reached ? 0 : 1.5,
              borderColor: meta.color,
            }}
            testID={pipId}
          />
        );
      })}
    </View>
  );
}
