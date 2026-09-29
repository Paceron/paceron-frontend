import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useCheckinStore } from '../../store/checkin-store.js';
import { useSaveCheckin } from '../../hooks/use-checkin.js';
import { parseCheckinQrPayload } from '../../utils/checkin-qr-url.js';
import { notifyError, notifySuccess } from '../../utils/haptics.js';
import { CheckinWaitingOverlay } from './checkin-waiting-overlay.jsx';
import { CheckinResult } from './checkin-result.jsx';

// Máquina de fases (D8): `scanning` → `submitting` → `result`. El overlay
// aparece en `submitting` y el resultado en `result`. No hay polling ni estado
// intermedio de la request: es un POST que resuelve o falla, y meter más estados
// sería código para un caso que no existe.
const PHASE = { SCANNING: 'scanning', SUBMITTING: 'submitting', RESULT: 'result' };

// Traduce la respuesta del backend al resultado de pantalla (D7). El texto es
// del front: el del backend no se muestra salvo en el caso no clasificado, para
// no filtrar nada de la sesión.
function toOutcome(response, error) {
  if (!error) {
    return response?.message === 'esta asistencia fue previamente registrada'
      ? { kind: 'duplicate' }
      : { kind: 'registered' };
  }
  const byStatus = { 400: 'invalid', 403: 'forbidden', 404: 'gone' };
  const kind = byStatus[error.status];
  return kind
    ? { kind }
    : { kind: 'unknown', detail: error.message };
}

export function CheckinScanner() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const pendingCheckin = useCheckinStore((s) => s.pendingCheckin);
  const { setPendingCheckin, clearPendingCheckin } = useCheckinStore();

  const [phase, setPhase] = useState(PHASE.SCANNING);
  const [outcome, setOutcome] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();

  const { saveCheckin } = useSaveCheckin();

  // El escaneo pendiente se guarda ANTES de disparar la request, no después de
  // que responda: si el token expira en pleno vuelo, `services/api.js` cierra la
  // sesión, `RequireAuth` manda a `/login`, y sin esto el identificador leído del
  // QR se perdía justo cuando el corredor ya lo tenía apuntado (Etapa 3).
  const attempt = useCallback(async (payload) => {
    setPhase(PHASE.SUBMITTING);
    // Se guarda ANTES de disparar la request. Si el token expira con la request
    // en vuelo, `services/api.js` cierra la sesión, `RequireAuth` manda a
    // `/login` y este pendiente es lo único que permite retomar el registro sin
    // que el corredor vuelva a apuntar la cámara al cartel.
    setPendingCheckin(payload);
    try {
      const response = await saveCheckin(payload);
      clearPendingCheckin();
      notifySuccess();
      setOutcome(toOutcome(response, null));
    } catch (error) {
      notifyError();
      setOutcome(toOutcome(null, error));
    }
    setPhase(PHASE.RESULT);
  }, [saveCheckin, setPendingCheckin, clearPendingCheckin]);

  // Retoma un escaneo que quedó pendiente de una sesión que se cayó. Se dispara
  // una sola vez por pendiente: el ref evita que el efecto se dispare de nuevo si
  // el componente re-renderiza mientras la request sigue en vuelo.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (!userId || !pendingCheckin || resumedRef.current) return;
    resumedRef.current = true;
    const { stale, ...payload } = pendingCheckin;
    attempt(payload);
  }, [userId, pendingCheckin, attempt]);

  // Escaneo. La guarda de fase es lo que impide que un segundo código leído
  // durante el POST dispare otra request (requisito 2): `onBarcodeScanned` sigue
  // llegando mientras la cámara está montada.
  const handleScan = useCallback(({ data }) => {
    if (phase !== PHASE.SCANNING) return;

    const payload = parseCheckinQrPayload(data);
    if (!payload) {
      notifyError();
      setOutcome({ kind: 'invalid' });
      setPhase(PHASE.RESULT);
      return;
    }

    // Sin sesión: se guarda la intención y se manda a login. El usuario vuelve
    // al escáner desde el menú y el registro continúa solo, sin volver a apuntar
    // la cámara al cartel.
    if (!userId) {
      setPendingCheckin(payload);
      router.replace('/login');
      return;
    }

    attempt(payload);
  }, [phase, userId, attempt, router, setPendingCheckin]);

  const handleAccept = useCallback(() => {
    setOutcome(null);
    setPhase(PHASE.SCANNING);
  }, []);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black" nativeID="checkin-permission-loading" testID="checkin-permission-loading">
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  if (!permission.granted) {
    return <CameraPermissionNotice onRequest={requestPermission} />;
  }

  const showCamera = phase === PHASE.SCANNING || phase === PHASE.SUBMITTING;

  return (
    <View className="flex-1 bg-black" nativeID="checkin-scanner-root" testID="checkin-scanner-root">
      {showCamera ? (
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          nativeID="checkin-scanner-camera"
          onBarcodeScanned={phase === PHASE.SCANNING ? handleScan : undefined}
          style={{ flex: 1 }}
          testID="checkin-scanner-camera"
        />
      ) : null}

      {phase === PHASE.SCANNING ? (
        <>
          <View className="absolute left-0 right-0 top-0 h-64 border-b-4 border-primary" nativeID="checkin-scanner-guide" testID="checkin-scanner-guide" pointerEvents="none" />
          <View className="absolute inset-x-0 bottom-0 px-6 pb-10" nativeID="checkin-scanner-hint-wrapper" testID="checkin-scanner-hint-wrapper" pointerEvents="none">
            <Text className="text-center text-sm text-white" nativeID="checkin-scanner-hint" testID="checkin-scanner-hint">
              Apuntá la cámara al QR de la sesión
            </Text>
          </View>
        </>
      ) : null}

      <CheckinWaitingOverlay visible={phase === PHASE.SUBMITTING} />

      <CheckinResult onAccept={handleAccept} outcome={outcome} visible={phase === PHASE.RESULT} />
    </View>
  );
}

