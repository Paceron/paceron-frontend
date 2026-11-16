import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useNextTrainingBanner } from '../../hooks/use-next-training-banner.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { canStartSession } from '../../utils/session-start-window.js';
import { isWeb } from '../../utils/platform.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { useArrowBounce } from '../../hooks/use-arrow-bounce.js';

const CAROUSEL_AUTOPLAY_MS = 20000;
const CAROUSEL_BODY_VERTICAL_PADDING = 32;

function CarouselProgressBar({ active, colorScheme, idPrefix }) {
  const progress = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  useEffect(() => {
    if (!active) return;
    progress.value = 1;
    progress.value = withTiming(0, { duration: CAROUSEL_AUTOPLAY_MS, easing: Easing.linear });
  }, [active, progress]);

  if (!active) return null;

  return (
    <View className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-green-900/10 dark:bg-white/10" nativeID={`${idPrefix}-autoplay-track`} pointerEvents="none" testID={`${idPrefix}-autoplay-track`}>
      <Animated.View
        nativeID={`${idPrefix}-autoplay-progress`}
        style={[{ backgroundColor: colorScheme === 'dark' ? '#dcfce7' : '#14532d', height: '100%', transformOrigin: 'left center', width: '100%' }, animatedStyle]}
        testID={`${idPrefix}-autoplay-progress`}
      />
    </View>
  );
}

function CancelledCard({ session, onPress }) {
  const idPrefix = `next-training-banner-cancelled-${session.id}`;

  return (
    <Pressable
      className="relative flex-row items-center overflow-hidden rounded-2xl bg-red-600 p-4 hover:opacity-90 active:opacity-90 dark:bg-red-800"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <View className="absolute -bottom-4 -right-4" nativeID={`${idPrefix}-watermark`} pointerEvents="none" testID={`${idPrefix}-watermark`}>
        <MaterialCommunityIcons color="#ffffff" name="calendar-remove-outline" size={80} style={{ opacity: 0.15 }} />
      </View>

      <View className="flex-1 pr-3" nativeID={`${idPrefix}-text`} testID={`${idPrefix}-text`}>
        <Text className="text-xs font-semibold uppercase tracking-wide text-white/80" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
          Cancelado · {formatDisplayDate(session.date)}
        </Text>
        <Text className="mt-0.5 text-sm font-bold text-white" nativeID={`${idPrefix}-name`} testID={`${idPrefix}-name`}>
          {session.sessionInstance?.name ?? 'Entrenamiento'}
        </Text>
      </View>

      <View className="w-12 items-center justify-center" nativeID={`${idPrefix}-icon-rail`} testID={`${idPrefix}-icon-rail`}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white/15" nativeID={`${idPrefix}-icon-badge`} testID={`${idPrefix}-icon-badge`}>
          <MaterialCommunityIcons color="#ffffff" name="calendar-remove-outline" size={20} />
        </View>
      </View>
    </Pressable>
  );
}

