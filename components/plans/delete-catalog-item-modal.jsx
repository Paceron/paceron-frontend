import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CheckboxField } from '../forms/checkbox-field.jsx';

// Modal de borrado reusado por el catálogo de ejercicios y el de
// sesiones — ver docs/superpowers/specs/2026-09-03-exercises-sessions-catalog-design.md.
// Sin uso (`usedIn` vacío): confirmación simple, mismo patrón que
// DeleteTrainingPlanModal. Con uso: lista dónde está y exige un
// checkbox tildado antes de habilitar "Eliminar" — pedido explícito
// del usuario, para que el entrenador no borre algo referenciado sin
// darse cuenta de qué rompe.
export function DeleteCatalogItemModal({ visible, itemKind, itemName, usageLabel, usedIn, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const hasUsage = usedIn.length > 0;

  useEffect(() => {
    if (visible) setUnderstood(false);
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
    <Modal animationType="fade" nativeID="delete-catalog-item-modal" onRequestClose={handleCancel} testID="delete-catalog-item-modal" transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="delete-catalog-item-modal-backdrop" testID="delete-catalog-item-modal-backdrop">
        <View className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="delete-catalog-item-modal-card" testID="delete-catalog-item-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="delete-catalog-item-modal-header" testID="delete-catalog-item-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text className="text-lg font-bold capitalize text-red-700 dark:text-red-400" nativeID="delete-catalog-item-modal-title" testID="delete-catalog-item-modal-title">
              Eliminar {itemKind}
            </Text>
          </View>

          <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="delete-catalog-item-modal-description" testID="delete-catalog-item-modal-description">
            Vas a eliminar &quot;{itemName}&quot; de forma permanente. Esta acción no se puede deshacer.
          </Text>

          {hasUsage && (
            <View className="mb-4 rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20" nativeID="delete-catalog-item-modal-usage" testID="delete-catalog-item-modal-usage">
              <Text className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-400" nativeID="delete-catalog-item-modal-usage-title" testID="delete-catalog-item-modal-usage-title">
                Está en uso en {usedIn.length} {usageLabel}:
              </Text>
              <ScrollView className="max-h-28" nativeID="delete-catalog-item-modal-usage-list" showsVerticalScrollIndicator={false} testID="delete-catalog-item-modal-usage-list">
                {usedIn.map((item) => (
                  <Text className="text-xs text-amber-700 dark:text-amber-300" key={item.id} nativeID={`delete-catalog-item-modal-usage-item-${item.id}`} testID={`delete-catalog-item-modal-usage-item-${item.id}`}>
                    • {item.name}
                  </Text>
                ))}
              </ScrollView>
              <CheckboxField checked={understood} idPrefix="delete-catalog-item-modal-checkbox" onChange={setUnderstood}>
                <Text className="text-xs text-amber-800 dark:text-amber-300" nativeID="delete-catalog-item-modal-checkbox-label" testID="delete-catalog-item-modal-checkbox-label">
                  Entiendo que {itemKind === 'ejercicio' ? 'este ejercicio va a dejar de estar' : 'esta sesión va a dejar de estar'} en {usedIn.length === 1 ? 'esa' : 'esas'} {usageLabel}.
                </Text>
              </CheckboxField>
            </View>
          )}

          <View className="flex-row gap-3" nativeID="delete-catalog-item-modal-actions" testID="delete-catalog-item-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="delete-catalog-item-modal-cancel-button"
              onPress={handleCancel}
              testID="delete-catalog-item-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="delete-catalog-item-modal-cancel-label" testID="delete-catalog-item-modal-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={loading || (hasUsage && !understood)}
              nativeID="delete-catalog-item-modal-confirm-button"
              onPress={handleConfirm}
              testID="delete-catalog-item-modal-confirm-button"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="delete-catalog-item-modal-confirm-label" testID="delete-catalog-item-modal-confirm-label">Eliminar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
