import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/auth-store.js';
import { ScreenCard } from '../shared/screen-card.jsx';
// Con extensión explícita, a propósito: esta página siempre corre en un
// bundle web (la carga el WebView nativo de checkout-flow.jsx, que ya
// provee su propio chrome de modal) — quiere siempre el Brick sin chrome,
// nunca el CheckoutFlow.web.jsx que se envuelve a sí mismo en un modal
// (eso duplicaría el chrome). No aplica el quirk de resolución por
// plataforma de Metro porque no hay ambigüedad de plataforma a resolver.
import { CheckoutBrick } from './checkout-brick.web.jsx';

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
        <ScreenCard nativeID="checkout-page-no-session-container" testID="checkout-page-no-session-container">
          <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID="checkout-page-no-session-label" testID="checkout-page-no-session-label">
            No pudimos validar tu sesión. Cerrá esta ventana e intentá de nuevo.
          </Text>
        </ScreenCard>
      </View>
    );
  }

  // ScrollView y no View: el root de Expo web ocupa la pantalla con overflow
  // hidden, así que un formulario más alto que el WebView (el Brick con todos
  // los medios de pago y "Completá tu información") quedaba cortado y no se
  // podía bajar hasta el botón de pagar.
  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="p-4 pb-12"
      keyboardShouldPersistTaps="handled"
      nativeID="checkout-page-root"
      testID="checkout-page-root"
    >
      <ScreenCard nativeID="checkout-page-container" testID="checkout-page-container">
        <CheckoutBrick
          amount={Number(params.amount)}
          concept={params.concept}
          installmentId={params.installmentId ? Number(params.installmentId) : undefined}
          marketplace={params.marketplace === 'true'}
          onApproved={(payment) => postToNative({ status: 'approved', payment })}
          onError={(error) => postToNative({ status: 'error', message: error?.message ?? 'Error desconocido' })}
          preferenceId={params.preferenceId}
          publicKey={params.publicKey}
        />
      </ScreenCard>
    </ScrollView>
  );
}
