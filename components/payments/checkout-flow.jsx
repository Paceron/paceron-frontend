// components/payments/checkout-flow.jsx
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { useAuthStore } from '../../store/auth-store.js';
import { WEB_ORIGIN } from '../../config/env.js';

// Rama nativa de CheckoutFlow — WebView cargando la misma página web del
// checkout (app/checkout.jsx), en vez de duplicar UI nativa o salir a un
// navegador externo (Checkout Pro). Firma idéntica a la variante web más
// un `onCancel` opcional — asimetría real y aceptada: el brick inline en
// web no tiene concepto de "cerrar", el modal nativo sí. Ver
// docs/superpowers/specs/2026-09-03-payments-checkout-webview-design.md.
export function CheckoutFlow({ preferenceId, publicKey, amount, marketplace, onApproved, onError, onCancel }) {
  const colors = useThemeColors();
  const { themeMode } = useThemeMode();
  const webViewRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);

  // Sesión mínima, NO el objeto completo que persiste auth-store.js — sin
  // refreshToken. Si el access token vence a mitad del pago, el refresh
  // silenciosamente falla en un contexto de menor confianza en vez de
  // exponer el refresh token ahí — recuperable reabriendo el checkout, la
  // sesión real de la app (expo-secure-store) no se toca.
  const [session] = useState(() => {
    const { user, token, expiresAt, activeRole } = useAuthStore.getState();
    return { user, token, expiresAt, activeRole };
  });

  // Sin sesión, ni se monta el WebView. onError se llama en un efecto, no
  // durante el render (llamar un callback del padre en medio del render
  // es un anti-patrón de React — puede disparar el warning "Cannot
  // update a component while rendering a different component").
  useEffect(() => {
    if (!session.token) onError?.(new Error('Sesión inválida — no se pudo abrir el checkout.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!session.token) return null;

  const injectedJavaScriptBeforeContentLoaded = `
    window.localStorage.setItem('paceron.auth', ${JSON.stringify(JSON.stringify(session))});
    window.localStorage.setItem('paceron-theme-mode', ${JSON.stringify(themeMode)});
    true;
  `;

  const queryParams = new URLSearchParams({
    preferenceId,
    publicKey,
    amount: String(amount),
    ...(marketplace ? { marketplace: 'true' } : {}),
  });
  const checkoutUrl = `${WEB_ORIGIN}/checkout?${queryParams.toString()}`;

  const handleMessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (payload.status === 'approved' && payload.payment) {
      setResolved(true);
      onApproved?.(payload.payment);
    } else if (payload.status === 'error') {
      setResolved(true);
      onError?.(new Error(payload.message ?? 'Error en el checkout'));
    }
  };

  const handleClose = () => {
    if (!resolved) onCancel?.();
  };

  const handleShouldStartLoadWithRequest = (request) => request.url.startsWith(WEB_ORIGIN);

  const handleRetry = () => {
    setLoadError(false);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <Modal animationType="slide" nativeID="checkout-flow-modal" onRequestClose={handleClose} testID="checkout-flow-modal" visible>
      <View className="flex-1 bg-paper dark:bg-ink" nativeID="checkout-flow-modal-root" testID="checkout-flow-modal-root">
        <View className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700" nativeID="checkout-flow-modal-header" testID="checkout-flow-modal-header">
          <Text className="text-sm font-bold text-slate-900 dark:text-white" nativeID="checkout-flow-modal-title" testID="checkout-flow-modal-title">Checkout</Text>
          <Pressable
            accessibilityLabel="Cerrar"
            className="p-1 hover:opacity-70 active:opacity-70"
            nativeID="checkout-flow-modal-close-button"
            onPress={handleClose}
            testID="checkout-flow-modal-close-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={22} />
          </Pressable>
        </View>

        {loadError ? (
          <View className="flex-1 items-center justify-center gap-4 px-6" nativeID="checkout-flow-modal-error" testID="checkout-flow-modal-error">
            <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="checkout-flow-modal-error-label" testID="checkout-flow-modal-error-label">
              No pudimos cargar el checkout.
            </Text>
            <Pressable
              className="rounded-full bg-primary px-6 py-2.5 hover:opacity-90 active:opacity-80"
              nativeID="checkout-flow-modal-retry-button"
              onPress={handleRetry}
              testID="checkout-flow-modal-retry-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="checkout-flow-modal-retry-button-label" testID="checkout-flow-modal-retry-button-label">
                Reintentar
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1" nativeID="checkout-flow-modal-webview-wrap" testID="checkout-flow-modal-webview-wrap">
            <WebView
              allowFileAccess={false}
              incognito
              injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
              javaScriptCanOpenWindowsAutomatically={false}
              mixedContentMode="never"
              onError={() => { setLoadError(true); setLoading(false); }}
              onHttpError={() => { setLoadError(true); setLoading(false); }}
              onLoadEnd={() => setLoading(false)}
              onMessage={handleMessage}
              onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
              originWhitelist={[WEB_ORIGIN]}
              ref={webViewRef}
              setSupportMultipleWindows={false}
              source={{ uri: checkoutUrl }}
              style={{ flex: 1 }}
            />
            {loading && (
              <View className="absolute inset-0 items-center justify-center bg-paper dark:bg-ink" nativeID="checkout-flow-modal-loading" testID="checkout-flow-modal-loading">
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
