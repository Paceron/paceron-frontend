import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Confirmación de baja: exige tipear el email exacto de la cuenta antes de habilitar
// el botón destructivo. Evita bajas por click accidental.
export function DeactivateAccountModal({ visible, userEmail, onCancel, onConfirm }) {
  const colors = useThemeColors();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const matches = input.trim().toLowerCase() === (userEmail ?? '').toLowerCase();

  const handleConfirm = async () => {
    if (!matches || loading) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    setInput('');
    onCancel();
  };

  return (
    <Modal nativeID="deactivate-account-modal" testID="deactivate-account-modal" animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View nativeID="deactivate-account-modal-backdrop" testID="deactivate-account-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="deactivate-account-modal-card" testID="deactivate-account-modal-card" className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface">
          <View nativeID="deactivate-account-modal-header" testID="deactivate-account-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text nativeID="deactivate-account-modal-title" testID="deactivate-account-modal-title" className="text-lg font-bold text-red-700 dark:text-red-400">Confirmar baja de cuenta</Text>
          </View>

          <Text nativeID="deactivate-account-modal-description" testID="deactivate-account-modal-description" className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Esta acción desactiva tu cuenta y cierra tu sesión. Para confirmar, escribí tu email{' '}
            <Text nativeID="deactivate-account-modal-email" testID="deactivate-account-modal-email" className="font-semibold text-slate-900 dark:text-white">{userEmail}</Text>.
          </Text>

          <TextInput
            nativeID="deactivate-account-modal-email-input"
            testID="deactivate-account-modal-email-input"
            autoCapitalize="none"
            autoComplete="email"
            className="mb-5 h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            editable={!loading}
            keyboardType="email-address"
            onChangeText={setInput}
            placeholder="tu@email.com"
            placeholderTextColor={colors.onSurfaceVariant}
            textContentType="emailAddress"
            value={input}
          />

          <View nativeID="deactivate-account-modal-actions" testID="deactivate-account-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="deactivate-account-modal-cancel-button"
              testID="deactivate-account-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text nativeID="deactivate-account-modal-cancel-label" testID="deactivate-account-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              nativeID="deactivate-account-modal-confirm-button"
              testID="deactivate-account-modal-confirm-button"
              className={`h-11 flex-1 items-center justify-center rounded-full ${matches ? 'bg-red-600 hover:opacity-90' : 'bg-slate-200 dark:bg-slate-800'} active:opacity-80`}
              disabled={!matches || loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color={matches ? '#ffffff' : colors.onSurfaceVariant} size="small" />
              ) : (
                <Text nativeID="deactivate-account-modal-confirm-label" testID="deactivate-account-modal-confirm-label" className={`text-sm font-semibold uppercase tracking-wide ${matches ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                  Confirmar baja
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
