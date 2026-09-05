import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRoutesByRole } from '../../routes/catalog.js';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { ThemeToggle } from '../theme/theme-toggle.jsx';
import { RoleBadge } from './role-badge.jsx';
import { RoleSwitchToggle } from '../profile/role-switch-toggle.jsx';
import { TeamsAccordion } from './teams-accordion.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { getUserInitials } from '../../utils/user-initials.js';
import { usePendingRequestsCount } from '../../hooks/use-join-requests.js';

const ANIMATION_CONFIG = { duration: 280, easing: Easing.out(Easing.cubic) };

function TopBarNarrow({ onTogglePress, open }) {
  const colors = useThemeColors();

  return (
    <View
      className="h-[60px] w-full flex-row items-center justify-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-surface"
      nativeID="web-narrow-topbar"
      style={{ zIndex: 70 }}
      testID="web-narrow-topbar"
    >
      <Pressable
        accessibilityLabel={open ? 'Cerrar menú' : 'Abrir menú'}
        className="absolute left-4 rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="web-narrow-topbar-menu-toggle"
        onPress={onTogglePress}
        testID="web-narrow-topbar-menu-toggle"
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={open ? 'close' : 'menu'} size={24} />
      </Pressable>
      <View className="flex-row items-center gap-3" nativeID="web-narrow-topbar-brand" testID="web-narrow-topbar-brand">
        <Image
          accessibilityLabel="Paceron"
          nativeID="web-narrow-topbar-brand-logo"
          resizeMode="contain"
          source={require('../../assets/paceron-symbol-transparent.png')}
          style={{ width: 36, height: 36 }}
          testID="web-narrow-topbar-brand-logo"
        />
        <PaceronBrand size={18} />
      </View>
    </View>
  );
}

