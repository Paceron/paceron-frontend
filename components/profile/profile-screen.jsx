import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions, useUserMutations } from '../../hooks/use-user.js';
import { useTierSubscription } from '../../hooks/use-tier-subscription.js';
import { useArrowBounce } from '../../hooks/use-arrow-bounce.js';
import { formatArs } from '../../utils/currency.js';
import { formatTierName } from '../../utils/tier-name.js';
import { createPreference } from '../../services/payments.js';
import { toCreatePreferencePayload, toPreferenceResponseModel } from '../../services/normalizers.js';
import { CheckoutFlow } from '../payments/checkout-flow';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { useMpConnectStatus } from '../../hooks/use-mp-connect.js';
import { PAYMENT_HISTORY_KEYS } from '../../hooks/use-payment-history.js';
import { mpConnectionState } from '../../utils/mp-connect-status.js';
import { SkeletonBlock, SkeletonCircle } from '../shared/skeleton.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { ScreenCard } from '../shared/screen-card.jsx';
import { DeactivateAccountModal } from './deactivate-account-modal.jsx';
import { DeactivateTrainerModal } from './deactivate-trainer-modal.jsx';
import { RoleSwitchToggle } from './role-switch-toggle.jsx';
import { PaymentsSummaryCard } from './payments-summary-card.jsx';
import { PaymentsHistoryCard } from './payments-history-card.jsx';
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

// En web ancho reparte los campos en 2 columnas; en mobile (nativo o web
// angosto), uno por fila — ver useIsNarrowWeb(), mismo breakpoint que el
// resto del shell responsive (no alcanza con `isWeb`, que es true para
// cualquier ancho de viewport en react-native-web).
function FieldGrid({ children }) {
  const isNarrowWeb = useIsNarrowWeb();
  const isDesktopWeb = isWeb && !isNarrowWeb;
  return <View className={isDesktopWeb ? 'flex-row flex-wrap' : ''} nativeID="profile-screen-field-grid" testID="profile-screen-field-grid">{children}</View>;
}

