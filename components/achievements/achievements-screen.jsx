import { useEffect, useRef } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { TabBar } from '../shared/tab-bar.jsx';
import { StreaksTab } from './streaks-tab.jsx';
import { AchievementsTab } from './achievements-tab.jsx';
import { TrophyCaseTab } from './trophy-case-tab.jsx';
import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
import { useAchievementsTabStore } from '../../store/achievements-tab-store.js';
import { useAuthStore } from '../../store/auth-store.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useThemeColors } from '../../theme/colors.js';

// Hub de gamificación con pestañas. 'achievements'/'trophies' comparten la
// misma `section` de Gap 34 ('achievements') -- logros y vitrina son una
// sola sección a efectos del punto rojo, aunque sean 2 pestañas.
const TABS = [
  { id: 'streaks', label: 'Rachas', icon: 'fire' },
  { id: 'achievements', label: 'Logros', icon: 'medal-outline' },
  { id: 'trophies', label: 'Vitrina', icon: 'trophy' },
];

export function AchievementsScreen() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const activeTab = useAchievementsTabStore((s) => s.activeTab);
  const setActiveTab = useAchievementsTabStore((s) => s.setActiveTab);
  const { ackSection } = useGamificationBadge();
  const ackedSections = useRef(new Set());

  // Mismas 3 queries que alimentan las 3 pestañas, sin importar cuál está
  // activa -- barato, mismo criterio que el pull-to-refresh del Home.
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['streaks', userId] }),
    queryClient.invalidateQueries({ queryKey: ['achievements', userId] }),
    queryClient.invalidateQueries({ queryKey: ['stamps', userId] }),
  ]));

  // Marca la sección correspondiente como vista la primera vez que se
  // entra a cada pestaña en esta sesión de pantalla (un Set, no un boolean
  // -- hay 2 secciones distintas: 'streaks' y 'achievements'). Como
  // `activeTab` arranca en 'streaks', el ack de rachas sigue disparando
  // al montar, igual que en Spec 1.
  useEffect(() => {
    if (ackedSections.current.has(activeTab)) return;
    ackedSections.current.add(activeTab);
    const section = activeTab === 'streaks' ? 'streaks' : 'achievements';
    ackSection(section);
  }, [activeTab]);

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="achievements-screen-root"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      testID="achievements-screen-root"
    >
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="achievements-screen-container" testID="achievements-screen-container">
        <Text className="mb-6 text-2xl text-slate-900 dark:text-white" nativeID="achievements-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="achievements-screen-title">
          Logros
        </Text>
        <TabBar active={activeTab} onChange={setActiveTab} scope="achievements-tab-bar" tabs={TABS} />
        {activeTab === 'streaks' && <StreaksTab />}
        {activeTab === 'achievements' && <AchievementsTab />}
        {activeTab === 'trophies' && <TrophyCaseTab />}
      </View>
    </ScrollView>
  );
}
