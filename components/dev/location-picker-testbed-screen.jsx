import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { RequireAuth } from '../guards/require-auth.jsx';
// Sin extensión a propósito: Metro resuelve .web.jsx vs .jsx por esto.
import { LocationPicker } from '../shared/location-picker';

// Pantalla interna sin entrada en ningún menú — solo alcanzable
// tipeando /profile/location-picker-testbed. Prueba LocationPicker en
// dispositivo real antes de que exista un consumidor real (el calendario
// de asignaciones). Ver docs/superpowers/specs/2026-09-16-location-picker-design.md.
function LocationPickerTestbedScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const [value, setValue] = useState(null);

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="location-picker-testbed-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="location-picker-testbed-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="location-picker-testbed-screen-container" testID="location-picker-testbed-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="location-picker-testbed-screen-header" testID="location-picker-testbed-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="location-picker-testbed-screen-back-button"
            onPress={() => router.back()}
            testID="location-picker-testbed-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text
            className="text-xl text-slate-900 dark:text-white"
            nativeID="location-picker-testbed-screen-title"
            style={{ fontFamily: 'Orbitron_700Bold' }}
            testID="location-picker-testbed-screen-title"
          >
            Testbed de LocationPicker
          </Text>
        </View>

        <LocationPicker onChange={setValue} value={value} />

        <Text
          className="mt-4 text-xs text-slate-600 dark:text-slate-300"
          nativeID="location-picker-testbed-value"
          testID="location-picker-testbed-value"
        >
          {JSON.stringify(value, null, 2)}
        </Text>
      </View>
    </ScrollView>
  );
}

export function LocationPickerTestbedScreen() {
  return (
    <RequireAuth>
      <LocationPickerTestbedScreenContent />
    </RequireAuth>
  );
}
