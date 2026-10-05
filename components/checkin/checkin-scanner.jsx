import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useCheckinStore } from '../../store/checkin-store.js';
import { useSaveCheckin } from '../../hooks/use-checkin.js';
import { parseCheckinQrPayload } from '../../utils/checkin-qr-url.js';
import { destinationForOutcome, toOutcome } from '../../utils/checkin-outcome.js';
import { MIN_WAITING_MS, waitMinimum } from '../../utils/checkin-waiting.js';
import { notifyError, notifySuccess } from '../../utils/haptics.js';
import { CheckinWaitingOverlay } from './checkin-waiting-overlay.jsx';
import { CheckinResult } from './checkin-result.jsx';

// Máquina de fases (D8): `scanning` → `submitting` → `result`. El overlay
// aparece en `submitting` y el resultado en `result`. No hay polling ni estado
// intermedio de la request: es un POST que resuelve o falla, y meter más estados
// sería código para un caso que no existe.
const PHASE = { SCANNING: 'scanning', SUBMITTING: 'submitting', RESULT: 'result' };

export function CheckinScanner() {
  const router = useRouter();
  // Presente solo cuando el escáner se abrió desde una sesión presencial en
  // curso (ver session-pre-start-screen.jsx/training-session-live-screen.jsx)
  // -- ver destinationForOutcome en checkin-outcome.js para el porqué.
  const { returnTo } = useLocalSearchParams();
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
    const startedAt = Date.now();
    setPhase(PHASE.SUBMITTING);
    // Se guarda ANTES de disparar la request. Si el token expira con la request
    // en vuelo, `services/api.js` cierra la sesión, `RequireAuth` manda a
    // `/login` y este pendiente es lo único que permite retomar el registro sin
    // que el corredor vuelva a apuntar la cámara al cartel.
    setPendingCheckin(payload);
    try {
      const response = await saveCheckin(payload);
      // El pendiente se borra apenas la request responde, NO después de la
      // espera: si el usuario cierra la app en el medio del piso de 2 s, ya no
      // tiene que volver a escanear nada.
      clearPendingCheckin();
      await waitMinimum(MIN_WAITING_MS, startedAt);
      notifySuccess();
      setOutcome(toOutcome(response, null));
    } catch (error) {
      // La espera también aplica al camino de error. Un fallo rápido contra un
      // backend local mostraba el GIF un flash y encima una X: el mismo efecto
      // de "se rompió" que se quiere evitar.
      await waitMinimum(MIN_WAITING_MS, startedAt);
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

  // ACEPTAR no vuelve al escáner: cierra la cámara y se va. Volver al escáner
  // dejaría al corredor con la pantalla de la cámara abierta sin nada que
  // escanear, que es el peor final posible después de ya haberse registrado.
  const handleAccept = useCallback(() => {
    router.replace(destinationForOutcome(outcome, returnTo));
  }, [outcome, returnTo, router]);

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
          <ScanFrame />

          {/* El logo va sobre una placa translúcida, no directo sobre la cámara.
              `paceron-symbol-transparent.png` es transparente (que es lo pedido:
              nada de fondo horneado como en el GIF de espera), pero su color es
              un gris medio y la preview de la cámara es un feed oscuro e
              impredecible — directo encima no se lee. La placa garantiza
              contraste sin volver a meter un fondo al logo. */}
          <View
            className="absolute left-0 right-0 top-0 items-center pt-14"
            nativeID="checkin-scanner-brand"
            style={{ pointerEvents: 'none' }}
            testID="checkin-scanner-brand"
          >
            <View
              className="rounded-2xl bg-black/50 px-4 py-2"
              nativeID="checkin-scanner-brand-plate"
              testID="checkin-scanner-brand-plate"
            >
              <Image
                contentFit="contain"
                nativeID="checkin-scanner-logo"
                source={require('../../assets/paceron-symbol-transparent.png')}
                style={{ height: 44, width: 48 }}
                testID="checkin-scanner-logo"
              />
            </View>
          </View>

          <View className="absolute inset-x-0 bottom-0 px-6 pb-10" nativeID="checkin-scanner-hint-wrapper" testID="checkin-scanner-hint-wrapper" style={{ pointerEvents: 'none' }}>
            <Text className="text-center text-sm text-white" nativeID="checkin-scanner-hint" testID="checkin-scanner-hint">
              Apuntá la cámara al QR de la sesión
            </Text>
          </View>
        </>
      ) : null}

      {/* El overlay de espera va por encima de todo (zIndex) y el de resultado
          también, así que el cerrar solo aparece mientras se escanea. */}
      {phase === PHASE.SCANNING ? (
        <Pressable
          accessibilityLabel="Cerrar el escáner y volver"
          accessibilityRole="button"
          className="absolute right-5 top-14 h-11 w-11 items-center justify-center rounded-full bg-black/50 active:opacity-70"
          hitSlop={8}
          nativeID="checkin-scanner-close-button"
          onPress={() => router.back()}
          testID="checkin-scanner-close-button"
        >
          <MaterialCommunityIcons color="#ffffff" name="close" size={26} />
        </Pressable>
      ) : null}

      <CheckinWaitingOverlay visible={phase === PHASE.SUBMITTING} />

      <CheckinResult onAccept={handleAccept} outcome={outcome} visible={phase === PHASE.RESULT} />
    </View>
  );
}

