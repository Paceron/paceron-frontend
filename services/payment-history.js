import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockGetReceivedPayments,
  mockGetReceivedPaymentsSummary,
  mockGetPaymentHistory,
} from './__mocks__/payment-history-mock.js';

// Historial de pagos y cobros del entrenador. Contrato del change de OpenSpec
// historial-pagos-cobros-entrenador (repo paceron-backend), ver
// docs/superpowers/specs/2026-09-26-trainer-payments-dashboard-design.md.
// El usuario sale del token: ningún endpoint lleva :id en el path.

function toQueryString(params) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.append(key, String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// GET /api/v1/payments/received?page&team_id&status — payment.ReceivedPaymentsResponse
// {payments, has_more}. `status` es un grupo (approved|pending|rejected|refunded).
export async function getReceivedPayments({ page = 1, teamId, status } = {}) {
  if (USE_MOCKS) return await mockGetReceivedPayments({ page, teamId, status });
  return await api.get(`/payments/received${toQueryString({ page, team_id: teamId, status })}`);
}

// GET /api/v1/payments/received/summary?months&until — payment.ReceivedSummaryResponse.
// `monthly` trae `months` meses seguidos y el último es `until` (YYYY-MM) o, sin
// él, el mes actual. `earliest_month` es el primer mes con cobros, o null.
export async function getReceivedPaymentsSummary({ months = 6, until } = {}) {
  if (USE_MOCKS) return await mockGetReceivedPaymentsSummary({ months, until });
  return await api.get(`/payments/received/summary${toQueryString({ months, until })}`);
}

// GET /api/v1/payments/history?page&type&status — payment.HistoryPaymentsResponse
// {payments, has_more}: los pagos que hizo el usuario. `type` es
// subscription (tier) o trainer_payment (membresía de un equipo).
export async function getPaymentHistory({ page = 1, type, status } = {}) {
  if (USE_MOCKS) return await mockGetPaymentHistory({ page, type, status });
  return await api.get(`/payments/history${toQueryString({ page, type, status })}`);
}
