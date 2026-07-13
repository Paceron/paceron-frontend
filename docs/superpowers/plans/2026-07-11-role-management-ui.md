# Role Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only (no backend yet) role system UI — a role badge next to the user's name, a "Gestión de rol" action-row to activate/switch between corredor and entrenador, and a redesigned single-control theme switch — in both the web dropdown and the mobile drawer.

**Architecture:** Role state (`activeRole`, `trainerActivated`) lives in the existing `useAuthStore`, persisted the same way the session already is. Presentational pieces are small shared components (`RoleBadge`, `RoleManagementSection`, `ActivateTrainerModal`) consumed identically by both shells; only the container markup differs (dropdown vs drawer, already separate today). `ThemeToggle` is rewritten in place (same import path, same consumers) as a single sliding switch instead of two side-by-side buttons.

**Tech Stack:** React Native + react-native-web, NativeWind (Tailwind classes), Zustand (store), react-native-reanimated (animations), Jest (store tests only — this project has no component-render tests; visual components are verified manually, matching existing project convention).

## Global Constraints

- No real backend call anywhere in this plan — `role` does not exist on the backend user model. Everything is local-only state, structured so it can be swapped for real backend data later without changing consumers.
- Role state resets to defaults (`activeRole: 'runner'`, `trainerActivated: false`) on `logout()` — a new login must not inherit another account's role.
- Colors: corredor = `bg-primary/15` / `text-primary` / icon `run-fast`, color `#8cc63e`. Entrenador = `bg-amber-500/15` / `text-amber-600 dark:text-amber-400` / icon `whistle`, color `#f59e0b`.
- "Activar perfil de entrenador" (not yet activated) uses the **same** amber/whistle styling as "Cambiar a Entrenador" — only the label text differs.
- Activating trainer profile requires a confirm/cancel modal (no text-input gate, unlike account deactivation). Switching between already-activated roles has no modal — direct action.
- `RoleManagementSection` renders first in both the web dropdown and the mobile drawer's action list (before "Ver perfil" on web; right after the user identity block on mobile).
- Theme control: single `Pressable` covering the whole track — each tap calls `toggleThemeMode()` (no picking a specific side). Label "Tema" sits above the control, centered, full width of its container — not beside it.
- No test files for visual/presentational components — this matches the existing project convention (`__tests__/` only covers store/services/validators/pure logic; `DeactivateAccountModal`, `ProfileScreen`, etc. have no dedicated test file). Only the store task (Task 1) gets Jest tests.
- Tests must stay green: `npm test` → 27/27 baseline before this work.

---

### Task 1: Store — role state and actions

**Files:**
- Modify: `store/auth-store.js`
- Test: `__tests__/auth-store.test.js`

**Interfaces:**
- Produces: store state `activeRole` (`'runner' | 'trainer'`, default `'runner'`), `trainerActivated` (`boolean`, default `false`). Actions `activateTrainerProfile()` (async, no args) and `switchRole()` (async, no args). Both persist via the existing `persist()` helper under the same `STORAGE_KEY`. `logout()` resets both to defaults.

- [ ] **Step 1: Read the current test file to match its existing mock setup**

Run: `sed -n '1,40p' __tests__/auth-store.test.js`
Expected: shows the existing `jest.mock('../services/auth.js', ...)`, `jest.mock('../services/storage.js', ...)` blocks and the `beforeEach` that resets `useAuthStore` state — the new tests must extend the same `beforeEach` reset object and use the same mocked storage.

- [ ] **Step 2: Add the failing tests**

Add to `__tests__/auth-store.test.js`, inside the existing `describe('auth store', ...)` block (or a new adjacent `describe`), using the same imports and mocked storage already set up in the file:

```js
describe('role management (local-only)', () => {
  test('starts with default role state', () => {
    const s = useAuthStore.getState();
    expect(s.activeRole).toBe('runner');
    expect(s.trainerActivated).toBe(false);
  });

  test('activateTrainerProfile sets trainerActivated, keeps role as runner', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok' });
    await useAuthStore.getState().activateTrainerProfile();
    const s = useAuthStore.getState();
    expect(s.trainerActivated).toBe(true);
    expect(s.activeRole).toBe('runner');
    expect(storage.setItem).toHaveBeenCalled();
  });

  test('switchRole toggles activeRole only when trainerActivated', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', trainerActivated: false, activeRole: 'runner' });
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('runner');

    useAuthStore.setState({ trainerActivated: true });
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('trainer');
    await useAuthStore.getState().switchRole();
    expect(useAuthStore.getState().activeRole).toBe('runner');
  });

  test('logout resets role state to defaults', async () => {
    useAuthStore.setState({ user: { userId: 1 }, token: 'tok', activeRole: 'trainer', trainerActivated: true });
    await useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.activeRole).toBe('runner');
    expect(s.trainerActivated).toBe(false);
  });
});
```

