import { resolveWebOrigin } from './web-origin.js';

const REMOTE_URL = 'https://paceron-backend-as9c.onrender.com/api/v1';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || REMOTE_URL;
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
// Origen de la web deployada — el checkout nativo (WebView, ver
// components/payments/checkout-flow.jsx) carga /checkout desde acá. Sale del
// mismo entorno que API_BASE_URL (ver config/web-origin.js).
export const WEB_ORIGIN = resolveWebOrigin(API_BASE_URL, process.env.EXPO_PUBLIC_WEB_ORIGIN);
