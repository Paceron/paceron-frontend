import { Text, View } from 'react-native';

const STYLE_BY_ROLE = {
  runner: { bg: 'bg-primary/15', text: 'text-primary', label: 'Corredor' },
  trainer: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', label: 'Entrenador' },
};

export function RoleBadge({ role }) {
  const config = STYLE_BY_ROLE[role] ?? STYLE_BY_ROLE.runner;

  return (
    <View className={`rounded-full px-2 py-0.5 ${config.bg}`}>
      <Text className={`text-xs font-semibold ${config.text}`}>{config.label}</Text>
    </View>
  );
}
