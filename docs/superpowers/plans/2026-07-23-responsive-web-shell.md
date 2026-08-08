# Web responsivo: un solo bundle web para desktop y mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El bundle web (`isWeb`) deja de asumir desktop-only — un hook de breakpoint (`useIsNarrowWeb()`, 1024px) decide en JS si montar el shell/landing anchos actuales (sin cambios) o una variante angosta nueva (hamburguesa + drawer), sin depender de detectar el user-agent ni bloquear nada.

**Architecture:** Dos componentes nuevos y dedicados a web angosto (`AppWebShellNarrow`, `HomeWebNarrowScreen`), independientes de los componentes de la app nativa compilada (`AppMobileShell`, `HomeMobileScreen`, que no se tocan salvo extraerles una pieza puramente presentacional compartida). El breakpoint se decide con `useWindowDimensions()` de React Native, nunca con clases responsive de NativeWind (esas son CSS-only, no sirven para decidir qué estructura montar). El gate de `isMobileBrowser()` (branch `feature/mobile-browser-web-gate`, ya en `develop`) se elimina al final, una vez que la alternativa responsive ya funciona.

**Tech Stack:** Expo Router (file-based), React Native Web, NativeWind, react-native-reanimated, Zustand.

## Global Constraints

- Breakpoint: **1024px** (`useWindowDimensions().width < 1024` = angosto). Única fuente de verdad: el hook de la Task 1, no se hardcodea el número en otro lado.
- Todo `View`/`Text`/`Pressable`/etc. nuevo lleva `nativeID` + `testID` (regla obligatoria del proyecto, `eslint.config.js` la hace fallar el build si falta).
- No hay tests de render de componentes en este proyecto (convención ya establecida) — la verificación de cada task es `npm run lint` + `npm test` (33/33, sin tests nuevos) + chequeo visual en preview donde aplique.
- Commits chicos, uno por task — no mezclar todo en un diff gigante (mismo criterio ya usado en `feature/button-hover-consistency` y el backfill de `nativeID`).
- La app nativa compilada (`Platform.OS !== 'web'`) no cambia de comportamiento en ningún momento de este plan.

Spec completa: `docs/superpowers/specs/2026-07-23-responsive-web-shell-design.md`.

---

### Task 1: Hook de breakpoint compartido

**Files:**
- Create: `hooks/use-is-narrow-web.js`

**Interfaces:**
- Produces: `useIsNarrowWeb()` — hook sin argumentos, devuelve `boolean` (`true` = viewport angosto, < 1024px). Usado por las Tasks 4 y 6.

- [ ] **Step 1: Crear el hook**

```js
import { useWindowDimensions } from 'react-native';

// Breakpoint único para todo el shell/landing responsive de web — no
// confundir con los prefijos sm:/md:/lg: de NativeWind (esos son CSS,
// sin equivalente en nativo; acá se decide en JS qué estructura montar,
// no solo qué clase aplicar). Ver
// docs/superpowers/specs/2026-07-23-responsive-web-shell-design.md.
const NARROW_WEB_BREAKPOINT = 1024;

export function useIsNarrowWeb() {
  const { width } = useWindowDimensions();
  return width < NARROW_WEB_BREAKPOINT;
}
```

- [ ] **Step 2: Verificar**

```bash
npm run lint
```
Esperado: 0 errores (el hook no tiene JSX, no aplica la regla de `nativeID`).

- [ ] **Step 3: Commit**

```bash
git add hooks/use-is-narrow-web.js
git commit -m "feat(web): add shared narrow-web breakpoint hook"
```

---

### Task 2: Extraer `TeamsAccordion` a un componente compartido

**Files:**
- Create: `components/shell/teams-accordion.jsx`
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Produces: `TeamsAccordion({ expanded, onToggle, teams, selectedTeamId, onSelectTeam, onCreateTeam, colors, icon, label })` — mismo contrato que ya tenía como función interna de `app-mobile-shell.jsx`, ahora exportado. Usado por `app-mobile-shell.jsx` (Task 2) y `app-web-shell-narrow.jsx` (Task 3).