Also update the file's top-level `beforeEach` reset (the one that does `useAuthStore.setState({ user: null, token: null, ... })`) to also reset `activeRole: 'runner', trainerActivated: false`, so earlier tests in the file aren't affected by state bleed from these new ones.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- auth-store`
Expected: FAIL — `activateTrainerProfile`/`switchRole` are not defined on the store, and `activeRole`/`trainerActivated` are `undefined`.

- [ ] **Step 3: Implement in `store/auth-store.js`**

Add to the store's initial state (alongside `hydrated: false,`):

```js
  activeRole: 'runner',
  trainerActivated: false,
```

Add these two actions (place them near `deactivateAccount`, before `logout`):

```js
  // Local-only por ahora: el backend no tiene roles todavía. Estructurado
  // para que reemplazar esto por datos reales del backend no cambie la
  // interfaz que consumen los componentes.
  activateTrainerProfile: async () => {
    set({ trainerActivated: true });
    const { user, token, refreshToken, expiresAt, activeRole } = get();
    await persist({ user, token, refreshToken, expiresAt, activeRole, trainerActivated: true });
  },

  switchRole: async () => {
    const { trainerActivated, activeRole, user, token, refreshToken, expiresAt } = get();
    if (!trainerActivated) return;
    const nextRole = activeRole === 'runner' ? 'trainer' : 'runner';
    set({ activeRole: nextRole });
    await persist({ user, token, refreshToken, expiresAt, activeRole: nextRole, trainerActivated });
  },
```

Update `logout` to reset the new fields:

```js
  logout: async () => {
    set({ user: null, token: null, refreshToken: null, expiresAt: null, activeRole: 'runner', trainerActivated: false });
    await removeItem(STORAGE_KEY);
  },
```

Update `hydrate` to restore the persisted role fields (find the `set({ user: data.user ?? null, ... })` block inside `hydrate` and add the two new fields):

```js
        set({
          user: data.user ?? null,
          token: data.token ?? null,
          refreshToken: data.refreshToken ?? null,
          expiresAt: data.expiresAt ?? null,
          activeRole: data.activeRole ?? 'runner',
          trainerActivated: data.trainerActivated ?? false,
        });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- auth-store`
Expected: PASS, all cases including the pre-existing ones (no regressions).

- [ ] **Step 5: Run the full suite once**

Run: `npm test`
Expected: PASS, 27 + (new tests) total.

- [ ] **Step 6: Commit**

```bash
git add store/auth-store.js __tests__/auth-store.test.js
git commit -m "feat(roles): add local-only role state to auth store"
```

---

### Task 2: RoleBadge component

**Files:**
- Create: `components/shell/role-badge.jsx`

**Interfaces:**
- Consumes: nothing external.
- Produces: `RoleBadge({ role })` — `role` is `'runner' | 'trainer'`. Renders a small pill with the role label, colored per Global Constraints. Used by Task 6 (web) and Task 7 (mobile).

- [ ] **Step 1: Create the component**

```jsx
import { Text, View } from 'react-native';

const STYLE_BY_ROLE = {
  runner: { bg: 'bg-primary/15', text: 'text-primary', label: 'Corredor' },
  trainer: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', label: 'Entrenador' },
};

