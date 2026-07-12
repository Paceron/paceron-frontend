import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { ActivateTrainerModal } from './activate-trainer-modal.jsx';

const COLOR_BY_KIND = {
  trainer: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', icon: '#f59e0b' },
  runner: { bg: 'bg-primary/15', text: 'text-primary', icon: '#8cc63e' },
};

function getRoleAction(trainerActivated, activeRole) {
  if (!trainerActivated) {
    return { label: 'Activar perfil de entrenador', icon: 'whistle', kind: 'trainer' };
  }
  if (activeRole === 'runner') {
    return { label: 'Cambiar a Entrenador', icon: 'whistle', kind: 'trainer' };
  }
  return { label: 'Cambiar a Corredor', icon: 'run-fast', kind: 'runner' };
}

export function RoleManagementSection({ onClose }) {
  const trainerActivated = useAuthStore((s) => s.trainerActivated);
  const activeRole = useAuthStore((s) => s.activeRole);
  const activateTrainerProfile = useAuthStore((s) => s.activateTrainerProfile);
  const switchRole = useAuthStore((s) => s.switchRole);
  const [modalVisible, setModalVisible] = useState(false);

  const action = getRoleAction(trainerActivated, activeRole);
  const colors = COLOR_BY_KIND[action.kind];

  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.label]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handlePress = () => {
    if (!trainerActivated) {
      setModalVisible(true);
      return;
    }
    switchRole();
    onClose?.();
  };

  const handleConfirmActivate = async () => {
    await activateTrainerProfile();
    setModalVisible(false);
    onClose?.();
  };

  return (
    <>
      <View className="px-4 pt-3 pb-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Gestión de rol
        </Text>
      </View>
      <Pressable className={`mx-2 mb-1 flex-row items-center rounded-lg px-2 py-2.5 ${colors.bg}`} onPress={handlePress}>
        <Animated.View className="flex-1 flex-row items-center gap-3" style={animatedStyle}>
          <MaterialCommunityIcons color={colors.icon} name={action.icon} size={18} />
          <Text className={`text-sm font-semibold ${colors.text}`}>{action.label}</Text>
        </Animated.View>
      </Pressable>

      <ActivateTrainerModal onCancel={() => setModalVisible(false)} onConfirm={handleConfirmActivate} visible={modalVisible} />
    </>
  );
}
