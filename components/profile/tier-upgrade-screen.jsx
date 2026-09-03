import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { listTiers } from '../../services/tiers.js';
import { toTierModel } from '../../services/normalizers.js';
import { SectionCard } from '../forms/section-card.jsx';

const ROLE_LABEL = { runner: 'Corredor', trainer: 'Entrenador' };

function formatTierPrice(tierAmount, paymentRequired) {
  if (!paymentRequired || !tierAmount) return 'Gratis';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(tierAmount);
}

// Card de un tier — "Tier actual" si coincide con roles[].tier del rol
// activo, si no "Próximamente" (sin acción de pago conectada: Fase 1 del
// backend, que gatearía el acceso tras el primer pago, todavía no
// existe — ver docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md).
function TierCard({ tier, isCurrent, isDesktopWeb }) {
  const idPrefix = `tier-card-${tier.id}`;
  return (
    <View
      className={`rounded-2xl border p-5 ${isCurrent ? 'border-primary bg-primary-tint dark:bg-primary/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface'} ${isDesktopWeb ? 'w-[31%]' : 'w-full'}`}
      nativeID={idPrefix}
      testID={idPrefix}
    >
      <Text className="text-base font-bold capitalize text-slate-900 dark:text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
        {tier.name}
      </Text>
      <View className="mt-1 flex-row items-baseline gap-1" nativeID={`${idPrefix}-price-row`} testID={`${idPrefix}-price-row`}>
        <Text className="text-lg font-bold text-primary" nativeID={`${idPrefix}-price`} testID={`${idPrefix}-price`}>
          {formatTierPrice(tier.tierAmount, tier.paymentRequired)}
        </Text>
        {tier.paymentRequired && (
          <Text className="text-xs font-medium text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-price-period`} testID={`${idPrefix}-price-period`}>
            /mes
          </Text>
        )}
      </View>
      {tier.description && (
        <Text className="mt-3 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-description`} testID={`${idPrefix}-description`}>
          {tier.description}
        </Text>
      )}

      {isCurrent ? (
        <View className="mt-4 h-10 flex-row items-center justify-center gap-2 rounded-full bg-primary-tint dark:bg-primary/15" nativeID={`${idPrefix}-current-badge`} testID={`${idPrefix}-current-badge`}>
          <MaterialCommunityIcons color="#8cc63e" name="check-circle" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-on-primary-tint dark:text-primary" nativeID={`${idPrefix}-current-badge-label`} testID={`${idPrefix}-current-badge-label`}>
            Tier actual
          </Text>
        </View>
      ) : (
        <View className="mt-4 h-10 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800" nativeID={`${idPrefix}-coming-soon`} testID={`${idPrefix}-coming-soon`}>
          <MaterialCommunityIcons color="#94a3b8" name="clock-outline" size={16} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-coming-soon-label`} testID={`${idPrefix}-coming-soon-label`}>
            Próximamente
          </Text>
        </View>
      )}
    </View>
  );
}

export function TierUpgradeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isNarrowWeb = useIsNarrowWeb();
  const isDesktopWeb = isWeb && !isNarrowWeb;
  const activeRole = useAuthStore((s) => s.activeRole);
  const roles = useAuthStore((s) => s.roles);

  const currentRoleName = activeRole === 'runner' ? 'corredor' : 'entrenador';
  const currentTierName = roles.find((r) => r.name === currentRoleName)?.tier;

  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadTiers = async () => {
      setLoading(true);
      try {
        const dtos = await listTiers();
        if (!cancelled) setTiers(dtos.map(toTierModel));
      } catch (error) {
        if (!cancelled) Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'No se pudieron cargar los tiers.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadTiers();
    return () => { cancelled = true; };
  }, []);

  const roleTiers = tiers
    .filter((t) => t.roleName === currentRoleName)
    .sort((a, b) => a.tierAmount - b.tierAmount);

  return (
    <ScrollView
      nativeID="tier-upgrade-screen-scroll"
      testID="tier-upgrade-screen-scroll"
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      showsVerticalScrollIndicator={false}
    >
      <View nativeID="tier-upgrade-screen-container" testID="tier-upgrade-screen-container" className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        <View nativeID="tier-upgrade-screen-header" testID="tier-upgrade-screen-header" className="mb-8 flex-row items-center gap-2">
          <Pressable
            nativeID="tier-upgrade-screen-back-button"
            testID="tier-upgrade-screen-back-button"
            className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
            onPress={() => router.replace('/profile')}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            <Text nativeID="tier-upgrade-screen-back-label" testID="tier-upgrade-screen-back-label" className="text-sm font-medium text-slate-500 dark:text-slate-400">Mi perfil</Text>
          </Pressable>
          <Text nativeID="tier-upgrade-screen-breadcrumb-separator" testID="tier-upgrade-screen-breadcrumb-separator" className="text-sm text-slate-400 dark:text-slate-600">/</Text>
          <Text nativeID="tier-upgrade-screen-title" testID="tier-upgrade-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} className="text-xl text-slate-900 dark:text-white">
            Mejorar tier
          </Text>
        </View>

        <SectionCard icon="star-four-points" title={`Tiers de ${ROLE_LABEL[activeRole]}`}>
          {loading ? (
            <View className="items-center py-6" nativeID="tier-upgrade-screen-loading" testID="tier-upgrade-screen-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : roleTiers.length === 0 ? (
            <Text className="py-2 text-sm text-slate-500 dark:text-slate-400" nativeID="tier-upgrade-screen-empty" testID="tier-upgrade-screen-empty">
              Todavía no hay tiers configurados para este rol.
            </Text>
          ) : (
            <View className={isDesktopWeb ? 'flex-row flex-wrap gap-4' : 'gap-3'} nativeID="tier-upgrade-screen-cards" testID="tier-upgrade-screen-cards">
              {roleTiers.map((tier) => (
                <TierCard isCurrent={tier.name === currentTierName} isDesktopWeb={isDesktopWeb} key={tier.id} tier={tier} />
              ))}
            </View>
          )}
        </SectionCard>
      </View>
    </ScrollView>
  );
}
