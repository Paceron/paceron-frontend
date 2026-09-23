import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { canStartAsyncSession, canStartPresencialSession } from '../../utils/session-start-window.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';

export function StartSessionButton({ assignment, role }) {
  const router = useRouter();
  const colors = useThemeColors();
  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);

  const eligible = role === 'runner' ? canStartAsyncSession(assignment) : canStartPresencialSession(assignment);
  if (!eligible) return null;

  const idPrefix = `start-session-button-${assignment.id}`;

  if (isWeb) {
    return (
      <View className="mt-2 flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 dark:bg-emerald-900/20" nativeID={`${idPrefix}-web-notice`} testID={`${idPrefix}-web-notice`}>
        <MaterialCommunityIcons color="#16a34a" name="cellphone-check" size={14} />
        <Text className="text-xs font-medium text-emerald-700 dark:text-emerald-400" nativeID={`${idPrefix}-web-notice-label`} testID={`${idPrefix}-web-notice-label`}>
          El inicio y registro del entrenamiento solo está disponible en la app nativa
        </Text>
      </View>
    );
  }

  const handlePress = () => {
    setPendingSession(assignment);
    router.push('/training-session');
  };

  return (
    <Pressable
      className="mt-2 h-9 flex-row items-center justify-center gap-1.5 rounded-full bg-primary active:opacity-80"
      nativeID={idPrefix}
      onPress={handlePress}
      testID={idPrefix}
    >
      <MaterialCommunityIcons color={colors.onPrimary} name="play" size={14} />
      <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        Iniciar entrenamiento
      </Text>
    </Pressable>
  );
}