// Recuadro de encuadre: oscurece todo lo que está FUERA del cuadrado y deja
// cuatro esquinas en el color de acento.
//
// El "agujero" del medio se arma con CUATRO views (arriba/abajo/izq/der) en vez
// de un overlay con el centro transparente: react-native no tiene mascara ni
// `clip-path`, y un único `View` con `backgroundColor` taparía justo la parte
// que hay que ver. Las cuatro se miden contra el viewport real, así que el
// cuadrado se ve igual en un teléfono angosto que en una tablet.
function ScanFrame() {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height) * 0.68;
  const top = (height - size) / 2;
  const side = (width - size) / 2;
  const arm = Math.max(28, size * 0.16); // largo de cada esquina

  const dim = 'absolute bg-black/60';
  const bracket = 'absolute border-primary';

  return (
    <View className="absolute inset-0" nativeID="checkin-scanner-guide" style={{ pointerEvents: 'none' }} testID="checkin-scanner-guide">
      {/* La franja de arriba es más alta a propósito: deja lugar para el logo y
          para el botón de cerrar sin que caigan sobre el recuadro. */}
      <View className={`${dim} left-0 right-0 top-0`} style={{ height: top }} nativeID="checkin-scanner-dim-top" testID="checkin-scanner-dim-top" />
      <View className={`${dim} inset-x-0 bottom-0`} style={{ height: top }} nativeID="checkin-scanner-dim-bottom" testID="checkin-scanner-dim-bottom" />
      <View className={`${dim} left-0`} style={{ top, height: size, width: side }} nativeID="checkin-scanner-dim-left" testID="checkin-scanner-dim-left" />
      <View className={`${dim} right-0`} style={{ top, height: size, width: side }} nativeID="checkin-scanner-dim-right" testID="checkin-scanner-dim-right" />

      <View className={`${bracket} rounded-tl-lg border-l-4 border-t-4`} style={{ left: side, top, width: arm, height: arm }} nativeID="checkin-scanner-corner-tl" testID="checkin-scanner-corner-tl" />
      <View className={`${bracket} rounded-tr-lg border-r-4 border-t-4`} style={{ left: side + size - arm, top, width: arm, height: arm }} nativeID="checkin-scanner-corner-tr" testID="checkin-scanner-corner-tr" />
      <View className={`${bracket} rounded-bl-lg border-b-4 border-l-4`} style={{ left: side, top: top + size - arm, width: arm, height: arm }} nativeID="checkin-scanner-corner-bl" testID="checkin-scanner-corner-bl" />
      <View className={`${bracket} rounded-br-lg border-b-4 border-r-4`} style={{ left: side + size - arm, top: top + size - arm, width: arm, height: arm }} nativeID="checkin-scanner-corner-br" testID="checkin-scanner-corner-br" />
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