export function NextTrainingBanner() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.activeRole);
  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);
  const { nextTraining, nextTrainings, cancelledSessions, loading, isFetching } = useNextTrainingBanner(role, userId);

  if (!role) return null;

  // Antes iba al calendario general (con el día como deep-link, un modal
  // más para llegar a donde ya se sabía ir) -- directo al día del grupo
  // específico, mismo destino que "Ir a este día" en day-detail-modal.jsx
  // (bug real, 2026-10-05: "para cada asignación" quedaba un paso atrás).
  // Esa ruta es de GESTIÓN (editar/cancelar/vaciar), exclusiva del
  // entrenador -- este banner se muestra para los DOS roles (es el mismo
  // componente en Home), así que un corredor no puede ir ahí (bug real
  // reportado 2026-10-08, "gravísimo": corredor viendo los botones de
  // edición del entrenador). Ahora gateado también adentro de
  // GroupCalendarDayScreen (RequireRole) como defensa real -- esto de acá
  // es además la UX correcta: el corredor va a su propio calendario
  // general con el día como deep-link (abre el mismo DayDetailModal de
  // solo lectura que ya usa su calendario, ver my-calendar-screen.jsx).
  const goToCalendarDay = (session) => {
    if (role === 'trainer') {
      router.push(`/teams/${session.teamId}/groups/${session.groupId}/calendar/${session.date}`);
      return;
    }
    router.push(`/calendar?date=${session.date}`);
  };

  return (
    <View className="mb-3" nativeID="next-training-banner-root" testID="next-training-banner-root">
      {/* Sin label de sección arriba -- el contenido de la card ya se
          explica solo (fecha/nombre/equipo o el aviso de "no hay nada
          programado"). Loading/vacío usan el mismo estilo que las cards de
          Rachas/Logros (bg-white shadow-sm dark:bg-surface, sin borde) para
          no haber disparidad visual cuando no hay nada para destacar -- el
          hero CON contenido sigue con su color propio (bg-primary) a
          propósito, es una card-CTA real que lleva a "Iniciar
          entrenamiento", no una card informativa más. */}
      {loading && (
        <View className="items-center justify-center rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="next-training-banner-loading" testID="next-training-banner-loading">
          <ActivityIndicator color={colors.primary} nativeID="next-training-banner-loading-indicator" testID="next-training-banner-loading-indicator" />
        </View>
      )}

      {/* 
        Por ahora se desabilita el banner de "no hay nada programado" para dejar el home limpio.
        En un futuro se podra ver un componente para redirigir a la busqueda de equipos o a la asignacion de entrenamientos segun el rol.
      */}
      {/* {!loading && !nextTraining && (
        <View className="items-center justify-center rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="next-training-banner-empty" testID="next-training-banner-empty">
          <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="next-training-banner-empty-label" testID="next-training-banner-empty-label">
            No tenés entrenamientos programados.
          </Text>
        </View>
      )} */}

      {!loading && nextTraining && (
        <NextTrainingCardGroup
          cancelledSessions={cancelledSessions}
          isFetching={isFetching}
          nextTrainings={nextTrainings}
          onCancelledPress={goToCalendarDay}
          onHeroPress={(session) => {
            if (canStartSession(session) && !isWeb) {
              setPendingSession(session);
              if (role === 'trainer' && session.isPresencial) {
                router.push('/trainer-session-pre-start');
                return;
              }
              router.push('/training-session');
              return;
            }
            goToCalendarDay(session);
          }}
        />
      )}
    </View>
  );
}

