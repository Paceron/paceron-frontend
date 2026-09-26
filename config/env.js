const REMOTE_URL = 'http://192.168.100.66:8080/api/v1';
const REMOTE_WEB_ORIGIN = 'https://paceron-frontend.vercel.app';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || REMOTE_URL;
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
// Origen de la web deployada — el checkout nativo (WebView, ver
// components/payments/checkout-flow.jsx) carga /checkout desde acá.
export const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN || REMOTE_WEB_ORIGIN;
