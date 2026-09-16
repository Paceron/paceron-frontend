import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { getMpConnectAuthUrl } from '../../services/mp-connect.js';
import { MpConnectButtonView } from './mp-connect-button-view.jsx';

// Rama web de MpConnectButton: abre la autorización de Mercado Pago en una
// ventana emergente y espera el postMessage de la página de retorno
// (components/payments/mp-connect-callback-page.jsx).
//
// Ventana emergente y no redirect de página completa porque el usuario está a
// mitad del formulario de alta de entrenador: un redirect perdería el alias ya
// tipeado, y además fuerza un boot completo del bundle al volver (vercel.json
// reescribe todo a la SPA). La ventana emergente deja el árbol montado.
//
// Iframe no es opción: Mercado Pago manda X-Frame-Options.

export const MP_CONNECT_MESSAGE_SOURCE = 'paceron-mp-connect';

const POPUP_FEATURES = 'width=520,height=760';
const POLL_INTERVAL_MS = 500;

export function MpConnectButton({ connected, disabled, onConnected, onError, onCancel }) {
  const [loading, setLoading] = useState(false);
  const popupRef = useRef(null);
  const pollRef = useRef(null);
  const settledRef = useRef(false);

  // Los callbacks van por ref para que el listener de 'message' se suscriba una
  // sola vez y no se re-arme en cada render del padre.
  const handlersRef = useRef();
  handlersRef.current = { onConnected, onError, onCancel };

  // Estables entre renders (solo tocan refs y setState), así el listener de
  // 'message' se suscribe una sola vez.
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // settle garantiza una sola salida: sin esto, el postMessage y el polling de
  // popup.closed se disparan casi juntos al final del flujo feliz y el padre
  // recibiría onConnected seguido de onCancel.
  const settle = useCallback((callback, arg) => {
    if (settledRef.current) return;
    settledRef.current = true;
    stopPolling();
    popupRef.current = null;
    setLoading(false);
    callback?.(arg);
  }, [stopPolling]);

  useEffect(() => {
    const handleMessage = (event) => {
      // Cualquier pestaña puede postear a esta ventana: se valida el origen y
      // una marca propia. Nunca '*' ni un chequeo laxo.
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== MP_CONNECT_MESSAGE_SOURCE) return;

      popupRef.current?.close();
      const { onConnected: connectedCb, onError: errorCb } = handlersRef.current;

      if (event.data.status === 'success') {
        settle(connectedCb);
      } else {
        settle(errorCb, new Error(event.data.reason || 'unknown_error'));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      stopPolling();
    };
  }, [settle, stopPolling]);

  const handlePress = async () => {
    if (loading) return;
    settledRef.current = false;

    // El window.open TIENE que ser sincrónico dentro del handler del click: si
    // se abre después de un await ya se perdió el gesto del usuario y el
    // navegador lo bloquea. Es el error clásico de este patrón — no mover esto
    // abajo del fetch, aunque quede más prolijo.
    const popup = window.open('', MP_CONNECT_MESSAGE_SOURCE, POPUP_FEATURES);
    if (!popup) {
      Toast.show({
        type: 'error',
        text1: 'No pudimos abrir Mercado Pago',
        text2: 'Habilitá las ventanas emergentes para este sitio y probá de nuevo.',
      });
      return;
    }

    popupRef.current = popup;
    setLoading(true);
    // El backend puede tardar ~20s en despertar (Render free): sin esto la
    // ventana queda en blanco y parece colgada.
    popup.document.write('Conectando con Mercado Pago…');

    try {
      const { auth_url: authUrl } = await getMpConnectAuthUrl('web');
      if (!authUrl) throw new Error('El servidor no devolvió la URL de autorización.');
      popup.location.href = authUrl;
    } catch (error) {
      popup.close();
      settle(handlersRef.current.onError, error);
      return;
    }

    pollRef.current = setInterval(() => {
      if (popupRef.current?.closed) {
        // Cerró sin mandar mensaje: canceló, o completó y cerró a mano. El
        // padre consulta /connect/status igual, que es quien decide.
        settle(handlersRef.current.onCancel);
      }
    }, POLL_INTERVAL_MS);
  };

  return (
    <MpConnectButtonView connected={connected} disabled={disabled} loading={loading} onPress={handlePress} />
  );
}
