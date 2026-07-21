import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { validateTrainerAlias } from '../../utils/trainer-alias-validators.js';
import { useAuthStore } from '../../store/auth-store.js';
import { InputField } from '../forms/fields.jsx';
import { SectionCard } from '../forms/section-card.jsx';

export function ActivateTrainerScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const [trainerAlias, setTrainerAlias] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const aliasError = touched ? validateTrainerAlias(trainerAlias) : null;
  const canSubmit = !validateTrainerAlias(trainerAlias);

  const handleSubmit = async () => {
    if (loading) return;
    setTouched(true);
    if (!canSubmit) return;

    setLoading(true);
    const result = await useAuthStore.getState().activateTrainerRole(trainerAlias);
    setLoading(false);
    if (result.success) {
      router.replace('/profile');
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudo activar el perfil de entrenador.' });
    }
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      extraScrollHeight={24}
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <View className="mb-8 flex-row items-center gap-2">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 active:opacity-70"
            onPress={() => router.replace('/profile')}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text className="text-sm font-medium text-slate-500 dark:text-slate-400">Mi perfil</Text>
          </Pressable>
          <Text className="text-sm text-slate-400 dark:text-slate-600">/</Text>
          <Text style={{ fontFamily: 'Orbitron_700Bold' }} className="text-xl text-slate-900 dark:text-white">
            Activar perfil de entrenador
          </Text>
        </View>

        <SectionCard icon="whistle" title="Activar perfil de entrenador" variant="amber">
          <Text className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Vas a poder gestionar equipos, planificar entrenamientos y alternar entre tu perfil de corredor y de
            entrenador cuando quieras.
          </Text>

          <InputField
            autoCapitalize="none"
            error={aliasError}
            label="Alias de pagos *"
            onBlur={() => setTouched(true)}
            onChange={setTrainerAlias}
            placeholder="Tu alias de pagos"
            touched={touched}
            value={trainerAlias}
          />
        </SectionCard>

        <Pressable
          className={`mt-4 h-12 flex-row items-center justify-center gap-2 rounded-full ${canSubmit ? 'bg-amber-500' : 'bg-slate-100 dark:bg-slate-800'} active:opacity-80`}
          disabled={loading}
          onPress={handleSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons color={canSubmit ? '#ffffff' : colors.onSurfaceVariant} name="whistle" size={18} />
              <Text className={`text-sm font-semibold uppercase tracking-wide ${canSubmit ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                Activar
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}
