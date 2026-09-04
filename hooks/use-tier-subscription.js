import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changeTier as changeTierService, getCurrentSubscription } from '../services/tier-subscriptions.js';
import { toSubscriptionModel } from '../services/normalizers.js';

// Estado de servidor del dominio de suscripción/cuotas — TanStack
// Query, no Zustand (ver CLAUDE.md "Estado de aplicación vs. de
// servidor"), mismo criterio que hooks/use-team-roster.js. Primer
// useMutation real del repo: al cambiar de tier, el resultado ya trae
// la suscripción actualizada — se escribe directo en el cache con
// setQueryData en vez de invalidar + esperar un refetch de red.
export function useTierSubscription(userId, roleId) {
  const queryClient = useQueryClient();
  const queryKey = ['subscription-current', userId, roleId];

  const subscriptionQuery = useQuery({
    queryKey,
    queryFn: () => getCurrentSubscription(userId, roleId).then(toSubscriptionModel),
    enabled: Boolean(userId) && Boolean(roleId),
  });

  const changeTierMutation = useMutation({
    mutationFn: (tierId) => changeTierService(userId, roleId, tierId).then(toSubscriptionModel),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    subscription: subscriptionQuery.data ?? null,
    isLoading: subscriptionQuery.isLoading,
    refetchSubscription: subscriptionQuery.refetch,
    changeTier: changeTierMutation.mutateAsync,
    isChangingTier: changeTierMutation.isPending,
  };
}
