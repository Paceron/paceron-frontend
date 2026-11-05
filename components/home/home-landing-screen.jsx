import { Pressable, ScrollView, Text, View } from 'react-native';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { HERO_CONTENT, FEATURES, AI_PANEL_CONTENT, AUDIENCE_CARDS } from './landing-content.js';

function FeatureCard({ icon, title, description, colors }) {
  return (
    <View
      className="flex-1 min-w-[280px] rounded-2xl bg-slate-100 p-6 dark:bg-slate-900 hover:bg-lime-100 dark:hover:bg-lime-950 transition-all"
      nativeID={`home-landing-screen-feature-card-${icon}`}
      testID={`home-landing-screen-feature-card-${icon}`}
    >
      <View className="mb-2 flex-row items-start align-center" nativeID={`home-landing-screen-feature-header-${icon}`} testID={`home-landing-screen-feature-header-${icon}`}>
        <View
          className="h-12 w-12 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15 animate-pulse"
          nativeID={`home-landing-screen-feature-icon-${icon}`}
          testID={`home-landing-screen-feature-icon-${icon}`}
        >
          <MaterialCommunityIcons color={colors.primary} name={icon} size={24} />
        </View>
        <Text
          className="m-3 ml-4 text-lg font-bold text-slate-900 dark:text-white"
          nativeID={`home-landing-screen-feature-title-${icon}`}
          testID={`home-landing-screen-feature-title-${icon}`}
        >
          {title}
        </Text>
      </View>
      <Text
        className="text-sm leading-6 text-slate-500 dark:text-slate-400"
        nativeID={`home-landing-screen-feature-description-${icon}`}
        testID={`home-landing-screen-feature-description-${icon}`}
      >
        {description}
      </Text>
    </View>
  );
}

