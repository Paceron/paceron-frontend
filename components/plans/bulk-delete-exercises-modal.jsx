import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CheckboxField } from '../forms/checkbox-field.jsx';
import { notifyWarning } from '../../utils/haptics.js';

// Borrado en bloque de N ejercicios seleccionados — mismo criterio que
// DeleteCatalogItemModal (individual): si alguno está en uso en
// sesiones, se lista aparte y exige el mismo checkbox "entiendo" antes
// de habilitar "Eliminar". `items` = lista completa de ejercicios
// seleccionados (para el conteo/nombres); `withUsage` = el subconjunto
// que exercisesWithUsage() marcó como en uso.
export function BulkDeleteExercisesModal({ visible, items, withUsage, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const hasUsage = withUsage.length > 0;

  useEffect(() => {
    if (visible) { setUnderstood(false); notifyWarning(); }
  }, [visible]);

  const handleConfirm = async () => {
    if (loading || (hasUsage && !understood)) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal animationType="fade" nativeID="bulk-delete-exercises-modal" onRequestClose={handleCancel} testID="bulk-delete-exercises-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="bulk-delete-exercises-modal-backdrop" onPress={handleCancel} testID="bulk-delete-exercises-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="bulk-delete-exercises-modal-card" onPress={() => {}} testID="bulk-delete-exercises-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="bulk-delete-exercises-modal-header" testID="bulk-delete-exercises-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="bulk-delete-exercises-modal-title" testID="bulk-delete-exercises-modal-title">
              Eliminar {items.length} ejercicio{items.length === 1 ? '' : 's'}
            </Text>
          </View>

          <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="bulk-delete-exercises-modal-description" testID="bulk-delete-exercises-modal-description">
            Esta acción no se puede deshacer.
          </Text>

          {hasUsage && (
            <View className="mb-4 rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20" nativeID="bulk-delete-exercises-modal-usage" testID="bulk-delete-exercises-modal-usage">
              <Text className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-400" nativeID="bulk-delete-exercises-modal-usage-title" testID="bulk-delete-exercises-modal-usage-title">
                {withUsage.length} de estos están en uso en sesiones:
              </Text>
              <ScrollView className="max-h-28" nativeID="bulk-delete-exercises-modal-usage-list" showsVerticalScrollIndicator={false} testID="bulk-delete-exercises-modal-usage-list">
                {withUsage.map(({ exercise, usedIn }) => (
                  <Text className="text-xs text-amber-700 dark:text-amber-300" key={exercise.id} nativeID={`bulk-delete-exercises-modal-usage-item-${exercise.id}`} testID={`bulk-delete-exercises-modal-usage-item-${exercise.id}`}>
                    • {exercise.name} ({usedIn.length} {usedIn.length === 1 ? 'sesión' : 'sesiones'})
                  </Text>
                ))}
              </ScrollView>
              <CheckboxField checked={understood} idPrefix="bulk-delete-exercises-modal-checkbox" onChange={setUnderstood}>
                <Text className="text-xs text-amber-800 dark:text-amber-300" nativeID="bulk-delete-exercises-modal-checkbox-label" testID="bulk-delete-exercises-modal-checkbox-label">
                  Entiendo que van a dejar de estar en esas sesiones.
                </Text>
              </CheckboxField>
            </View>
          )}

          <View className="flex-row gap-3" nativeID="bulk-delete-exercises-modal-actions" testID="bulk-delete-exercises-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="bulk-delete-exercises-modal-cancel-button"
              onPress={handleCancel}
              testID="bulk-delete-exercises-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="bulk-delete-exercises-modal-cancel-label" testID="bulk-delete-exercises-modal-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={loading || (hasUsage && !understood)}
              nativeID="bulk-delete-exercises-modal-confirm-button"
              onPress={handleConfirm}
              testID="bulk-delete-exercises-modal-confirm-button"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="bulk-delete-exercises-modal-confirm-label" testID="bulk-delete-exercises-modal-confirm-label">Eliminar</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
