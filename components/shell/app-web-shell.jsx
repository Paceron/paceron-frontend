import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRoutesByRole } from '../../routes/catalog.js';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { ThemeToggle } from '../theme/theme-toggle.jsx';
import { RoleBadge } from './role-badge.jsx';
import { RoleManagementSection } from './role-management-section.jsx';

// Envuelve el dropdown para animar apertura/cierre (fade + slide sutil).
// Se mantiene siempre montado (mismo patrón que el drawer mobile) para que
// la animación de salida se vea; cuando está cerrado, pointerEvents 'none'
// evita que intercepte clicks.
function AnimatedDropdown({ open, onClose, children }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);

  useEffect(() => {
    const config = { duration: open ? 160 : 120, easing: Easing.out(Easing.cubic) };
    opacity.value = withTiming(open ? 1 : 0, config);
    translateY.value = withTiming(open ? 0 : -8, config);
  }, [open]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View className="absolute inset-0 z-50" pointerEvents={open ? 'auto' : 'none'}>
      <Pressable className="absolute inset-0" onPress={onClose} />
      <Animated.View style={[{ position: 'absolute', right: 16, top: 60 }, animatedStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}

function DropdownMenu({ onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const trainerActivated = useAuthStore((s) => s.trainerActivated);

  return (
    <View className="w-56">
      {/* Nub que conecta visualmente el dropdown con el pill de usuario de arriba */}
      <View className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-surface-2" />

      <View className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-surface-2">
        {trainerActivated && (
          <>
            <RoleManagementSection allowActivate={false} onClose={onClose} />
            <View className="mx-4 border-t border-slate-100 dark:border-slate-800" />
          </>
        )}

        <View className="flex-row items-center justify-between px-4 py-3.5">
          <View className="flex-row items-center gap-3">
            <MaterialCommunityIcons name="theme-light-dark" size={18} color={colors.onSurfaceVariant} />
            <Text className="text-sm font-medium text-slate-900 dark:text-white">Tema</Text>
          </View>
          <ThemeToggle />
        </View>

        <View className="mx-4 border-t border-slate-100 dark:border-slate-800" />

        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-150"
          onPress={() => { router.push('/profile'); onClose(); }}
        >
          <MaterialCommunityIcons name="account-circle" size={18} color={colors.onSurfaceVariant} />
          <Text className="flex-1 text-sm font-medium text-slate-900 dark:text-white">Ver perfil</Text>
        </Pressable>

        <View className="mx-4 border-t border-slate-100 dark:border-slate-800" />

        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-50 dark:active:bg-red-900/20 transition-colors duration-150"
          onPress={() => { useAuthStore.getState().logout(); onClose(); }}
        >
          <MaterialCommunityIcons name="logout" size={18} color={colors.error} />
          <Text className="text-sm font-semibold text-red-600 dark:text-red-400">Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TopBar({ isGuest, userName, activeRole, dropdownOpen, routesTab, activeTab, onTabPress, onUserPress }) {
  const router = useRouter();
  const colors = useThemeColors();

  const handleUserPress = () => {
    if (isGuest) {
      router.push('/login');
      return;
    }
    onUserPress?.();
  };

  return (
    <View className="h-[60px] w-full flex-row items-center bg-white px-3 dark:bg-surface border-b border-slate-200 dark:border-slate-800">
      <Pressable
        className="flex-row items-center gap-2 shrink-0"
        onPress={() => router.replace('/')}
      >
        <Image
          accessibilityLabel="Paceron"
          resizeMode="contain"
          source={require('../../assets/paceron-symbol-transparent.png')}
          style={{ width: 32, height: 32 }}
        />
        <PaceronBrand size={16} />
      </Pressable>

      {!isGuest && routesTab ? (
        <View className="flex-1 items-center justify-center">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 4 }}
          >
            {routesTab.map((route) => {
              const isActive = activeTab === route.href;
              return (
                <Pressable
                  key={route.name}
                  className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 ${
                    isActive
                      ? 'bg-primary-tint-subtle dark:bg-primary/10'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800'
                  }`}
                  onPress={() => onTabPress?.(route.href)}
                >
                  <MaterialCommunityIcons
                    name={route.icon}
                    size={16}
                    color={isActive ? colors.primary : colors.onSurfaceVariant}
                  />
                  <Text
                    className={`text-sm whitespace-nowrap ${
                      isActive
                        ? 'font-semibold text-primary'
                        : 'font-medium text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {route.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View className="flex-1" />
      )}

      <View className="flex-row items-center shrink-0">
        {isGuest ? (
          <View className="flex-row items-center gap-3">
            <ThemeToggle />
            <Pressable
              className="rounded-full bg-primary px-5 py-2 active:opacity-80"
              onPress={() => router.push('/login')}
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]">
                Ingresar
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            className={`flex-row items-center gap-2 rounded-lg p-1.5 transition-colors duration-150 ${
              dropdownOpen ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800'
            }`}
            onPress={handleUserPress}
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-tint-subtle dark:bg-primary/10">
              <MaterialCommunityIcons
                color={colors.primary}
                name="account-circle"
                size={20}
              />
            </View>
            {userName && (
              <Text className="text-sm font-medium text-slate-900 dark:text-white">
                {userName}
              </Text>
            )}
            <RoleBadge role={activeRole} />
            <MaterialCommunityIcons
              color={colors.onSurfaceVariant}
              name="chevron-down"
              size={16}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function AppWebShell({ children, pathname }) {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const isGuest = !user;
  const userName = user?.name || null;
  const activeRole = useAuthStore((s) => s.activeRole);
  const routesTab = getRoutesByRole(user?.role || null);
  const [activeTab, setActiveTab] = useState(pathname);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setActiveTab(pathname);
  }, [pathname]);

  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  const handleTabPress = (href) => {
    setActiveTab(href);
    router.push(href);
  };

  const handleUserPress = () => {
    setDropdownOpen(true);
  };

  const handleCloseDropdown = () => {
    setDropdownOpen(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']}>
      <View className="flex-1">
        <TopBar
          activeRole={activeRole}
          activeTab={activeTab}
          dropdownOpen={dropdownOpen}
          isGuest={isGuest}
          onTabPress={handleTabPress}
          onUserPress={handleUserPress}
          routesTab={routesTab}
          userName={userName}
        />
        {!isGuest && (
          <AnimatedDropdown open={dropdownOpen} onClose={handleCloseDropdown}>
            <DropdownMenu onClose={handleCloseDropdown} />
          </AnimatedDropdown>
        )}
        <View className="flex-1">{children}</View>
      </View>
    </SafeAreaView>
  );
}
