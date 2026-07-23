import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { getRoutesByRole } from '../../routes/catalog.js';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore } from '../../store/team-store.js';
import { ThemeToggle } from '../theme/theme-toggle.jsx';
import { RoleBadge } from './role-badge.jsx';
import { RoleSwitchToggle } from '../profile/role-switch-toggle.jsx';

// Envuelve el dropdown para animar apertura/cierre (fade + slide sutil).
// Se mantiene siempre montado (mismo patrón que el drawer mobile) para que
// la animación de salida se vea; cuando está cerrado, pointerEvents 'none'
// evita que intercepte clicks. anchorStyle posiciona el panel (cada
// dropdown cuelga de un disparador distinto en el TopBar).
function AnimatedDropdown({ open, onClose, anchorStyle, children }) {
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
    <View className="absolute inset-0 z-50" nativeID="web-shell-animated-dropdown" pointerEvents={open ? 'auto' : 'none'} testID="web-shell-animated-dropdown">
      <Pressable className="absolute inset-0" nativeID="web-shell-animated-dropdown-backdrop" onPress={onClose} testID="web-shell-animated-dropdown-backdrop" />
      <Animated.View nativeID="web-shell-animated-dropdown-panel" style={[{ position: 'absolute' }, anchorStyle, animatedStyle]} testID="web-shell-animated-dropdown-panel">
        {children}
      </Animated.View>
    </View>
  );
}

