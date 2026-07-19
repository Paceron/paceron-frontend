import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';

const COLOR_BY_KIND = {
  trainer: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', icon: '#f59e0b' },
  runner: { bg: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary', icon: '#8cc63e' },
};

function getRoleAction(hasTrainerRole, activeRole) {
  if (!hasTrainerRole) {
    return { label: 'Activar perfil de entrenador', icon: 'whistle', kind: 'trainer' };
  }
  if (activeRole === 'runner') {
    return { label: 'Cambiar a Entrenador', icon: 'whistle', kind: 'trainer' };
  }
  return { label: 'Cambiar a Corredor', icon: 'run-fast', kind: 'runner' };
}

export function RoleManagementSection({ onClose, allowActivate = true }) {
  const router = useRouter();
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
  const activeRole = useAuthStore((s) => s.activeRole);
  const switchRole = useAuthStore((s) => s.switchRole);

  if (!allowActivate && !hasTrainerRole) return null;

  const action = getRoleAction(hasTrainerRole, activeRole);
  const colors = COLOR_BY_KIND[action.kind];

  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.label]);

  // flexDirection/alignItems/gap van en style, no en className: Animated.View
  // no procesa className de NativeWind de forma confiable (mismo problema ya
  // visto en el dropdown web) — con className caía al column por defecto de
  // RN, apilando ícono y texto en vez de ponerlos en fila.
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  }));

  const handlePress = () => {
    if (!hasTrainerRole) {
      onClose?.();
      router.push('/profile/activate-trainer');
      return;
    }
    switchRole();
    onClose?.();
  };

  return (
    <Pressable className={`m-2 items-center justify-center rounded-lg px-2 py-2.5 ${colors.bg}`} onPress={handlePress}>
      <Animated.View style={animatedStyle}>
        <MaterialCommunityIcons color={colors.icon} name={action.icon} size={18} />
        <Text className={`text-sm font-semibold ${colors.text}`} numberOfLines={1} adjustsFontSizeToFit>
          {action.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
