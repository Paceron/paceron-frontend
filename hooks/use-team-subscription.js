import { useQuery } from '@tanstack/react-query';
import { getTeamSubscription } from '../services/team-subscriptions.js';
import { toTeamSubscriptionModel } from '../services/normalizers.js';

// Estado de servidor de la membresía del corredor a un equipo (TanStack Query,
// no Zustand — ver CLAUDE.md "Estado de aplicación vs. de servidor"). Sin
// mutaciones propias: la membresía la crean los endpoints de unirse y la activa
// el webhook de Mercado Pago, así que acá solo se lee y se refetchea.
//
// `enabled` deja la query apagada mientras no haya usuario/equipo — y el caller
// puede apagarla además con `enabled: false` para equipos gratis, donde no hay
// nada que consultar (el backend igual responde `active`, pero es una request al
// vacío).
export function useTeamSubscription(userId, teamId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['team-subscription', userId, teamId],
    queryFn: () => getTeamSubscription(userId, teamId).then(toTeamSubscriptionModel),
    enabled: Boolean(userId) && Boolean(teamId) && enabled,
  });

  const subscription = query.data ?? null;

  return {
    subscription,
    // Derivados de conveniencia: los usan el banner y la pantalla de pago, y
    // así el `subscription_status` del backend no se compara a mano con strings
    // sueltos en cada call site.
    isPendingFirstPayment: subscription?.membership?.subscriptionStatus === 'first_payment_pending',
    isActive: subscription?.membership?.subscriptionStatus === 'active',
    hasDebt: Boolean(subscription?.hasDebt),
    nextInstallment: subscription?.nextInstallment ?? null,
    loading: query.isLoading,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
