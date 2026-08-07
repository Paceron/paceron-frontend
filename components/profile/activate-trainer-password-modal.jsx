import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { InputField } from '../forms/fields.jsx';

// Paso intermedio entre "completé el alias" y "mandar la activación" —
// el backend ahora exige confirmar la contraseña actual
// (userrole.ActivateEntrenadorRequest.password, obligatorio) antes de
// activar el rol entrenador. Mismo patrón visual que
// deactivate-trainer-modal.jsx (modal propio con su loading interno).
export function ActivateTrainerPasswordModal({ visible, onCancel, onConfirm }) {
  const colors = useThemeColors();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading || !password) return;
    setLoading(true);
    await onConfirm(password);
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    setPassword('');
    onCancel();
  };

  return (
    <Modal nativeID="activate-trainer-password-modal" testID="activate-trainer-password-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View nativeID="activate-trainer-password-modal-backdrop" testID="activate-trainer-password-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="activate-trainer-password-modal-card" testID="activate-trainer-password-modal-card" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface">
          <View nativeID="activate-trainer-password-modal-header" testID="activate-trainer-password-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color={colors.primary} name="lock-outline" size={20} />
            <Text nativeID="activate-trainer-password-modal-title" testID="activate-trainer-password-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Confirmá tu contraseña
            </Text>
          </View>

          <Text nativeID="activate-trainer-password-modal-description" testID="activate-trainer-password-modal-description" className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Por seguridad, confirmá tu contraseña actual para activar el perfil de entrenador.
          </Text>

          <InputField
            autoComplete="current-password"
            dense
            label="Contraseña"
            onChange={setPassword}
            onSubmitEditing={handleConfirm}
            onToggleSecure={() => setShowPassword((v) => !v)}
            placeholder="Tu contraseña"
            returnKeyType="done"
            secureTextEntry={!showPassword}
            showSecure={showPassword}
            textContentType="password"
            value={password}
          />

          <View nativeID="activate-trainer-password-modal-actions" testID="activate-trainer-password-modal-actions" className="mt-2 flex-row gap-3">
            <Pressable
              nativeID="activate-trainer-password-modal-cancel-button"
              testID="activate-trainer-password-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="activate-trainer-password-modal-cancel-label" testID="activate-trainer-password-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              nativeID="activate-trainer-password-modal-confirm-button"
              testID="activate-trainer-password-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
              disabled={loading || !password}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text nativeID="activate-trainer-password-modal-confirm-label" testID="activate-trainer-password-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-[#111518]">
                  Confirmar
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
