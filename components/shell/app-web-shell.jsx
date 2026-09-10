import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { PaceronBrand } from '../brand/paceron-brand.jsx';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRoutesByRole } from '../../routes/catalog.js';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser, usePermissions } from '../../hooks/use-user.js';
import { useMyInvitations } from '../../hooks/use-invitations.js';
import { ThemeToggle } from '../theme/theme-toggle.jsx';
import { RoleBadge } from './role-badge.jsx';
import { RoleSwitchToggle } from '../profile/role-switch-toggle.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { getUserInitials } from '../../utils/user-initials.js';
import { usePendingRequestsCount } from '../../hooks/use-join-requests.js';

function DropdownMenu({ onClose }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { roles } = usePermissions(userId);
  const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
  const [loggingOut, setLoggingOut] = useState(false);

  // logout() ahora pega al backend (revoca el refresh token) antes de
  // limpiar el estado local — sin esperar esa promesa, el replace a '/'
  // corría con el usuario todavía autenticado en el store y la ruta raíz
  // mostraba Home un instante antes de reaccionar al logout real.
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await useAuthStore.getState().logout();
    setLoggingOut(false);
    onClose();
    router.replace('/');
  };

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

        <View className="mx-4 border-t border-slate-100 dark:border-slate-800" nativeID="web-shell-dropdown-divider-settings-above" testID="web-shell-dropdown-divider-settings-above" />

        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-150"
          nativeID="web-shell-dropdown-settings-link"
          onPress={() => { router.push('/settings'); onClose(); }}
          testID="web-shell-dropdown-settings-link"
        >
          <MaterialCommunityIcons name="cog-outline" size={18} color={colors.onSurfaceVariant} />
          <Text className="flex-1 text-sm font-medium text-slate-900 dark:text-white" nativeID="web-shell-dropdown-settings-link-label" testID="web-shell-dropdown-settings-link-label">Ajustes</Text>
        </Pressable>

        <View className="mx-4 border-t border-slate-100 dark:border-slate-800" nativeID="web-shell-dropdown-divider-profile" testID="web-shell-dropdown-divider-profile" />

        <Pressable
          className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-50 dark:active:bg-red-900/20 transition-colors duration-150 disabled:opacity-60"
          disabled={loggingOut}
          nativeID="web-shell-dropdown-logout"
          onPress={handleLogout}
          testID="web-shell-dropdown-logout"
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <MaterialCommunityIcons name="logout" size={18} color={colors.error} />
          )}
          <Text className="text-sm font-semibold text-red-600 dark:text-red-400" nativeID="web-shell-dropdown-logout-label" testID="web-shell-dropdown-logout-label">
            {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TopBar({ isGuest, userName, userPhotoUrl, userInitials, activeRole, dropdownOpen, routesTab, activeTab, notificationsBadgeCount, onTabPress, onUserPress }) {
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
            {routesTab.filter((route) => route.name !== 'notifications').map((route) => {
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
                    color={isActive ? colors.primary : colors.onSurfaceVariant}
                    name={route.icon}
                    size={16}
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
          <>
            <Pressable
              accessibilityLabel="Notificaciones"
              className="relative rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="web-shell-topbar-notifications-button"
              onPress={() => router.push('/notifications')}
              testID="web-shell-topbar-notifications-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="bell-outline" size={20} />
              {notificationsBadgeCount > 0 && (
                <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" nativeID="web-shell-topbar-notifications-badge" testID="web-shell-topbar-notifications-badge" />
              )}
            </Pressable>
            <Pressable
              className={`ml-1 flex-row items-center gap-2 rounded-lg p-1.5 transition-colors duration-150 ${
                dropdownOpen ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800'
              }`}
              nativeID="web-shell-topbar-user-pill"
              onPress={handleUserPress}
              testID="web-shell-topbar-user-pill"
            >
              <AvatarPicker
                accessibilityLabel={userName ? `Menú de ${userName}` : 'Menú de usuario'}
                fallbackIcon="account"
                idPrefix="web-shell-topbar-user-avatar"
                initials={userInitials}
                size={32}
                uri={userPhotoUrl}
              />
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
          </>
        )}
      </View>
    </View>
  );
}

export function AppWebShell({ children, pathname }) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  // isGuest se basa en userId (sesión), no en user (perfil, todavía
  // cargando en el momento del mount) — con user habría un flash de
  // "invitado" mientras useUser resuelve, mismo riesgo que
  // components/guards/require-auth.jsx.
  const isGuest = !userId;
  const userName = user?.name || null;
  const userPhotoUrl = user?.photoUrl || null;
  const userInitials = user ? getUserInitials(user) : '';
  const activeRole = useAuthStore((s) => s.activeRole);
  // activeRole, no un userRole estático que nunca llegó a existir en el
  // modelo real — así "Mis planes"/"Planes de entrenamiento" cambian solos
  // al switchear de rol, igual que el resto de los gates de esta pantalla.
  const routesTab = getRoutesByRole(activeRole);
  const [activeTab, setActiveTab] = useState(pathname);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { invitations: myInvitations } = useMyInvitations(user?.userId, user?.email);
  const myInvitationsCount = myInvitations.length;
  const pendingRequestsCount = usePendingRequestsCount(activeRole === 'trainer');
  const notificationsBadgeCount = activeRole === 'trainer' ? pendingRequestsCount : myInvitationsCount;

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
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="web-shell-safe-area" testID="web-shell-safe-area">
      <View className="flex-1" nativeID="web-shell-root" testID="web-shell-root">
        <TopBar
          activeRole={activeRole}
          activeTab={activeTab}
          dropdownOpen={dropdownOpen}
          isGuest={isGuest}
          notificationsBadgeCount={notificationsBadgeCount}
          onTabPress={handleTabPress}
          onUserPress={handleUserPress}
          routesTab={routesTab}
          userInitials={userInitials}
          userName={userName}
          userPhotoUrl={userPhotoUrl}
        />
        {!isGuest && (
          <AnimatedDropdown anchorStyle={{ right: 16, top: 60 }} open={dropdownOpen} onClose={handleCloseDropdown}>
            <DropdownMenu onClose={handleCloseDropdown} />
          </AnimatedDropdown>
        )}
        <View className="flex-1" nativeID="web-shell-content" testID="web-shell-content">{children}</View>
      </View>
    </SafeAreaView>
  );
}
