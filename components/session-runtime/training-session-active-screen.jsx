import { Text, View } from 'react-native';
import { MobileOnlyRoute } from '../guards/platform-gate.jsx';

// Stub — cronómetro/series/GPS quedan para otra spec.
export function TrainingSessionActiveScreen() {
  return (
    <MobileOnlyRoute>
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="training-session-active-screen-root" testID="training-session-active-screen-root">
        <Text className="text-center text-base text-slate-500 dark:text-slate-400" nativeID="training-session-active-screen-placeholder" testID="training-session-active-screen-placeholder">
          Acá va la sesión en curso — cronómetro, series y GPS. Todavía no está construido.
        </Text>
      </View>
    </MobileOnlyRoute>
  );
}