function NextTrainingCardGroup({ nextTrainings, cancelledSessions, isFetching, onHeroPress, onCancelledPress }) {
  const { colorScheme } = useThemeMode();
  const [pageWidth, setPageWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uniformCardHeight, setUniformCardHeight] = useState(0);
  const [uniformContentHeight, setUniformContentHeight] = useState(0);
  const activeIndexRef = useRef(0);
  const scrollRef = useRef(null);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef(null);
  const programmaticTargetIndexRef = useRef(null);
  // 4 vueltas (~3.6s) y se queda quieto -- no infinito, ver el comentario
  // de useArrowBounce sobre el lag real reportado en el Home de corredor.
  const bounceStyle = useArrowBounce(4);
  const carouselKey = nextTrainings
    .map((session) => `${session.groupId ?? ''}:${session.date}:${session.sessionInstance?.id ?? ''}`)
    .join('|');
  const currentIndex = Math.min(activeIndex, nextTrainings.length - 1);
  const selectedTraining = nextTrainings[currentIndex] ?? nextTrainings[0];

  const setIndex = useCallback((index) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  const measureCardContentHeight = useCallback((contentHeight) => {
    if (!Number.isFinite(contentHeight) || contentHeight <= 0) return;
    const nextHeight = Math.ceil(contentHeight) + CAROUSEL_BODY_VERTICAL_PADDING;
    setUniformCardHeight((current) => (nextHeight > current ? nextHeight : current));
  }, []);

  const measureContentCardHeight = useCallback((contentHeight) => {
    if (!Number.isFinite(contentHeight) || contentHeight <= 0) return;
    const nextHeight = Math.ceil(contentHeight);
    setUniformContentHeight((current) => (nextHeight > current ? nextHeight : current));
  }, []);

  const clearProgrammaticScroll = useCallback(() => {
    programmaticScrollRef.current = false;
    programmaticTargetIndexRef.current = null;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
      programmaticScrollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearProgrammaticScroll(), [clearProgrammaticScroll]);

  // RNW ya soporta scroll suave con `animated: true`; el cambio inmediato en
  // web venía de un efecto que reescribía la posición sin animación en cada
  // cambio de índice.
  const scrollToX = useCallback((x, animated) => {
    const scrollable = scrollRef.current;
    if (scrollable?.scrollTo) {
      scrollable.scrollTo({ x, y: 0, animated });
      return;
    }
    const node = scrollable?.getScrollableNode?.();
    if (node?.scrollTo) node.scrollTo({ x, y: 0, animated });
  }, []);

  useEffect(() => {
    setIndex(0);
    setUniformCardHeight(0);
    setUniformContentHeight(0);
    scrollToX(0, false);
  }, [carouselKey, scrollToX, setIndex]);

  useEffect(() => {
    if (pageWidth > 0) scrollToX(activeIndexRef.current * pageWidth, false);
  }, [pageWidth, scrollToX]);

  const scrollToIndex = useCallback((index) => {
    const nextIndex = Math.max(0, Math.min(nextTrainings.length - 1, index));
    setIndex(nextIndex);
    programmaticScrollRef.current = true;
    programmaticTargetIndexRef.current = nextIndex;
    if (programmaticScrollTimeoutRef.current) clearTimeout(programmaticScrollTimeoutRef.current);
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
      programmaticTargetIndexRef.current = null;
      programmaticScrollTimeoutRef.current = null;
    }, 1500);
    scrollToX(nextIndex * pageWidth, true);
  }, [nextTrainings.length, pageWidth, scrollToX, setIndex]);

  useEffect(() => {
    if (nextTrainings.length <= 1 || pageWidth <= 0) return undefined;
    const timer = setTimeout(() => {
      scrollToIndex((currentIndex + 1) % nextTrainings.length);
    }, CAROUSEL_AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [currentIndex, nextTrainings.length, pageWidth, scrollToIndex]);

  const onScrollEnd = (event) => {
    if (pageWidth <= 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    if (programmaticScrollRef.current) {
      const target = programmaticTargetIndexRef.current ?? activeIndexRef.current;
      if (Math.abs(offsetX - target * pageWidth) < 2) clearProgrammaticScroll();
      return;
    }
    const index = Math.round(offsetX / pageWidth);
    setIndex(Math.max(0, Math.min(nextTrainings.length - 1, index)));
  };

  const renderTrainingCard = (session, key, idPrefix, isCarousel = false, index = 0) => (
    <NextTrainingHeroCard
      key={key}
      activeIndex={currentIndex}
      bounceStyle={bounceStyle}
      carousel={isCarousel ? {
        canNext: currentIndex < nextTrainings.length - 1,
        canPrev: currentIndex > 0,
        currentIndex,
        isActive: currentIndex === index,
        onNext: () => scrollToIndex(currentIndex + 1),
        onPrev: () => scrollToIndex(currentIndex - 1),
        total: nextTrainings.length,
      } : null}
      colorScheme={colorScheme}
      idPrefix={idPrefix}
      isCarousel={isCarousel}
      isFetching={isFetching}
      onMeasureCardContentHeight={isCarousel ? measureContentCardHeight : undefined}
      onMeasureContentHeight={isCarousel ? measureCardContentHeight : undefined}
      onPress={() => onHeroPress(session)}
      session={session}
      uniformContentHeight={isCarousel ? uniformContentHeight : 0}
      uniformHeight={isCarousel ? uniformCardHeight : 0}
    />
  );

  return (
    <View className="gap-2" nativeID="next-training-banner-list" testID="next-training-banner-list">
      {cancelledSessions.map((session) => (
        <CancelledCard key={session.id} onPress={() => onCancelledPress(session)} session={session} />
      ))}

      <View
        className="relative w-full"
        nativeID="next-training-banner-carousel"
        onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
        testID="next-training-banner-carousel"
      >
        {nextTrainings.length > 1 ? (
          <ScrollView
            ref={scrollRef}
            decelerationRate="fast"
            horizontal
            nativeID="next-training-banner-carousel-pages"
            onMomentumScrollEnd={onScrollEnd}
            onScroll={onScrollEnd}
            onScrollBeginDrag={clearProgrammaticScroll}
            pagingEnabled
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            testID="next-training-banner-carousel-pages"
          >
            {nextTrainings.map((session, index) => (
              <View
                key={`${session.groupId ?? ''}:${session.date}:${session.sessionInstance?.id ?? index}`}
                nativeID={`next-training-banner-carousel-page-${index + 1}`}
                className="relative"
                style={{ width: pageWidth || '100%' }}
                testID={`next-training-banner-carousel-page-${index + 1}`}
              >
                {renderTrainingCard(
                  session,
                  `hero-${session.groupId ?? ''}-${session.date}-${index}`,
                  `next-training-banner-hero-${index + 1}`,
                  true,
                  index,
                )}
              </View>
            ))}
          </ScrollView>
        ) : (
          renderTrainingCard(selectedTraining, 'hero-single', 'next-training-banner-hero')
        )}

      </View>
    </View>
  );
}

function CarouselArrow({ colorScheme, direction, disabled, idPrefix, onPress }) {
  const isPrevious = direction === 'previous';
  const color = colorScheme === 'dark' ? '#ffffff' : '#14532d';

  return (
    <Pressable
      accessibilityLabel={isPrevious ? 'Entrenamiento anterior' : 'Siguiente entrenamiento'}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className="items-center justify-center active:opacity-60"
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      nativeID={`${idPrefix}-${direction}`}
      onPress={(event) => {
        event?.stopPropagation?.();
        onPress();
      }}
      style={{ alignSelf: 'stretch', opacity: disabled ? 0.3 : 1, width: 28 }}
      testID={`${idPrefix}-${direction}`}
    >
      <Text
        nativeID={`${idPrefix}-${direction}-glyph`}
        style={{ color, fontSize: 32, fontWeight: '400', includeFontPadding: false, lineHeight: 34 }}
        testID={`${idPrefix}-${direction}-glyph`}
      >
        {isPrevious ? '<' : '>'}
      </Text>
    </Pressable>
  );
}

function NextTrainingHeroCard({ session, onPress, colorScheme, bounceStyle, isFetching, idPrefix, isCarousel, carousel, activeIndex, uniformHeight, uniformContentHeight, onMeasureContentHeight, onMeasureCardContentHeight }) {
  const heroIcon = session.isPresencial ? 'map-marker-radius' : 'run-fast';
  const isActive = isCarousel ? Boolean(carousel?.isActive) : true;
  const reveal = useSharedValue(1);
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateX: (1 - reveal.value) * 14 }],
  }));

  useEffect(() => {
    if (!isCarousel || !isActive) return;
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [activeIndex, isActive, isCarousel, reveal]);

  return (
    <Pressable
      className="relative overflow-hidden rounded-2xl bg-green-200 shadow-sm hover:opacity-90 active:opacity-90 dark:bg-green-800"
      nativeID={idPrefix}
      onPress={onPress}
      style={isCarousel && uniformHeight > 0 ? { height: uniformHeight } : undefined}
      testID={idPrefix}
    >
      <View className="absolute -bottom-8 -right-8" nativeID={`${idPrefix}-watermark`} pointerEvents="none" testID={`${idPrefix}-watermark`}>
        <MaterialCommunityIcons color={colorScheme === 'dark' ? '#ffffff' : '#111518'} name={heroIcon} size={130} style={{ opacity: 0.12 }} />
      </View>

      <View className={isCarousel ? 'relative flex-1 flex-row' : 'relative p-4'} nativeID={`${idPrefix}-body`} testID={`${idPrefix}-body`}>
        {isCarousel ? (
          <CarouselArrow
            colorScheme={colorScheme}
            direction="previous"
            disabled={!carousel.canPrev}
            idPrefix={idPrefix}
            onPress={carousel.onPrev}
          />
        ) : null}

        <View className={isCarousel ? 'flex-1 px-1 py-4' : ''} nativeID={`${idPrefix}-content-wrapper`} testID={`${idPrefix}-content-wrapper`}>
          <Animated.View
            nativeID={`${idPrefix}-reveal`}
            onLayout={isCarousel ? (event) => onMeasureContentHeight?.(event.nativeEvent.layout.height) : undefined}
            style={revealStyle}
            testID={`${idPrefix}-reveal`}
          >
            <View className="mb-1 flex-row items-center gap-1" nativeID={`${idPrefix}-heading`} testID={`${idPrefix}-heading`}>
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300" nativeID={`${idPrefix}-kicker`} testID={`${idPrefix}-kicker`}>
                Siguiente entrenamiento
              </Text>
              {isCarousel ? (
                <Text className="text-[10px] font-bold uppercase tracking-wide text-green-900 dark:text-green-100" nativeID={`${idPrefix}-position`} testID={`${idPrefix}-position`}>
                  {`(${carousel.currentIndex + 1}/${carousel.total})`}
                </Text>
              ) : null}
            </View>

            <View className="flex-row items-center" nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
              <View className="flex-1 rounded-2xl bg-green-50/70 p-4 dark:bg-green-700/70" nativeID={`${idPrefix}-text`} onLayout={isCarousel ? (event) => onMeasureCardContentHeight?.(event.nativeEvent.layout.height) : undefined} style={isCarousel && uniformContentHeight > 0 ? { minHeight: uniformContentHeight } : undefined} testID={`${idPrefix}-text`}>
                <View className="min-w-0 flex-row items-center" nativeID={`${idPrefix}-date-name`} testID={`${idPrefix}-date-name`}>
                  <Animated.View nativeID={`${idPrefix}-icon`} style={[{ marginRight: 6 }, bounceStyle]} testID={`${idPrefix}-icon`}>
                    <View className="h-6 w-6 items-center justify-center rounded-full border border-green-400 bg-green-300 dark:border-green-500 dark:bg-green-600" nativeID={`${idPrefix}-icon-badge`} testID={`${idPrefix}-icon-badge`}>
                      <MaterialCommunityIcons color={colorScheme === 'dark' ? '#ffffff' : '#111518'} name={heroIcon} size={14} />
                    </View>
                  </Animated.View>
                  <View className="min-w-0 flex-1" nativeID={`${idPrefix}-title-block`} testID={`${idPrefix}-title-block`}>
                    <Text className="text-xl font-bold text-green-950 dark:text-green-50" nativeID={`${idPrefix}-title`} numberOfLines={1} testID={`${idPrefix}-title`}>
                      {session.sessionInstance?.name ?? 'Entrenamiento'}
                    </Text>
                    <Text className="mt-0.5 text-xs font-semibold text-green-900 dark:text-green-100" nativeID={`${idPrefix}-date`} numberOfLines={1} testID={`${idPrefix}-date`}>
                      {formatWeekdayLabel(session.date, { short: true })}, {formatDisplayDate(session.date)}
                    </Text>
                  </View>
                </View>

                <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1" nativeID={`${idPrefix}-scope`} testID={`${idPrefix}-scope`}>
                  <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-team`} testID={`${idPrefix}-team`}>
                    <MaterialCommunityIcons color={colorScheme === 'dark' ? '#ffffff' : '#111518'} name="shield-account-outline" size={14} />
                    <Text className="text-xs font-semibold text-green-950 dark:text-green-50" nativeID={`${idPrefix}-team-label`} testID={`${idPrefix}-team-label`}>
                      {session.teamName}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-group`} testID={`${idPrefix}-group`}>
                    <MaterialCommunityIcons color={colorScheme === 'dark' ? '#ffffff' : '#111518'} name="account-multiple-outline" size={14} />
                    <Text className="text-xs font-semibold text-green-950 dark:text-green-50" nativeID={`${idPrefix}-group-label`} testID={`${idPrefix}-group-label`}>
                      {session.groupName}
                    </Text>
                  </View>
                </View>

                {session.isPresencial && (
                  <View className="mt-2 flex-row items-center gap-1.5" nativeID={`${idPrefix}-presencial`} testID={`${idPrefix}-presencial`}>
                    <MaterialCommunityIcons color={colorScheme === 'dark' ? '#ffffff' : '#111518'} name="map-marker-outline" size={14} />
                    <Text className="text-xs text-green-950 dark:text-green-50" nativeID={`${idPrefix}-presencial-label`} testID={`${idPrefix}-presencial-label`}>
                      {session.presencialTimeFrom}–{session.presencialTimeTo}
                      {session.presencialLocation?.label ? ` · ${session.presencialLocation.label}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </View>

        {isCarousel ? (
          <CarouselArrow
            colorScheme={colorScheme}
            direction="next"
            disabled={!carousel.canNext}
            idPrefix={idPrefix}
            onPress={carousel.onNext}
          />
        ) : null}

        <CarouselProgressBar active={isCarousel && isActive} colorScheme={colorScheme} idPrefix={idPrefix} />
      </View>

      {isFetching && (
        <View className="absolute inset-0 items-center justify-center rounded-2xl bg-primary/70" nativeID={`${idPrefix}-fetching-overlay`} testID={`${idPrefix}-fetching-overlay`}>
          <ActivityIndicator color={colorScheme === 'dark' ? '#ffffff' : '#111518'} nativeID={`${idPrefix}-fetching-indicator`} testID={`${idPrefix}-fetching-indicator`} />
        </View>
      )}
    </Pressable>
  );
}
