import { Text, View } from 'react-native';

const STYLE_BY_ROLE = {
  runner: { bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary', label: 'Corredor' },
  trainer: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', label: 'Entrenador' },
};

const SIZE = {
  sm: { pad: 'px-2 py-0.5', text: 'text-xs' },
  md: { pad: 'px-3 py-1', text: 'text-sm' },
};

export function RoleBadge({ role, active = true, size = 'sm' }) {
  const config = STYLE_BY_ROLE[role] ?? STYLE_BY_ROLE.runner;
  const bg = active ? config.bg : 'bg-slate-200 dark:bg-slate-700';
  const text = active ? config.text : 'text-slate-500 dark:text-slate-400';
  const { pad, text: textSize } = SIZE[size] ?? SIZE.sm;

  return (
    <View className={`rounded-full ${pad} ${bg}`} nativeID="role-badge" testID="role-badge">
      <Text className={`${textSize} font-semibold ${text}`} nativeID="role-badge-label" testID="role-badge-label">{config.label}</Text>
    </View>
  );
}
