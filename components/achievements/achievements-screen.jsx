import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { StreaksTab } from './streaks-tab.jsx';
import { AchievementsTab } from './achievements-tab.jsx';
import { TrophyCaseTab } from './trophy-case-tab.jsx';
import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
import { isWeb } from '../../utils/platform.js';

// Hub de gamificación con pestañas. 'achievements'/'trophies' comparten la
// misma `section` de Gap 34 ('achievements') -- logros y vitrina son una
// sola sección a efectos del punto rojo, aunque sean 2 pestañas.
const TABS = [
  { id: 'streaks', label: 'Rachas', icon: 'fire' },
  { id: 'achievements', label: 'Logros', icon: 'medal-outline' },
  { id: 'trophies', label: 'Vitrina', icon: 'trophy' },
];

export function AchievementsScreen() {
  const [activeTab, setActiveTab] = useState('streaks');
  const { ackSection } = useGamificationBadge();
  const ackedSections = useRef(new Set());

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
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="achievements-screen-root" testID="achievements-screen-root">
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