function DropdownMenu({ onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));

  return (
    <View className="w-64" nativeID="web-shell-dropdown-menu" testID="web-shell-dropdown-menu">
      {/* Nub que conecta visualmente el dropdown con el pill de usuario de arriba */}
      <View className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-surface-2" nativeID="web-shell-dropdown-menu-nub" testID="web-shell-dropdown-menu-nub" />

      <View className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-surface-2" nativeID="web-shell-dropdown-menu-panel" testID="web-shell-dropdown-menu-panel">
        {hasTrainerRole && (
          <>
            <View className="items-center px-3 py-3" nativeID="web-shell-dropdown-role-switch-row" testID="web-shell-dropdown-role-switch-row">
              <RoleSwitchToggle onClose={onClose} />
            </View>
            <View className="mx-4 border-t border-slate-100 dark:border-slate-800" nativeID="web-shell-dropdown-divider-role" testID="web-shell-dropdown-divider-role" />
          </>
        )}

        <View className="flex-row items-center justify-between px-4 py-3.5" nativeID="web-shell-dropdown-theme-row" testID="web-shell-dropdown-theme-row">
          <View className="flex-row items-center gap-3" nativeID="web-shell-dropdown-theme-label-group" testID="web-shell-dropdown-theme-label-group">
            <MaterialCommunityIcons name="theme-light-dark" size={18} color={colors.onSurfaceVariant} />
            <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="web-shell-dropdown-theme-label" testID="web-shell-dropdown-theme-label">Tema</Text>
          </View>
          <ThemeToggle />
        </View>

        <View className="mx-4 border-t border-slate-100 dark:border-slate-800" nativeID="web-shell-dropdown-divider-theme" testID="web-shell-dropdown-divider-theme" />

        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-150"
          nativeID="web-shell-dropdown-profile-link"
          onPress={() => { router.push('/profile'); onClose(); }}
          testID="web-shell-dropdown-profile-link"
        >
          <MaterialCommunityIcons name="account-circle" size={18} color={colors.onSurfaceVariant} />
          <Text className="flex-1 text-sm font-medium text-slate-900 dark:text-white" nativeID="web-shell-dropdown-profile-link-label" testID="web-shell-dropdown-profile-link-label">Ver perfil</Text>
        </Pressable>

        <View className="mx-4 border-t border-slate-100 dark:border-slate-800" nativeID="web-shell-dropdown-divider-profile" testID="web-shell-dropdown-divider-profile" />

        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-50 dark:active:bg-red-900/20 transition-colors duration-150"
          nativeID="web-shell-dropdown-logout"
          onPress={() => { useAuthStore.getState().logout(); onClose(); }}
          testID="web-shell-dropdown-logout"
        >
          <MaterialCommunityIcons name="logout" size={18} color={colors.error} />
          <Text className="text-sm font-semibold text-red-600 dark:text-red-400" nativeID="web-shell-dropdown-logout-label" testID="web-shell-dropdown-logout-label">Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Sin backend de equipos todavía: elegir un equipo o crear uno nuevo solo
// guarda selección local y avisa por toast — no navega a una pantalla propia.
function TeamsMenu({ onClose }) {
  const colors = useThemeColors();
  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);

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
    <View className="w-64" nativeID="web-shell-teams-menu" testID="web-shell-teams-menu">
      <View className="absolute -top-1.5 left-6 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-surface-2" nativeID="web-shell-teams-menu-nub" testID="web-shell-teams-menu-nub" />

      <View className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-surface-2" nativeID="web-shell-teams-menu-panel" testID="web-shell-teams-menu-panel">
        {teams.length === 0 && (
          <Text className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400" nativeID="web-shell-teams-menu-empty" testID="web-shell-teams-menu-empty">Todavía no tenés equipos.</Text>
        )}

        {teams.map((team) => {
          const isSelected = team.id === selectedTeamId;
          return (
            <Pressable
              key={team.id}
              className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-150"
              nativeID={`web-shell-teams-menu-team-${team.id}`}
              onPress={() => handleSelectTeam(team)}
              testID={`web-shell-teams-menu-team-${team.id}`}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={18}
                color={isSelected ? colors.primary : colors.onSurfaceVariant}
              />
              <Text
                className={`flex-1 text-sm ${
                  isSelected ? 'font-semibold text-primary' : 'font-medium text-slate-900 dark:text-white'
                }`}
                nativeID={`web-shell-teams-menu-team-label-${team.id}`}
                testID={`web-shell-teams-menu-team-label-${team.id}`}
              >
                {team.name}
              </Text>
              {isSelected && <MaterialCommunityIcons color={colors.primary} name="check" size={16} />}
            </Pressable>
          );
        })}

        <View className="mx-4 border-t border-slate-100 dark:border-slate-800" nativeID="web-shell-teams-menu-divider" testID="web-shell-teams-menu-divider" />

        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-150"
          nativeID="web-shell-teams-menu-create"
          onPress={handleCreateTeam}
          testID="web-shell-teams-menu-create"
        >
          <MaterialCommunityIcons name="plus-circle" size={18} color={colors.primary} />
          <Text className="text-sm font-semibold text-primary" nativeID="web-shell-teams-menu-create-label" testID="web-shell-teams-menu-create-label">Crear equipo</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Tab con submenu propio (a diferencia de los demás, no navega directo al
// presionar). Mide su propia posición en pantalla para anclar el dropdown.
function TeamsTab({ route, isOpen, colors, onOpen }) {
  const ref = useRef(null);

  const handlePress = () => {
    ref.current?.measureInWindow((x, y, width, height) => {
      onOpen({ x, y, width, height });
    });
  };

  return (
    <Pressable
      ref={ref}
      className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors duration-150 ${
        isOpen
          ? 'bg-slate-100 dark:bg-slate-800'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800'
      }`}
      nativeID={`web-shell-nav-tab-${route.name}`}
      onPress={handlePress}
      testID={`web-shell-nav-tab-${route.name}`}
    >
      <MaterialCommunityIcons name={route.icon} size={16} color={colors.onSurfaceVariant} />
      <Text
        className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
        nativeID={`web-shell-nav-tab-label-${route.name}`}
        testID={`web-shell-nav-tab-label-${route.name}`}
      >
        {route.label}
      </Text>
      <MaterialCommunityIcons
        name={isOpen ? 'chevron-up' : 'chevron-down'}
        size={14}
        color={colors.onSurfaceVariant}
      />
    </Pressable>
  );
}

function TopBar({ isGuest, userName, activeRole, dropdownOpen, routesTab, activeTab, teamsMenuOpen, onTabPress, onUserPress, onTeamsPress }) {
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
    <View className="h-[60px] w-full flex-row items-center bg-white px-3 dark:bg-surface border-b border-slate-200 dark:border-slate-800" nativeID="web-shell-topbar" testID="web-shell-topbar">
      <Pressable
        className="flex-row items-center gap-2 shrink-0"
        nativeID="web-shell-topbar-brand"
        onPress={() => router.replace('/')}
        testID="web-shell-topbar-brand"
      >
        <Image
          accessibilityLabel="Paceron"
          nativeID="web-shell-topbar-brand-logo"
          resizeMode="contain"
          source={require('../../assets/paceron-symbol-transparent.png')}
          style={{ width: 32, height: 32 }}
          testID="web-shell-topbar-brand-logo"
        />
        <PaceronBrand size={16} />
      </Pressable>

      {!isGuest && routesTab && (
        <View className="mx-3 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-800" nativeID="web-shell-topbar-divider" testID="web-shell-topbar-divider" />
      )}

      {!isGuest && routesTab ? (
        <View className="flex-1 flex-row items-center overflow-hidden" nativeID="web-shell-nav-tabs" testID="web-shell-nav-tabs">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 4 }}
            nativeID="web-shell-nav-tabs-scroll"
            testID="web-shell-nav-tabs-scroll"
          >
            {routesTab.map((route) => {
              if (route.name === 'equipos') {
                return (
                  <TeamsTab key={route.name} colors={colors} isOpen={teamsMenuOpen} onOpen={onTeamsPress} route={route} />
                );
              }

              const isActive = activeTab === route.href;
              return (
                <Pressable
                  key={route.name}
                  className={`flex-row items-center gap-1.5 rounded-lg px-3 py-1.5 ${
                    isActive
                      ? 'bg-primary-tint-subtle dark:bg-primary/10'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800'
                  }`}
                  nativeID={`web-shell-nav-tab-${route.name}`}
                  onPress={() => onTabPress?.(route.href)}
                  testID={`web-shell-nav-tab-${route.name}`}
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
                    nativeID={`web-shell-nav-tab-label-${route.name}`}
                    testID={`web-shell-nav-tab-label-${route.name}`}
                  >
                    {route.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View className="flex-1" nativeID="web-shell-nav-tabs-spacer" testID="web-shell-nav-tabs-spacer" />
      )}

      <View className="flex-row items-center shrink-0" nativeID="web-shell-topbar-actions" testID="web-shell-topbar-actions">
        {isGuest ? (
          <View className="flex-row items-center gap-3" nativeID="web-shell-topbar-guest-actions" testID="web-shell-topbar-guest-actions">
            <ThemeToggle />
            <Pressable
              className="rounded-full bg-primary px-5 py-2 active:opacity-80"
              nativeID="web-shell-topbar-login-button"
              onPress={() => router.push('/login')}
              testID="web-shell-topbar-login-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="web-shell-topbar-login-button-label" testID="web-shell-topbar-login-button-label">
                Ingresar
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            className={`flex-row items-center gap-2 rounded-lg p-1.5 transition-colors duration-150 ${
              dropdownOpen ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800'
            }`}
            nativeID="web-shell-topbar-user-pill"
            onPress={handleUserPress}
            testID="web-shell-topbar-user-pill"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-tint-subtle dark:bg-primary/10" nativeID="web-shell-topbar-user-avatar" testID="web-shell-topbar-user-avatar">
              <MaterialCommunityIcons
                color={colors.primary}
                name="account-circle"
                size={20}
              />
            </View>
            {userName && (
              <Text className="text-sm font-medium text-slate-900 dark:text-white" nativeID="web-shell-topbar-user-name" testID="web-shell-topbar-user-name">
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
  const [teamsMenuOpen, setTeamsMenuOpen] = useState(false);
  const [teamsAnchor, setTeamsAnchor] = useState({ x: 0, y: 60, width: 0, height: 0 });

  useEffect(() => {
    setActiveTab(pathname);
  }, [pathname]);

  useEffect(() => {
    setDropdownOpen(false);
    setTeamsMenuOpen(false);
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

  const handleTeamsPress = (anchor) => {
    setTeamsAnchor(anchor);
    setTeamsMenuOpen(true);
  };

  const handleCloseTeamsMenu = () => {
    setTeamsMenuOpen(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="web-shell-safe-area" testID="web-shell-safe-area">
      <View className="flex-1" nativeID="web-shell-root" testID="web-shell-root">
        <TopBar
          activeRole={activeRole}
          activeTab={activeTab}
          dropdownOpen={dropdownOpen}
          isGuest={isGuest}
          onTabPress={handleTabPress}
          onTeamsPress={handleTeamsPress}
          onUserPress={handleUserPress}
          routesTab={routesTab}
          teamsMenuOpen={teamsMenuOpen}
          userName={userName}
        />
        {!isGuest && (
          <AnimatedDropdown anchorStyle={{ right: 16, top: 60 }} open={dropdownOpen} onClose={handleCloseDropdown}>
            <DropdownMenu onClose={handleCloseDropdown} />
          </AnimatedDropdown>
        )}
        {!isGuest && (
          <AnimatedDropdown
            anchorStyle={{ left: teamsAnchor.x, top: teamsAnchor.y + teamsAnchor.height + 8 }}
            open={teamsMenuOpen}
            onClose={handleCloseTeamsMenu}
          >
            <TeamsMenu onClose={handleCloseTeamsMenu} />
          </AnimatedDropdown>
        )}
        <View className="flex-1" nativeID="web-shell-content" testID="web-shell-content">{children}</View>
      </View>
    </SafeAreaView>
  );
}
