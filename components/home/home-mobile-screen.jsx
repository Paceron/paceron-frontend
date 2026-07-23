import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { HERO_CONTENT, FEATURES, AI_PANEL_CONTENT, AUDIENCE_CARDS } from './landing-content.js';

function FeatureItem({ icon, title, description, colors }) {
  return (
    <View className="flex-row gap-4 py-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15">
        <MaterialCommunityIcons color={colors.primary} name={icon} size={20} />
      </View>
      <View className="flex-1">
        <Text className="mb-1 text-base font-bold text-slate-950 dark:text-white">{title}</Text>
        <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300">{description}</Text>
      </View>
    </View>
  );
}

export function HomeMobileScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-[#111518]"
      contentContainerClassName="px-gutter pb-16"
      nativeID="home-mobile-screen"
      testID="home-mobile-screen"
    >
      <View className="items-center py-16">
        <View className="mb-6 flex-row items-center gap-2 rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5">
          <MaterialCommunityIcons
            color={colors.primary}
            name="brain"
            size={16}
          />
          <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
            {HERO_CONTENT.badge}
          </Text>
        </View>

        <Text className="mb-6 text-center text-[26px] font-bold leading-8 text-slate-950 dark:text-white">
          {HERO_CONTENT.title}
        </Text>

        <Text className="mb-10 text-center text-base leading-6 text-slate-600 dark:text-slate-300">
          {HERO_CONTENT.description}
        </Text>

        <View className="w-full gap-4">
          <Pressable
            className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary shadow-md active:opacity-80"
            onPress={() => router.push('/register')}
          >
            <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]">
              {HERO_CONTENT.primaryCta}
            </Text>
            <MaterialCommunityIcons
              color={colors.onPrimary}
              name="arrow-right"
              size={18}
            />
          </Pressable>

          <Pressable
            className="h-12 flex-row items-center justify-center gap-2 rounded-full border border-slate-300 active:opacity-80 dark:border-slate-700"
            onPress={() => router.push('/login')}
          >
            <Text className="text-sm font-semibold uppercase tracking-wide text-slate-950 dark:text-white">
              {HERO_CONTENT.secondaryCta}
            </Text>
            <MaterialCommunityIcons
              color={colors.onSurface}
              name="login"
              size={18}
            />
          </Pressable>
        </View>
      </View>

      <View className="py-4">
        {FEATURES.map((feature) => (
          <FeatureItem key={feature.icon} {...feature} colors={colors} />
        ))}
      </View>

      <View className="py-12">
        <View
          className="overflow-hidden rounded-2xl border border-primary/20 bg-white p-8 shadow-lg dark:bg-[#282d31]"
          nativeID="home-mobile-ai-panel-card"
          testID="home-mobile-ai-panel-card"
        >
          <View className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5">
            <MaterialCommunityIcons
              color={colors.primary}
              name="creation"
              size={16}
            />
            <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
              {AI_PANEL_CONTENT.badge}
            </Text>
          </View>

          <Text className="mb-4 text-[26px] font-bold leading-8 text-slate-950 dark:text-white">
            {AI_PANEL_CONTENT.title}
          </Text>

          <Text className="text-base leading-6 text-slate-600 dark:text-slate-300">
            {AI_PANEL_CONTENT.description}
          </Text>
        </View>
      </View>

      <View className="mt-8 flex-row gap-4">
        {AUDIENCE_CARDS.map((card) => (
          <View
            key={card.icon}
            className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#1d2125]"
            nativeID={`home-mobile-audience-card-${card.icon}`}
            testID={`home-mobile-audience-card-${card.icon}`}
          >
            <MaterialCommunityIcons color={colors.primary} name={card.icon} size={24} style={{ marginBottom: 8 }} />
            <Text className="mb-1 text-base font-bold text-slate-950 dark:text-white">{card.title}</Text>
            <Text className="text-sm leading-5 text-slate-600 dark:text-slate-300">{card.description}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
