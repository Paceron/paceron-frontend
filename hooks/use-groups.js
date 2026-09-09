import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listGroups as listGroupsService, createGroup as createGroupService, updateGroup as updateGroupService, deleteGroup as deleteGroupService, getGroupUsers as getGroupUsersService, addGroupUser as addGroupUserService, removeGroupUser as removeGroupUserService } from '../services/groups.js';
import { toGroupModel, toCreateGroupPayload, toUpdateGroupPayload } from '../services/normalizers.js';

// Estado de servidor del dominio de grupos — TanStack Query, no Zustand
// (ver CLAUDE.md). trainingPlanId sigue siendo local-only (sin campo en
// el backend, ver docs/BACKEND_API_GAPS.md gap 4) — este hook no lo toca,
// solo lo devuelve tal cual viene del catálogo mock ahora en
// store/team-store.js#TRAINING_PLAN_OPTIONS (fuera de esta migración).
export function useGroups(teamId, userId) {
  const query = useQuery({
    queryKey: ['groups', teamId],
    queryFn: () => listGroupsService(teamId, userId).then((dtos) => dtos.map((dto) => toGroupModel(dto))),
    enabled: Boolean(teamId && userId),
  });
  return { groups: query.data ?? [], loading: query.isLoading, error: query.error };
}

export function useGroupMutations(teamId) {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['groups', teamId] });

  const createGroupMutation = useMutation({
    mutationFn: async (form) => {
      try {
        const created = await createGroupService(toCreateGroupPayload(teamId, form));
        return { success: true, group: toGroupModel(created) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ groupId, form }) => {
      try {
        const updated = await updateGroupService(groupId, toUpdateGroupPayload(form));
        return { success: true, group: toGroupModel(updated) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  // Antes de borrar, reasigna a sus miembros (si tiene) al grupo principal
  // del equipo — nadie queda "sin grupo" solo porque su grupo se borró.
  // Best-effort por miembro: si uno falla, sigue con el resto y borra el
  // grupo igual. El caller (team-detail-screen.jsx) le pasa el id del
  // grupo principal — este hook no necesita conocer la lista completa de
  // grupos para encontrarlo.
  const deleteGroupMutation = useMutation({
    mutationFn: async ({ groupId, defaultGroupId }) => {
      try {
        if (defaultGroupId && defaultGroupId !== groupId) {
          const groupUserDtos = await getGroupUsersService(groupId);
          for (const dto of groupUserDtos) {
            try {
              await removeGroupUserService(groupId, dto.user_id);
              await addGroupUserService(teamId, defaultGroupId, dto.user_id);
            } catch {
              // best-effort — ver comentario de arriba
            }
          }
        }
        await deleteGroupService(groupId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) invalidate(); },
  });

  return {
    createGroup: createGroupMutation.mutateAsync,
    isCreating: createGroupMutation.isPending,
    updateGroup: updateGroupMutation.mutateAsync,
    isUpdating: updateGroupMutation.isPending,
    deleteGroup: deleteGroupMutation.mutateAsync,
    isDeleting: deleteGroupMutation.isPending,
  };
}
