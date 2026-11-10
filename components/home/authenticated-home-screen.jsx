import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useAchievements } from '../../hooks/use-achievements.js';
import { pickAchievementHighlight } from '../../utils/achievement-highlight.js';
import { useThemeColors } from '../../theme/colors.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { NextTrainingBanner } from './next-training-banner.jsx';
import { StreakBanner } from './streak-banner.jsx';
import { AchievementHighlightCard } from './achievement-highlight-card.jsx';
import { RunnerKpisCard } from './runner-kpis-card.jsx';
import { HomePaymentsDueCard } from './home-payments-due-card.jsx';
import { PAYMENT_HISTORY_KEYS } from '../../hooks/use-payment-history.js';
import { ACTIVITY_COMPARISON_KEYS } from '../../hooks/use-activity-comparison.js';
import { CompetitionsPreviewCard } from './competitions-preview-card.jsx';
import { RecentTrainingsCard } from './recent-trainings-card.jsx';
import { TrainerHomeKpisCard } from './trainer-home-kpis-card.jsx';
import { trainerHomeKpisPrefix } from '../../utils/trainer-home-kpis.js';

export function AuthenticatedHomeScreen() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { user } = useUser(userId);
  const firstName = user?.name || '';

  // Decidido ACÁ (no dentro de AchievementHighlightCard) para saber, antes
  // de montarla, si va a haber algo que mostrar -- de eso depende si
  // Rachas se empareja 50/50 con Logros (7 días) o toma el ancho completo
  // (14 días). Mismo query cache que usa esa card (useAchievements), sin
  // fetch duplicado.
  const { achievements, loading: achievementsLoading, error: achievementsError } = useAchievements();
  const hasAchievementHighlight = !achievementsLoading && !achievementsError && Boolean(pickAchievementHighlight(achievements));

  const queryClient = useQueryClient();
  // Invalida calendario/user siempre; streaks/achievements solo tienen
  // sentido si la card de gamificación está montada (ver guard de
  // `activeRole === 'runner'` más abajo) -- invalidar esas queries para un
  // entrenador sería trabajo sin efecto visible, nadie las lee.
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['member-calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['administered-calendar'] }),
    queryClient.invalidateQueries({ queryKey: ['user', userId] }),
    queryClient.invalidateQueries({ queryKey: PAYMENT_HISTORY_KEYS.upcoming(userId) }),
    ...(activeRole === 'runner' ? [
      queryClient.invalidateQueries({ queryKey: ['streaks', userId] }),
      queryClient.invalidateQueries({ queryKey: ['achievements', userId] }),
      queryClient.invalidateQueries({ queryKey: ['runner-kpis'] }),
      // Bug real reportado 2026-11-08: CompetitionsPreviewCard/RecentTrainingsCard
      // (los dos últimos widgets agregados a este Home) nunca se habían
      // sumado acá -- pull-to-refresh los dejaba con datos viejos (ej. una
      // competencia nueva donde recién lo agregaron no aparecía hasta
      // recargar la app entera).
      queryClient.invalidateQueries({ queryKey: ['competitions'] }),
      queryClient.invalidateQueries({ queryKey: ACTIVITY_COMPARISON_KEYS.list(userId) }),
    ] : []),
    ...(activeRole === 'trainer' ? [
      queryClient.invalidateQueries({ queryKey: trainerHomeKpisPrefix(userId) }),
    ] : []),
  ]));

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="authenticated-home-screen-root"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      testID="authenticated-home-screen-root"
    >
      {/* NO usa `ScreenCard` (ver docs/superpowers/specs/2026-10-31-visual-
          design-refresh-design.md) a propósito -- evaluado en la Tarea 11 de
          ese plan. A diferencia de una pantalla con contenido suelto, los
          4 hijos de acá YA son cada uno su propia card individual, con la
          MISMA combinación bg-white/dark:bg-surface que ScreenCard
          introduciría (confirmado en next-training-banner.jsx, que incluso
          documenta en su propio comentario que ese tono fue elegido a
          propósito para igualar a Rachas/Logros). Envolver todo en
          ScreenCard apilaría una card del mismo tono alrededor de otras
          cards del mismo tono -- el mismo problema de "colisión de tono"
          que este plan viene resolviendo en otras pantallas con
          variant="nested"/bg-slate-50, pero sin ningún nivel más adentro
          al que demotear: estas 4 ya SON el nivel de contenido, no una
          card anidada dentro de otra. El único elemento realmente suelto
          (el saludo de arriba) es una sola línea de texto, no contenido
          de pantalla que amerite su propia card. */}
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="authenticated-home-screen-container" testID="authenticated-home-screen-container">
        <Text
          className="mb-4 text-2xl text-slate-900 dark:text-white"
          nativeID="authenticated-home-screen-greeting"
          style={{ fontFamily: 'Orbitron_700Bold' }}
          testID="authenticated-home-screen-greeting"
        >
          {firstName ? `Hola, ${firstName}` : 'Bienvenido a Paceron'}
        </Text>
        {/* Cuotas por vencer o vencidas, de los dos roles (los dos pagan tier). */}
        <HomePaymentsDueCard />
        <NextTrainingBanner />
        {activeRole === 'trainer' ? <TrainerHomeKpisCard /> : null}
        {/* Gamificación es un módulo pensado para corredores -- oculto
            para entrenador a propósito (pedido real, 2026-10-15),
            reversible: solo este guard de `activeRole`. */}
        {activeRole === 'runner' && (
          <>
            {/* Rachas y Logros 50/50 -- pedido real 2026-11-09. Sin logro
                destacado para mostrar, Rachas ocupa el ancho completo y
                pasa a la variante de 14 días (ver `hasAchievementHighlight`
                arriba). Cada hijo mantiene su propio `mb-3` (no se duplica
                acá arriba); `paired` iguala la altura visible entre las dos
                cards (el slot ya queda fijado por el hermano más alto). */}
            {hasAchievementHighlight ? (
              <View className="flex-row gap-3" nativeID="authenticated-home-screen-gamification-row" testID="authenticated-home-screen-gamification-row">
                <View className="flex-1" nativeID="authenticated-home-screen-streak-slot" testID="authenticated-home-screen-streak-slot">
                  <StreakBanner daysCount={7} paired />
                </View>
                <View className="flex-1" nativeID="authenticated-home-screen-achievement-slot" testID="authenticated-home-screen-achievement-slot">
                  <AchievementHighlightCard paired />
                </View>
              </View>
            ) : (
              <StreakBanner daysCount={14} />
            )}
            <RunnerKpisCard />
            <CompetitionsPreviewCard />
            <RecentTrainingsCard />
          </>
        )}
      </View>
    </ScrollView>
  );
}
