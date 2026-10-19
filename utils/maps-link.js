import { Linking } from 'react-native';

// URL universal de Google Maps (coordenadas, no label -- el label es solo
// para mostrar, puede ser ambiguo; lat/lng es siempre exacto). Funciona
// igual en las 3 plataformas vía Linking.openURL (abre pestaña nueva en
// web, la app de Maps o el navegador en nativo). Extraído 2026-10-17 --
// vivía triplicado (session-pre-start-screen.jsx, trainer-session-pre-
// start-screen.jsx, trainer-session-review-screen.jsx), cada copia con el
// comentario de "no se puede importar porque la otra función no está
// exportada" -- con un 4to call site (competitions-tab.jsx) ya no vale la
// pena mantener la duplicación.
export function openLocationInMaps(location) {
  if (!location?.lat || !location?.lng) return;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`);
}
