import { useEffect, useState } from 'react';
import { BackHandler, Dimensions, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getRoutesByRole } from '../../routes/catalog.js';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore } from '../../store/team-store.js';
import { ThemeToggle } from '../theme/theme-toggle.jsx';
import { RoleBadge } from './role-badge.jsx';
import { RoleSwitchToggle } from '../profile/role-switch-toggle.jsx';

const isWeb = Platform.OS === 'web';
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH;
const ANIMATION_CONFIG = { duration: 280, easing: Easing.out(Easing.cubic) };
const ACCORDION_CONFIG = { duration: 220, easing: Easing.out(Easing.cubic) };

// Ítem "Equipos" del drawer: acordeón que expande/contrae la lista de
// equipos. Usa las animaciones de entrada/salida de Reanimated (maneja la
// transición de altura sola al montar/desmontar, más confiable en device
// que medir con onLayout y animar una altura manual) y rota un único
// ícono de chevron en vez de intercambiar dos íconos.
// El estado "expandido" usa un highlight neutro (no el verde de ruta
// activa) — si estuviera en la misma paleta que "Inicio" activo, con el
// acordeón abierto en home parecería que hay dos accesos seleccionados
// a la vez (mismo bug ya corregido en el header web).
function TeamsAccordion({ expanded, onToggle, teams, selectedTeamId, onSelectTeam, onCreateTeam, colors, icon, label }) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, ACCORDION_CONFIG);
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <View nativeID="teams-accordion" testID="teams-accordion">
      <Pressable
        className={`mb-0.5 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-90 ${
          expanded ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        nativeID="teams-accordion-toggle"
        onPress={onToggle}
        testID="teams-accordion-toggle"
      >
        <MaterialCommunityIcons
          color={colors.onSurfaceVariant}
          name={icon ?? 'circle-small'}
          size={22}
        />
        <Text className="flex-1 text-sm font-semibold text-slate-600 dark:text-slate-300" nativeID="teams-accordion-label" testID="teams-accordion-label">
          {label}
        </Text>
        <Animated.View style={chevronStyle}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-down" size={18} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          layout={LinearTransition.duration(200)}
          nativeID="teams-accordion-content"
          testID="teams-accordion-content"
        >
          <View className="ml-6 gap-0.5 border-l border-slate-200 pl-3 dark:border-slate-800">
            {teams.length === 0 && (
              <Text
                className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400"
                nativeID="teams-accordion-empty"
                testID="teams-accordion-empty"
              >
                Todavía no tenés equipos.
              </Text>
            )}
            {teams.map((team) => {
              const isSelected = team.id === selectedTeamId;
              return (
                <Pressable
                  key={team.id}
                  className="flex-row items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100 active:opacity-80 dark:hover:bg-slate-800"
                  nativeID={`teams-accordion-team-${team.id}`}
                  onPress={() => onSelectTeam(team)}
                  testID={`teams-accordion-team-${team.id}`}
                >
                  <MaterialCommunityIcons
                    color={isSelected ? colors.primary : colors.onSurfaceVariant}
                    name="account-group"
                    size={16}
                  />
                  <Text className={`flex-1 text-sm ${isSelected ? 'font-semibold text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
                    {team.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              className="flex-row items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100 active:opacity-80 dark:hover:bg-slate-800"
              nativeID="teams-accordion-create"
              onPress={onCreateTeam}
              testID="teams-accordion-create"
            >
              <MaterialCommunityIcons color={colors.primary} name="plus-circle" size={16} />
              <Text className="text-sm font-semibold text-primary">Crear equipo</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function TopAppBar({ onTogglePress, open }) {
  const colors = useThemeColors();

  return (
    <View
      className="h-[60px] w-full flex-row items-center justify-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-surface"
      nativeID="mobile-topbar"
      style={{ zIndex: 70 }}
      testID="mobile-topbar"
    >
      <Pressable
        accessibilityLabel={open ? 'Cerrar menú' : 'Abrir menú'}
        className="absolute left-4 rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="mobile-topbar-menu-toggle"
        onPress={onTogglePress}
        testID="mobile-topbar-menu-toggle"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={open ? 'close' : 'menu'} size={24} />
      </Pressable>
      <View className="flex-row items-center gap-3" nativeID="mobile-topbar-brand" testID="mobile-topbar-brand">
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

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeRole = useAuthStore((s) => s.activeRole);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));

  const userRole = user?.role ?? null;
  const routes = getRoutesByRole(userRole);

  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
  const [teamsExpanded, setTeamsExpanded] = useState(false);

  const translateX = useSharedValue(-DRAWER_WIDTH);

  useEffect(() => {
    translateX.value = withTiming(open ? 0 : -DRAWER_WIDTH, ANIMATION_CONFIG);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setTeamsExpanded(false);
  }, [open]);

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const goTo = (href) => {
    router.push(href);
    onClose();
  };

  // Sin backend de equipos todavía: elegir un equipo o crear uno nuevo solo
  // guarda selección local y avisa por toast — no navega a una pantalla propia.
  const handleSelectTeam = (team) => {
    selectTeam(team.id);
    onClose();
    Toast.show({ type: 'info', text1: team.name, text2: 'La vista de equipo todavía está en construcción.' });
  };

  const handleCreateTeam = () => {
    onClose();
    Toast.show({ type: 'info', text1: 'Crear equipo', text2: 'Este flujo todavía no está disponible.' });
  };

  return (
    <>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_WIDTH, zIndex: 60 },
          drawerAnimatedStyle,
        ]}
      >
        <View className="flex-1 bg-white dark:bg-surface" nativeID="mobile-drawer" testID="mobile-drawer">
          <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
            <View className="flex-1" style={{ paddingTop: 60 }}>
              {user ? (
                <Pressable
                  className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-4 hover:bg-slate-100 active:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800"
                  nativeID="mobile-drawer-profile-row"
                  onPress={() => goTo('/profile')}
                  testID="mobile-drawer-profile-row"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <MaterialCommunityIcons color={colors.primary} name="account-circle" size={26} />
                  </View>
                  <View className="flex-1 flex-row items-center gap-2">
                    <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="mobile-drawer-user-name" testID="mobile-drawer-user-name">{user.name}</Text>
                    <RoleBadge role={activeRole} />
                  </View>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={20} />
                </Pressable>
              ) : (
                <View className="border-b border-slate-200 px-5 py-4 dark:border-slate-800" nativeID="mobile-drawer-guest-row" testID="mobile-drawer-guest-row">
                  <Pressable
                    className="h-11 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
                    nativeID="mobile-drawer-login-button"
                    onPress={() => { router.push('/login'); onClose(); }}
                    testID="mobile-drawer-login-button"
                  >
                    <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]">Ingresar</Text>
                  </Pressable>
                </View>
              )}

              {user && hasTrainerRole && (
                <View className="items-center border-b border-slate-200 px-5 py-4 dark:border-slate-800" nativeID="mobile-drawer-role-switch-row" testID="mobile-drawer-role-switch-row">
                  <RoleSwitchToggle onClose={onClose} showTierLink={false} wide />
                </View>
              )}

              <View className="flex-row items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800" nativeID="mobile-drawer-theme-row" testID="mobile-drawer-theme-row">
                <View className="flex-row items-center gap-3">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="theme-light-dark" size={20} />
                  <Text className="text-sm font-medium text-slate-700 dark:text-slate-200">Tema</Text>
                </View>
                <ThemeToggle />
              </View>

              {user && (
                <ScrollView className="flex-1 px-2 py-4" nativeID="mobile-drawer-routes" testID="mobile-drawer-routes">
                  {routes.map((route) => {
                    if (route.name === 'equipos') {
                      return (
                        <TeamsAccordion
                          key={route.name}
                          colors={colors}
                          expanded={teamsExpanded}
                          icon={route.icon}
                          label={route.label}
                          onCreateTeam={handleCreateTeam}
                          onSelectTeam={handleSelectTeam}
                          onToggle={() => setTeamsExpanded((v) => !v)}
                          selectedTeamId={selectedTeamId}
                          teams={teams}
                        />
                      );
                    }

                    const isActive = pathname === route.href;

                    return (
                      <Pressable
                        key={route.name}
                        className={`mb-0.5 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:opacity-90 ${
                          isActive ? 'border-l-4 border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        nativeID={`mobile-drawer-route-${route.name}`}
                        onPress={() => goTo(route.href)}
                        testID={`mobile-drawer-route-${route.name}`}
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
              )}

              {user && (
                <View className="border-t border-slate-200 p-3 dark:border-slate-800" nativeID="mobile-drawer-logout-row" testID="mobile-drawer-logout-row">
                  <Pressable
                    className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-red-50 active:opacity-80 dark:hover:bg-red-900/20"
                    nativeID="mobile-drawer-logout-button"
                    onPress={() => { logout(); onClose(); }}
                    testID="mobile-drawer-logout-button"
                  >
                    <MaterialCommunityIcons color={colors.error} name="logout" size={20} />
                    <Text className="text-sm font-semibold text-red-600 dark:text-red-400">Cerrar sesión</Text>
                  </Pressable>
                </View>
              )}
            </View>
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
      className="flex-1 bg-white dark:bg-surface"
      edges={isWeb ? ['top', 'left', 'right'] : ['top', 'bottom']}
      nativeID="app-mobile-shell"
      testID="app-mobile-shell"
    >
      <TopAppBar onTogglePress={() => setDrawerOpen((v) => !v)} open={drawerOpen} />
      <NavigationDrawer onClose={() => setDrawerOpen(false)} open={drawerOpen} pathname={pathname} />
      <View className="flex-1" nativeID="app-mobile-shell-content" testID="app-mobile-shell-content">{children}</View>
    </SafeAreaView>
  );
}
