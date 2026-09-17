import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { validateTrainerAlias } from '../../utils/trainer-alias-validators.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, useUserMutations } from '../../hooks/use-user.js';
import { useMpConnectStatus } from '../../hooks/use-mp-connect.js';
import { resolveMpConnectErrorText } from '../../utils/mp-connect-messages.js';
// Sin extensión, a propósito: hay split de plataforma (.jsx / .web.jsx) y
// Metro solo resuelve por plataforma cuando el specifier no la trae.
import { MpConnectButton } from '../payments/mp-connect-button';
import { InputField } from '../forms/fields.jsx';
import { SectionCard } from '../forms/section-card.jsx';
import { ActivateTrainerPasswordModal } from './activate-trainer-password-modal.jsx';

export function ActivateTrainerScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { activateTrainerRole } = useUserMutations();

  // Si el usuario ya tuvo el perfil de entrenador activo antes (dado de
  // baja, no borra el alias — ver auth-store.js), se pre-completa acá para
  // no obligar a retipearlo si es el mismo.
  const [trainerAlias, setTrainerAlias] = useState(user?.bankAlias ?? '');
  const [touched, setTouched] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const hasPreviousAlias = Boolean(user?.bankAlias);
  const { connected: mpConnected, loading: mpLoading, failed: mpFailed, refetch: refetchMpStatus } = useMpConnectStatus();

  const aliasError = touched ? validateTrainerAlias(trainerAlias) : null;
  const aliasOk = !validateTrainerAlias(trainerAlias);
  // Para activar hacen falta las dos cosas: alias válido y cuenta de Mercado
  // Pago conectada (sin ella no se puede cobrar con split).
  const canSubmit = aliasOk && mpConnected;

  const missingHint = (() => {
    if (canSubmit || mpLoading) return null;
    // "No pudimos consultar" va primero: decirle que conecte la cuenta cuando
    // en realidad no sabemos si ya está conectada lo manda a repetir un paso
    // que quizás ya hizo.
    if (mpFailed) return 'No pudimos verificar el estado de tu cuenta de Mercado Pago. Reintentá para poder activar el perfil.';
    if (!aliasOk && !mpConnected) return 'Completá tu alias de pagos y conectá tu cuenta de Mercado Pago para activar el perfil.';
    if (!mpConnected) return 'Conectá tu cuenta de Mercado Pago para activar el perfil.';
    return 'Completá un alias de pagos válido para activar el perfil.';
  })();

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    setPasswordModalVisible(true);
  };

  // Las tres salidas del botón refrescan el estado contra el backend: el
  // resultado que llega por la ventana emergente o el deep link sirve para el
  // mensaje, pero quien decide si está conectada es /connect/status.
  const handleMpConnected = () => {
    refetchMpStatus();
    Toast.show({ type: 'success', text1: 'Configuración de cobros exitosa', text2: 'Tu cuenta de Mercado Pago quedó conectada.' });
  };

  const handleMpError = (error) => {
    refetchMpStatus();
    Toast.show({ type: 'error', text1: 'Algo salió mal', text2: resolveMpConnectErrorText(error) });
  };

  const handleConfirmActivate = async (password) => {
    const result = await activateTrainerRole({ bankAlias: trainerAlias, password });
    setPasswordModalVisible(false);
    if (result.success) {
      Toast.show({ type: 'success', text1: '¡Perfil de entrenador activado!', text2: 'Ya podés alternar entre corredor y entrenador.' });
      router.replace('/profile');
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudo activar el perfil de entrenador.' });
    }
  };

  return (
    <KeyboardAwareScrollView
      nativeID="activate-trainer-screen-scroll"
      testID="activate-trainer-screen-scroll"
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      extraScrollHeight={24}
    >
      <View nativeID="activate-trainer-screen-container" testID="activate-trainer-screen-container" className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <View nativeID="activate-trainer-screen-header" testID="activate-trainer-screen-header" className="mb-8 flex-row items-center gap-2">
          <Pressable
            nativeID="activate-trainer-screen-back-button"
            testID="activate-trainer-screen-back-button"
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            onPress={() => router.replace('/profile')}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text nativeID="activate-trainer-screen-back-label" testID="activate-trainer-screen-back-label" className="text-sm font-medium text-slate-500 dark:text-slate-400">Mi perfil</Text>
          </Pressable>
          <Text nativeID="activate-trainer-screen-breadcrumb-separator" testID="activate-trainer-screen-breadcrumb-separator" className="text-sm text-slate-400 dark:text-slate-600">/</Text>
          <Text nativeID="activate-trainer-screen-title" testID="activate-trainer-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} className="text-xl text-slate-900 dark:text-white">
            Activar perfil de entrenador
          </Text>
        </View>

        <SectionCard icon="whistle" title="Activar perfil de entrenador" variant="amber">
          <Text nativeID="activate-trainer-screen-description" testID="activate-trainer-screen-description" className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Vas a poder gestionar equipos, planificar entrenamientos y alternar entre tu perfil de corredor y de
            entrenador cuando quieras.
          </Text>

          <InputField
            autoCapitalize="none"
            error={aliasError}
            hint={hasPreviousAlias ? 'Detectamos un alias guardado de una activación anterior — podés cambiarlo si querés.' : undefined}
            label="Alias de pagos *"
            onBlur={() => setTouched(true)}
            onChange={setTrainerAlias}
            placeholder="Tu alias de pagos"
            touched={touched}
            value={trainerAlias}
          />
        </SectionCard>

        <SectionCard icon="link-variant" title="Cobros con Mercado Pago" variant="amber">
          <Text nativeID="activate-trainer-screen-mp-description" testID="activate-trainer-screen-mp-description" className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Conectá tu cuenta de Mercado Pago para poder cobrar las mensualidades de tu equipo. El pago del corredor se
            divide automáticamente entre vos y Paceron, sin que tengas que hacer nada.
          </Text>

          {mpFailed ? (
            <View nativeID="activate-trainer-screen-mp-status-error" testID="activate-trainer-screen-mp-status-error" className="mb-4 flex-row items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 dark:bg-rose-900/20">
              <Text nativeID="activate-trainer-screen-mp-status-error-text" testID="activate-trainer-screen-mp-status-error-text" className="flex-1 text-xs leading-4 text-rose-700 dark:text-rose-300">
                No pudimos verificar si tu cuenta está conectada. Puede ser un problema momentáneo de conexión.
              </Text>
              <Pressable nativeID="activate-trainer-screen-mp-status-retry" testID="activate-trainer-screen-mp-status-retry" className="rounded-full bg-rose-100 px-3 py-1.5 hover:opacity-90 active:opacity-80 dark:bg-rose-900/40" onPress={() => refetchMpStatus()}>
                <Text nativeID="activate-trainer-screen-mp-status-retry-label" testID="activate-trainer-screen-mp-status-retry-label" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  Reintentar
                </Text>
              </Pressable>
            </View>
          ) : null}

          <MpConnectButton
            connected={mpConnected}
            disabled={mpLoading}
            onCancel={refetchMpStatus}
            onConnected={handleMpConnected}
            onError={handleMpError}
          />
        </SectionCard>

        <Pressable
          nativeID="activate-trainer-screen-submit-button"
          testID="activate-trainer-screen-submit-button"
          className={`mt-4 h-12 flex-row items-center justify-center gap-2 rounded-full ${canSubmit ? 'bg-amber-500 hover:opacity-90' : 'bg-slate-100 dark:bg-slate-800'} active:opacity-80`}
          onPress={handleSubmit}
        >
          <MaterialCommunityIcons color={canSubmit ? '#ffffff' : colors.onSurfaceVariant} name="whistle" size={18} />
          <Text nativeID="activate-trainer-screen-submit-label" testID="activate-trainer-screen-submit-label" className={`text-sm font-semibold uppercase tracking-wide ${canSubmit ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>
            Activar
          </Text>
        </Pressable>

        {missingHint ? (
          <Text nativeID="activate-trainer-screen-missing-hint" testID="activate-trainer-screen-missing-hint" className="mt-3 text-center text-xs leading-4 text-slate-500 dark:text-slate-400">
            {missingHint}
          </Text>
        ) : null}
      </View>

      <ActivateTrainerPasswordModal
        onCancel={() => setPasswordModalVisible(false)}
        onConfirm={handleConfirmActivate}
        visible={passwordModalVisible}
      />
    </KeyboardAwareScrollView>
  );
}
