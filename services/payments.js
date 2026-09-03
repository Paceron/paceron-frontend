import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import {
  mockCreatePreference,
  mockProcessPayment,
  mockGetPayment,
  mockCreateTestCardToken,
} from './__mocks__/payments-mock.js';

// Fase 0 de pagos — contrato real y estable, ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md.
// `concept` se pasa tal cual lo pida el caller ("order"/"subscription")
// — este servicio no le asume ningún comportamiento especial, el
// backend tampoco lo tiene todavía.

// POST /api/v1/payments/preference.
export async function createPreference(payload) {
  if (USE_MOCKS) return await mockCreatePreference(payload);
  return await api.post('/payments/preference', payload);
}

// POST /api/v1/payments.
export async function processPayment(payload) {
  if (USE_MOCKS) return await mockProcessPayment(payload);
  return await api.post('/payments', payload);
}

// GET /api/v1/payments/{id}.
export async function getPayment(paymentId) {
  if (USE_MOCKS) return await mockGetPayment(paymentId);
  return await api.get(`/payments/${paymentId}`);
}

// POST /api/v1/payments/test-card-token — sandbox only, sin UI propia
// todavía (ver spec).
export async function createTestCardToken(payload) {
  if (USE_MOCKS) return await mockCreateTestCardToken(payload);
  return await api.post('/payments/test-card-token', payload);
}
