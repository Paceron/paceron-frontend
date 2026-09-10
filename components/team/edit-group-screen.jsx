import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { useTeam } from '../../hooks/use-teams.js';
import { useGroups, useGroupMutations } from '../../hooks/use-groups.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';

// Formulario chico: nombre + descripción + plan de entrenamiento — mismos
// campos que ya usa GroupListEditor para agregar un grupo nuevo (la
// descripción se sumó acá y ahí a la vez, no existía en ningún lado antes).
// No permite editar membresía (mover corredores de grupo es otro flujo, no
// implementado todavía) ni el grupo default "Sin grupo" (no tiene sentido
// renombrar el bucket al que cae todo corredor sin grupo elegido) — la
// pantalla de detalle no ofrece el lápiz de edición para ese grupo en
// particular.
function EditGroupScreenContent({ teamId, groupId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { team, loading: loadingTeam } = useTeam(teamId);
  const { groups, loading: loadingGroups } = useGroups(teamId, user?.userId);
  const { updateGroup } = useGroupMutations(teamId);
  const group = groups.find((g) => g.id === groupId);

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [trainingPlanId, setTrainingPlanId] = useState(group?.trainingPlanId ?? '');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isDirty = useFormDirty({ name, description, trainingPlanId });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const seededRef = useRef(false);
  useEffect(() => {
    if (group && !seededRef.current) {
      seededRef.current = true;
      setName(group.name);
      setDescription(group.description ?? '');
      setTrainingPlanId(group.trainingPlanId ?? '');
    }
  }, [group]);

  if (loadingTeam || loadingGroups) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="edit-group-loading" testID="edit-group-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!team || !group) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="edit-group-not-found" testID="edit-group-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="edit-group-not-found-label" testID="edit-group-not-found-label">
          No encontramos este grupo.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="edit-group-not-found-back-button"
          onPress={() => guardedClose(() => router.back())}
          testID="edit-group-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-group-not-found-back-button-label" testID="edit-group-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresá un nombre para el grupo.');
      return;
    }
    const duplicate = groups.some((g) => g.id !== groupId && g.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setError('Ya existe un grupo con ese nombre.');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const result = await updateGroup({ groupId, form: { name: trimmed, description: description.trim() || null } });
    setSubmitting(false);
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos actualizar el grupo', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Grupo actualizado' });
    bypassGuard(() => router.back());
  };

  return (
    <>
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="edit-group-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="edit-group-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="edit-group-screen-container" testID="edit-group-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="edit-group-screen-header" testID="edit-group-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="edit-group-screen-back-button"
            onPress={() => guardedClose(() => router.back())}
            testID="edit-group-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="edit-group-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="edit-group-screen-title">
            Editar grupo
          </Text>
        </View>

        <SectionCard icon="account-multiple" title={`Datos de "${group.name}"`}>
          <InputField dense error={error} label="Nombre del grupo" onChange={(text) => { setName(text); if (error) setError(null); }} placeholder="Ej. Grupo avanzado" value={name} />
          <InputField dense label="Descripción del grupo" multiline numberOfLines={2} onChange={setDescription} placeholder="Ej. Corredores con mayor volumen y ritmo." value={description} />
          <ResponsiveSelectField dense label="Plan de entrenamiento" onChange={setTrainingPlanId} options={TRAINING_PLAN_OPTIONS} placeholder="Sin plan asignado" value={trainingPlanId} />

          <Pressable
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 disabled:opacity-60"
            disabled={submitting}
            nativeID="edit-group-save-button"
            onPress={handleSubmit}
            testID="edit-group-save-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-group-save-button-label" testID="edit-group-save-button-label">
                  Guardar cambios
                </Text>
              </>
            )}
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}

export function EditGroupScreen({ teamId, groupId }) {
  return (
    <RequireAuth>
      <EditGroupScreenContent teamId={teamId} groupId={groupId} />
    </RequireAuth>
  );
}
