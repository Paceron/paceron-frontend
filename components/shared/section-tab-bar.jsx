import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';

export function SectionTabBar({ tabs, active, onChange, idPrefix }) {
  const colors = useThemeColors();
  const refs = useRef({});

  const select = (index) => {
    const target = tabs[index];
    if (!target) return;
    onChange(target.id);
    if (isWeb) refs.current[target.id]?.focus?.();
  };

  const handleKeyDown = (event, index) => {
    const positions = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = positions[event.key];
    if (next === undefined) return;
    event.preventDefault?.();
    select((next + tabs.length) % tabs.length);
  };

  return (
    <View
      accessibilityRole="tablist"
      className="mb-6 flex-row gap-2 p-1 rounded-xl bg-slate-200 dark:bg-slate-800"
      nativeID={`${idPrefix}-tab-bar`}
      testID={`${idPrefix}-tab-bar`}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            aria-selected={isActive}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 active:opacity-70 hover:bg-slate-100 dark:hover:bg-slate-700 ${
              isActive ? 'bg-primary-tint-subtle dark:bg-primary/10' : 'bg-transparent'
            }`}
            focusable={isWeb}
            key={tab.id}
            nativeID={`${idPrefix}-tab-${tab.id}`}
            onKeyDown={isWeb ? (event) => handleKeyDown(event, index) : undefined}
            onPress={() => onChange(tab.id)}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            testID={`${idPrefix}-tab-${tab.id}`}
          >
            <MaterialCommunityIcons color={isActive ? colors.primary : colors.onSurfaceVariant} name={tab.icon} size={16} />
            <Text
              className={`text-sm ${isActive ? 'font-semibold text-on-primary-tint dark:text-primary' : 'font-medium text-slate-700 dark:text-slate-200'}`}
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