export function HomeLandingScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  // NO usa `ScreenCard` (ver docs/superpowers/specs/2026-10-31-visual-design-
  // refresh-design.md) a propósito -- evaluado en la Tarea 11 de ese plan.
  // Esta es la landing de marketing para visitantes sin sesión (hero +
  // features + panel de IA + audience cards + footer propio), no una
  // pantalla de contenido (texto/listas/forms/datos de estado) -- la forma
  // que ScreenCard está pensada para resolver. Cada sección ya es un bloque
  // visual propio y deliberado (hero centrado sin card, grid de feature
  // cards, panel de IA con su propio borde `primary/20`, audience cards, una
  // franja de footer con su propio fondo `bg-white dark:bg-surface-2`) --
  // forzar una sola card blanca envolviendo TODO el `max-w-5xl` de arriba
  // aplanaría esa jerarquía de bloques contrastantes en una sola superficie
  // uniforme, el patrón que una landing usa a propósito y que el spec no
  // pide cambiar (fuera de alcance: "cambios de layout/estructura").
  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink transition-all"
      nativeID="home-landing-screen-root"
      testID="home-landing-screen-root"
    >
      <View
        className="mx-auto w-full max-w-5xl px-8 py-16"
        nativeID="home-landing-screen-content"
        testID="home-landing-screen-content"
      >
        <View
          className="mb-16 items-center"
          nativeID="home-landing-screen-hero"
          testID="home-landing-screen-hero"
        >
          <View
            className="-mt-6 mb-16 items-center p-14 rounded-full transition-all duration-500 bg-slate-100 dark:bg-slate-900 hover:bg-lime-100 dark:hover:bg-lime-950 shadow-md hover:shadow-2xl shadow-slate-600 dark:shadow-slate-500 hover:shadow-lime-600 dark:hover:shadow-lime-500"
            nativeID="home-landing-screen-hero-brand"
            testID="home-landing-screen-hero-brand"
          >
            <PaceronBrand size={80} />
          </View>

          <Text
            className="mb-6 text-center text-5xl font-bold leading-tight text-slate-900 dark:text-white"
            nativeID="home-landing-screen-hero-title"
            testID="home-landing-screen-hero-title"
          >
            {HERO_CONTENT.title}
          </Text>

          <Text
            className="mb-10 max-w-2xl text-center text-lg leading-7 text-slate-500 dark:text-slate-400"
            nativeID="home-landing-screen-hero-description"
            testID="home-landing-screen-hero-description"
          >
            {HERO_CONTENT.description}
          </Text>

          <View
            className="flex-row gap-4"
            nativeID="home-landing-screen-hero-actions"
            testID="home-landing-screen-hero-actions"
          >
            <Pressable
              className="h-12 flex-row items-center gap-2 rounded-full bg-primary px-8 shadow-md hover:opacity-90 active:opacity-80"
              nativeID="home-landing-screen-hero-primary-cta"
              testID="home-landing-screen-hero-primary-cta"
              onPress={() => router.push('/register')}
            >
              <Text
                className="text-sm font-semibold uppercase tracking-wide text-[#111518]"
                nativeID="home-landing-screen-hero-primary-cta-label"
                testID="home-landing-screen-hero-primary-cta-label"
              >
                {HERO_CONTENT.primaryCta}
              </Text>
              <MaterialCommunityIcons color={colors.onPrimary} name="arrow-right" size={18} />
            </Pressable>
            <Pressable
              className="h-12 flex-row items-center gap-2 rounded-full px-8 shadow-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-100 active:opacity-80 dark:hover:bg-surface-2"
              nativeID="home-landing-screen-hero-secondary-cta"
              testID="home-landing-screen-hero-secondary-cta"
              onPress={() => router.push('/login')}
            >
              <Text
                className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200"
                nativeID="home-landing-screen-hero-secondary-cta-label"
                testID="home-landing-screen-hero-secondary-cta-label"
              >
                {HERO_CONTENT.secondaryCta}
              </Text>
              <MaterialCommunityIcons color={colors.onSurface} name="login" size={18} />
            </Pressable>
          </View>
        </View>

        <View
          className="mb-16 flex-row flex-wrap gap-6"
          nativeID="home-landing-screen-features"
          testID="home-landing-screen-features"
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.icon} {...feature} colors={colors} />
          ))}
        </View>

        <View
          className="mb-16 overflow-hidden rounded-2xl bg-slate-50 p-12 dark:bg-slate-800/60 hover:bg-green-50 dark:hover:bg-lime-900 transition-all"
          nativeID="home-landing-screen-ai-panel"
          testID="home-landing-screen-ai-panel"
        >
          <View
            className="flex-row items-center justify-between"
            nativeID="home-landing-screen-ai-panel-row"
            testID="home-landing-screen-ai-panel-row"
          >
            <View
              className="flex-1 pr-12"
              nativeID="home-landing-screen-ai-panel-copy"
              testID="home-landing-screen-ai-panel-copy"
            >
              <View
                className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary-tint dark:bg-primary/20 px-4 py-2 animate-pulse"
                nativeID="home-landing-screen-ai-panel-badge"
                testID="home-landing-screen-ai-panel-badge"
              >
                <MaterialCommunityIcons color={colors.primary} name="creation" size={16} />
                <Text
                  className="text-xs font-semibold uppercase tracking-wider text-primary"
                  nativeID="home-landing-screen-ai-panel-badge-label"
                  testID="home-landing-screen-ai-panel-badge-label"
                >
                  {AI_PANEL_CONTENT.badge}
                </Text>
              </View>
              <Text
                className="mb-4 text-4xl font-bold leading-tight text-slate-900 dark:text-white"
                nativeID="home-landing-screen-ai-panel-title"
                testID="home-landing-screen-ai-panel-title"
              >
                {AI_PANEL_CONTENT.title}
              </Text>
              <Text
                className="mb-4 max-w-lg text-base leading-7 text-slate-500 dark:text-slate-400"
                nativeID="home-landing-screen-ai-panel-description"
                testID="home-landing-screen-ai-panel-description"
              >
                {AI_PANEL_CONTENT.description}
              </Text>
            </View>
            <View
              className="items-center justify-center opacity-10"
              nativeID="home-landing-screen-ai-panel-icon"
              testID="home-landing-screen-ai-panel-icon"
            >
              <MaterialCommunityIcons color={colors.primary} name="brain" size={200} />
            </View>
          </View>
        </View>

        <View
          className="mb-16 flex-row gap-6"
          nativeID="home-landing-screen-audience-cards"
          testID="home-landing-screen-audience-cards"
        >
          {AUDIENCE_CARDS.map((card) => (
            <View
              key={card.icon}
              className="flex-1 rounded-2xl bg-slate-100 p-8 dark:bg-slate-900 hover:bg-lime-100 dark:hover:bg-lime-950 transition-all"
              nativeID={`home-landing-screen-audience-card-${card.icon}`}
              testID={`home-landing-screen-audience-card-${card.icon}`}
            >
              <View className="mb-2 flex-row items-start align-center" nativeID={`home-landing-screen-audience-header-${card.icon}`} testID={`home-landing-screen-audience-header-${card.icon}`}>
                <View
                  className="h-12 w-12 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15 animate-pulse"
                  nativeID={`home-landing-screen-audience-icon-${card.icon}`}
                  testID={`home-landing-screen-audience-icon-${card.icon}`}
                >
                  <MaterialCommunityIcons color={colors.primary} name={card.icon} size={24} />
                </View>
                <Text
                  className="m-3 ml-4 text-lg font-bold text-slate-900 dark:text-white"
                  nativeID={`home-landing-screen-audience-title-${card.icon}`}
                  testID={`home-landing-screen-audience-title-${card.icon}`}
                >
                  {card.title}
                </Text>
              </View>
              <Text
                className="text-sm leading-6 text-slate-500 dark:text-slate-400"
                nativeID={`home-landing-screen-audience-description-${card.icon}`}
                testID={`home-landing-screen-audience-description-${card.icon}`}
              >
                {card.description}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View
        className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-surface-2"
        nativeID="home-landing-screen-footer"
        testID="home-landing-screen-footer"
      >
        <View
          className="mx-auto w-full max-w-5xl flex-row items-center justify-between px-8"
          nativeID="home-landing-screen-footer-row"
          testID="home-landing-screen-footer-row"
        >
          <PaceronBrand size={16} />
          <Text
            className="text-sm text-slate-400"
            nativeID="home-landing-screen-footer-copyright"
            testID="home-landing-screen-footer-copyright"
          >
            © 2026 Paceron
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
