import { Pressable, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

const VARIANT = {
  default: {
    box: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-surface',
    title: 'text-slate-900 dark:text-white',
    icon: null, // usa colors.primary
  },
  amber: {
    box: 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
    title: 'text-amber-700 dark:text-amber-400',
    icon: '#f59e0b',
  },
};

// Card de sección compartida por ProfileScreen, EditProfileScreen y
// RegisterScreen. Header estático por default; con collapsible=true se
// vuelve presionable y agrega un chevron animado que expande/contrae
// children (usado por RegisterScreen). variant='amber' da el tratamiento
// especial usado para datos de entrenador (local-only, no persistido en
// backend todavía).
export function SectionCard({ title, icon, children, collapsible = false, collapsed = false, onToggle, variant = 'default' }) {
  const colors = useThemeColors();
  const rotateAnim = useSharedValue(collapsed ? 1 : 0);
  const style = VARIANT[variant] ?? VARIANT.default;

  useEffect(() => {
    if (!collapsible) return;
    rotateAnim.value = withTiming(collapsed ? 1 : 0, { duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotateAnim.value, [0, 1], [0, -90])}deg` }],
  }));

  const Header = collapsible ? Pressable : View;

  return (
    <View className={`mb-5 rounded-2xl border p-6 shadow-sm ${style.box}`}>
      <Header
        className={`flex-row items-center gap-2 ${collapsible ? 'active:opacity-70' : ''} ${!collapsed || !collapsible ? 'mb-4' : ''}`}
        onPress={collapsible ? onToggle : undefined}
      >
        {collapsible && (
          <Animated.View style={chevronStyle}>
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={18} />
          </Animated.View>
        )}
        <MaterialCommunityIcons color={style.icon ?? colors.primary} name={icon} size={18} />
        <Text className={`text-base font-bold ${style.title}`}>{title}</Text>
      </Header>
      {(!collapsible || !collapsed) && children}
    </View>
  );
}
