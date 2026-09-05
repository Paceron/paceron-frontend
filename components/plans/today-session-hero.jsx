import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { TodaySessionCard } from './today-session-card.jsx';

// Invitación cuando todavía no se marcó ningún plan como "actual" — no
// se oculta el hero del todo, es la primera vez que alguien entra y
// tiene que enterarse de que el feature existe (ver spec).
function EmptyCurrentPlanCard() {
  const colors = useThemeColors();
  return (
    <View className="w-full items-center gap-3 rounded-3xl border border-dashed border-primary/40 bg-primary-tint-subtle px-6 py-8 dark:bg-primary/5" nativeID="today-session-hero-empty" testID="today-session-hero-empty">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15" nativeID="today-session-hero-empty-icon" testID="today-session-hero-empty-icon">
        <MaterialCommunityIcons color={colors.primary} name="star-outline" size={28} />
      </View>
      <Text className="text-center text-base text-slate-900 dark:text-white" nativeID="today-session-hero-empty-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="today-session-hero-empty-title">
        Marcá un plan como actual
      </Text>
      <Text className="max-w-xs text-center text-sm text-slate-500 dark:text-slate-400" nativeID="today-session-hero-empty-copy" testID="today-session-hero-empty-copy">
        Elegí hasta 2 planes de la lista de abajo (ícono de estrella) para ver acá arriba la sesión de hoy apenas entrás.
      </Text>
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={20} />
    </View>
  );
}

// Puntos indicadores — comunes a las dos plataformas, para saber en cuál
// de las 2 cards se está parado (más útil en mobile, donde el swipe no
// deja tan claro cuántas hay como las flechas de web).
function Dots({ count, active }) {
  return (
    <View className="mt-3 flex-row items-center justify-center gap-2" nativeID="today-session-hero-dots" testID="today-session-hero-dots">
      {Array.from({ length: count }).map((_, i) => (
        <View
          className={`h-1.5 rounded-full ${i === active ? 'w-5 bg-primary' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`}
          key={i}
          nativeID={`today-session-hero-dot-${i}`}
          testID={`today-session-hero-dot-${i}`}
        />
      ))}
    </View>
  );
}

// 0 marcados: invitación. 1: card sola. 2: carrusel — scroll horizontal
// táctil en mobile (!isWeb), flechas prev/next en web (isWeb, cualquier
// ancho) — pedido explícito del usuario para cada plataforma.
export function TodaySessionHero({ plans }) {
  const colors = useThemeColors();
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  if (plans.length === 0) return <EmptyCurrentPlanCard />;
  if (plans.length === 1) return <TodaySessionCard plan={plans[0]} />;

  const goTo = (index) => setActiveIndex(Math.max(0, Math.min(plans.length - 1, index)));

  if (!isWeb) {
    return (
      <View nativeID="today-session-hero-carousel" testID="today-session-hero-carousel" onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
        <ScrollView
          horizontal
          decelerationRate="fast"
          nativeID="today-session-hero-scroll"
          onMomentumScrollEnd={(e) => {
            if (!containerWidth) return;
            goTo(Math.round(e.nativeEvent.contentOffset.x / containerWidth));
          }}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          testID="today-session-hero-scroll"
        >
          {plans.map((plan) => (
            <View key={plan.id} nativeID={`today-session-hero-slide-${plan.id}`} style={{ width: containerWidth || '100%' }} testID={`today-session-hero-slide-${plan.id}`}>
              <TodaySessionCard plan={plan} />
            </View>
          ))}
        </ScrollView>
        <Dots active={activeIndex} count={plans.length} />
      </View>
    );
  }

  const plan = plans[activeIndex];
  return (
    <View nativeID="today-session-hero-carousel" testID="today-session-hero-carousel">
      <View className="flex-row items-center gap-3" nativeID="today-session-hero-arrow-row" testID="today-session-hero-arrow-row">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={activeIndex === 0}
          nativeID="today-session-hero-prev-button"
          onPress={() => goTo(activeIndex - 1)}
          testID="today-session-hero-prev-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-left" size={22} />
        </Pressable>
        <View className="flex-1" nativeID="today-session-hero-card-slot" testID="today-session-hero-card-slot">
          <TodaySessionCard plan={plan} />
        </View>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={activeIndex === plans.length - 1}
          nativeID="today-session-hero-next-button"
          onPress={() => goTo(activeIndex + 1)}
          testID="today-session-hero-next-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={22} />
        </Pressable>
      </View>
      <Dots active={activeIndex} count={plans.length} />
    </View>
  );
}
