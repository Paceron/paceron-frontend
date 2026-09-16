import { useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { getMpConnectAuthUrl } from '../../services/mp-connect.js';
import { MpConnectButtonView } from './mp-connect-button-view.jsx';

// Rama nativa de MpConnectButton: abre la autorización en una Custom Tab de
// Chrome (eso es openAuthSessionAsync en Android) y vuelve por deep link.
//
// Ojo: acá NO se puede reusar el patrón de <WebView> de checkout-flow.jsx.
// Mercado Pago deprecó el login dentro de navegador embebido
// (https://www.mercadopago.com.ar/developers/es/news/2023/11/30/WebView-integrations-have-been-deprecated,
// discontinuado el 10/12/2024) y recomienda Custom Tabs / Safari View
// Controller. Aquel WebView es legítimo porque carga NUESTRA página del Brick,
// sin login de MP adentro; este flujo sí tiene login.
export function MpConnectButton({ connected, disabled, onConnected, onError, onCancel }) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Tiene que coincidir con MP_OAUTH_APP_RETURN_URL del backend, que es a
      // donde redirige el callback: paceron://mp-connect/callback en producción
      // y paceron-dev://... en la variante de desarrollo (los schemes salen de
      // app.config.js). Si se cambia uno, cambiar el otro.
      const returnUrl = Linking.createURL('/mp-connect/callback');
      const { auth_url: authUrl } = await getMpConnectAuthUrl('app');
      if (!authUrl) throw new Error('El servidor no devolvió la URL de autorización.');

      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

      if (result.type !== 'success') {
        // 'cancel' (cerró la pestaña) o 'dismiss' (back de Android). El padre
        // consulta /connect/status igual: pudo haber completado igual.
        onCancel?.();
        return;
      }

      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.status === 'success') {
        onConnected?.();
      } else {
        onError?.(new Error(String(queryParams?.reason ?? 'unknown_error')));
      }
    } catch (error) {
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MpConnectButtonView connected={connected} disabled={disabled} loading={loading} onPress={handlePress} />
  );
}
