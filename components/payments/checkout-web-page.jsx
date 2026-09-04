import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
// Sin extensión a propósito: Metro solo aplica resolución por plataforma
// (.web.jsx antes que .jsx) cuando el specifier NO trae extensión — un
// import con '.jsx' explícito carga ese archivo literal en cualquier
// plataforma, incluida web, rompiendo el split.
import { CheckoutFlow } from './checkout-flow';

// Página real de la web (deployada en Vercel), pensada para cargarse
// standalone dentro de un WebView nativo (ver checkout-flow.jsx, rama
// nativa de CheckoutFlow) — no se linkea desde ningún lado de la
// navegación nativa ni de la web normal. Ver
// docs/superpowers/specs/2026-09-03-payments-checkout-webview-design.md.
//
// La sesión y el tema llegan inyectados en localStorage ANTES de que
// este componente monte (injectedJavaScriptBeforeContentLoaded, del
// lado nativo) — para cuando useAuthStore hidrata acá, token/user ya
// están. Sin RequireAuth: su redirect a '/' mostraría el shell completo
// de la app adentro del WebView, sin sentido en este contexto aislado —
// si la inyección falló por algún motivo, se muestra un mensaje corto
// en su lugar, sin navegar a ningún lado.
export function CheckoutWebPage() {
  const params = useLocalSearchParams();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postToNative = (payload) => {
    window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
  };

  if (!hydrated) return null;

  if (!token) {
    return (
      <View className="flex-1 items-center justify-center bg-paper p-6 dark:bg-ink" nativeID="checkout-page-no-session" testID="checkout-page-no-session">
        <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="checkout-page-no-session-label" testID="checkout-page-no-session-label">
          No pudimos validar tu sesión. Cerrá esta ventana e intentá de nuevo.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper p-4 dark:bg-ink" nativeID="checkout-page-root" testID="checkout-page-root">
      <CheckoutFlow
        amount={Number(params.amount)}
        installmentId={params.installmentId ? Number(params.installmentId) : undefined}
        marketplace={params.marketplace === 'true'}
        onApproved={(payment) => postToNative({ status: 'approved', payment })}
        onError={(error) => postToNative({ status: 'error', message: error?.message ?? 'Error desconocido' })}
        preferenceId={params.preferenceId}
        publicKey={params.publicKey}
      />
    </View>
  );
}