export function RoleBadge({ role }) {
  const config = STYLE_BY_ROLE[role] ?? STYLE_BY_ROLE.runner;

  return (
    <View className={`rounded-full px-2 py-0.5 ${config.bg}`}>
      <Text className={`text-xs font-semibold ${config.text}`}>{config.label}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Run the full suite (no new tests, just confirm nothing broke)**

Run: `npm test`
Expected: PASS (same count as end of Task 1 — this file isn't imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add components/shell/role-badge.jsx
git commit -m "feat(roles): add RoleBadge presentational component"
```

---

### Task 3: ActivateTrainerModal component

**Files:**
- Create: `components/shell/activate-trainer-modal.jsx`

**Interfaces:**
- Consumes: nothing external (props only).
- Produces: `ActivateTrainerModal({ visible, onCancel, onConfirm })` — `onConfirm` is an async function called on confirm; the modal shows a loading spinner on the confirm button while `onConfirm` is pending. Used by Task 4.

- [ ] **Step 1: Create the component**

Same shell/structure as `components/profile/deactivate-account-modal.jsx` (already in the codebase), but no text-input gate — just confirm/cancel:

```jsx
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Confirmación simple (sin campo de texto) para activar el perfil de
// entrenador. Acción reversible/no destructiva, a diferencia de la baja
// de cuenta — no necesita el gate de tipear el email.
export function ActivateTrainerModal({ visible, onCancel, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  const handleCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal animationType="fade" onRequestClose={handleCancel} transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-black/50 px-4">
        <View className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl dark:border-amber-900/50 dark:bg-surface">
          <View className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#f59e0b" name="whistle" size={20} />
            <Text className="text-lg font-bold text-amber-700 dark:text-amber-400">Activar perfil de entrenador</Text>
          </View>

          <Text className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Vas a poder gestionar equipos, planificar entrenamientos y alternar entre tu perfil de corredor y de
            entrenador cuando quieras.
          </Text>

          <View className="flex-row gap-3">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 active:opacity-70 dark:border-slate-700"
              disabled={loading}
              onPress={handleCancel}
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-amber-500 active:opacity-80"
              disabled={loading}
              onPress={handleConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white">Activar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS (unaffected — not imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add components/shell/activate-trainer-modal.jsx
git commit -m "feat(roles): add ActivateTrainerModal confirm/cancel dialog"
```

---

### Task 4: RoleManagementSection component

**Files:**
- Create: `components/shell/role-management-section.jsx`

**Interfaces:**
- Consumes: `useAuthStore` (`activeRole`, `trainerActivated`, `activateTrainerProfile`, `switchRole` from Task 1), `ActivateTrainerModal` from Task 3.
- Produces: `RoleManagementSection({ onClose })` — `onClose` is called after a successful activate-confirm or a direct role switch (so the caller's dropdown/drawer closes). Renders the section label + the single action-row, cross-fading its icon/text/color when the underlying state changes. Used by Task 6 (web) and Task 7 (mobile).

- [ ] **Step 1: Create the component**

```jsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { ActivateTrainerModal } from './activate-trainer-modal.jsx';

const COLOR_BY_KIND = {
  trainer: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', icon: '#f59e0b' },
  runner: { bg: 'bg-primary/15', text: 'text-primary', icon: '#8cc63e' },
};

function getRoleAction(trainerActivated, activeRole) {
  if (!trainerActivated) {
    return { label: 'Activar perfil de entrenador', icon: 'whistle', kind: 'trainer' };
  }
  if (activeRole === 'runner') {
    return { label: 'Cambiar a Entrenador', icon: 'whistle', kind: 'trainer' };
  }
  return { label: 'Cambiar a Corredor', icon: 'run-fast', kind: 'runner' };
}

export function RoleManagementSection({ onClose }) {
  const trainerActivated = useAuthStore((s) => s.trainerActivated);
  const activeRole = useAuthStore((s) => s.activeRole);
  const activateTrainerProfile = useAuthStore((s) => s.activateTrainerProfile);
  const switchRole = useAuthStore((s) => s.switchRole);
  const [modalVisible, setModalVisible] = useState(false);

  const action = getRoleAction(trainerActivated, activeRole);
  const colors = COLOR_BY_KIND[action.kind];

  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.label]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handlePress = () => {
    if (!trainerActivated) {
      setModalVisible(true);
      return;
    }
    switchRole();
    onClose?.();
  };

  const handleConfirmActivate = async () => {
    await activateTrainerProfile();
    setModalVisible(false);
    onClose?.();
  };

  return (
    <>
      <View className="px-4 pt-3 pb-1">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Gestión de rol
        </Text>
      </View>
      <Pressable className={`mx-2 mb-1 flex-row items-center rounded-lg px-2 py-2.5 ${colors.bg}`} onPress={handlePress}>
        <Animated.View className="flex-1 flex-row items-center gap-3" style={animatedStyle}>
          <MaterialCommunityIcons color={colors.icon} name={action.icon} size={18} />
          <Text className={`text-sm font-semibold ${colors.text}`}>{action.label}</Text>
        </Animated.View>
      </Pressable>

      <ActivateTrainerModal onCancel={() => setModalVisible(false)} onConfirm={handleConfirmActivate} visible={modalVisible} />
    </>
  );
}
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS (unaffected — not imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add components/shell/role-management-section.jsx
git commit -m "feat(roles): add RoleManagementSection action-row with activate/switch flow"
```

---

### Task 5: ThemeToggle rewrite — single sliding switch

**Files:**
- Modify: `components/theme/theme-toggle.jsx`

**Interfaces:**
- Consumes: `useThemeMode()` from `providers/theme-provider.jsx` (already exists: `{ themeMode, toggleThemeMode }`).
- Produces: `ThemeToggle()` — same export name and zero props as today, so **no changes needed at any call site** (Tasks 6 and 7 only change the surrounding container markup/label placement, not the `<ThemeToggle />` usage itself).

- [ ] **Step 1: Read the current file once more to confirm the exact current content before overwriting**

Run: `cat components/theme/theme-toggle.jsx`
Expected: the current two-button implementation (sun button + moon button side by side).

- [ ] **Step 2: Replace the file content**

```jsx
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../../providers/theme-provider.jsx';
import { useThemeColors } from '../../theme/colors.js';

const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 24;
const THUMB_TRAVEL = TRACK_WIDTH - 4 - THUMB_SIZE;

// Switch único (no dos botones): un solo Pressable cubre todo el track,
// cada tap alterna el tema. El thumb anima su posición con Reanimated.
export function ThemeToggle() {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const colors = useThemeColors();
  const isDark = themeMode === 'dark';

  const translateX = useSharedValue(isDark ? THUMB_TRAVEL : 0);

  useEffect(() => {
    translateX.value = withTiming(isDark ? THUMB_TRAVEL : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [isDark]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable
      accessibilityLabel={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      className="flex-row items-center rounded-full bg-slate-200 dark:bg-slate-800"
      onPress={toggleThemeMode}
      style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT, padding: 2 }}
    >
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-1.5"
        style={{ height: TRACK_HEIGHT }}
      >
        <MaterialCommunityIcons color={isDark ? colors.onSurfaceVariant : '#f59e0b'} name="weather-sunny" size={13} />
        <MaterialCommunityIcons color={isDark ? '#8cc63e' : colors.onSurfaceVariant} name="weather-night" size={13} />
      </View>
      <Animated.View
        className="items-center justify-center rounded-full bg-white shadow dark:bg-slate-950"
        style={[{ width: THUMB_SIZE, height: THUMB_SIZE }, thumbStyle]}
      >
        <MaterialCommunityIcons
          color={isDark ? '#8cc63e' : '#f59e0b'}
          name={isDark ? 'weather-night' : 'weather-sunny'}
          size={13}
        />
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS — no test imports this component directly, but confirms nothing else broke.

- [ ] **Step 4: Manual verification (web preview)**

Start the web preview, open the user dropdown (need a logged-in session — use `EXPO_PUBLIC_USE_MOCKS=true`), confirm:
- The switch renders as a single pill with a sliding circular thumb, not two buttons.
- Clicking anywhere on the pill toggles the theme and the thumb animates to the other side.
- Sun/moon icons are visible at both ends.

- [ ] **Step 5: Commit**

```bash
git add components/theme/theme-toggle.jsx
git commit -m "refactor(theme): rewrite ThemeToggle as a single sliding switch"
```

---

### Task 6: Integrate into the web shell

**Files:**
- Modify: `components/shell/app-web-shell.jsx`

**Interfaces:**
- Consumes: `RoleBadge` (Task 2), `RoleManagementSection` (Task 4), `activeRole` from `useAuthStore` (Task 1).

- [ ] **Step 1: Add imports**

At the top of `components/shell/app-web-shell.jsx`, alongside the existing imports:

```jsx
import { RoleBadge } from './role-badge.jsx';
import { RoleManagementSection } from './role-management-section.jsx';
```

- [ ] **Step 2: Thread `activeRole` into `TopBar` and render the badge**

Change the `TopBar` function signature (currently `function TopBar({ isGuest, userName, routesTab, activeTab, onTabPress, onUserPress })`) to also accept `activeRole`:

```jsx
function TopBar({ isGuest, userName, activeRole, routesTab, activeTab, onTabPress, onUserPress }) {
```

Inside `TopBar`, find this block (the authenticated user pill):

```jsx
          <Pressable
            className="flex-row items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800"
            onPress={handleUserPress}
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
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
            <MaterialCommunityIcons
              color={colors.onSurfaceVariant}
              name="chevron-down"
              size={16}
            />
          </Pressable>
```

Replace it with (adds `<RoleBadge>` between the name and the chevron):

```jsx
          <Pressable
            className="flex-row items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800"
            onPress={handleUserPress}
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
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
```

- [ ] **Step 3: Pass `activeRole` down from `AppWebShell`**

In `AppWebShell`, find:

```jsx
  const user = useAuthStore((s) => s.user);
  const isGuest = !user;
  const userName = user?.name || null;
  const routesTab = getRoutesByRole(user?.role || null);
```

Add a line right after (reads the new store field):

```jsx
  const user = useAuthStore((s) => s.user);
  const isGuest = !user;
  const userName = user?.name || null;
  const activeRole = useAuthStore((s) => s.activeRole);
  const routesTab = getRoutesByRole(user?.role || null);
```

Then find the `<TopBar ... />` call inside `AppWebShell`'s `return`:

```jsx
        <TopBar
          activeTab={activeTab}
          isGuest={isGuest}
          onTabPress={handleTabPress}
          onUserPress={handleUserPress}
          routesTab={routesTab}
          userName={userName}
        />
```

Add the new prop:

```jsx
        <TopBar
          activeRole={activeRole}
          activeTab={activeTab}
          isGuest={isGuest}
          onTabPress={handleTabPress}
          onUserPress={handleUserPress}
          routesTab={routesTab}
          userName={userName}
        />
```

- [ ] **Step 4: Add `RoleManagementSection` to `DropdownMenu`, reorder, and re-lay-out the theme row**

In `DropdownMenu`, replace the whole function body with:

```jsx
function DropdownMenu({ onClose }) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View className="w-56 rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-surface-2">
      <RoleManagementSection onClose={onClose} />

      <View className="mx-4 border-t border-slate-100 dark:border-slate-800" />

      <Pressable
        className="flex-row items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors duration-150"
        onPress={() => { router.push('/profile'); onClose(); }}
      >
        <MaterialCommunityIcons name="account-circle" size={18} color={colors.onSurfaceVariant} />
        <Text className="flex-1 text-sm font-medium text-slate-900 dark:text-white">Ver perfil</Text>
      </Pressable>

      <View className="mx-4 border-t border-slate-100 dark:border-slate-800" />

      <View className="items-center gap-2 px-4 py-3.5">
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Tema</Text>
        <ThemeToggle />
      </View>

      <View className="mx-4 border-t border-slate-100 dark:border-slate-800" />

      <Pressable
        className="flex-row items-center gap-3 rounded-b-xl px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-50 dark:active:bg-red-900/20 transition-colors duration-150"
        onPress={() => { useAuthStore.getState().logout(); onClose(); }}
      >
        <MaterialCommunityIcons name="logout" size={18} color={colors.error} />
        <Text className="text-sm font-semibold text-red-600 dark:text-red-400">Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}
```

(Note: `rounded-t-xl` was removed from the "Ver perfil" row since `RoleManagementSection` now occupies the top of the card — its own top corners are square already, matching the card's rounding is not required since it has its own internal padding, not full-bleed.)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Manual verification (web preview)**

With `EXPO_PUBLIC_USE_MOCKS=true`, log in, and confirm:
- User pill shows "Corredor" badge (green) next to the name.
- Dropdown opens with "Gestión de rol" section on top showing "Activar perfil de entrenador" (amber, whistle icon).
- Tapping it opens the `ActivateTrainerModal`; confirming closes the modal and the dropdown, and the pill/dropdown now shows "Entrenador" badge / "Cambiar a Corredor" row.
- Tapping "Cambiar a Corredor" switches back immediately (no modal), badge flips to "Corredor" (green).
- Theme section shows "Tema" label centered above the new sliding switch; tapping it toggles dark/light.
- Reload the page — role state persists (still on whichever role/activation state was last set).

- [ ] **Step 7: Commit**

```bash
git add components/shell/app-web-shell.jsx
git commit -m "feat(roles): integrate role badge and management section into web shell"
```

---

### Task 7: Integrate into the mobile shell

**Files:**
- Modify: `components/shell/app-mobile-shell.jsx`

**Interfaces:**
- Consumes: `RoleBadge` (Task 2), `RoleManagementSection` (Task 4), `activeRole` from `useAuthStore` (Task 1).

- [ ] **Step 1: Add imports**

At the top of `components/shell/app-mobile-shell.jsx`:

```jsx
import { RoleBadge } from './role-badge.jsx';
import { RoleManagementSection } from './role-management-section.jsx';
```

- [ ] **Step 2: Read `activeRole` in `NavigationDrawer`**

In `NavigationDrawer`, find:

```jsx
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
```

Add a line:

```jsx
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeRole = useAuthStore((s) => s.activeRole);
```

- [ ] **Step 3: Split the drawer header into a brand header + user identity block, add the badge**

Find this block (the authenticated-user branch of the header):

```jsx
            {user ? (
              <Pressable
                className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-5 active:opacity-70 dark:border-slate-800"
                onPress={() => goTo('/profile')}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <MaterialCommunityIcons color={colors.primary} name="account-circle" size={26} />
                </View>
                <View className="flex-1">
                  <PaceronBrand size={18} />
                  <Text className="text-sm text-slate-600 dark:text-slate-300">{user.name}</Text>
                </View>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={20} />
              </Pressable>
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
```

Replace it with (adds a standalone brand header row, then separates identity into its own row with the badge):

```jsx
            <View className="flex-row items-center border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <PaceronBrand size={18} />
            </View>

            {user ? (
              <Pressable
                className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-4 active:opacity-70 dark:border-slate-800"
                onPress={() => goTo('/profile')}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <MaterialCommunityIcons color={colors.primary} name="account-circle" size={26} />
                </View>
                <View className="flex-1 flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</Text>
                  <RoleBadge role={activeRole} />
                </View>
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="chevron-right" size={20} />
              </Pressable>
            ) : (
              <View className="flex-row items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-circle" size={26} />
                </View>
                <View className="flex-1">
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

            {user && <RoleManagementSection onClose={onClose} />}
```

- [ ] **Step 4: Re-lay-out the theme row**

Find:

```jsx
            <View className="flex-row items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <View className="flex-row items-center gap-3">
                <MaterialCommunityIcons color={colors.onSurfaceVariant} name="theme-light-dark" size={20} />
                <Text className="text-sm font-medium text-slate-700 dark:text-slate-200">Tema</Text>
              </View>
              <ThemeToggle />
            </View>
```

Replace with:

```jsx
            <View className="items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Tema</Text>
              <ThemeToggle />
            </View>
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Manual verification (device or Expo Go, by the user)**

Confirm:
- Drawer shows a standalone "Paceron" brand header row at the top.
- Below it, the user identity row shows avatar, name, and role badge (green "Corredor" by default).
- Below that, "Gestión de rol" section with the activate/switch action-row — same behavior as web (modal on first activation, direct switch after).
- Theme section shows "Tema" centered above the sliding switch, tapping toggles theme.
- Guest state (no session) still shows brand header + "Invitado" row + Ingresar button, no role section (guarded by `{user && ...}`).

- [ ] **Step 7: Commit**

```bash
git add components/shell/app-mobile-shell.jsx
git commit -m "feat(roles): integrate role badge and management section into mobile shell"
```

---

## Manual verification (after all tasks, both platforms)

- [ ] Web: full flow — guest sees no badge/role section; log in, activate trainer, switch roles back and forth, confirm animation on the action-row (fade), confirm theme switch feel.
- [ ] Mobile (user's device): same flow, plus confirm the new two-row drawer header (brand + identity) looks right and doesn't clip/overflow.
- [ ] Confirm `npm test` still reports the full suite green after all 7 tasks.

## Notes / follow-ups (out of scope)

- No real backend integration for roles — this is 100% local UI state, explicitly by design (see spec's Global Constraints).
- `getRoutesByRole` is untouched — still returns only "Inicio" regardless of role, until there's real per-role content to route to.
- The role-switch animation and the theme switch's feel are both expected to need a follow-up pass: the switch animation will matter more once each role has its own home/header content to transition between (per the user's note during design approval); the theme switch's comfort/harmony is unverified until seen live.