// Etiqueta + contenido de un campo, con el mismo ancho que el resto de la grilla.
function FieldShell({ label, slug, children, fullWidth = false, labelClassName }) {
  const isNarrowWeb = useIsNarrowWeb();
  const isDesktopWeb = isWeb && !isNarrowWeb;
  return (
    <View className={isDesktopWeb && !fullWidth ? 'w-1/2 pr-4' : 'w-full'} nativeID={slug} testID={slug}>
      <View className="mb-4" nativeID={`${slug}-inner`} testID={`${slug}-inner`}>
        <Text className={labelClassName ?? 'mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500'} nativeID={`${slug}-label`} testID={`${slug}-label`}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

function Field({ label, value }) {
  const slug = `profile-screen-field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <FieldShell label={label} slug={slug}>
      <Text className="text-sm text-slate-900 dark:text-white" nativeID={`${slug}-value`} testID={`${slug}-value`}>{value}</Text>
    </FieldShell>
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

function HeaderPanel({ user, status, fullName, onEdit, colors, photoUploading, onPickPhoto, onRemovePhoto }) {
  // Iniciales de nombre + apellido — fallback de AvatarPicker cuando no
  // hay foto, en vez del ícono genérico. Solo tiene sentido acá (un
  // equipo no tiene "nombre y apellido" — team-detail-screen.jsx no pasa
  // este prop, se queda con el ícono account-group de siempre).
  const initials = getUserInitials(user);
  const isNarrowWeb = useIsNarrowWeb();
  // Web ancho: fila superior (avatar + datos + botón editar), fila de
  // switch debajo. En web angosto el nombre/email/badge no entran junto al
  // botón "Editar datos" en esa fila (colapsan a una columna de pocos px
  // de ancho, forzando word-wrap letra por letra) — mismo criterio de
  // useIsNarrowWeb() que decide el resto del shell responsive, `isWeb`
  // solo no alcanza porque es true para cualquier ancho en RN Web.
  if (isWeb && !isNarrowWeb) {
    return (
      <View className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-surface" nativeID="profile-screen-header-panel" testID="profile-screen-header-panel">
        <View className="flex-row items-center gap-4" nativeID="profile-screen-header-panel-top-row" testID="profile-screen-header-panel-top-row">
          <AvatarPicker
            accessibilityLabel="Foto de perfil"
            fallbackIcon="account"
            idPrefix="profile-screen-avatar"
            initials={initials}
            loading={photoUploading}
            onPick={onPickPhoto}
            onRemove={onRemovePhoto}
            size={64}
            uri={user.photoUrl}
          />
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
          <RoleSwitchToggle wide />
        </View>
      </View>
    );
  }

  // Mobile: panel centrado, botón editar full-width, switch en fila debajo.
  return (
    <View className="mb-5 items-center rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-surface" nativeID="profile-screen-header-panel" testID="profile-screen-header-panel">
      <View className="mb-3" nativeID="profile-screen-avatar-wrapper" testID="profile-screen-avatar-wrapper">
        <AvatarPicker
          accessibilityLabel="Foto de perfil"
          fallbackIcon="account"
          idPrefix="profile-screen-avatar"
          initials={initials}
          loading={photoUploading}
          onPick={onPickPhoto}
          onRemove={onRemovePhoto}
          size={80}
          uri={user.photoUrl}
        />
      </View>
      <Text className="text-center text-lg font-bold text-slate-900 dark:text-white" nativeID="profile-screen-full-name" testID="profile-screen-full-name">{display(fullName)}</Text>
      <Text className="mb-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="profile-screen-email" testID="profile-screen-email">{display(user.email)}</Text>
      <View className={`mb-5 rounded-full px-3 py-1 ${status.badge}`} nativeID="profile-screen-status-badge" testID="profile-screen-status-badge">
        <Text className={`text-xs font-semibold ${status.text}`} nativeID="profile-screen-status-badge-text" testID="profile-screen-status-badge-text">{status.label}</Text>
      </View>
      <EditButton onEdit={onEdit} colors={colors} full />
      <View className="mt-4 w-full items-center border-t border-slate-100 pt-4 dark:border-slate-800" nativeID="profile-screen-role-switch-row" testID="profile-screen-role-switch-row">
        <RoleSwitchToggle wide />
      </View>
    </View>
  );
}

const MP_STATE_TONE = {
  connected: { badge: 'bg-primary-tint dark:bg-primary/15', text: 'text-on-primary-tint dark:text-primary', icon: 'check-circle' },
  expired: { badge: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: 'clock-alert-outline' },
  disconnected: { badge: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', icon: 'link-variant-off' },
};

// Estado de la cuenta de Mercado Pago con la que el entrenador cobra: si está
// conectada y hasta cuándo (el token dura 180 días y no se renueva solo).
function MpConnectionField({ fullWidth = false }) {
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isDesktopWeb = isWeb && !isNarrowWeb;
  const status = useMpConnectStatus();
  const slug = 'profile-screen-field-mercado-pago';
  const mp = mpConnectionState(status);
  const tone = MP_STATE_TONE[mp.state];

  let body;
  if (status.loading) {
    body = <SkeletonBlock height={20} nativeID={`${slug}-skeleton`} rounded="rounded-full" testID={`${slug}-skeleton`} width={120} />;
  } else if (status.failed) {
    body = (
      <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID={`${slug}-error`} testID={`${slug}-error`}>
        No pudimos consultar la conexión.
      </Text>
    );
  } else {
    body = (
      // Fila en web ancha (badge + detalle lado a lado); apilado en mobile
      // y web angosta -- el texto de detalle al lado del badge en un
      // ancho chico quedaba aplastado contra él, en vez de leerse como
      // una aclaración debajo (pedido real 2026-11-10, ver captura).
      <View className={isDesktopWeb ? 'flex-row items-center gap-2' : 'gap-1.5'} nativeID={`${slug}-status`} testID={`${slug}-status`}>
        <View className={`flex-row items-center gap-1 self-start rounded-full px-3 py-1 ${tone.badge}`} nativeID={`${slug}-badge`} testID={`${slug}-badge`}>
          <MaterialCommunityIcons color={mp.state === 'connected' ? colors.primary : colors.onSurfaceVariant} name={tone.icon} size={16} />
          <Text className={`text-sm font-semibold ${tone.text}`} nativeID={`${slug}-badge-label`} testID={`${slug}-badge-label`}>{mp.label}</Text>
        </View>
        {mp.detail ? (
          <Text className="text-sm italic text-slate-600 dark:text-slate-300" nativeID={`${slug}-detail`} testID={`${slug}-detail`}>{mp.detail}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className={isDesktopWeb && !fullWidth ? 'w-1/2 pr-4' : 'w-full'} nativeID={slug} testID={slug}>
      <View nativeID={`${slug}-inner`} testID={`${slug}-inner`}>
        <View className="rounded-xl border border-primary bg-primary/20 p-3 dark:border-primary/30 dark:bg-primary/15" nativeID={`${slug}-status-card`} testID={`${slug}-status-card`}>
          <Text className="text-sm font-semibold text-green-700 dark:text-green-400" nativeID={`${slug}-label`} testID={`${slug}-label`}>Cuenta de Mercado Pago:</Text>
          <View nativeID={`${slug}-status-inline`} testID={`${slug}-status-inline`}>{body}</View>
        </View>
      </View>
    </View>
  );
}

function TrainerDataSection({ onUpgradeTier, trainerTier, subscription, onPay, paying, confirming, loading }) {
  const isNarrowWeb = useIsNarrowWeb();
  const isDesktopWeb = isWeb && !isNarrowWeb;
  const renewal = subscription?.subscriptionStatus === 'active' && subscription?.tier?.paymentRequired && subscription?.installmentId ? subscription : null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Una sola ruedita para todo el panel (permisos + suscripción + Mercado
  // Pago) en vez de placeholders apareciendo escalonados. Mismo spinner que
  // "Rendimiento" (components/dashboard/dashboard-loading-overlay.jsx).
  const mpStatus = useMpConnectStatus();
  const panelLoading = loading || mpStatus.loading;
  const bounceStyle = useArrowBounce();
  const isPremium = String(trainerTier ?? '').toLowerCase().includes('premium');
  return (
    <SectionCard icon="whistle" title="Configuración de Membresía" variant="nested">
      {panelLoading ? (
        <View className="items-center justify-center py-10" nativeID="profile-screen-membership-loading" testID="profile-screen-membership-loading">
          <ActivityIndicator color="#8cc63e" nativeID="profile-screen-membership-loading-spinner" size="large" testID="profile-screen-membership-loading-spinner" />
        </View>
      ) : (
        <>
          <FieldGrid>
            <MpConnectionField fullWidth />
          </FieldGrid>
          <View className="mt-3" nativeID="profile-screen-membership-details" testID="profile-screen-membership-details">
            {/* Apilado en mobile/web angosta: label+badge en una fila y el
                botón debajo, a todo el ancho (`self-stretch`, vía el
                `alignItems: stretch` default de un contenedor en columna)
                -- en una fila sola con el botón "MEJORAR TIER" quedaba
                todo muy junto (pedido real 2026-11-10, ver captura). */}
            <View className={`mb-2 rounded-xl border border-primary bg-primary/20 p-3 dark:border-primary/30 dark:bg-primary/15 ${isDesktopWeb ? 'flex-row items-center gap-4' : 'gap-3'}`} nativeID="profile-screen-current-tier" testID="profile-screen-current-tier">
              <View className="flex-row items-center gap-2" nativeID="profile-screen-current-tier-info" testID="profile-screen-current-tier-info">
                <Text className="text-sm font-semibold text-green-700 dark:text-green-400" nativeID="profile-screen-current-tier-label" testID="profile-screen-current-tier-label">Tier Actual:</Text>
                {/* Badge mayúscula/negrita en vez de texto italic/minúscula
                    (pedido real 2026-11-10) -- mismos tokens que el segmento
                    activo de role-switch-toggle.jsx (bg-primary-tint/
                    text-on-primary-tint), no un color nuevo. `formatTierName`
                    porque `trainerTier` llega crudo del backend
                    (`base_entrenador`, `premium_entrenador`) -- se mostraba
                    sin formatear, único lugar de la app que no lo hacía. */}
                <View className="self-start rounded-full bg-primary-tint px-3 py-1 dark:bg-primary/15" nativeID="profile-screen-current-tier-badge" testID="profile-screen-current-tier-badge">
                  <Text className="text-xs font-bold uppercase tracking-wide text-on-primary-tint dark:text-primary" nativeID="profile-screen-current-tier-value" testID="profile-screen-current-tier-value">
                    {formatTierName(trainerTier, '—')}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                className={`h-9 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 transition-opacity hover:opacity-90 active:opacity-80 ${isDesktopWeb ? 'ml-auto self-start' : 'self-stretch'}`}
                nativeID="profile-screen-upgrade-tier-button"
                onPress={() => {
                  if (isPremium) setConfirmOpen(true);
                  else onUpgradeTier?.();
                }}
                testID="profile-screen-upgrade-tier-button"
              >
                <Animated.View nativeID="profile-screen-upgrade-tier-button-icon" style={bounceStyle} testID="profile-screen-upgrade-tier-button-icon">
                  <MaterialCommunityIcons color="#111518" name="arrow-up-circle-outline" size={16} />
                </Animated.View>
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="profile-screen-upgrade-tier-button-label" testID="profile-screen-upgrade-tier-button-label">{isPremium ? 'cambiar tier' : 'MEJORAR TIER'}</Text>
              </Pressable>
            </View>
            {renewal && (
              <View className={`mt-3 rounded-xl border border-primary bg-primary/30 p-3 dark:border-primary/30 dark:bg-primary/20 ${isDesktopWeb ? 'flex-row items-center justify-between' : 'gap-2'}`} nativeID="profile-screen-renewal" testID="profile-screen-renewal">
                <Text className="text-sm text-slate-600 dark:text-slate-300" nativeID="profile-screen-renewal-summary" testID="profile-screen-renewal-summary">
                  <Text className="font-bold text-green-700 dark:text-green-400" nativeID="profile-screen-renewal-label" testID="profile-screen-renewal-label">Próxima Cuota (Nro {renewal.installmentNumber}):</Text> <Text className="font-bold italic text-slate-500 dark:text-slate-400" nativeID="profile-screen-renewal-detail" testID="profile-screen-renewal-detail">{formatArs(renewal.installmentAmount)} - vence {new Date(renewal.nextDueDate).toLocaleDateString('es-AR')}</Text>
                </Text>
                {confirming ? (
                  <View className="h-9 flex-row items-center gap-2 rounded-full bg-primary/20 px-3" nativeID="profile-screen-renewal-confirming" testID="profile-screen-renewal-confirming">
                  <ActivityIndicator color="#8cc63e" nativeID="profile-screen-renewal-confirming-spinner" size="small" testID="profile-screen-renewal-confirming-spinner" />
                    <Text className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300" nativeID="profile-screen-renewal-confirming-label" testID="profile-screen-renewal-confirming-label">Confirmando pago…</Text>
                  </View>
                ) : (
                  <Pressable
                    className={`h-9 flex-row items-center justify-center gap-2 rounded-full bg-primary px-4 hover:opacity-90 active:opacity-80 ${paying ? 'opacity-60' : ''} ${isDesktopWeb ? '' : 'self-stretch'}`}
                    disabled={paying}
                    nativeID="profile-screen-pay-renewal-button"
                    onPress={() => onPay?.(renewal)}
                    testID="profile-screen-pay-renewal-button"
                  >
                    {paying ? <ActivityIndicator color="#111518" nativeID="profile-screen-pay-renewal-spinner" size="small" testID="profile-screen-pay-renewal-spinner" /> : (
                      <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="profile-screen-pay-renewal-label" testID="profile-screen-pay-renewal-label">Pagar cuota</Text>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </>
      )}
      <Modal animationType="fade" nativeID="profile-screen-tier-confirm-modal" testID="profile-screen-tier-confirm-modal" transparent visible={confirmOpen}>
        <View className="flex-1 items-center justify-center px-6" nativeID="profile-screen-tier-confirm-container" testID="profile-screen-tier-confirm-container">
          <Pressable className="absolute inset-0 bg-black/40" nativeID="profile-screen-tier-confirm-backdrop" onPress={() => setConfirmOpen(false)} testID="profile-screen-tier-confirm-backdrop" />
          <View className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-900" nativeID="profile-screen-tier-confirm-card" testID="profile-screen-tier-confirm-card">
            <Text className="mb-2 text-base font-bold text-slate-900 dark:text-white" nativeID="profile-screen-tier-confirm-title" testID="profile-screen-tier-confirm-title">Confirmar</Text>
            <Text className="mb-5 text-sm text-slate-600 dark:text-slate-300" nativeID="profile-screen-tier-confirm-description" testID="profile-screen-tier-confirm-description">Cambiar el tier reduce tus funcionalidades, ¿estás seguro de querer continuar?</Text>
            <View className="flex-row justify-end gap-2" nativeID="profile-screen-tier-confirm-actions" testID="profile-screen-tier-confirm-actions">
              <Pressable className="rounded-full px-4 py-2" nativeID="profile-screen-tier-confirm-cancel" onPress={() => setConfirmOpen(false)} testID="profile-screen-tier-confirm-cancel">
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400" nativeID="profile-screen-tier-confirm-cancel-label" testID="profile-screen-tier-confirm-cancel-label">Cancelar</Text>
              </Pressable>
              <Pressable className="rounded-full bg-primary px-4 py-2" nativeID="profile-screen-tier-confirm-continue" onPress={() => { setConfirmOpen(false); onUpgradeTier?.(); }} testID="profile-screen-tier-confirm-continue">
                <Text className="text-sm font-semibold text-on-primary" nativeID="profile-screen-tier-confirm-continue-label" testID="profile-screen-tier-confirm-continue-label">Continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SectionCard>
  );
}

function DangerZone({ onDelete, hasTrainerRole, onDeactivateTrainer }) {
  return (
    <View className="mt-2 rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20" nativeID="profile-screen-danger-zone" testID="profile-screen-danger-zone">
      <View className="mb-2 flex-row items-center gap-2" nativeID="profile-screen-danger-zone-header" testID="profile-screen-danger-zone-header">
        <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={18} />
        <Text className="text-base font-bold text-red-700 dark:text-red-400" nativeID="profile-screen-danger-zone-title" testID="profile-screen-danger-zone-title">Zona de peligro</Text>
      </View>

      {hasTrainerRole && (
        <View className="mb-4 border-b border-red-200 pb-4 dark:border-red-900/50" nativeID="profile-screen-deactivate-trainer-block" testID="profile-screen-deactivate-trainer-block">
          <Text className="mb-3 text-sm leading-5 text-red-700/80 dark:text-red-400/80" nativeID="profile-screen-deactivate-trainer-description" testID="profile-screen-deactivate-trainer-description">
            Dar de baja tu perfil de entrenador te vuelve a dejar solo con el perfil de corredor. Podés reactivarlo cuando quieras.
          </Text>
          <Pressable
            className="h-11 flex-row items-center justify-center gap-2 self-start rounded-full border border-red-400 px-6 transition-colors hover:bg-red-50 active:opacity-80 dark:border-red-800 dark:hover:bg-red-900/20"
            nativeID="profile-screen-deactivate-trainer-button"
            onPress={onDeactivateTrainer}
            testID="profile-screen-deactivate-trainer-button"
          >
            <MaterialCommunityIcons color="#ef4444" name="whistle-outline" size={16} />
            <Text className="text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-400" nativeID="profile-screen-deactivate-trainer-button-text" testID="profile-screen-deactivate-trainer-button-text">Dar de baja perfil de entrenador</Text>
          </Pressable>
        </View>
      )}

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

// Esqueleto de la pantalla completa mientras llega el perfil. Mantiene el
// mismo contenedor y la misma silueta (título, panel de cabecera y dos cards)
// para que el swap a contenido real no mueva el layout.
function ProfileSkeleton() {
  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="profile-screen-skeleton" testID="profile-screen-skeleton">
      <ScreenCard nativeID="profile-screen-skeleton-content" testID="profile-screen-skeleton-content">
        <SkeletonBlock height={28} nativeID="profile-screen-skeleton-title" rounded="rounded-lg" testID="profile-screen-skeleton-title" width={140} />
        <View className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-surface" nativeID="profile-screen-skeleton-header" testID="profile-screen-skeleton-header">
          <View className="flex-row items-center gap-4" nativeID="profile-screen-skeleton-header-row" testID="profile-screen-skeleton-header-row">
            <SkeletonCircle nativeID="profile-screen-skeleton-avatar" size={64} testID="profile-screen-skeleton-avatar" />
            <View className="flex-1 gap-2" nativeID="profile-screen-skeleton-identity" testID="profile-screen-skeleton-identity">
              <SkeletonBlock height={16} nativeID="profile-screen-skeleton-name" rounded="rounded-full" testID="profile-screen-skeleton-name" width={160} />
              <SkeletonBlock height={12} nativeID="profile-screen-skeleton-email" rounded="rounded-full" testID="profile-screen-skeleton-email" width={200} />
              <SkeletonBlock height={20} nativeID="profile-screen-skeleton-status" rounded="rounded-full" testID="profile-screen-skeleton-status" width={80} />
            </View>
          </View>
        </View>
        {[0, 1].map((row) => (
          <View className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-surface" key={row} nativeID={`profile-screen-skeleton-card-${row}`} testID={`profile-screen-skeleton-card-${row}`}>
            <SkeletonBlock height={16} nativeID={`profile-screen-skeleton-card-${row}-title`} rounded="rounded-full" testID={`profile-screen-skeleton-card-${row}-title`} width={130} />
            <SkeletonBlock className="mt-4" height={12} nativeID={`profile-screen-skeleton-card-${row}-line-1`} rounded="rounded-full" testID={`profile-screen-skeleton-card-${row}-line-1`} width="70%" />
            <SkeletonBlock className="mt-3" height={12} nativeID={`profile-screen-skeleton-card-${row}-line-2`} rounded="rounded-full" testID={`profile-screen-skeleton-card-${row}-line-2`} width="50%" />
          </View>
        ))}
      </ScreenCard>
    </ScrollView>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const queryClient = useQueryClient();
  const { user } = useUser(userId);
  const refreshUser = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user', userId] }),
      queryClient.invalidateQueries({ queryKey: PAYMENT_HISTORY_KEYS.summary(userId) }),
      queryClient.invalidateQueries({ queryKey: ['mp-connect-status', userId] }),
    ]);
  const { deactivateAccount, deactivateTrainerRole, uploadPhoto, deletePhoto } = useUserMutations();
  const { roles, loading: rolesLoading } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  const trainerRoleId = roles.find((r) => r.name === 'entrenador')?.id;
  // `includeNext: false`: el perfil solo usa la sub activa, no el pendiente de
  // cambio de tier — evita una request extra en la carga de la pantalla.
  const { subscription, refetchSubscription, isLoading: subscriptionLoading } = useTierSubscription(userId, trainerRoleId, { includeNext: false });
  // Mientras permisos o la suscripción resuelven, el panel de membresía se
  // dibuja igual con esqueletos (no aparece de golpe al final).
  const membershipLoading = rolesLoading || subscriptionLoading;

  // El resumen de cobros depende del rol ACTIVO, no solo de tenerlo: como
  // corredor se ve la tarjeta del historial de pagos, igual que cualquier usuario.
  const showPayments = hasTrainerRole && activeRole === 'trainer';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTrainerOpen, setConfirmTrainerOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  // Checkout de renovación: `checkoutData` es la preferencia ya creada (el
  // brick solo se monta si tiene preferenceId + publicKey), `processingPayment`
  // es la espera del POST /payments/preference y `confirming` la ventana
  // post-aprobación mientras el backend refleja la cuota paga.
  const [checkoutData, setCheckoutData] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const startCheckout = (renewal) => {
    if (!renewal || processingPayment) return;
    setProcessingPayment(true);
    createPreference(toCreatePreferencePayload({
      concept: 'subscription',
      description: 'Cuota de suscripción de tier',
      items: [{ title: 'Cuota mensual de tier', quantity: 1, unitPrice: renewal.installmentAmount }],
      installmentId: renewal.installmentId,
    }))
      .then((dto) => {
        const preference = toPreferenceResponseModel(dto);
        if (!preference?.preferenceId || !preference?.publicKey) {
          throw new Error('La preferencia de pago vino incompleta.');
        }
        setCheckoutData({
          amount: renewal.installmentAmount,
          installmentId: renewal.installmentId,
          paidBefore: renewal.paidInstallments ?? 0,
          preferenceId: preference.preferenceId,
          publicKey: preference.publicKey,
        });
      })
      // Sin `console.error`: en web dispara el LogBox de Expo, que en este
      // proyecto rompe con "Cannot read properties of undefined (reading
      // 'map')" en LogContext. El error se informa con Toast, igual que
      // tier-upgrade-screen.
      .catch((error) => {
        Toast.show({ type: 'error', text1: 'No pudimos iniciar el pago', text2: error?.message });
      })
      .finally(() => setProcessingPayment(false));
  };

  // La cuota de renovación no cambia el tier ni el estado de la suscripción:
  // se confirma recién cuando sube paidInstallments. Mismo criterio que
  // handleRenewalApproved en tier-upgrade-screen.jsx.
  const handleApproved = async () => {
    const paidBefore = checkoutData?.paidBefore ?? 0;
    setCheckoutData(null);
    setConfirming(true);
    try {
      let reflected = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const { data } = await refetchSubscription();
        if ((data?.paidInstallments ?? 0) > paidBefore) {
          reflected = data;
          break;
        }
      }
      if (reflected) {
        Toast.show({ type: 'success', text1: 'Cuota pagada', text2: 'Tu suscripción sigue activa.' });
      } else {
        Toast.show({ type: 'info', text1: 'Tu pago fue recibido', text2: 'Puede tardar unos minutos en reflejarse.' });
      }
    } finally {
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: PAYMENT_HISTORY_KEYS.upcoming(userId) });
      queryClient.invalidateQueries({ queryKey: PAYMENT_HISTORY_KEYS.history(userId) });
      refreshUser();
    }
  };

  const handleCheckoutError = (error) => {
    setCheckoutData(null);
    Toast.show({ type: 'error', text1: 'Error en el checkout', text2: error?.message });
  };

  const handleCheckoutCancel = () => setCheckoutData(null);

  // userId (sesión), no user (perfil, todavía cargando en el momento del
  // mount) — con user habría un redirect espurio a /login mientras
  // useUser resuelve, mismo riesgo que components/guards/require-auth.jsx.
  useEffect(() => {
    if (!userId) router.replace('/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const { refreshing, onRefresh } = usePullToRefresh(refreshUser);

  // La pantalla se dibuja de inmediato con esqueletos en vez de quedar en
  // blanco mientras llega GET /users/{id} (con Render free el cold start
  // puede tardar 20-25 s — ver use-mp-connect.js).
  if (!user) return <ProfileSkeleton />;

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

  const handleConfirmDeactivateTrainer = async () => {
    const result = await deactivateTrainerRole();
    if (result.success) {
      setConfirmTrainerOpen(false);
      Toast.show({ type: 'success', text1: 'Perfil de entrenador dado de baja', text2: 'Podés reactivarlo cuando quieras.' });
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudo dar de baja el perfil de entrenador.' });
    }
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Toast.show({ type: 'error', text1: 'Permiso necesario', text2: 'Habilitá el acceso a tus fotos para elegir una imagen.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Toast.show({ type: 'error', text1: 'La imagen es muy grande', text2: 'El máximo es 5MB.' });
      return;
    }
    setPhotoUploading(true);
    const uploadResult = await uploadPhoto({ uri: asset.uri, mimeType: asset.mimeType });
    setPhotoUploading(false);
    if (!uploadResult.success) {
      Toast.show({ type: 'error', text1: 'No pudimos subir la foto', text2: uploadResult.error });
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    const result = await deletePhoto();
    setPhotoUploading(false);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos borrar la foto', text2: result.error });
    }
  };

  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="profile-screen" refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined} testID="profile-screen">
      <ScreenCard nativeID="profile-screen-content" testID="profile-screen-content">
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
          photoUploading={photoUploading}
          onPickPhoto={handlePickPhoto}
          onRemovePhoto={handleRemovePhoto}
        />

        {(rolesLoading || hasTrainerRole) && activeRole === 'trainer' && (
          <TrainerDataSection
            confirming={confirming}
            loading={membershipLoading}
            onPay={startCheckout}
            onUpgradeTier={() => router.push('/profile/tier-upgrade')}
            paying={processingPayment}
            subscription={subscription}
            trainerTier={roles.find((r) => r.name === 'entrenador')?.tier}
          />
        )}

        {checkoutData && (
          <CheckoutFlow
            amount={checkoutData.amount}
            installmentId={checkoutData.installmentId}
            key={checkoutData.preferenceId}
            onApproved={handleApproved}
            onCancel={handleCheckoutCancel}
            onError={handleCheckoutError}
            preferenceId={checkoutData.preferenceId}
            publicKey={checkoutData.publicKey}
          />
        )}

        {showPayments ? <PaymentsSummaryCard /> : <PaymentsHistoryCard />}

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

        <DangerZone
          hasTrainerRole={hasTrainerRole}
          onDeactivateTrainer={() => setConfirmTrainerOpen(true)}
          onDelete={() => setConfirmOpen(true)}
        />

        <DeactivateAccountModal
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirmDeactivate}
          userEmail={user.email}
          visible={confirmOpen}
        />

        <DeactivateTrainerModal
          onCancel={() => setConfirmTrainerOpen(false)}
          onConfirm={handleConfirmDeactivateTrainer}
          visible={confirmTrainerOpen}
        />
      </ScreenCard>
    </ScrollView>
  );
}
