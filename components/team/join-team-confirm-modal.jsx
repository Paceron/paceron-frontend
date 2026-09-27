import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatMonthlyFee } from '../../utils/currency.js';

// Confirmación antes de pedir unirse a un equipo que COBRA. No cobra nada acá:
// el pago recién es posible cuando el entrenador acepta la solicitud, porque la
// cuota #1 la crea el backend al crearse la membresía. Este modal existe para
// que el corredor sepa a qué se está comprometiendo antes de pedir, y no se
// entere del precio recién al ser aceptado.
//
// Equipos gratis no lo abren (ver team-search-screen.jsx) — el flujo de unirse
// queda idéntico a como era.
export function JoinTeamConfirmModal({ visible, teamName, membershipFee, onCancel, onConfirm }) {
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
    <Modal animationType="fade" nativeID="join-team-confirm-modal" onRequestClose={handleCancel} testID="join-team-confirm-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="join-team-confirm-modal-backdrop" onPress={handleCancel} testID="join-team-confirm-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="join-team-confirm-modal-card" onPress={() => {}} testID="join-team-confirm-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="join-team-confirm-modal-header" testID="join-team-confirm-modal-header">
            <MaterialCommunityIcons color="#8cc63e" name="cash-multiple" size={20} />
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="join-team-confirm-modal-title" testID="join-team-confirm-modal-title">
              Este equipo tiene cuota
            </Text>
          </View>

          <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="join-team-confirm-modal-description" testID="join-team-confirm-modal-description">
            {teamName} cobra una cuota mensual de:
          </Text>

          <View className="mt-2 flex-row items-baseline gap-1" nativeID="join-team-confirm-modal-price-row" testID="join-team-confirm-modal-price-row">
            <Text className="text-2xl font-bold text-primary" nativeID="join-team-confirm-modal-price" testID="join-team-confirm-modal-price">
              {formatMonthlyFee(membershipFee)}
            </Text>
            <Text className="text-xs font-medium text-slate-400 dark:text-slate-500" nativeID="join-team-confirm-modal-price-period" testID="join-team-confirm-modal-price-period">
              /mes
            </Text>
          </View>

          <Text className="mb-5 mt-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="join-team-confirm-modal-note" testID="join-team-confirm-modal-note">
            No se te cobra nada ahora. Cuando el entrenador acepte tu solicitud vas a
            poder pagar la primera cuota desde el equipo.
          </Text>

          <View className="flex-row gap-3" nativeID="join-team-confirm-modal-actions" testID="join-team-confirm-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="join-team-confirm-modal-cancel-button"
              onPress={handleCancel}
              testID="join-team-confirm-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="join-team-confirm-modal-cancel-label" testID="join-team-confirm-modal-cancel-label">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
              disabled={loading}
              nativeID="join-team-confirm-modal-confirm-button"
              onPress={handleConfirm}
              testID="join-team-confirm-modal-confirm-button"
            >
              {loading ? (
                <ActivityIndicator color="#111518" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="join-team-confirm-modal-confirm-label" testID="join-team-confirm-modal-confirm-label">
                  Solicitar unirme
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
