import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { usePermissions } from '../../hooks/use-user.js';
import { CheckinScanner } from './checkin-scanner.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

// Gate de la pantalla de check-in del corredor: se entra con perfil corredor y
// en mobile (requisito 1). La cámara, el overlay de espera y el resultado viven
// en `checkin-scanner.jsx`.
//
// La pantalla se arma en dos componentes por la misma razón que
// attendance-screen.jsx: con el rol o la plataforma equivocados NO tiene que
// disparar nada. Un `if` dentro del mismo componente dejaría correr los hooks
// de la sesión que viene; un componente que no se monta no pide nada.
export function CheckinScreen() {
  return (
    // `redirectHref` a `/login` y no al `/` que trae el guard por default: el
    // escenario real es que la sesión se caiga con el escaneo ya leído (token
    // expirado en pleno POST). El pendiente ya quedó guardado antes de la
    // request, así que al volver al escáner el registro continúa solo.
    <RequireAuth redirectHref="/login">
      <CheckinGate />
    </RequireAuth>
  );
}

function CheckinGate() {
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles } = usePermissions(userId);

  // Mismo criterio que attendance-screen.jsx: `activeRole` dice qué se está
  // mirando ahora, `hasTrainerRole` que el rol exista de verdad. Acá la
  // condición es la inversa — la entrada es del CORREDOR —, pero la forma de
  // comprobarlo es la misma: los dos juntos, no uno solo.
  const hasRunnerRole = roles.some((role) => role.name === 'corredor');
  const canCheckIn = hasRunnerRole && activeRole === 'runner';

  if (isWeb) return <PlatformNotice />;
  if (!canCheckIn) return <TrainerProfileNotice hasRunnerRole={hasRunnerRole} />;

  return <CheckinScanner />;
}

// Requisito 6 del spec: en web la función es de la app nativa, y no se pide
// cámara ni se dispara ninguna request.
function PlatformNotice() {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <View className="flex-1 bg-paper px-4 py-8 dark:bg-ink" nativeID="checkin-web-root" testID="checkin-web-root">
      <View className={`w-full self-center ${isWeb ? 'max-w-2xl' : ''}`} nativeID="checkin-web-container" testID="checkin-web-container">
        <View className="rounded-2xl border border-slate-200 bg-white px-6 py-10 dark:border-slate-700 dark:bg-surface" nativeID="checkin-web-card" testID="checkin-web-card">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="cellphone" size={28} />
          <Text className="mt-3 text-base font-bold text-slate-900 dark:text-white" nativeID="checkin-web-title" testID="checkin-web-title">
            Registrar asistencia es una función de la app
          </Text>
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400" nativeID="checkin-web-hint" testID="checkin-web-hint">
            El escaneo del QR de la sesión se hace con la cámara, y eso solo funciona en la app de Paceron. Abrí la app en el teléfono y escaneá el QR desde el menú.
          </Text>
          <Pressable
            accessibilityLabel="Volver al inicio"
            className="mt-5 h-11 items-center justify-center rounded-full border border-slate-200 px-6 active:opacity-70 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            nativeID="checkin-web-back-button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            testID="checkin-web-back-button"
          >
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="checkin-web-back-label" testID="checkin-web-back-label">Volver</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Requisito 1: un entrenador (o un corredor mirando la app como entrenador) que
// llega por URL directa no ve la cámara ni puede registrar.
function TrainerProfileNotice({ hasRunnerRole }) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View className="flex-1 bg-paper px-4 py-8 dark:bg-ink" nativeID="checkin-role-root" testID="checkin-role-root">
      <View className="w-full self-center max-w-2xl" nativeID="checkin-role-container" testID="checkin-role-container">
        <View className="rounded-2xl border border-slate-200 bg-white px-6 py-10 dark:border-slate-700 dark:bg-surface" nativeID="checkin-role-card" testID="checkin-role-card">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="whistle-outline" size={28} />
          <Text className="mt-3 text-base font-bold text-slate-900 dark:text-white" nativeID="checkin-role-title" testID="checkin-role-title">
            El registro por QR es del corredor
          </Text>
          {/* Los dos motivos reales necesitan acciones distintas: o el usuario
              tiene el rol y está mirando la app como entrenador (cambiar de
              perfil), o no lo tiene (pedirlo). Decir siempre "cambiá al
              perfil" sería un consejo imposible de seguir. */}
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400" nativeID="checkin-role-hint" testID="checkin-role-hint">
            {hasRunnerRole
              ? 'Estás mirando la app con el perfil de entrenador. Cambiá al perfil de corredor para registrar asistencia escaneando el QR.'
              : 'Necesitás un perfil de corredor para registrar asistencia escaneando el QR de la sesión.'}
          </Text>
          <Pressable
            accessibilityLabel="Volver al inicio"
            className="mt-5 h-11 items-center justify-center rounded-full border border-slate-200 px-6 active:opacity-70 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            nativeID="checkin-role-back-button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            testID="checkin-role-back-button"
          >
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="checkin-role-back-label" testID="checkin-role-back-label">Volver</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
