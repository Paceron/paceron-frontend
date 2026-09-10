import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, useUserMutations } from '../../hooks/use-user.js';
import { toUpdatePayload } from '../../services/normalizers.js';
import { SectionCard } from '../forms/section-card.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

const THEME_OPTIONS = [
  { id: 'light', name: 'Claro' },
  { id: 'dark', name: 'Oscuro' },
];

// Construye el payload completo de PUT /users/{id} a partir del user actual
// del store + el campo puntual que cambió — el backend no soporta PATCH
// parcial acá, toUpdatePayload siempre espera el form completo (mismo
// criterio que edit-profile-screen.jsx).
function buildFullPayload(user, overrides) {
  return toUpdatePayload({
    firstName: user.name,
    lastName: user.surname,
    dni: user.dni,
    birthDate: user.birthDate,
    email: user.email,
    phone: user.phone,
    phoneContact: user.phoneContact,
    country: user.country,
    province: user.province,
    city: user.city,
    street: user.street,
    number: user.number,
    bankAlias: user.bankAlias,
    defaultTheme: user.defaultTheme,
    allowTeamInvitations: user.allowTeamInvitations,
    ...overrides,
  });
}

function SettingsScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const { updateUser } = useUserMutations();
  const { setThemeMode } = useThemeMode();

  const [savingTheme, setSavingTheme] = useState(false);
  const [savingInvitations, setSavingInvitations] = useState(false);

  // user (perfil) puede tardar en cargar — mismo guard que
  // edit-profile-screen.jsx, evita leer user.defaultTheme/etc contra null.
  if (!user) return null;

  const handleThemeChange = async (mode) => {
    setSavingTheme(true);
    const result = await updateUser({ id: user.userId, payload: buildFullPayload(user, { defaultTheme: mode }) });
    setSavingTheme(false);
    if (result.success) {
      setThemeMode(mode);
    } else {
      Toast.show({ type: 'error', text1: 'No pudimos guardar el tema', text2: result.error });
    }
  };

  const handleInvitationsToggle = async () => {
    const next = !user.allowTeamInvitations;
    setSavingInvitations(true);
    const result = await updateUser({ id: user.userId, payload: buildFullPayload(user, { allowTeamInvitations: next }) });
    setSavingInvitations(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos guardar el cambio', text2: result.error });
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="settings-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="settings-screen-scroll"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="settings-screen-container" testID="settings-screen-container">
        <View className="mb-8 flex-row items-center gap-2" nativeID="settings-screen-header" testID="settings-screen-header">
          <Pressable
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            nativeID="settings-screen-back-button"
            onPress={() => router.back()}
            testID="settings-screen-back-button"
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
          </Pressable>
          <Text className="text-xl text-slate-900 dark:text-white" nativeID="settings-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="settings-screen-title">
            Ajustes
          </Text>
        </View>

        <SectionCard icon="palette-outline" title="Apariencia">
          <View className="flex-row items-center gap-3" nativeID="settings-screen-theme-row" testID="settings-screen-theme-row">
            <View className="flex-1" nativeID="settings-screen-theme-picker-wrap" testID="settings-screen-theme-picker-wrap">
              <ResponsiveSelectField
                dense
                hideErrorRow
                label="Tema predeterminado"
                onChange={handleThemeChange}
                options={THEME_OPTIONS}
                value={user.defaultTheme ?? 'dark'}
              />
            </View>
            {savingTheme && <ActivityIndicator color={colors.primary} size="small" />}
          </View>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="settings-screen-theme-hint" testID="settings-screen-theme-hint">
            Se aplica en este dispositivo ahora y queda guardado para cuando ingreses desde uno nuevo. No afecta el tema ya elegido en tus otros dispositivos.
          </Text>
        </SectionCard>

        <SectionCard icon="bell-outline" title="Notificaciones">
          <Pressable
            accessibilityLabel="Permitir invitaciones a equipos"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: user.allowTeamInvitations }}
            className="flex-row items-start gap-3 py-1"
            disabled={savingInvitations}
            nativeID="settings-screen-invitations-checkbox"
            onPress={handleInvitationsToggle}
            testID="settings-screen-invitations-checkbox"
          >
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${user.allowTeamInvitations ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}
              nativeID="settings-screen-invitations-checkbox-box"
              testID="settings-screen-invitations-checkbox-box"
            >
              {savingInvitations ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                user.allowTeamInvitations && <MaterialCommunityIcons color={colors.onPrimary} name="check-bold" size={14} />
              )}
            </View>
            <View className="flex-1" nativeID="settings-screen-invitations-checkbox-text" testID="settings-screen-invitations-checkbox-text">
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="settings-screen-invitations-checkbox-label" testID="settings-screen-invitations-checkbox-label">
                Permitir invitaciones a equipos
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="settings-screen-invitations-checkbox-hint" testID="settings-screen-invitations-checkbox-hint">
                Si lo desactivás, los entrenadores no van a poder invitarte a un equipo.
              </Text>
            </View>
          </Pressable>
        </SectionCard>
      </View>
    </ScrollView>
  );
}

export function SettingsScreen() {
  return (
    <RequireAuth>
      <SettingsScreenContent />
    </RequireAuth>
  );
}
