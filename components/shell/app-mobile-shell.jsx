import { useEffect, useState } from 'react';
import { Dimensions, Image, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRoutesByRole } from '../../routes/catalog.js';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';

const isWeb = Platform.OS === 'web';
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 360);
const ANIMATION_CONFIG = { duration: 280, easing: Easing.out(Easing.cubic) };

function TopAppBar({ onMenuPress }) {
  const colors = useThemeColors();

  return (
    <View className="h-[60px] w-full flex-row items-center justify-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-[#111518]">
      <Pressable
        accessibilityLabel="Abrir menú"
        className="absolute left-4 rounded-full p-2 active:opacity-70"
        onPress={onMenuPress}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="menu" size={24} />
      </Pressable>
      <View className="flex-row items-center gap-3">
        <Image
          accessibilityLabel="Paceron"
          resizeMode="contain"
          source={require('../../assets/paceron-symbol-transparent.png')}
          style={{ width: 36, height: 36 }}
        />
        <PaceronBrand size={18} />
      </View>
    </View>
  );
}

function NavigationDrawer({ open, pathname, onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const { colorScheme, themeMode, toggleThemeMode } = useThemeMode();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const userRole = user?.role ?? null;
  const routes = getRoutesByRole(userRole);

  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(open ? 0 : -DRAWER_WIDTH, ANIMATION_CONFIG);
    backdropOpacity.value = withTiming(open ? 1 : 0, ANIMATION_CONFIG);
  }, [open]);

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const goTo = (href) => {
    router.push(href);
    onClose();
  };

  const themeIcon = themeMode === 'dark' || (themeMode === 'system' && colorScheme === 'dark')
    ? 'weather-night'
    : 'weather-sunny';

  return (
    <>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 55, backgroundColor: 'black' }, backdropAnimatedStyle]}
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_WIDTH, zIndex: 60 },
          drawerAnimatedStyle,
        ]}
      >
        <View className="flex-1 border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111518]">
          <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
            {user ? (
              <View className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <MaterialCommunityIcons color={colors.primary} name="account-circle" size={26} />
                </View>
                <View className="flex-1">
                  <PaceronBrand size={18} />
                  <Text className="text-sm text-slate-600 dark:text-slate-300">{user.name}</Text>
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-circle" size={26} />
                </View>
                <View className="flex-1">
                  <PaceronBrand size={18} />
                  <Text className="text-sm text-slate-600 dark:text-slate-300">Invitado</Text>
                </View>
                <Pressable
                  className="rounded-full bg-primary px-4 py-1.5 active:opacity-80"
                  onPress={() => { router.push('/login'); onClose(); }}
                >
                  <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]">Ingresar</Text>
                </Pressable>
              </View>
            )}

            <View className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <Pressable
                className="flex-row items-center justify-between rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800"
                onPress={toggleThemeMode}
              >
                <Text className="text-xs text-slate-600 dark:text-slate-300">Tema</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-slate-500 dark:text-slate-400">{themeMode}</Text>
                  <MaterialCommunityIcons
                    color={colors.onSurfaceVariant}
                    name={themeIcon}
                    size={16}
                  />
                </View>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-2 py-4">
              {routes.map((route) => {
                const isActive = pathname === route.href;

                return (
                  <Pressable
                    key={route.name}
                    className={`mb-0.5 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-90 ${
                      isActive ? 'border-l-4 border-primary bg-primary/10' : ''
                    }`}
                    onPress={() => goTo(route.href)}
                  >
                    <MaterialCommunityIcons
                      color={isActive ? colors.primary : colors.onSurfaceVariant}
                      name={route.icon ?? 'circle-small'}
                      size={22}
                    />
                    <Text
                      className={`text-sm font-semibold ${
                        isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {route.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {user && (
              <View className="border-t border-slate-200 p-3 dark:border-slate-800">
                <Pressable
                  className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-80"
                  onPress={() => { logout(); onClose(); }}
                >
                  <MaterialCommunityIcons color={colors.error} name="logout" size={20} />
                  <Text className="text-sm font-semibold text-red-600 dark:text-red-400">Cerrar sesión</Text>
                </Pressable>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Animated.View>
    </>
  );
}

export function AppMobileShell({ children, pathname }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-[#111518]"
      edges={isWeb ? ['top', 'left', 'right'] : ['top', 'bottom']}
    >
      <TopAppBar onMenuPress={() => setDrawerOpen(true)} />
      <NavigationDrawer onClose={() => setDrawerOpen(false)} open={drawerOpen} pathname={pathname} />
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
