import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { HERO_CONTENT, FEATURES, AI_PANEL_CONTENT, AUDIENCE_CARDS } from './landing-content.js';

function FeatureItem({ icon, title, description, colors }) {
  return (
    <View
      className="flex-row gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1d2125]"
      nativeID={`home-web-narrow-screen-feature-card-${icon}`}
      testID={`home-web-narrow-screen-feature-card-${icon}`}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15"
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

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-[#111518]"
      contentContainerClassName="px-gutter pb-16"
      nativeID="home-web-narrow-screen"
      testID="home-web-narrow-screen"
    >
      <View
        className="items-center py-16"
        nativeID="home-web-narrow-screen-hero"
        testID="home-web-narrow-screen-hero"
      >
        <View
          className="mb-6 flex-row items-center gap-2 rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5"
          nativeID="home-web-narrow-screen-hero-badge"
          testID="home-web-narrow-screen-hero-badge"
        >
          <MaterialCommunityIcons color={colors.primary} name="brain" size={16} />
          <Text
            className="text-xs font-semibold uppercase tracking-wide text-primary"
            nativeID="home-web-narrow-screen-hero-badge-label"
            testID="home-web-narrow-screen-hero-badge-label"
          >
            {HERO_CONTENT.badge}
          </Text>
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
            className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-slate-100 hover:bg-slate-200 active:opacity-80 dark:bg-slate-800 dark:hover:bg-slate-700"
            nativeID="home-web-narrow-screen-hero-secondary-cta"
            testID="home-web-narrow-screen-hero-secondary-cta"
            onPress={() => router.push('/login')}
          >
            <Text
              className="text-sm font-semibold uppercase tracking-wide text-slate-950 dark:text-white"
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
        className="py-12"
        nativeID="home-web-narrow-screen-ai-panel"
        testID="home-web-narrow-screen-ai-panel"
      >
        <View
          className="overflow-hidden rounded-2xl border border-primary/20 bg-white p-8 shadow-lg dark:bg-[#282d31]"
          nativeID="home-web-narrow-screen-ai-panel-card"
          testID="home-web-narrow-screen-ai-panel-card"
        >
          <View
            className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5"
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
        className="mt-8 flex-row gap-4"
        nativeID="home-web-narrow-screen-audience-cards"
        testID="home-web-narrow-screen-audience-cards"
      >
        {AUDIENCE_CARDS.map((card) => (
          <View
            key={card.icon}
            className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#1d2125]"
            nativeID={`home-web-narrow-screen-audience-card-${card.icon}`}
            testID={`home-web-narrow-screen-audience-card-${card.icon}`}
          >
            <MaterialCommunityIcons color={colors.primary} name={card.icon} size={24} style={{ marginBottom: 8 }} />
            <Text
              className="mb-1 text-base font-bold text-slate-950 dark:text-white"
              nativeID={`home-web-narrow-screen-audience-title-${card.icon}`}
              testID={`home-web-narrow-screen-audience-title-${card.icon}`}
            >
              {card.title}
            </Text>
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
