import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { StreaksTab } from './streaks-tab.jsx';
import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
import { isWeb } from '../../utils/platform.js';

// Hub de gamificación con pestañas (arranca con una sola -- Spec 2 agrega
// 'achievements'/'trophies' a este mismo array, sin tocar el resto del
// shell). Sin persistencia de la pestaña activa entre sesiones -- no lo
// pide la spec 1.
const TABS = [{ id: 'streaks', label: 'Rachas', icon: 'fire' }];

export function AchievementsScreen() {
  const [activeTab, setActiveTab] = useState('streaks');
  const { ackSection } = useGamificationBadge();

  // Marca "rachas" como visto al entrar al hub -- apaga el punto rojo
  // (Gap 34) sin esperar a que el usuario haga nada más. Spec 2 hará lo
  // mismo con 'achievements' cuando esa pestaña exista. El warning de
  // `react-hooks/exhaustive-deps` por el dep array vacío es uno de los
  // preexistentes que el repo no bloquea (ver CLAUDE.md "Testing") --
  // `ackSection` se recrea cada render (no está memoizado en el hook) pero
  // solo nos interesa dispararlo una vez al montar, no en cada render.
  useEffect(() => {
    ackSection('streaks');
  }, []);

  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="achievements-screen-root" testID="achievements-screen-root">
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="achievements-screen-container" testID="achievements-screen-container">
        <Text className="mb-6 text-2xl text-slate-900 dark:text-white" nativeID="achievements-screen-title" testID="achievements-screen-title">
          Logros
        </Text>
        <TabBar active={activeTab} onChange={setActiveTab} scope="achievements-tab-bar" tabs={TABS} />
        {activeTab === 'streaks' && <StreaksTab />}
      </View>
    </ScrollView>
  );
}
