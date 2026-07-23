import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useThemeColors } from '../../theme/colors.js';

// Home placeholder para usuarios autenticados. Sin roles todavía del lado del
// backend, así que no hay accesos/dashboards que mostrar; se completa cuando
// el sistema de roles esté disponible (equipos, planificación, etc por rol).
export function AuthenticatedHomeScreen() {
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name || '';

  return (
    <View
      className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink"
      nativeID="authenticated-home-screen-root"
      testID="authenticated-home-screen-root"
    >
      <View
        className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15"
        nativeID="authenticated-home-screen-icon-badge"
        testID="authenticated-home-screen-icon-badge"
      >
        <MaterialCommunityIcons color={colors.primary} name="run-fast" size={32} />
      </View>
      <Text
        className="mb-2 text-center text-xl font-bold text-slate-900 dark:text-white"
        nativeID="authenticated-home-screen-greeting"
        testID="authenticated-home-screen-greeting"
      >
        {firstName ? `Hola, ${firstName}` : 'Bienvenido a Paceron'}
      </Text>
      <Text
        className="max-w-sm text-center text-sm leading-5 text-slate-500 dark:text-slate-400"
        nativeID="authenticated-home-screen-subtitle"
        testID="authenticated-home-screen-subtitle"
      >
        Tu panel está en construcción. Pronto vas a encontrar acá tus accesos y estadísticas.
      </Text>
    </View>
  );
}
