import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';

const DASH = '—';

// Muestra el valor o un guion si está vacío/ausente (respuestas sparse del backend).
function display(value) {
  return value && String(value).trim() ? String(value) : DASH;
}

const STATUS_META = {
  active: { label: 'Activo', badge: 'bg-primary/15', text: 'text-primary' },
  inactive: { label: 'Inactivo', badge: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
  pause: { label: 'En pausa', badge: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  blocked: { label: 'Bloqueado', badge: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  suspended: { label: 'Suspendido', badge: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

function Field({ label, value }) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</Text>
      <Text className="text-sm text-slate-900 dark:text-white">{value}</Text>
    </View>
  );
}

function Card({ title, icon, children }) {
  const colors = useThemeColors();
  return (
    <View className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-surface">
      <View className="mb-4 flex-row items-center gap-2">
        <MaterialCommunityIcons color={colors.primary} name={icon} size={18} />
        <Text className="text-base font-bold text-slate-900 dark:text-white">{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  // Guard: si ya hidrató y no hay sesión, mandar a login.
  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
  }, [hydrated, user]);

  // Refresh best-effort cuando el usuario está disponible (tras hydrate/login).
  // Dep en userId (primitivo): refrescar mantiene el mismo id → no re-dispara loop.
  useEffect(() => {
    if (user?.userId) refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  if (!user) return null;

  const status = STATUS_META[user.status] ?? {
    label: display(user.status),
    badge: 'bg-slate-200 dark:bg-slate-700',
    text: 'text-slate-600 dark:text-slate-300',
  };
  const fullName = `${user.name ?? ''} ${user.surname ?? ''}`.trim();

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-ink" contentContainerClassName="px-4 py-8">
      <View className={`w-full self-center ${isWeb ? 'max-w-2xl' : ''}`}>
        <Text
          style={{ fontFamily: 'Orbitron_700Bold' }}
          className="mb-6 text-center text-2xl text-slate-900 dark:text-white"
        >
          Mi perfil
        </Text>

        <View className="mb-6 items-center">
          <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-primary/15">
            <MaterialCommunityIcons color={colors.primary} name="account" size={44} />
          </View>
          <Text className="text-xl font-bold text-slate-900 dark:text-white">{display(fullName)}</Text>
          <Text className="text-sm text-slate-500 dark:text-slate-400">{display(user.email)}</Text>
          <View className={`mt-2 rounded-full px-3 py-1 ${status.badge}`}>
            <Text className={`text-xs font-semibold ${status.text}`}>{status.label}</Text>
          </View>
        </View>

        <Card title="Datos personales" icon="account-details">
          <Field label="Nombre" value={display(user.name)} />
          <Field label="Apellido" value={display(user.surname)} />
          <Field label="Email" value={display(user.email)} />
          <Field label="DNI" value={display(user.dni)} />
          <Field label="Fecha de nacimiento" value={display(user.birthDate)} />
        </Card>

        <Card title="Dirección" icon="map-marker">
          <Field label="País" value={display(user.country && getCountryName(user.country))} />
          <Field label="Provincia" value={display(user.province && getProvinceName(user.country, user.province))} />
          <Field label="Localidad" value={display(user.city)} />
          <Field label="Calle" value={display(user.street)} />
          <Field label="Altura" value={display(user.number)} />
        </Card>

        <Card title="Contacto" icon="phone">
          <Field label="Teléfono" value={display(user.phone)} />
          <Field label="Teléfono de contacto" value={display(user.phoneContact)} />
        </Card>

        <Pressable
          className="mt-1 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80"
          onPress={() => router.push('/profile/edit')}
        >
          <MaterialCommunityIcons color={colors.onPrimary} name="pencil" size={18} />
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]">Editar datos</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
