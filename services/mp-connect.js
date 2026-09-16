import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetMpConnectAuthUrl, mockGetMpConnectStatus } from './__mocks__/mp-connect-mock.js';

// Conexión OAuth de la cuenta de Mercado Pago del entrenador ("mp-connect").
// Es lo que habilita el cobro con split (corredor → app + entrenador): sin
// esto el backend no tiene un access_token del vendedor con el que crear la
// preferencia. Ver docs/superpowers/specs/2026-09-16-mp-connect-trainer-onboarding-design.md.

// GET /api/v1/mercadopago/connect?platform=web|app — mpconnect.AuthURLResponse
// {auth_url, state}. El platform define a dónde vuelve el navegador cuando el
// backend termina de procesar el callback (origen web o deep link de la app);
// viaja codificado adentro del state, porque el redirect_uri registrado en
// Mercado Pago es fijo y no puede variar por request.
export async function getMpConnectAuthUrl(platform) {
  if (USE_MOCKS) return await mockGetMpConnectAuthUrl(platform);
  return await api.get(`/mercadopago/connect?platform=${encodeURIComponent(platform)}`);
}

// GET /api/v1/mercadopago/connect/status — mpconnect.StatusResponse
// {connected, account_status}. El usuario sale del token, no va por query.
//
// Es la ÚNICA fuente de verdad del estado de la conexión: el `status` que
// llega por la URL de retorno sirve para el mensaje inmediato, nunca para
// decidir. Así el flujo no se rompe si el canal de retorno falla (ventana
// emergente bloqueada, deep link que no resuelve, usuario que cierra a mitad).
export async function getMpConnectStatus() {
  if (USE_MOCKS) return await mockGetMpConnectStatus();
  return await api.get('/mercadopago/connect/status');
}
