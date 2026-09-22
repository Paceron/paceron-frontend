import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changeTier as changeTierService, getCurrentSubscription, getNextSubscription, cancelPendingSubscription as cancelPendingService } from '../services/tier-subscriptions.js';
import { toSubscriptionModel } from '../services/normalizers.js';

// Estado de servidor del dominio de suscripción/cuotas — TanStack
// Query, no Zustand (ver CLAUDE.md "Estado de aplicación vs. de
// servidor"), mismo criterio que hooks/use-team-roster.js. Primer
// useMutation real del repo: al cambiar de tier, el resultado ya trae
// la suscripción actualizada — se escribe directo en el cache con
// setQueryData en vez de invalidar + esperar un refetch de red.
export function useTierSubscription(userId, roleId) {
  const queryClient = useQueryClient();
  const currentKey = ['subscription-current', userId, roleId];
  const nextKey = ['subscription-next', userId, roleId];

  const subscriptionQuery = useQuery({
    queryKey: currentKey,
    queryFn: () => getCurrentSubscription(userId, roleId).then(toSubscriptionModel),
    enabled: Boolean(userId) && Boolean(roleId),
  });

  // Período `next`: la sub en first_payment_pending (cambio de tier hacia
  // un tier pago que nunca se pagó). Es lo que dibuja el banner
  // "Completar pago" — especialmente tras re-login, donde current (solo
  // `active`) no muestra nada pero el pendiente sigue bloqueando changeTier.
  const nextSubscriptionQuery = useQuery({
    queryKey: nextKey,
    queryFn: () => getNextSubscription(userId, roleId).then(toSubscriptionModel),
    enabled: Boolean(userId) && Boolean(roleId),
  });

  const changeTierMutation = useMutation({
    mutationFn: (tierId) => changeTierService(userId, roleId, tierId).then(toSubscriptionModel),
    onSuccess: (data) => {
      queryClient.setQueryData(currentKey, data);
    },
  });

  const cancelPendingMutation = useMutation({
    mutationFn: (tierId) => cancelPendingService(userId, roleId, tierId),
    onSuccess: () => {
      // El pendiente ya no existe: next queda vacío y current sigue igual
      // (la cancelación no toca la sub activa ni el tier efectivo).
      queryClient.setQueryData(nextKey, null);
      queryClient.invalidateQueries({ queryKey: nextKey });
      queryClient.invalidateQueries({ queryKey: currentKey });
    },
  });

  return {
    subscription: subscriptionQuery.data ?? null,
    isLoading: subscriptionQuery.isLoading,
    refetchSubscription: subscriptionQuery.refetch,
    changeTier: changeTierMutation.mutateAsync,
    isChangingTier: changeTierMutation.isPending,
    nextSubscription: nextSubscriptionQuery.data ?? null,
    refetchNextSubscription: nextSubscriptionQuery.refetch,
    cancelPending: cancelPendingMutation.mutateAsync,
    isCancellingPending: cancelPendingMutation.isPending,
  };
}