function NavigationDrawerNarrow({ open, pathname, onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);
  const activeRole = useAuthStore((s) => s.activeRole);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));
  // No alcanza con tener el rol asignado — "Crear equipo" solo tiene
  // sentido viendo la app como entrenador ahora mismo. Con RoleSwitchToggle
  // un usuario puede tener ambos roles y estar activo como corredor.
  const canCreateTeam = hasTrainerRole && activeRole === 'trainer';

  // activeRole, no un userRole estático que nunca llegó a existir en el
  // modelo real (el backend no trackea "el" rol, solo el conjunto
  // asignado) — así "Mis planes"/"Planes de entrenamiento" cambian solos
  // al switchear de rol, igual que el resto de los gates de esta pantalla.
  const routes = getRoutesByRole(activeRole);

  const teams = useTeamStore((s) => s.teams);
  const fetchTeams = useTeamStore((s) => s.fetchTeams);
  const myMemberTeams = useTeamStore((s) => s.myMemberTeams);
  const fetchMyMemberTeams = useTeamStore((s) => s.fetchMyMemberTeams);
  const administeredTeams = selectAdministeredTeams(teams, user?.userId);
  // Entrenador ve lo que administra, corredor lo que integra — ver
  // store/team-store.js#fetchMyMemberTeams.
  const myTeams = activeRole === 'trainer' ? administeredTeams : myMemberTeams;
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
  const [teamsExpanded, setTeamsExpanded] = useState(false);
  const fetchMyInvitations = useTeamStore((s) => s.fetchMyInvitations);
  const myInvitationsCount = useTeamStore((s) => s.myInvitations.length);
  const pendingRequestsCount = usePendingRequestsCount(activeRole === 'trainer');
  const notificationsBadgeCount = activeRole === 'trainer' ? pendingRequestsCount : myInvitationsCount;

  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeRole === 'trainer' || !user?.userId) return;
    fetchMyMemberTeams(user.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, user?.userId]);

  useEffect(() => {
    if (!user?.userId) return undefined;
    fetchMyInvitations(user.userId, user.email);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.email]);

  const translateX = useSharedValue(-width);

  useEffect(() => {
    translateX.value = withTiming(open ? 0 : -width, ANIMATION_CONFIG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, width]);

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

  // Sin backend de equipos todavía: elegir un equipo guarda la selección
  // local y navega a su detalle (/teams/[teamId]); crear equipo navega a
  // su propia pantalla (/teams/create).
  const handleSelectTeam = (team) => {
    selectTeam(team.id);
    onClose();
    router.push(`/teams/${team.id}`);
  };

  const handleCreateTeam = () => {
    onClose();
    router.push('/teams/create');
  };

  const handleViewAllTeams = () => {
    onClose();
    router.push('/teams');
  };

  // logout() ahora pega al backend (revoca el refresh token) antes de
  // limpiar el estado local — sin esperar esa promesa, el replace a '/'
  // corría con el usuario todavía autenticado en el store y la ruta raíz
  // mostraba Home un instante antes de reaccionar al logout real.
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    onClose();
    router.replace('/');
  };

  return (
    <Animated.View
      nativeID="web-narrow-drawer-panel"
      style={[
        { position: 'absolute', top: 0, bottom: 0, left: 0, width, zIndex: 60 },
        drawerAnimatedStyle,
      ]}
      testID="web-narrow-drawer-panel"
    >
      <View className="flex-1 bg-white dark:bg-surface" nativeID="web-narrow-drawer" testID="web-narrow-drawer">
        <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']} nativeID="web-narrow-drawer-safe-area" testID="web-narrow-drawer-safe-area">
          <View className="flex-1" nativeID="web-narrow-drawer-body" style={{ paddingTop: 60 }} testID="web-narrow-drawer-body">
            {user ? (
              <>
                <Pressable
                  className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-4 hover:bg-slate-100 active:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800"
                  nativeID="web-narrow-drawer-profile-row"
                  onPress={() => goTo('/profile')}
                  testID="web-narrow-drawer-profile-row"
                >
                  <AvatarPicker
                    accessibilityLabel="Ver perfil"
                    fallbackIcon="account"
                    idPrefix="web-narrow-drawer-profile-avatar"
                    initials={getUserInitials(user)}
                    size={40}
                    uri={user.photoUrl}
                  />
                  <View className="flex-1 flex-row items-center gap-2" nativeID="web-narrow-drawer-profile-info" testID="web-narrow-drawer-profile-info">
                    <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="web-narrow-drawer-user-name" testID="web-narrow-drawer-user-name">{user.name}</Text>
                    <RoleBadge role={activeRole} />
                  </View>
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={20} />
                </Pressable>

                <Pressable
                  className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-4 hover:bg-slate-100 active:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800"
                  nativeID="web-narrow-drawer-settings-row"
                  onPress={() => goTo('/settings')}
                  testID="web-narrow-drawer-settings-row"
                >
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800" nativeID="web-narrow-drawer-settings-icon" testID="web-narrow-drawer-settings-icon">
                    <MaterialCommunityIcons color={colors.primary} name="cog-outline" size={20} />
                  </View>
                  <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID="web-narrow-drawer-settings-label" testID="web-narrow-drawer-settings-label">Settings</Text>
                </Pressable>
              </>
            ) : (
              <View className="border-b border-slate-200 px-5 py-4 dark:border-slate-800" nativeID="web-narrow-drawer-guest-row" testID="web-narrow-drawer-guest-row">
                <Pressable
                  className="h-11 items-center justify-center rounded-full bg-primary hover:opacity-90 active:opacity-80"
                  nativeID="web-narrow-drawer-login-button"
                  onPress={() => { router.push('/login'); onClose(); }}
                  testID="web-narrow-drawer-login-button"
                >
                  <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="web-narrow-drawer-login-button-label" testID="web-narrow-drawer-login-button-label">Ingresar</Text>
                </Pressable>
              </View>
            )}

            {user && hasTrainerRole && (
              <View className="items-center border-b border-slate-200 px-5 py-4 dark:border-slate-800" nativeID="web-narrow-drawer-role-switch-row" testID="web-narrow-drawer-role-switch-row">
                <RoleSwitchToggle onClose={onClose} showTierLink={false} wide />
              </View>
            )}

            <View className="flex-row items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800" nativeID="web-narrow-drawer-theme-row" testID="web-narrow-drawer-theme-row">
              <View className="flex-row items-center gap-3" nativeID="web-narrow-drawer-theme-label-group" testID="web-narrow-drawer-theme-label-group">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="theme-light-dark" size={20} />
                <Text className="text-sm font-medium text-slate-700 dark:text-slate-200" nativeID="web-narrow-drawer-theme-label" testID="web-narrow-drawer-theme-label">Tema</Text>
              </View>
              <ThemeToggle />
            </View>

            {user && (
              <ScrollView className="flex-1 px-2 py-4" nativeID="web-narrow-drawer-routes" testID="web-narrow-drawer-routes">
                {routes.map((route) => {
                  if (route.name === 'teams') {
                    return (
                      <TeamsAccordion
                        key={route.name}
                        colors={colors}
                        expanded={teamsExpanded}
                        icon={route.icon}
                        label={route.label}
                        onCreateTeam={canCreateTeam ? handleCreateTeam : undefined}
                        onSelectTeam={handleSelectTeam}
                        onToggle={() => setTeamsExpanded((v) => !v)}
                        onViewAll={handleViewAllTeams}
                        selectedTeamId={selectedTeamId}
                        teams={myTeams}
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
                      nativeID={`web-narrow-drawer-route-${route.name}`}
                      onPress={() => goTo(route.href)}
                      testID={`web-narrow-drawer-route-${route.name}`}
                    >
                      <View className="relative" nativeID={`web-narrow-drawer-route-${route.name}-icon-wrapper`} testID={`web-narrow-drawer-route-${route.name}-icon-wrapper`}>
                        <MaterialCommunityIcons
                          color={isActive ? colors.primary : colors.onSurfaceVariant}
                          name={route.icon ?? 'circle-small'}
                          size={22}
                        />
                        {route.name === 'notifications' && notificationsBadgeCount > 0 && (
                          <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="web-narrow-drawer-route-notifications-badge" testID="web-narrow-drawer-route-notifications-badge" />
                        )}
                      </View>
                      <Text
                        className={`text-sm font-semibold ${
                          isActive ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
                        }`}
                        nativeID={`web-narrow-drawer-route-label-${route.name}`}
                        testID={`web-narrow-drawer-route-label-${route.name}`}
                      >
                        {route.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {user && (
              <View className="border-t border-slate-200 p-3 dark:border-slate-800" nativeID="web-narrow-drawer-logout-row" testID="web-narrow-drawer-logout-row">
                <Pressable
                  className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-red-50 active:opacity-80 dark:hover:bg-red-900/20 disabled:opacity-60"
                  disabled={loggingOut}
                  nativeID="web-narrow-drawer-logout-button"
                  onPress={handleLogout}
                  testID="web-narrow-drawer-logout-button"
                >
                  {loggingOut ? (
                    <ActivityIndicator color={colors.error} size="small" />
                  ) : (
                    <MaterialCommunityIcons color={colors.error} name="logout" size={20} />
                  )}
                  <Text className="text-sm font-semibold text-red-600 dark:text-red-400" nativeID="web-narrow-drawer-logout-label" testID="web-narrow-drawer-logout-label">
                    {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Animated.View>
  );
}

export function AppWebShellNarrow({ children, pathname }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-surface"
      edges={['top', 'left', 'right']}
      nativeID="app-web-shell-narrow"
      testID="app-web-shell-narrow"
    >
      <TopBarNarrow onTogglePress={() => setDrawerOpen((v) => !v)} open={drawerOpen} />
      <NavigationDrawerNarrow onClose={() => setDrawerOpen(false)} open={drawerOpen} pathname={pathname} />
      <View className="flex-1" nativeID="app-web-shell-narrow-content" testID="app-web-shell-narrow-content">{children}</View>
    </SafeAreaView>
  );
}
