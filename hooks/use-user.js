import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser as getUserService } from '../services/auth.js';
import { updateUser as updateUserService, changeStatus as changeStatusService, uploadUserPhoto as uploadUserPhotoService, deleteUserPhoto as deleteUserPhotoService } from '../services/user.js';
import { activateTrainerRole as activateTrainerRoleService, deactivateTrainerRole as deactivateTrainerRoleService, getPermissions as getPermissionsService } from '../services/roles.js';
import { toUserModel } from '../services/normalizers.js';
import { useAuthStore } from '../store/auth-store.js';

// Estado de servidor del perfil de usuario — TanStack Query, no Zustand
// (ver CLAUDE.md). Sesión (token/refreshToken/activeRole/userId) sigue en
// store/auth-store.js — services/api.js la lee sincrónica fuera de React
// en cada request, no encaja con el modelo de hooks de Query.
//
// Única forma de pedir un `['user', id]` en toda la app -- no hand-rollear
// otra useQuery con la misma key para resolver "el perfil de otro user_id"
// (ej. el dueño de un equipo) en otro componente. Bug real encontrado
// 2026-10-11 en team-detail-screen.jsx: una query paralela ahí usaba la
// MISMA key pero devolvía el dto crudo (sin pasar por toUserModel) --
// cuando el id coincidía con el usuario logueado (visitar tu propio
// equipo), las dos competían por el mismo slot de caché, y la que perdía
// la carrera pisaba la caché con un objeto sin `userId` (camelCase),
// rompiendo cualquier otro componente que leyera ese mismo user vía este
// hook. Si en algún momento hace falta pedir el perfil de otro usuario,
// usar este hook con ese id -- nunca una query propia contra el mismo
// endpoint.
export function useUser(userId) {
  const query = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserService({ id: userId }).then((dto) => toUserModel(dto)),
    enabled: Boolean(userId),
  });
  return { user: query.data ?? null, loading: query.isLoading };
}

export function usePermissions(userId) {
  const query = useQuery({
    queryKey: ['permissions', userId],
    queryFn: () => getPermissionsService(userId).then((data) => data?.roles ?? []),
    enabled: Boolean(userId),
  });
  return { roles: query.data ?? [], loading: query.isLoading };
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.userId);

  const invalidateUser = () => queryClient.invalidateQueries({ queryKey: ['user', userId] });
  const invalidatePermissions = () => queryClient.invalidateQueries({ queryKey: ['permissions', userId] });

  // Siembra el cache con el user actualizado que ya viene en la respuesta
  // de PUT /users/{id}, en vez de invalidar y refetchear (mismo criterio
  // que login() en auth-store.js) — un GET /users/{id} inmediato después
  // no está garantizado que devuelva el eco exacto de lo recién guardado.
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, payload, currentPassword }) => {
      try {
        const updated = toUserModel(await updateUserService(id, payload, currentPassword));
        return { success: true, user: updated };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) queryClient.setQueryData(['user', userId], result.user); },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ uri, mimeType }) => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        const { photo_url: photoUrl } = await uploadUserPhotoService(userId, uri, mimeType);
        return { success: true, photoUrl };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => {
      if (!result.success) return;
      queryClient.setQueryData(['user', userId], (old) => (old ? { ...old, photoUrl: result.photoUrl } : old));
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        await deleteUserPhotoService(userId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => {
      if (!result.success) return;
      queryClient.setQueryData(['user', userId], (old) => (old ? { ...old, photoUrl: null } : old));
    },
  });

  // Baja lógica: a diferencia del resto, en éxito cierra sesión
  // (auth-store.js#logout, que limpia todo el cache de perfil) en vez de
  // invalidar puntualmente — no tiene sentido seguir mostrando un perfil
  // que ya no existe.
  const deactivateAccountMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        await changeStatusService(userId, 'inactive');
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: async (result) => { if (result.success) await useAuthStore.getState().logout(); },
  });

  const activateTrainerRoleMutation = useMutation({
    mutationFn: async ({ bankAlias, password }) => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        await activateTrainerRoleService(userId, { password, bankAlias });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) { invalidateUser(); invalidatePermissions(); } },
  });

  const deactivateTrainerRoleMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return { success: false, error: 'No hay sesión activa.' };
      try {
        await deactivateTrainerRoleService(userId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result) => { if (result.success) { invalidateUser(); invalidatePermissions(); } },
  });

  return {
    updateUser: updateUserMutation.mutateAsync,
    isUpdating: updateUserMutation.isPending,
    uploadPhoto: uploadPhotoMutation.mutateAsync,
    isUploadingPhoto: uploadPhotoMutation.isPending,
    deletePhoto: deletePhotoMutation.mutateAsync,
    isDeletingPhoto: deletePhotoMutation.isPending,
    deactivateAccount: deactivateAccountMutation.mutateAsync,
    isDeactivating: deactivateAccountMutation.isPending,
    activateTrainerRole: activateTrainerRoleMutation.mutateAsync,
    isActivatingTrainer: activateTrainerRoleMutation.isPending,
    deactivateTrainerRole: deactivateTrainerRoleMutation.mutateAsync,
    isDeactivatingTrainer: deactivateTrainerRoleMutation.isPending,
  };
}

// Corrección reactiva: si activeRole quedó en 'trainer' pero los roles
// reales (recién resueltos) no incluyen 'entrenador' (sesión vieja
// persistida, o el rol se revocó desde otra sesión), fuerza activeRole a
// 'runner'. Reemplaza la corrección que antes vivía inline al final de
// auth-store.js#fetchPermissions (ahora eliminada de ahí).
// Se monta una sola vez en providers/app-providers.jsx.
export function useRoleReconciliation() {
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const resetActiveRoleIfInvalid = useAuthStore((s) => s.resetActiveRoleIfInvalid);
  const { roles, loading } = usePermissions(userId);

  useEffect(() => {
    if (loading) return;
    const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
    if (activeRole === 'trainer' && !hasTrainerRole) resetActiveRoleIfInvalid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, loading]);
}
