import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { HERO_CONTENT, FEATURES, AI_PANEL_CONTENT, AUDIENCE_CARDS } from './landing-content.js';

function FeatureItem({ icon, title, description, colors }) {
  return (
    <View
      className="flex-row gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1d2125]"
      nativeID={`mobile-browser-landing-feature-card-${icon}`}
      testID={`mobile-browser-landing-feature-card-${icon}`}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl bg-primary-tint dark:bg-primary/15"
        nativeID={`mobile-browser-landing-feature-icon-${icon}`}
        testID={`mobile-browser-landing-feature-icon-${icon}`}
      >
        <MaterialCommunityIcons color={colors.primary} name={icon} size={20} />
      </View>
      <View
        className="flex-1"
        nativeID={`mobile-browser-landing-feature-copy-${icon}`}
        testID={`mobile-browser-landing-feature-copy-${icon}`}
      >
        <Text
          className="mb-1 text-base font-bold text-slate-950 dark:text-white"
          nativeID={`mobile-browser-landing-feature-title-${icon}`}
          testID={`mobile-browser-landing-feature-title-${icon}`}
        >
          {title}
        </Text>
        <Text
          className="text-sm leading-5 text-slate-600 dark:text-slate-300"
          nativeID={`mobile-browser-landing-feature-description-${icon}`}
          testID={`mobile-browser-landing-feature-description-${icon}`}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

// Se muestra cuando isMobileBrowser() detecta un browser en OS mobile
// (ver utils/platform.js) — la web todavía no es 100% responsive, así
// que se corta el acceso y se ofrece esta landing en su lugar: mismo
// contenido promocional que ya comparten home-landing-screen.jsx (web
// desktop) y home-mobile-screen.jsx (app nativa), pero sin ningún CTA
// hacia /login o /register — solo el aviso de que la app nativa está
// pendiente de publicar. Standalone (no monta AppWebShell/AppMobileShell,
// no hay sidebar/drawer, no hay nada que abrir).
export function MobileBrowserLandingScreen() {
  const colors = useThemeColors();

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-surface"
      nativeID="mobile-browser-landing-safe-area"
      testID="mobile-browser-landing-safe-area"
    >
      <View
        className="h-[60px] w-full flex-row items-center justify-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-surface"
        nativeID="mobile-browser-landing-header"
        testID="mobile-browser-landing-header"
      >
        <View
          className="flex-row items-center gap-3"
          nativeID="mobile-browser-landing-brand"
          testID="mobile-browser-landing-brand"
        >
          <Image
            accessibilityLabel="Paceron"
            nativeID="mobile-browser-landing-brand-logo"
            resizeMode="contain"
            source={require('../../assets/paceron-symbol-transparent.png')}
            style={{ width: 36, height: 36 }}
            testID="mobile-browser-landing-brand-logo"
          />
          <PaceronBrand size={18} />
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-paper dark:bg-[#111518]"
        contentContainerClassName="px-gutter pb-16"
        nativeID="mobile-browser-landing-scroll"
        testID="mobile-browser-landing-scroll"
      >
        <View
          className="items-center py-16"
          nativeID="mobile-browser-landing-hero"
          testID="mobile-browser-landing-hero"
        >
          <View
            className="mb-6 flex-row items-center gap-2 rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5"
            nativeID="mobile-browser-landing-hero-badge"
            testID="mobile-browser-landing-hero-badge"
          >
            <MaterialCommunityIcons color={colors.primary} name="brain" size={16} />
            <Text
              className="text-xs font-semibold uppercase tracking-wide text-primary"
              nativeID="mobile-browser-landing-hero-badge-label"
              testID="mobile-browser-landing-hero-badge-label"
            >
              {HERO_CONTENT.badge}
            </Text>
          </View>

          <Text
            className="mb-6 text-center text-[26px] font-bold leading-8 text-slate-950 dark:text-white"
            nativeID="mobile-browser-landing-hero-title"
            testID="mobile-browser-landing-hero-title"
          >
            {HERO_CONTENT.title}
          </Text>

          <Text
            className="mb-10 text-center text-base leading-6 text-slate-600 dark:text-slate-300"
            nativeID="mobile-browser-landing-hero-description"
            testID="mobile-browser-landing-hero-description"
          >
            {HERO_CONTENT.description}
          </Text>

          <View
            className="w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#1d2125]"
            nativeID="mobile-browser-landing-notice"
            testID="mobile-browser-landing-notice"
          >
            <View
              className="h-12 w-12 items-center justify-center rounded-full bg-primary-tint dark:bg-primary/15"
              nativeID="mobile-browser-landing-notice-icon-wrapper"
              testID="mobile-browser-landing-notice-icon-wrapper"
            >
              <MaterialCommunityIcons color={colors.primary} name="cellphone-arrow-down" size={24} />
            </View>
            <Text
              className="text-center text-base font-bold text-slate-950 dark:text-white"
              nativeID="mobile-browser-landing-notice-title"
              testID="mobile-browser-landing-notice-title"
            >
              Todavía no publicamos la app
            </Text>
            <Text
              className="text-center text-sm leading-5 text-slate-600 dark:text-slate-300"
              nativeID="mobile-browser-landing-notice-description"
              testID="mobile-browser-landing-notice-description"
            >
              Estamos trabajando en la versión nativa de Paceron. Muy pronto vas a poder descargarla desde acá.
            </Text>
            <View
              className="h-10 flex-row items-center gap-2 rounded-full bg-slate-100 px-4 dark:bg-slate-800"
              nativeID="mobile-browser-landing-notice-pill"
              testID="mobile-browser-landing-notice-pill"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="clock-outline" size={16} />
              <Text
                className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
                nativeID="mobile-browser-landing-notice-pill-label"
                testID="mobile-browser-landing-notice-pill-label"
              >
                Próximamente
              </Text>
            </View>
          </View>
        </View>

        <View
          className="gap-4 py-4"
          nativeID="mobile-browser-landing-features"
          testID="mobile-browser-landing-features"
        >
          {FEATURES.map((feature) => (
            <FeatureItem key={feature.icon} {...feature} colors={colors} />
          ))}
        </View>

        <View
          className="py-12"
          nativeID="mobile-browser-landing-ai-panel"
          testID="mobile-browser-landing-ai-panel"
        >
          <View
            className="overflow-hidden rounded-2xl border border-primary/20 bg-white p-8 shadow-lg dark:bg-[#282d31]"
            nativeID="mobile-browser-landing-ai-panel-card"
            testID="mobile-browser-landing-ai-panel-card"
          >
            <View
              className="mb-6 flex-row items-center gap-2 self-start rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5"
              nativeID="mobile-browser-landing-ai-panel-badge"
              testID="mobile-browser-landing-ai-panel-badge"
            >
              <MaterialCommunityIcons color={colors.primary} name="creation" size={16} />
              <Text
                className="text-xs font-semibold uppercase tracking-wide text-primary"
                nativeID="mobile-browser-landing-ai-panel-badge-label"
                testID="mobile-browser-landing-ai-panel-badge-label"
              >
                {AI_PANEL_CONTENT.badge}
              </Text>
            </View>

            <Text
              className="mb-4 text-[26px] font-bold leading-8 text-slate-950 dark:text-white"
              nativeID="mobile-browser-landing-ai-panel-title"
              testID="mobile-browser-landing-ai-panel-title"
            >
              {AI_PANEL_CONTENT.title}
            </Text>

            <Text
              className="text-base leading-6 text-slate-600 dark:text-slate-300"
              nativeID="mobile-browser-landing-ai-panel-description"
              testID="mobile-browser-landing-ai-panel-description"
            >
              {AI_PANEL_CONTENT.description}
            </Text>
          </View>
        </View>

        <View
          className="mt-8 flex-row gap-4"
          nativeID="mobile-browser-landing-audience-cards"
          testID="mobile-browser-landing-audience-cards"
        >
          {AUDIENCE_CARDS.map((card) => (
            <View
              key={card.icon}
              className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#1d2125]"
              nativeID={`mobile-browser-landing-audience-card-${card.icon}`}
              testID={`mobile-browser-landing-audience-card-${card.icon}`}
            >
              <MaterialCommunityIcons color={colors.primary} name={card.icon} size={24} style={{ marginBottom: 8 }} />
              <Text
                className="mb-1 text-base font-bold text-slate-950 dark:text-white"
                nativeID={`mobile-browser-landing-audience-title-${card.icon}`}
                testID={`mobile-browser-landing-audience-title-${card.icon}`}
              >
                {card.title}
              </Text>
              <Text
                className="text-sm leading-5 text-slate-600 dark:text-slate-300"
                nativeID={`mobile-browser-landing-audience-description-${card.icon}`}
                testID={`mobile-browser-landing-audience-description-${card.icon}`}
              >
                {card.description}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
