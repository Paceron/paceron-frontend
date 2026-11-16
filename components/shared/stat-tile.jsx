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
// (ej. tocar "Rechazados" filtra la lista). `actionHint` es la pista de que el
// tile hace algo ("Tocá para filtrar"): sin ella un tile presionable se ve
// igual que uno que solo muestra un número. Sin hint, actionHint ni onPress se
// ve exactamente igual que antes: attendance-metric-cards.jsx alinea sus
// tarjetas contra esa altura. `colors` es opcional (algunos consumidores lo
// pasan); si no viene, sale del tema. `layout="horizontal"` pone el ícono y el
// par valor/etiqueta en una sola línea para resúmenes compactos.
export function StatTile({ icon, label, value, hint, actionHint, onPress, active = false, idPrefix = 'stat-tile', colors: colorsProp, surface = 'bg-white dark:bg-surface', layout = 'vertical' }) {
  const themeColors = useThemeColors();
  const colors = colorsProp ?? themeColors;
  const id = `${idPrefix}-${label}`;
  const Container = onPress ? Pressable : View;
  const border = active ? 'border-primary' : 'border-slate-200 dark:border-slate-700';
  const horizontal = layout === 'horizontal';

  return (
    <Container
      className={`flex-1 ${horizontal ? 'flex-row items-center gap-2.5 px-3 py-3' : 'items-center px-1.5 py-4'} rounded-2xl border ${surface} ${border} ${onPress ? 'hover:opacity-90 active:opacity-80' : ''}`}
      nativeID={id}
      onPress={onPress}
      testID={id}
    >
      <MaterialCommunityIcons color={colors.primary} name={icon} size={horizontal ? 20 : 22} style={horizontal ? undefined : { marginBottom: 6 }} />
      <View className={horizontal ? 'min-w-0 flex-1' : 'items-center'} nativeID={`${id}-content`} testID={`${id}-content`}>
        <View className={horizontal ? 'flex-row flex-wrap items-baseline gap-x-1.5' : 'items-center'} nativeID={`${id}-value-label`} testID={`${id}-value-label`}>
          <Text className="text-xl font-bold text-slate-900 dark:text-white" nativeID={`${id}-value`} testID={`${id}-value`}>
            {value}
          </Text>
          <Text className={`${horizontal ? 'text-left' : 'text-center'} text-[11px] leading-4 text-slate-500 dark:text-slate-400`} nativeID={`${id}-label`} testID={`${id}-label`}>
            {label}
          </Text>
        </View>
        {hint ? (
          <Text className={`${horizontal ? 'text-left' : 'text-center'} mt-1 text-[11px] leading-4 text-slate-400 dark:text-slate-500`} nativeID={`${id}-hint`} testID={`${id}-hint`}>
            {hint}
          </Text>
        ) : null}
        {actionHint ? (
          <View className={`mt-1.5 flex-row items-center ${horizontal ? '' : 'justify-center'}`} nativeID={`${id}-action`} testID={`${id}-action`}>
            <Text className="text-center text-[11px] font-semibold leading-4 text-primary" nativeID={`${id}-action-text`} testID={`${id}-action-text`}>
              {actionHint}
            </Text>
            <MaterialCommunityIcons color={colors.primary} name="chevron-right" size={14} />
          </View>
        ) : null}
      </View>
    </Container>
  );
}
