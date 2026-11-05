import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { HERO_CONTENT, FEATURES, AI_PANEL_CONTENT, AUDIENCE_CARDS } from './landing-content.js';

function FeatureItem({ icon, title, description, colors }) {
  return (
    <View
      className="flex-row gap-4 rounded-2xl bg-slate-100 p-5 dark:bg-slate-900 hover:bg-lime-100 dark:hover:bg-lime-950 transition-all"
      nativeID={`home-web-narrow-screen-feature-card-${icon}`}
      testID={`home-web-narrow-screen-feature-card-${icon}`}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15 animate-pulse"
        nativeID={`home-web-narrow-screen-feature-icon-${icon}`}
        testID={`home-web-narrow-screen-feature-icon-${icon}`}
      >
        <MaterialCommunityIcons color={colors.primary} name={icon} size={20} />
      </View>
      <View
        className="flex-1"
        nativeID={`home-web-narrow-screen-feature-copy-${icon}`}
        testID={`home-web-narrow-screen-feature-copy-${icon}`}
      >
        <Text
          className="mb-1 text-base font-bold text-slate-950 dark:text-white"
          nativeID={`home-web-narrow-screen-feature-title-${icon}`}
          testID={`home-web-narrow-screen-feature-title-${icon}`}
        >
          {title}
        </Text>
        <Text
          className="text-sm leading-5 text-slate-600 dark:text-slate-300"
          nativeID={`home-web-narrow-screen-feature-description-${icon}`}
          testID={`home-web-narrow-screen-feature-description-${icon}`}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

export function HomeWebNarrowScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  // NO usa `ScreenCard` (ver docs/superpowers/specs/2026-10-31-visual-design-
  // refresh-design.md) a propósito -- evaluado en la Tarea 11 de ese plan,
  // misma razón que home-landing-screen.jsx (su variante web angosta de este
  // mismo contenido de marketing). Hero sin card + grid de feature cards +
  // panel de IA con borde propio + audience cards -- ya son bloques
  // deliberadamente distintos entre sí, no contenido de pantalla suelto que
  // necesite agruparse en una sola superficie uniforme.
  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink transition-all"
      contentContainerClassName="px-gutter pb-16"
      nativeID="home-web-narrow-screen"
      testID="home-web-narrow-screen"
    >
      <View
        className="items-center py-8 m-2"
        nativeID="home-web-narrow-screen-hero"
        testID="home-web-narrow-screen-hero"
      >
        <View
          className="mb-12 items-center p-8 rounded-full transition-all duration-500 bg-slate-100 dark:bg-slate-900 hover:bg-lime-100 dark:hover:bg-lime-950 shadow-md hover:shadow-2xl shadow-slate-600 dark:shadow-slate-500 hover:shadow-lime-600 dark:hover:shadow-lime-500"
          nativeID="home-web-narrow-screen-hero-brand"
          testID="home-web-narrow-screen-hero-brand"
        >
          <PaceronBrand size={45} />
        </View>

        <Text
          className="mb-6 text-center text-[26px] font-bold leading-8 text-slate-950 dark:text-white"
          nativeID="home-web-narrow-screen-hero-title"
          testID="home-web-narrow-screen-hero-title"
        >
          {HERO_CONTENT.title}
        </Text>

        <Text
          className="mb-10 text-center text-base leading-6 text-slate-600 dark:text-slate-300"
          nativeID="home-web-narrow-screen-hero-description"
          testID="home-web-narrow-screen-hero-description"
        >
          {HERO_CONTENT.description}
        </Text>

        <View
          className="w-full gap-4"
          nativeID="home-web-narrow-screen-hero-actions"
          testID="home-web-narrow-screen-hero-actions"
        >
          <Pressable
            className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary shadow-md hover:opacity-90 active:opacity-80"
            nativeID="home-web-narrow-screen-hero-primary-cta"
            testID="home-web-narrow-screen-hero-primary-cta"
            onPress={() => router.push('/register')}
          >
            <Text
              className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
              nativeID="home-web-narrow-screen-hero-primary-cta-label"
              testID="home-web-narrow-screen-hero-primary-cta-label"
            >
              {HERO_CONTENT.primaryCta}
            </Text>
            <MaterialCommunityIcons color={colors.onPrimary} name="arrow-right" size={18} />
          </Pressable>

          <Pressable
            className="h-12 flex-row items-center justify-center gap-2 rounded-full shadow-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-100 active:opacity-80 dark:hover:bg-surface-2"
            nativeID="home-web-narrow-screen-hero-secondary-cta"
            testID="home-web-narrow-screen-hero-secondary-cta"
            onPress={() => router.push('/login')}
          >
            <Text
              className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200"
              nativeID="home-web-narrow-screen-hero-secondary-cta-label"
              testID="home-web-narrow-screen-hero-secondary-cta-label"
            >
              {HERO_CONTENT.secondaryCta}
            </Text>
            <MaterialCommunityIcons color={colors.onSurface} name="login" size={18} />
          </Pressable>
        </View>
      </View>

      <View
        className="gap-4 py-4"
        nativeID="home-web-narrow-screen-features"
        testID="home-web-narrow-screen-features"
      >
        {FEATURES.map((feature) => (
          <FeatureItem key={feature.icon} {...feature} colors={colors} />
        ))}
      </View>

      <View
        className="pb-4"
        nativeID="home-web-narrow-screen-ai-panel"
        testID="home-web-narrow-screen-ai-panel"
      >
        <View
          className="overflow-hidden rounded-2xl bg-slate-50 p-8 dark:bg-slate-800/60 hover:bg-green-50 dark:hover:bg-lime-900 transition-all"
          nativeID="home-web-narrow-screen-ai-panel-card"
          testID="home-web-narrow-screen-ai-panel-card"
        >
          <View
            className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5 animate-pulse"
            nativeID="home-web-narrow-screen-ai-panel-badge"
            testID="home-web-narrow-screen-ai-panel-badge"
          >
            <MaterialCommunityIcons color={colors.primary} name="creation" size={16} />
            <Text
              className="text-xs font-semibold uppercase tracking-wide text-primary"
              nativeID="home-web-narrow-screen-ai-panel-badge-label"
              testID="home-web-narrow-screen-ai-panel-badge-label"
            >
              {AI_PANEL_CONTENT.badge}
            </Text>
          </View>

          <Text
            className="mb-4 text-[26px] font-bold leading-8 text-slate-950 dark:text-white"
            nativeID="home-web-narrow-screen-ai-panel-title"
            testID="home-web-narrow-screen-ai-panel-title"
          >
            {AI_PANEL_CONTENT.title}
          </Text>

          <Text
            className="text-base leading-6 text-slate-600 dark:text-slate-300"
            nativeID="home-web-narrow-screen-ai-panel-description"
            testID="home-web-narrow-screen-ai-panel-description"
          >
            {AI_PANEL_CONTENT.description}
          </Text>
        </View>
      </View>

      <View
        className="flex-row gap-4"
        nativeID="home-web-narrow-screen-audience-cards"
        testID="home-web-narrow-screen-audience-cards"
      >
        {AUDIENCE_CARDS.map((card) => (
          <View
            key={card.icon}
            className="flex-1 rounded-2xl bg-slate-100 p-6 dark:bg-slate-900 hover:bg-lime-100 dark:hover:bg-lime-950 transition-all"
            nativeID={`home-web-narrow-screen-audience-card-${card.icon}`}
            testID={`home-web-narrow-screen-audience-card-${card.icon}`}
          >
            <View className="mb-1 flex-row items-start align-center" nativeID={`home-web-narrow-screen-audience-header-${card.icon}`} testID={`home-web-narrow-screen-audience-header-${card.icon}`}>
              <View
                className="h-10 w-10 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15 animate-pulse"
                nativeID={`home-web-narrow-screen-audience-icon-${card.icon}`}
                testID={`home-web-narrow-screen-audience-icon-${card.icon}`}
              >
                <MaterialCommunityIcons color={colors.primary} name={card.icon} size={20} />
              </View>
              <Text
                className="m-2 ml-3 text-base font-bold text-slate-950 dark:text-white"
                nativeID={`home-web-narrow-screen-audience-title-${card.icon}`}
                testID={`home-web-narrow-screen-audience-title-${card.icon}`}
              >
                {card.title}
              </Text>
            </View>
            <Text
              className="text-sm leading-5 text-slate-600 dark:text-slate-300"
              nativeID={`home-web-narrow-screen-audience-description-${card.icon}`}
              testID={`home-web-narrow-screen-audience-description-${card.icon}`}
            >
              {card.description}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
