import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { DeactivateAccountModal } from './deactivate-account-modal.jsx';
import { RoleSwitchToggle } from './role-switch-toggle.jsx';
import { SectionCard } from '../forms/section-card.jsx';

const DASH = '—';

// Muestra el valor o un guion si está vacío/ausente (respuestas sparse del backend).
function display(value) {
  return value && String(value).trim() ? String(value) : DASH;
}

const STATUS_META = {
  active: { label: 'Activo', badge: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary' },
  inactive: { label: 'Inactivo', badge: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
  pause: { label: 'En pausa', badge: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  blocked: { label: 'Bloqueado', badge: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  suspended: { label: 'Suspendido', badge: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

// En web reparte los campos en 2 columnas; en mobile, uno por fila.
function FieldGrid({ children }) {
  return <View className={isWeb ? 'flex-row flex-wrap' : ''} nativeID="profile-screen-field-grid" testID="profile-screen-field-grid">{children}</View>;
}

function Field({ label, value }) {
  const slug = `profile-screen-field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <View className={isWeb ? 'w-1/2 pr-4' : 'w-full'} nativeID={slug} testID={slug}>
      <View className="mb-4" nativeID={`${slug}-inner`} testID={`${slug}-inner`}>
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${slug}-label`} testID={`${slug}-label`}>{label}</Text>
        <Text className="text-sm text-slate-900 dark:text-white" nativeID={`${slug}-value`} testID={`${slug}-value`}>{value}</Text>
      </View>
    </View>
  );
}

function Card({ title, icon, children }) {
  return (
    <SectionCard icon={icon} title={title}>
      <FieldGrid>{children}</FieldGrid>
    </SectionCard>
  );
}

function EditButton({ onEdit, colors, full }) {
  return (
    <Pressable
      className={`h-11 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 transition-opacity hover:opacity-90 active:opacity-80 ${full ? 'w-full' : ''}`}
      nativeID="profile-screen-edit-button"
      onPress={onEdit}
      testID="profile-screen-edit-button"
    >
      <MaterialCommunityIcons color={colors.onPrimary} name="pencil" size={16} />
      <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="profile-screen-edit-button-text" testID="profile-screen-edit-button-text">Editar datos</Text>
    </Pressable>
  );
}

function HeaderPanel({ user, status, fullName, onEdit, colors, onUpgradeTier }) {
  // Web: fila superior (avatar + datos + botón editar), fila de switch debajo.
  if (isWeb) {
    return (
      <View className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-surface" nativeID="profile-screen-header-panel" testID="profile-screen-header-panel">
        <View className="flex-row items-center gap-4" nativeID="profile-screen-header-panel-top-row" testID="profile-screen-header-panel-top-row">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID="profile-screen-avatar" testID="profile-screen-avatar">
            <MaterialCommunityIcons color={colors.primary} name="account" size={36} />
          </View>
          <View className="flex-1" nativeID="profile-screen-header-panel-identity" testID="profile-screen-header-panel-identity">
            <Text className="text-lg font-bold text-slate-900 dark:text-white" nativeID="profile-screen-full-name" testID="profile-screen-full-name">{display(fullName)}</Text>
            <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="profile-screen-email" testID="profile-screen-email">{display(user.email)}</Text>
            <View className={`mt-1.5 self-start rounded-full px-3 py-1 ${status.badge}`} nativeID="profile-screen-status-badge" testID="profile-screen-status-badge">
              <Text className={`text-xs font-semibold ${status.text}`} nativeID="profile-screen-status-badge-text" testID="profile-screen-status-badge-text">{status.label}</Text>
            </View>
          </View>
          <EditButton onEdit={onEdit} colors={colors} />
        </View>
        <View className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800" nativeID="profile-screen-role-switch-row" testID="profile-screen-role-switch-row">
          <RoleSwitchToggle onUpgradeTier={onUpgradeTier} wide />
        </View>
      </View>
    );
  }

  // Mobile: panel centrado, botón editar full-width, switch en fila debajo.
  return (
    <View className="mb-5 items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-surface" nativeID="profile-screen-header-panel" testID="profile-screen-header-panel">
      <View className="mb-3 h-20 w-20 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID="profile-screen-avatar" testID="profile-screen-avatar">
        <MaterialCommunityIcons color={colors.primary} name="account" size={44} />
      </View>
      <Text className="text-center text-lg font-bold text-slate-900 dark:text-white" nativeID="profile-screen-full-name" testID="profile-screen-full-name">{display(fullName)}</Text>
      <Text className="mb-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="profile-screen-email" testID="profile-screen-email">{display(user.email)}</Text>
      <View className={`mb-5 rounded-full px-3 py-1 ${status.badge}`} nativeID="profile-screen-status-badge" testID="profile-screen-status-badge">
        <Text className={`text-xs font-semibold ${status.text}`} nativeID="profile-screen-status-badge-text" testID="profile-screen-status-badge-text">{status.label}</Text>
      </View>
      <EditButton onEdit={onEdit} colors={colors} full />
      <View className="mt-4 w-full items-center border-t border-slate-100 pt-4 dark:border-slate-800" nativeID="profile-screen-role-switch-row" testID="profile-screen-role-switch-row">
        <RoleSwitchToggle onUpgradeTier={onUpgradeTier} wide />
      </View>
    </View>
  );
}

function TrainerDataSection({ bankAlias }) {
  return (
    <SectionCard icon="whistle" title="Datos de entrenador" variant="amber">
      <FieldGrid>
        <Field label="Alias de pagos" value={display(bankAlias)} />
      </FieldGrid>
    </SectionCard>
  );
}

function DangerZone({ onDelete }) {
  return (
    <View className="mt-2 rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20" nativeID="profile-screen-danger-zone" testID="profile-screen-danger-zone">
      <View className="mb-2 flex-row items-center gap-2" nativeID="profile-screen-danger-zone-header" testID="profile-screen-danger-zone-header">
        <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={18} />
        <Text className="text-base font-bold text-red-700 dark:text-red-400" nativeID="profile-screen-danger-zone-title" testID="profile-screen-danger-zone-title">Zona de peligro</Text>
      </View>
      <Text className="mb-4 text-sm leading-5 text-red-700/80 dark:text-red-400/80" nativeID="profile-screen-danger-zone-description" testID="profile-screen-danger-zone-description">
        Dar de baja tu cuenta desactiva tu acceso a Paceron. Podrás solicitar reactivación más adelante.
      </Text>
      <Pressable
        className="h-11 flex-row items-center justify-center gap-2 self-start rounded-full border border-red-400 px-6 transition-colors hover:bg-red-50 active:opacity-80 dark:border-red-800 dark:hover:bg-red-900/20"
        nativeID="profile-screen-delete-account-button"
        onPress={onDelete}
        testID="profile-screen-delete-account-button"
      >
        <MaterialCommunityIcons color="#ef4444" name="account-off-outline" size={16} />
        <Text className="text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-400" nativeID="profile-screen-delete-account-button-text" testID="profile-screen-delete-account-button-text">Borrar cuenta</Text>
      </Pressable>
    </View>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const deactivateAccount = useAuthStore((s) => s.deactivateAccount);
  const roles = useAuthStore((s) => s.roles);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!user) router.replace('/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const handleEdit = () => router.push('/profile/edit');

  const handleConfirmDeactivate = async () => {
    const result = await deactivateAccount();
    if (result.success) {
      setConfirmOpen(false);
      Toast.show({ type: 'success', text1: 'Cuenta dada de baja', text2: 'Tu cuenta fue desactivada correctamente.' });
      router.replace('/');
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudo dar de baja la cuenta.' });
    }
  };

  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="profile-screen" testID="profile-screen">
      <View className={`w-full ${isWeb ? 'max-w-3xl mx-auto' : ''}`} nativeID="profile-screen-content" testID="profile-screen-content">
        <Text
          style={{ fontFamily: 'Orbitron_700Bold' }}
          className="mb-6 text-2xl text-slate-900 dark:text-white"
          nativeID="profile-screen-title"
          testID="profile-screen-title"
        >
          Mi perfil
        </Text>

        <HeaderPanel
          user={user}
          status={status}
          fullName={fullName}
          onEdit={handleEdit}
          colors={colors}
          onUpgradeTier={() => router.push('/profile/tier-upgrade')}
        />

        {hasTrainerRole && <TrainerDataSection bankAlias={user.bankAlias} />}

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

        <DangerZone onDelete={() => setConfirmOpen(true)} />

        <DeactivateAccountModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirmDeactivate}
          userEmail={user.email}
          visible={confirmOpen}
        />
      </View>
    </ScrollView>
  );
}
