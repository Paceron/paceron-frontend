import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Barra de pestañas horizontal reusada por pantallas con secciones que
// merecen navegación propia en vez de ir todas apiladas — hoy
// TeamDetailScreen (solo en web, mobile apila) y TrainingPlansScreen
// (en ambas plataformas, ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md).
// `scope` prefija los nativeID/testID para que no colisionen entre
// pantallas que la usen a la vez.
export function TabBar({ active, onChange, tabs, scope = 'tab-bar' }) {
  const colors = useThemeColors();

  return (
    <View className="mb-5 flex-row gap-2" nativeID={scope} testID={scope}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            className={`flex-row items-center gap-1.5 rounded-lg px-3 py-2 ${
              isActive ? 'bg-primary-tint-subtle dark:bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            nativeID={`${scope}-${tab.id}`}
            onPress={() => onChange(tab.id)}
            testID={`${scope}-${tab.id}`}
          >
            <MaterialCommunityIcons name={tab.icon} size={16} color={isActive ? colors.primary : colors.onSurfaceVariant} />
            <Text
              className={`text-sm ${isActive ? 'font-semibold text-primary' : 'font-medium text-slate-700 dark:text-slate-200'}`}
              nativeID={`${scope}-${tab.id}-label`}
              testID={`${scope}-${tab.id}-label`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