// Permiso denegado. Sin cámara no hay nada que hacer, así que en vez de insistir
// se ofrece abrir los ajustes del sistema: el permiso de cámara en Android es de
// una sola vez por app instalada, no se puede volver a pedir desde la app.
function CameraPermissionNotice({ onRequest }) {
  const colors = useThemeColors();

  return (
    <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="checkin-permission-root" testID="checkin-permission-root">
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="camera-off" size={40} />
      <Text className="mt-4 text-center text-base font-bold text-slate-900 dark:text-white" nativeID="checkin-permission-title" testID="checkin-permission-title">
        Necesitamos la cámara
      </Text>
      <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="checkin-permission-hint" testID="checkin-permission-hint">
        Para leer el QR de la sesión. El permiso se pide una sola vez por app instalada: si lo denegaste, hay que habilitarlo desde los ajustes del sistema.
      </Text>

      <Pressable
        accessibilityLabel="Abrir los ajustes del sistema"
        className="mt-6 h-12 items-center justify-center rounded-full bg-primary px-6 active:opacity-80"
        nativeID="checkin-permission-settings-button"
        onPress={() => Linking.openSettings()}
        testID="checkin-permission-settings-button"
      >
        <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="checkin-permission-settings-label" testID="checkin-permission-settings-label">
          Abrir ajustes
        </Text>
      </Pressable>

      <Pressable
        accessibilityLabel="Volver a pedir el permiso"
        className="mt-3 h-11 items-center justify-center rounded-full border border-slate-200 px-6 active:opacity-70 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        nativeID="checkin-permission-retry-button"
        onPress={onRequest}
        testID="checkin-permission-retry-button"
      >
        <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="checkin-permission-retry-label" testID="checkin-permission-retry-label">
          Volver a pedir
        </Text>
      </Pressable>
    </View>
  );
}
