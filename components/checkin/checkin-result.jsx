import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Fondo del overlay: el mismo gris del asset, por el mismo motivo que en
// checkin-waiting-overlay.jsx (D4). Acá importa más todavía: el ícono de
// resultado es claro, y sobre un fondo de superficie blanca el check verde
// perdería la separación que tiene sobre gris.
const OVERLAY_BG = '#979597';

// Los textos son del front, NO del backend (D7): el mensaje del servidor no se
// muestra salvo cuando no se puede clasificar, para no filtrar nada de la
// sesión. `status` viene de `error.status` de services/api.js.
const MESSAGES = {
  registered: { title: 'Asistencia registrada', icon: 'check-circle', tone: 'success' },
  duplicate: { title: 'Esta asistencia ya estaba registrada', icon: 'check-circle', tone: 'success' },
  forbidden: { title: 'No pertenecés a este equipo', icon: 'close-circle', tone: 'error' },
  invalid: { title: 'El QR no es válido', icon: 'close-circle', tone: 'error' },
  gone: { title: 'La sesión ya no existe', icon: 'close-circle', tone: 'error' },
  unknown: { title: 'No pudimos registrar tu asistencia', icon: 'close-circle', tone: 'error' },
};

export function CheckinResult({ visible, outcome, onAccept }) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const conf = MESSAGES[outcome?.kind] ?? MESSAGES.unknown;
  const isSuccess = conf.tone === 'success';

  return (
    <View
      accessibilityViewIsModal
      className="absolute inset-0 items-center justify-center px-6"
      nativeID="checkin-result-overlay"
      style={{ backgroundColor: OVERLAY_BG, paddingTop: insets.top, paddingBottom: insets.bottom, pointerEvents: 'auto' }}
      testID="checkin-result-overlay"
    >
      <View
        className="w-full max-w-sm items-center rounded-2xl bg-white px-6 py-8 dark:bg-surface"
        nativeID="checkin-result-card"
        testID="checkin-result-card"
      >
        <View className="items-center" nativeID="checkin-result-icon-wrapper" testID="checkin-result-icon-wrapper">
          <MaterialCommunityIcons
            color={isSuccess ? '#8cc63e' : '#ef4444'}
            name={conf.icon}
            size={56}
          />
        </View>

        <Text
          accessibilityLiveRegion="assertive"
          className="mt-4 text-center text-lg font-bold text-slate-900 dark:text-white"
          nativeID="checkin-result-title"
          testID="checkin-result-title"
        >
          {conf.title}
        </Text>

        {outcome?.detail ? (
          <Text
            className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400"
            nativeID="checkin-result-detail"
            testID="checkin-result-detail"
          >
            {outcome.detail}
          </Text>
        ) : null}

        {/* ACEPTAR devuelve el control al escáner con la cámara de nuevo activa.
            No navega ni recarga nada: el corredor suele estar escaneando en un
            grupo de veinte personas y cada una tiene que volver a empezar por su
            cuenta (D9). */}
        <Pressable
          accessibilityLabel="Aceptar y volver a escanear"
          className="mt-6 h-12 w-full items-center justify-center rounded-full bg-primary px-6 active:opacity-80"
          nativeID="checkin-result-accept-button"
          onPress={onAccept}
          testID="checkin-result-accept-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="checkin-result-accept-label" testID="checkin-result-accept-label">
            Aceptar
          </Text>
        </Pressable>

        <Text
          className="mt-3 px-1 text-center text-xs text-slate-400 dark:text-slate-500"
          nativeID="checkin-result-hint"
          testID="checkin-result-hint"
        >
          {isSuccess
            ? 'Escaneá de nuevo el QR de la próxima sesión.'
            : 'Podés intentar de nuevo escaneando el QR.'}
        </Text>
      </View>
    </View>
  );
}
