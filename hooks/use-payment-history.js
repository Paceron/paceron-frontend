import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { getMyTierPayments, getReceivedPayments, getReceivedPaymentsSummary } from '../services/payment-history.js';
import {
  toPaymentsPageModel,
  toReceivedPaymentModel,
  toReceivedSummaryModel,
  toTierPaymentModel,
} from '../services/normalizers.js';

// Estado de servidor del historial de pagos del entrenador. Ver
// docs/superpowers/specs/2026-09-26-trainer-payments-dashboard-design.md.
//
// Los listados usan useInfiniteQuery, el primero del repo. use-team-search.js
// acumula páginas a mano, pero acá hay pull-to-refresh: el refetch de un
// infinite query vuelve a pedir todas las páginas ya cargadas, y con la
// acumulación manual eso habría que reescribirlo.

export const PAYMENT_HISTORY_KEYS = {
  summary: (userId) => ['payments-received-summary', userId],
  received: (userId) => ['payments-received', userId],
  mine: (userId) => ['payments-mine', userId],
};

export function useReceivedPaymentsSummary({ enabled = true, months = 6 } = {}) {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: [...PAYMENT_HISTORY_KEYS.summary(userId), months],
    queryFn: () => getReceivedPaymentsSummary({ months }).then(toReceivedSummaryModel),
    enabled: enabled && Boolean(userId),
  });

  return {
    summary: query.data ?? null,
    loading: query.isLoading,
    failed: query.isError,
    refetch: query.refetch,
  };
}

function usePaymentsInfiniteList({ queryKey, fetchPage, mapItem, enabled }) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage?.has_more ? allPages.length + 1 : undefined),
    enabled,
  });

  const items = (query.data?.pages ?? []).flatMap((page) => toPaymentsPageModel(page, mapItem).items);

  return {
    items,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => query.fetchNextPage(),
    loading: query.isLoading,
    loadingMore: query.isFetchingNextPage,
    failed: query.isError,
    refetch: query.refetch,
  };
}

// Cobros de membresía de equipo. teamId y status ('' = todos) son parte de la
// key: cambiar un filtro arranca de la página 1.
export function useReceivedPayments({ teamId = '', status = '', enabled = true } = {}) {
  const userId = useAuthStore((s) => s.userId);
  return usePaymentsInfiniteList({
    queryKey: [...PAYMENT_HISTORY_KEYS.received(userId), { teamId, status }],
    fetchPage: (page) => getReceivedPayments({ page, teamId, status }),
    mapItem: toReceivedPaymentModel,
    enabled: enabled && Boolean(userId),
  });
}

// Pagos de suscripción de tier propios, solo del rol entrenador.
export function useMyTierPayments({ enabled = true } = {}) {
  const userId = useAuthStore((s) => s.userId);
  return usePaymentsInfiniteList({
    queryKey: [...PAYMENT_HISTORY_KEYS.mine(userId), 'entrenador'],
    fetchPage: (page) => getMyTierPayments({ page, role: 'entrenador' }),
    mapItem: toTierPaymentModel,
    enabled: enabled && Boolean(userId),
  });
}