Refactor puro — cero cambio de comportamiento, solo mueve código de lugar.

- [ ] **Step 1: Crear `components/shell/teams-accordion.jsx`**

```jsx
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ACCORDION_CONFIG = { duration: 220, easing: Easing.out(Easing.cubic) };

// Ítem "Equipos" de un drawer de navegación: acordeón que expande/contrae
// la lista de equipos. Puramente presentacional (Reanimated +
// View/Pressable/Text, nada nativo-específico) — compartido a propósito
// entre AppMobileShell (nativo) y AppWebShellNarrow (web angosto), ver
// docs/superpowers/specs/2026-07-23-responsive-web-shell-design.md.
//
// Usa las animaciones de entrada/salida de Reanimated (maneja la
// transición de altura sola al montar/desmontar, más confiable que medir
// con onLayout y animar una altura manual) y rota un único ícono de
// chevron en vez de intercambiar dos íconos.
// El estado "expandido" usa un highlight neutro (no el verde de ruta
// activa) — si estuviera en la misma paleta que una ruta activa, con el
// acordeón abierto en home parecería que hay dos accesos seleccionados a
// la vez (mismo bug ya corregido en el header web ancho).
export function TeamsAccordion({ expanded, onToggle, teams, selectedTeamId, onSelectTeam, onCreateTeam, colors, icon, label }) {
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
        <Animated.View nativeID="teams-accordion-chevron" style={chevronStyle} testID="teams-accordion-chevron">
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
          <View className="ml-6 gap-0.5 border-l border-slate-200 pl-3 dark:border-slate-800" nativeID="teams-accordion-list" testID="teams-accordion-list">
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
                  <Text
                    className={`flex-1 text-sm ${isSelected ? 'font-semibold text-primary' : 'text-slate-600 dark:text-slate-300'}`}
                    nativeID={`teams-accordion-team-label-${team.id}`}
                    testID={`teams-accordion-team-label-${team.id}`}
                  >
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
              <Text className="text-sm font-semibold text-primary" nativeID="teams-accordion-create-label" testID="teams-accordion-create-label">Crear equipo</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Editar `components/shell/app-mobile-shell.jsx`** — reemplazar el bloque de imports + quitar la función `TeamsAccordion` + su constante `ACCORDION_CONFIG`.

Buscar (líneas 1–30 actuales):
```jsx
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
```

Reemplazar por:
```jsx
import { useEffect, useState } from 'react';
import { BackHandler, Dimensions, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
import { TeamsAccordion } from './teams-accordion.jsx';

const isWeb = Platform.OS === 'web';
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH;
const ANIMATION_CONFIG = { duration: 280, easing: Easing.out(Easing.cubic) };
```

- [ ] **Step 3: Borrar la función `TeamsAccordion` completa** (el bloque que arranca en el comentario `// Ítem "Equipos" del drawer...` y termina en el `}` que cierra la función, justo antes de `function TopAppBar`). Todo el resto del archivo (`TopAppBar`, `NavigationDrawer`, `AppMobileShell`) queda exactamente igual — `NavigationDrawer` ya invoca `<TeamsAccordion .../>` de la misma forma, ahora resuelto vía import en vez de definición local.

- [ ] **Step 4: Verificar**

```bash
npm run lint
npm test -- --silent
```
Esperado: `npm run lint` → 0 errores. `npm test` → 33/33 (sin cambios de lógica).

- [ ] **Step 5: Commit**

```bash
git add components/shell/teams-accordion.jsx components/shell/app-mobile-shell.jsx
git commit -m "refactor(shell): extract TeamsAccordion into a shared component"
```

---

### Task 3: `AppWebShellNarrow` (hamburguesa + drawer, propio de web)

**Files:**
- Create: `components/shell/app-web-shell-narrow.jsx`

**Interfaces:**
- Consumes: `TeamsAccordion` de `components/shell/teams-accordion.jsx` (Task 2).
- Produces: `AppWebShellNarrow({ children, pathname })` — mismo contrato que `AppWebShell`/`AppMobileShell` (drop-in en `(tabs)/_layout.jsx`, Task 4).

No usa `BackHandler` (no hay botón atrás de hardware en un browser) ni el `Dimensions.get()` module-level que usa `AppMobileShell` — usa `useWindowDimensions()` reactivo, porque una ventana de browser sí puede cambiar de ancho en caliente sin recargar, a diferencia de la pantalla de un device nativo.

- [ ] **Step 1: Crear `components/shell/app-web-shell-narrow.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
import { TeamsAccordion } from './teams-accordion.jsx';

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
  const activeRole = useAuthStore((s) => s.activeRole);
  const hasTrainerRole = useAuthStore((s) => s.roles.some((r) => r.name === 'entrenador'));

  const userRole = user?.role ?? null;
  const routes = getRoutesByRole(userRole);

  const teams = useTeamStore((s) => s.teams);
  const selectedTeamId = useTeamStore((s) => s.selectedTeamId);
  const selectTeam = useTeamStore((s) => s.selectTeam);
  const [teamsExpanded, setTeamsExpanded] = useState(false);

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
              <Pressable
                className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-4 hover:bg-slate-100 active:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800"
                nativeID="web-narrow-drawer-profile-row"
                onPress={() => goTo('/profile')}
                testID="web-narrow-drawer-profile-row"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800" nativeID="web-narrow-drawer-profile-avatar" testID="web-narrow-drawer-profile-avatar">
                  <MaterialCommunityIcons color={colors.primary} name="account-circle" size={26} />
                </View>
                <View className="flex-1 flex-row items-center gap-2" nativeID="web-narrow-drawer-profile-info" testID="web-narrow-drawer-profile-info">
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID="web-narrow-drawer-user-name" testID="web-narrow-drawer-user-name">{user.name}</Text>
                  <RoleBadge role={activeRole} />
                </View>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={20} />
              </Pressable>
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
                      nativeID={`web-narrow-drawer-route-${route.name}`}
                      onPress={() => goTo(route.href)}
                      testID={`web-narrow-drawer-route-${route.name}`}
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
                  className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-red-50 active:opacity-80 dark:hover:bg-red-900/20"
                  nativeID="web-narrow-drawer-logout-button"
                  onPress={() => { logout(); onClose(); }}
                  testID="web-narrow-drawer-logout-button"
                >
                  <MaterialCommunityIcons color={colors.error} name="logout" size={20} />
                  <Text className="text-sm font-semibold text-red-600 dark:text-red-400" nativeID="web-narrow-drawer-logout-label" testID="web-narrow-drawer-logout-label">Cerrar sesión</Text>
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
```

- [ ] **Step 2: Verificar**

```bash
npm run lint
```
Esperado: 0 errores. Todavía no está wireado en ningún lado (Task 4), así que no es visualmente verificable todavía — solo lint en este paso.

- [ ] **Step 3: Commit**

```bash
git add components/shell/app-web-shell-narrow.jsx
git commit -m "feat(shell): add AppWebShellNarrow for narrow web viewports"
```

---

### Task 4: Enganchar el shell angosto en el layout de tabs

**Files:**
- Modify: `app/(tabs)/_layout.jsx`

**Interfaces:**
- Consumes: `useIsNarrowWeb()` (Task 1), `AppWebShellNarrow` (Task 3).

- [ ] **Step 1: Reemplazar el contenido completo de `app/(tabs)/_layout.jsx`**

Archivo actual completo:
```jsx
import { Slot, usePathname } from 'expo-router';
import { AppWebShell } from '../../components/shell/app-web-shell.jsx';
import { AppMobileShell } from '../../components/shell/app-mobile-shell.jsx';
import { AppLoadingScreen } from '../../components/shell/app-loading-screen.jsx';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';

export default function TabsLayout() {
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) return <AppLoadingScreen />;

  if (isWeb) {
    return (
      <AppWebShell pathname={pathname}>
        <Slot />
      </AppWebShell>
    );
  }

  return (
    <AppMobileShell pathname={pathname}>
      <Slot />
    </AppMobileShell>
  );
}
```

Reemplazar por:
```jsx
import { Slot, usePathname } from 'expo-router';
import { AppWebShell } from '../../components/shell/app-web-shell.jsx';
import { AppWebShellNarrow } from '../../components/shell/app-web-shell-narrow.jsx';
import { AppMobileShell } from '../../components/shell/app-mobile-shell.jsx';
import { AppLoadingScreen } from '../../components/shell/app-loading-screen.jsx';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';

export default function TabsLayout() {
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isNarrowWeb = useIsNarrowWeb();

  if (!hydrated) return <AppLoadingScreen />;

  if (isWeb) {
    const WebShell = isNarrowWeb ? AppWebShellNarrow : AppWebShell;
    return (
      <WebShell pathname={pathname}>
        <Slot />
      </WebShell>
    );
  }

  return (
    <AppMobileShell pathname={pathname}>
      <Slot />
    </AppMobileShell>
  );
}
```

`useIsNarrowWeb()` se llama siempre (también en la rama nativa) para no violar las reglas de hooks de React (no se puede llamar un hook condicionalmente) — es seguro, `useWindowDimensions()` funciona en cualquier plataforma, simplemente no se usa su valor fuera de la rama web.

- [ ] **Step 2: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 33/33.

- [ ] **Step 3: Verificar visualmente en preview**

Arrancar el preview web, loguearse (usuario mock), y:
1. Con la ventana ancha (>1024px): confirmar que se ve el header con tabs de siempre (`AppWebShell`), sin cambios.
2. Redimensionar a un ancho angosto (ej. 500px) con `preview_resize`: confirmar que aparece el `AppWebShellNarrow` (topbar con hamburguesa, sin tabs).
3. Tocar el botón de hamburguesa: confirmar que el drawer se abre, muestra perfil/tema/rutas/Equipos (acordeón)/logout, y que Equipos expande/contrae igual que en el drawer nativo.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/_layout.jsx"
git commit -m "feat(shell): switch to AppWebShellNarrow below 1024px on web"
```

---

### Task 5: `HomeWebNarrowScreen` (landing angosta web, con CTAs funcionando)

**Files:**
- Create: `components/home/home-web-narrow-screen.jsx`

**Interfaces:**
- Consumes: `HERO_CONTENT`, `FEATURES`, `AI_PANEL_CONTENT`, `AUDIENCE_CARDS` de `components/home/landing-content.js` (ya existe, sin cambios).
- Produces: `HomeWebNarrowScreen()` — sin props, usado por `app/(tabs)/index.web.jsx` (Task 6).

A diferencia de la landing placeholder que se elimina en la Task 7, esta pantalla **sí** tiene los CTAs funcionando (Empezar ahora → `/register`, Ingresar → `/login`) — mobile web pasa a ser una experiencia soportada, no bloqueada. Mismo patrón visual de card-por-feature ya usado en `home-mobile-screen.jsx` (boxes con borde, no filas planas).

- [ ] **Step 1: Crear `components/home/home-web-narrow-screen.jsx`**

```jsx
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
```

- [ ] **Step 2: Verificar**

```bash
npm run lint
```
Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add components/home/home-web-narrow-screen.jsx
git commit -m "feat(home): add HomeWebNarrowScreen for narrow web viewports"
```

---

### Task 6: Enganchar la landing angosta en `index.web.jsx`

**Files:**
- Modify: `app/(tabs)/index.web.jsx`

**Interfaces:**
- Consumes: `useIsNarrowWeb()` (Task 1), `HomeWebNarrowScreen` (Task 5).

- [ ] **Step 1: Reemplazar el contenido completo de `app/(tabs)/index.web.jsx`**

Archivo actual completo:
```jsx
import { HomeLandingScreen } from '../../components/home/home-landing-screen.jsx';
import { AuthenticatedHomeScreen } from '../../components/home/authenticated-home-screen.jsx';
import { useAuthStore } from '../../store/auth-store.js';

export default function HomeScreenWeb() {
  const user = useAuthStore((s) => s.user);
  return user ? <AuthenticatedHomeScreen /> : <HomeLandingScreen />;
}
```

Reemplazar por:
```jsx
import { HomeLandingScreen } from '../../components/home/home-landing-screen.jsx';
import { HomeWebNarrowScreen } from '../../components/home/home-web-narrow-screen.jsx';
import { AuthenticatedHomeScreen } from '../../components/home/authenticated-home-screen.jsx';
import { useAuthStore } from '../../store/auth-store.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';

export default function HomeScreenWeb() {
  const user = useAuthStore((s) => s.user);
  const isNarrowWeb = useIsNarrowWeb();

  if (user) return <AuthenticatedHomeScreen />;
  return isNarrowWeb ? <HomeWebNarrowScreen /> : <HomeLandingScreen />;
}
```

`AuthenticatedHomeScreen` (pantalla de bienvenida post-login) no cambia — es contenido mínimo ya centrado, envuelto por el shell correspondiente (Task 4), no necesita su propia variante angosta.

- [ ] **Step 2: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 33/33.

- [ ] **Step 3: Verificar visualmente en preview**

Deslogueado, con la ventana ancha: confirmar que se ve `HomeLandingScreen` de siempre. Redimensionar a angosto (`preview_resize`): confirmar que cambia a `HomeWebNarrowScreen` (cards en vez de filas, mismo contenido) y que los botones "Empezar ahora"/"Ingresar" navegan a `/register`/`/login` correctamente (a diferencia de la landing placeholder que se elimina en la próxima task, acá SÍ deben funcionar).

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/index.web.jsx"
git commit -m "feat(home): switch to HomeWebNarrowScreen below 1024px on web"
```

---

### Task 7: Eliminar el gate de `isMobileBrowser()`

**Files:**
- Modify: `app/_layout.jsx`
- Modify: `utils/platform.js`
- Delete: `components/home/mobile-browser-landing-screen.jsx`

Se hace al final a propósito — recién ahora que las Tasks 3–6 ya cubren mobile web de verdad tiene sentido sacar el bloqueo. Si se sacara antes, un browser mobile vería el shell ancho sin protección durante el resto del plan.

- [ ] **Step 1: Editar `app/_layout.jsx`** — sacar el import y el uso de `MobileBrowserLandingScreen`/`isMobileBrowser`.

Buscar:
```jsx
import { AppProviders } from '../providers/app-providers.jsx';
import { toastConfig } from '../components/feedback/paceron-toast.jsx';
import { useThemeMode } from '../providers/theme-provider.jsx';
import { RoleSwitchOverlay } from '../components/shell/role-switch-overlay.jsx';
import { MobileBrowserLandingScreen } from '../components/home/mobile-browser-landing-screen.jsx';
import { isMobileBrowser } from '../utils/platform.js';
```

Reemplazar por:
```jsx
import { AppProviders } from '../providers/app-providers.jsx';
import { toastConfig } from '../components/feedback/paceron-toast.jsx';
import { useThemeMode } from '../providers/theme-provider.jsx';
import { RoleSwitchOverlay } from '../components/shell/role-switch-overlay.jsx';
```

Buscar:
```jsx
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Orbitron_700Bold });
  if (!fontsLoaded) return null;

  // La web todavía no es 100% responsive — mientras tanto, cortamos el
  // acceso desde cualquier browser en OS mobile (Android/iOS), sin
  // excepción de ruta, y mostramos esta landing en su lugar. Va antes
  // del Stack a propósito: /login y /register son Stack.Screen hermanos
  // de (tabs), no hijos — un gate solo en (tabs)/_layout.jsx no los
  // cubriría.
  if (isMobileBrowser()) return <MobileBrowserLandingScreen />;

  return (
```

Reemplazar por:
```jsx
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Orbitron_700Bold });
  if (!fontsLoaded) return null;

  return (
```

- [ ] **Step 2: Editar `utils/platform.js`** — sacar `isMobileBrowser()`, sin consumidores después del Step 1.

Buscar:
```js
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

// Distingue "browser corriendo en un OS mobile" de isWeb (que es true
// tanto en desktop como en mobile browser). Función, no constante: debe
// evaluarse en cliente — en el prerender estático del export web
// (app.config.js -> web.output: 'static') no existe `navigator`.
// User-agent, nunca viewport/Dimensions — así no se dispara por una
// ventana de desktop angosta, solo por el OS real del visitante.
export function isMobileBrowser() {
  if (!isWeb || typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default {
  isWeb,
  isMobile,
  hasNativeSensors: isMobile,
  hasGPS: isMobile,
  canScanQR: isMobile,
};
```

Reemplazar por:
```js
import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

export default {
  isWeb,
  isMobile,
  hasNativeSensors: isMobile,
  hasGPS: isMobile,
  canScanQR: isMobile,
};
```

- [ ] **Step 3: Borrar el archivo de la landing placeholder**

```bash
git rm components/home/mobile-browser-landing-screen.jsx
```

- [ ] **Step 4: Verificar con lint y tests**

```bash
npm run lint
npm test -- --silent
```
Esperado: 0 errores, 33/33. Si lint marca algún import ahora sin uso en `app/_layout.jsx`, revisar que el Step 1 se aplicó completo.

- [ ] **Step 5: Verificar visualmente**

En preview web, confirmar que la app carga normal (ancho y angosto). El usuario verifica en el emulador Android (Chrome, `localhost:8081`) que ahora la web mobile funciona de punta a punta (antes mostraba el aviso bloqueado).

- [ ] **Step 6: Commit**

```bash
git add app/_layout.jsx utils/platform.js
git commit -m "refactor(web): remove mobile-browser gate, superseded by responsive shell"
```

---

### Task 8: Documentar la convención en `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

Refleja la decisión de que, de acá en más, toda pantalla/componente nuevo del front se construye pensando que la web debe andar en cualquier ancho de viewport.

- [ ] **Step 1: Agregar una sección nueva** (después de la sección "Theming (claro/oscuro)", antes de "Identificadores de componentes"):

```markdown
## Responsive web

La web (`isWeb`) se adapta a cualquier ancho de viewport — no hay una
versión "solo desktop". El breakpoint (1024px, `useIsNarrowWeb()` en
`hooks/use-is-narrow-web.js`) decide en JS (`useWindowDimensions()`, no
clases `sm:`/`md:`/`lg:` de NativeWind — esas son CSS-only, no sirven
para decidir qué estructura montar) entre el shell/landing anchos
(`AppWebShell`, `HomeLandingScreen`) y sus variantes angostas
(`AppWebShellNarrow`, `HomeWebNarrowScreen`). Ver
`docs/superpowers/specs/2026-07-23-responsive-web-shell-design.md` para
el detalle completo de la decisión.

La app nativa compilada (`AppMobileShell`, `HomeMobileScreen`,
`Platform.OS !== 'web'`) es independiente de todo esto — el diferencial
entre nativo y web es funcional (GPS, cámara, sensores — ver
`utils/platform.js`), no de interfaz.

**A partir de ahora:** toda pantalla o componente nuevo del front se
construye pensando en que la web debe funcionar en cualquier ancho de
viewport desde el día uno — no es un caso aparte a resolver después.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document responsive web convention"
```

---

## Verification (plan completo)

- `npm test` → 33/33 en todo momento.
- `npm run lint` → 0 errores en todo momento (incluye `nativeID`/`testID`).
- Preview web: redimensionar cruzando 1024px en `/` (landing) y en cualquier ruta autenticada (ej. `/profile`) — confirmar que shell y landing cambian de estructura en el punto justo, sin quedar a mitad de camino.
- Emulador Android (Chrome, `localhost:8081`): flujo completo — landing angosta con CTAs funcionando, registro/login, drawer con Equipos por acordeón, logout. Antes de la Task 7 mostraba el aviso bloqueado; después debe andar todo.
