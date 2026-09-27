import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function SectionTabBar({ tabs, active, onChange, idPrefix }) {
  const colors = useThemeColors();

  return (
    <View className="mb-6 flex-row gap-2" nativeID={`${idPrefix}-tab-bar`} testID={`${idPrefix}-tab-bar`}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 ${
              isActive ? 'bg-primary-tint-subtle dark:bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            key={tab.id}
            nativeID={`${idPrefix}-tab-${tab.id}`}
            onPress={() => onChange(tab.id)}
            testID={`${idPrefix}-tab-${tab.id}`}
          >
            <MaterialCommunityIcons color={isActive ? colors.primary : colors.onSurfaceVariant} name={tab.icon} size={16} />
            <Text
              className={`text-sm ${isActive ? 'font-semibold text-primary' : 'font-medium text-slate-700 dark:text-slate-200'}`}
              nativeID={`${idPrefix}-tab-${tab.id}-label`}
              testID={`${idPrefix}-tab-${tab.id}-label`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
