import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Tile de un número con ícono y etiqueta. Extraído de team-detail-screen.jsx
// para reusarlo en el dashboard de pagos. `idPrefix` arma los nativeID/testID
// (`${idPrefix}-${label}`), así team-detail conserva sus ids de siempre.
//
// El padding horizontal es más chico que en el resto de las cards (px-1.5 en
// vez de p-4 parejo) porque las etiquetas largas ("Entrenamientos
// realizados") necesitan ese ancho para partir entre palabras en mobile, con
// 3 tiles flex-1. La etiqueta va en text-[11px] y sin numberOfLines: se deja
// crecer a 2 líneas en vez de truncarse. Con `onPress` se vuelve presionable
// (ej. tocar "Rechazados" filtra la lista).
export function StatTile({ icon, label, value, hint, onPress, active = false, idPrefix = 'stat-tile' }) {
  const colors = useThemeColors();
  const id = `${idPrefix}-${label}`;
  const Container = onPress ? Pressable : View;
  const border = active ? 'border-primary' : 'border-slate-200 dark:border-slate-700';

  return (
    <Container
      className={`flex-1 items-center rounded-2xl border bg-white px-1.5 py-4 dark:bg-surface ${border} ${onPress ? 'hover:opacity-90 active:opacity-80' : ''}`}
      nativeID={id}
      onPress={onPress}
      testID={id}
    >
      <MaterialCommunityIcons color={colors.primary} name={icon} size={22} style={{ marginBottom: 6 }} />
      <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID={`${id}-value`} testID={`${id}-value`}>
        {value}
      </Text>
      <Text className="text-center text-[11px] leading-4 text-slate-500 dark:text-slate-400" nativeID={`${id}-label`} testID={`${id}-label`}>
        {label}
      </Text>
      {hint ? (
        <Text className="mt-1 text-center text-[11px] leading-4 text-slate-400 dark:text-slate-500" nativeID={`${id}-hint`} testID={`${id}-hint`}>
          {hint}
        </Text>
      ) : null}
    </Container>
  );
}
