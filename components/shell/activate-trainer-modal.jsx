import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Confirmación simple (sin campo de texto) para activar el perfil de
// entrenador. Acción reversible/no destructiva, a diferencia de la baja
// de cuenta — no necesita el gate de tipear el email.
export function ActivateTrainerModal({ visible, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-black/50 px-4">
        <View className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl dark:border-amber-900/50 dark:bg-surface">
          <View className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#f59e0b" name="whistle" size={20} />
            <Text className="text-lg font-bold text-amber-700 dark:text-amber-400">Activar perfil de entrenador</Text>
          </View>

          <Text className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Vas a poder gestionar equipos, planificar entrenamientos y alternar entre tu perfil de corredor y de
            entrenador cuando quieras.
          </Text>

          <View className="flex-row gap-3">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-amber-500 active:opacity-80"
              disabled={loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white">Activar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
