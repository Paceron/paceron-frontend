import { Pressable, ScrollView, Text, View } from 'react-native';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { HERO_CONTENT, FEATURES, AI_PANEL_CONTENT, AUDIENCE_CARDS } from './landing-content.js';

function FeatureCard({ icon, title, description, colors }) {
  return (
    <View
      className="flex-1 min-w-[280px] rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-[#1d2125]"
      nativeID={`home-landing-screen-feature-card-${icon}`}
      testID={`home-landing-screen-feature-card-${icon}`}
    >
      <View
        className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15"
        nativeID={`home-landing-screen-feature-icon-${icon}`}
        testID={`home-landing-screen-feature-icon-${icon}`}
      >
        <MaterialCommunityIcons color={colors.primary} name={icon} size={24} />
      </View>
      <Text
        className="mb-2 text-lg font-bold text-slate-900 dark:text-white"
        nativeID={`home-landing-screen-feature-title-${icon}`}
        testID={`home-landing-screen-feature-title-${icon}`}
      >
        {title}
      </Text>
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

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-[#0d1013]"
      nativeID="home-landing-screen-root"
      testID="home-landing-screen-root"
    >
      <View
        className="mx-auto w-full max-w-5xl px-8 py-20"
        nativeID="home-landing-screen-content"
        testID="home-landing-screen-content"
      >
        <View
          className="mb-16 items-center"
          nativeID="home-landing-screen-hero"
          testID="home-landing-screen-hero"
        >
          <View
            className="mb-6 flex-row items-center gap-2 self-center rounded-full bg-primary-tint dark:bg-primary/20 px-4 py-2"
            nativeID="home-landing-screen-hero-badge"
            testID="home-landing-screen-hero-badge"
          >
            <MaterialCommunityIcons color={colors.primary} name="brain" size={16} />
            <Text
              className="text-xs font-semibold uppercase tracking-wider text-primary"
              nativeID="home-landing-screen-hero-badge-label"
              testID="home-landing-screen-hero-badge-label"
            >
              {HERO_CONTENT.badge}
            </Text>
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
              className="h-12 flex-row items-center gap-2 rounded-full bg-slate-100 px-8 hover:bg-slate-200 active:opacity-80 dark:bg-slate-800 dark:hover:bg-slate-700"
              nativeID="home-landing-screen-hero-secondary-cta"
              testID="home-landing-screen-hero-secondary-cta"
              onPress={() => router.push('/login')}
            >
              <Text
                className="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-white"
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
          className="mb-16 overflow-hidden rounded-2xl border border-primary/20 bg-white p-12 shadow-lg dark:bg-[#1d2125]"
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
                className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary-tint dark:bg-primary/20 px-4 py-2"
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
              className="flex-1 rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-[#1d2125]"
              nativeID={`home-landing-screen-audience-card-${card.icon}`}
              testID={`home-landing-screen-audience-card-${card.icon}`}
            >
              <View
                className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15"
                nativeID={`home-landing-screen-audience-icon-${card.icon}`}
                testID={`home-landing-screen-audience-icon-${card.icon}`}
              >
                <MaterialCommunityIcons color={colors.primary} name={card.icon} size={24} />
              </View>
              <Text
                className="mb-2 text-lg font-bold text-slate-900 dark:text-white"
                nativeID={`home-landing-screen-audience-title-${card.icon}`}
                testID={`home-landing-screen-audience-title-${card.icon}`}
              >
                {card.title}
              </Text>
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
        className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-[#111518]"
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
