import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { useThemeColors } from '../../theme/colors.js';

// Toggle de tema segmentado (sol / luna). Compacto y consistente para header,
// dropdown web y drawer mobile.
export function ThemeToggle() {
  const { themeMode, setThemeMode } = useThemeMode();
  const colors = useThemeColors();
  const isDark = themeMode === 'dark';

  return (
    <View className="flex-row items-center rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
      <Pressable
        accessibilityLabel="Tema claro"
        accessibilityRole="button"
        accessibilityState={{ selected: !isDark }}
        hitSlop={8}
        className={`h-7 w-7 items-center justify-center rounded-full ${!isDark ? 'bg-white' : ''}`}
        onPress={() => setThemeMode('light')}
      >
        <MaterialCommunityIcons color={!isDark ? '#f59e0b' : colors.onSurfaceVariant} name="weather-sunny" size={15} />
      </Pressable>
      <Pressable
        accessibilityLabel="Tema oscuro"
        accessibilityRole="button"
        accessibilityState={{ selected: isDark }}
        hitSlop={8}
        className={`h-7 w-7 items-center justify-center rounded-full ${isDark ? 'bg-slate-950' : ''}`}
        onPress={() => setThemeMode('dark')}
      >
        <MaterialCommunityIcons color={isDark ? '#8cc63e' : colors.onSurfaceVariant} name="weather-night" size={15} />
      </Pressable>
    </View>
  );
}
