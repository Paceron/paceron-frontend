import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

// Elegir una sesión existente para adjuntarle los ejercicios
// seleccionados del catálogo — append inmediato, sin abrir el modal de
// edición de esa sesión (ver spec para el porqué: es una acción rápida,
// el rol/orden se ajusta después si hace falta).
export function AttachToSessionPicker({ visible, sessions, onClose, onConfirm }) {
  const colors = useThemeColors();
  const [sessionId, setSessionId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setSessionId('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    await onConfirm(sessionId);
    setSubmitting(false);
    setSessionId('');
  };

  return (
    <Modal animationType="fade" nativeID="attach-to-session-picker" onRequestClose={handleClose} testID="attach-to-session-picker" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="attach-to-session-picker-backdrop" onPress={handleClose} testID="attach-to-session-picker-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="attach-to-session-picker-card" onPress={() => {}} testID="attach-to-session-picker-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="attach-to-session-picker-header" testID="attach-to-session-picker-header">
            <MaterialCommunityIcons color={colors.primary} name="clipboard-plus-outline" size={20} />
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="attach-to-session-picker-title" testID="attach-to-session-picker-title">
              Adjuntar a sesión existente
            </Text>
          </View>

          <ResponsiveSelectField
            dense
            hideErrorRow
            label="Sesión"
            onChange={setSessionId}
            options={sessions.map((s) => ({ id: s.id, name: s.name }))}
            placeholder={sessions.length ? 'Elegí una sesión' : 'Todavía no creaste ninguna sesión'}
            required
            value={sessionId}
          />

          <View className="mt-3 flex-row gap-3" nativeID="attach-to-session-picker-actions" testID="attach-to-session-picker-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={submitting}
              nativeID="attach-to-session-picker-cancel-button"
              onPress={handleClose}
              testID="attach-to-session-picker-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="attach-to-session-picker-cancel-label" testID="attach-to-session-picker-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={submitting || !sessionId}
              nativeID="attach-to-session-picker-confirm-button"
              onPress={handleConfirm}
              testID="attach-to-session-picker-confirm-button"
            >
              {submitting ? <ActivityIndicator color={colors.onPrimary} size="small" /> : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="attach-to-session-picker-confirm-label" testID="attach-to-session-picker-confirm-label">
                  Adjuntar
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
