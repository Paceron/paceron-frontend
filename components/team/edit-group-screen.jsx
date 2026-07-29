import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { InputField, PickerField } from '../forms/fields.jsx';

// Formulario chico: nombre + descripción + plan de entrenamiento — mismos
// campos que ya usa GroupListEditor para agregar un grupo nuevo (la
// descripción se sumó acá y ahí a la vez, no existía en ningún lado antes).
// No permite editar membresía (mover corredores de grupo es otro flujo, no
// implementado todavía) ni el grupo default "Sin grupo" (no tiene sentido
// renombrar el bucket al que cae todo corredor sin grupo elegido) — la
// pantalla de detalle no ofrece el lápiz de edición para ese grupo en
// particular.
export function EditGroupScreen({ teamId, groupId }) {
  const router = useRouter();
  const colors = useThemeColors();
  const team = useTeamStore((s) => s.teams.find((t) => t.id === teamId));
  const updateGroup = useTeamStore((s) => s.updateGroup);
  const fetchTeam = useTeamStore((s) => s.fetchTeam);
  const group = team?.groups.find((g) => g.id === groupId);

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [trainingPlanId, setTrainingPlanId] = useState(group?.trainingPlanId ?? '');
  const [error, setError] = useState(null);
  const [loadingTeam, setLoadingTeam] = useState(!team);

  // Entrar por deep-link (ej. recargar /teams/{id}/groups/{groupId}/edit
  // directo) puede caer acá antes de que el equipo esté en el store —
  // fetchTeam lo trae puntual. El grupo es un sub-objeto sintético del
  // equipo en este store, no un recurso fetcheable aparte.
  useEffect(() => {
    if (team) {
      setLoadingTeam(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingTeam(true);
    fetchTeam(teamId).finally(() => { if (!cancelled) setLoadingTeam(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (loadingTeam) {
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
          onPress={() => router.back()}
          testID="edit-group-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-group-not-found-back-button-label" testID="edit-group-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Ingresá un nombre para el grupo.');
      return;
    }
    const duplicate = team.groups.some((g) => g.id !== groupId && g.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setError('Ya existe un grupo con ese nombre.');
      return;
    }
    updateGroup(teamId, groupId, { name: trimmed, description: description.trim() || null, trainingPlanId: trainingPlanId || null });
    Toast.show({ type: 'success', text1: 'Grupo actualizado' });
    router.back();
  };

  return (
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
            onPress={() => router.back()}
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
          <PickerField dense label="Plan de entrenamiento" onChange={setTrainingPlanId} options={TRAINING_PLAN_OPTIONS} placeholder="Sin plan asignado" value={trainingPlanId} />

          <Pressable
            className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80"
            nativeID="edit-group-save-button"
            onPress={handleSubmit}
            testID="edit-group-save-button"
          >
            <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-group-save-button-label" testID="edit-group-save-button-label">
              Guardar cambios
            </Text>
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}
