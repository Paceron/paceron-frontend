import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useUser } from '../../hooks/use-user.js';
import { calculateAge } from '../../utils/age.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { colorForUserId } from '../../utils/participant-color.js';
import { ParticipantAvatar } from '../session-runtime/participant-avatar.jsx';

const DASH = '—';
function display(value) {
  return value && String(value).trim() ? String(value) : DASH;
}

function DetailField({ label, value, idPrefix }) {
  return (
    <View className="mb-3" nativeID={idPrefix} testID={idPrefix}>
      <Text className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        {label}
      </Text>
      <Text className="text-sm leading-5 text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-value`} testID={`${idPrefix}-value`}>
        {value}
      </Text>
    </View>
  );
}

// Perfil de un corredor del equipo, a pedido -- gateado por el caller
// (entrenador siempre, corredor-a-corredor solo si team.showGroupsToRunners).
// Solo campos "seguros": nunca DNI ni dirección exacta (calle/altura/lat/lng)
// -- ver docs/superpowers/specs para el detalle de esa decisión. Teléfono es
// SOLO `phone` (el propio del corredor), no `phoneContact` (contacto de
// emergencia) -- decisión explícita del usuario, 2026-11-07.
//
// `useUser` es la única forma sancionada de pedir el perfil de OTRO usuario
// en la app (ver su propio comentario en hooks/use-user.js) -- nunca una
// query propia contra el mismo endpoint. Fetch on-demand, gateado por
// `visible`: no se pide nada hasta que el modal efectivamente se abre.
export function RunnerDetailModal({ visible, onClose, userId, joinedAt, groupName, subscriptionLabel }) {
  const colors = useThemeColors();
  const { user, loading } = useUser(visible ? userId : null);
  const fullName = user ? `${user.name ?? ''} ${user.surname ?? ''}`.trim() : null;
  const age = user ? calculateAge(user.birthDate) : null;
  const location = user ? [user.city, user.province, user.country].filter(Boolean).join(', ') : null;

  return (
    <Modal animationType="fade" nativeID="runner-detail-modal" onRequestClose={onClose} testID="runner-detail-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="runner-detail-modal-backdrop" onPress={onClose} testID="runner-detail-modal-backdrop">
        <Pressable className="max-h-[80vh] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="runner-detail-modal-card" onPress={() => {}} testID="runner-detail-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="runner-detail-modal-header" testID="runner-detail-modal-header">
            <Text className="flex-1 text-base font-bold text-slate-900 dark:text-white" nativeID="runner-detail-modal-title" testID="runner-detail-modal-title">
              Detalle del corredor
            </Text>
            <Pressable className="h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800" nativeID="runner-detail-modal-close-button" onPress={onClose} testID="runner-detail-modal-close-button">
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
            </Pressable>
          </View>

          {loading || !user ? (
            <View className="items-center py-6" nativeID="runner-detail-modal-loading" testID="runner-detail-modal-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              <View className="mb-4 flex-row items-center gap-3" nativeID="runner-detail-modal-identity" testID="runner-detail-modal-identity">
                <ParticipantAvatar color={colorForUserId(userId)} idPrefix="runner-detail-modal-avatar" name={fullName} photoUrl={user.photoUrl} size={56} />
                <View className="flex-1" nativeID="runner-detail-modal-identity-text" testID="runner-detail-modal-identity-text">
                  <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID="runner-detail-modal-name" numberOfLines={1} testID="runner-detail-modal-name">
                    {display(fullName)}
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="runner-detail-modal-email" numberOfLines={1} testID="runner-detail-modal-email">
                    {display(user.email)}
                  </Text>
                </View>
              </View>

              <DetailField idPrefix="runner-detail-modal-status" label="Estado" value={display(subscriptionLabel)} />
              <DetailField idPrefix="runner-detail-modal-group" label="Grupo" value={display(groupName)} />
              <DetailField idPrefix="runner-detail-modal-seniority" label="Antigüedad en el equipo" value={joinedAt ? `${formatRelativeTime(joinedAt)} en el equipo` : DASH} />
              <DetailField idPrefix="runner-detail-modal-birthdate" label="Fecha de nacimiento" value={user.birthDate ? `${display(user.birthDate)}${age != null ? ` (${age} años)` : ''}` : DASH} />
              <DetailField idPrefix="runner-detail-modal-location" label="Ubicación" value={display(location)} />
              <DetailField idPrefix="runner-detail-modal-phone" label="Teléfono" value={display(user.phone)} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
