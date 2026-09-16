import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { resolveMpConnectMessage } from '../../utils/mp-connect-messages.js';

// Página de retorno del OAuth de Mercado Pago. El backend redirige acá (302)
// después de procesar el callback, con ?status=success | ?status=error&reason=<slug>.
//
// Vive fuera de (tabs) a propósito, igual que app/checkout.jsx: en web la carga
// una ventana emergente de 520px y en nativo ni siquiera se renderiza (el deep
// link lo consume openAuthSessionAsync). Montar el shell autenticado completo
// acá no tendría sentido, y el gate de `hydrated` de (tabs)/_layout.jsx
// retrasaría el postMessage sin ninguna ganancia.
//
// El `code` de autorización nunca llega hasta acá: el backend no lo propaga.

const MP_CONNECT_MESSAGE_SOURCE = 'paceron-mp-connect';

export function MpConnectCallbackPage() {
  const router = useRouter();
  const { status, reason } = useLocalSearchParams();
  // useLocalSearchParams puede devolver arrays si el param viene repetido.
  const result = resolveMpConnectMessage(
    Array.isArray(status) ? status[0] : status,
    Array.isArray(reason) ? reason[0] : reason
  );
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Avisarle a la ventana que abrió esta y cerrarse. postMessage con el
    // origen explícito, nunca '*'.
    if (window.opener) {
      window.opener.postMessage(
        { source: MP_CONNECT_MESSAGE_SOURCE, status: result.ok ? 'success' : 'error', reason: reason ?? null },
        window.location.origin
      );
      window.close();
      return;
    }

    // Sin opener: el usuario llegó acá directo (ventana emergente bloqueada, o
    // abrió el link a mano). Se muestra el resultado con una salida explícita
    // en vez de dejarlo en una pantalla muerta.
    setStandalone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!standalone) return null;

  return (
    <View
      className="flex-1 items-center justify-center gap-3 bg-paper p-6 dark:bg-ink"
      nativeID="mp-connect-callback-page"
      testID="mp-connect-callback-page"
    >
      <MaterialCommunityIcons
        color={result.ok ? '#10b981' : '#ef4444'}
        name={result.ok ? 'check-circle' : 'alert-circle'}
        size={40}
      />
      <Text
        className="text-center text-lg font-semibold text-slate-900 dark:text-white"
        nativeID="mp-connect-callback-page-title"
        testID="mp-connect-callback-page-title"
      >
        {result.title}
      </Text>
      <Text
        className="text-center text-sm leading-5 text-slate-600 dark:text-slate-300"
        nativeID="mp-connect-callback-page-detail"
        testID="mp-connect-callback-page-detail"
      >
        {result.detail}
      </Text>
      <Pressable
        className="mt-2 h-11 flex-row items-center justify-center rounded-full bg-primary px-6 hover:opacity-90 active:opacity-80"
        nativeID="mp-connect-callback-page-back-button"
        onPress={() => router.replace('/profile/activate-trainer')}
        testID="mp-connect-callback-page-back-button"
      >
        <Text
          className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
          nativeID="mp-connect-callback-page-back-label"
          testID="mp-connect-callback-page-back-label"
        >
          Volver a Paceron
        </Text>
      </Pressable>
    </View>
  );
}
