# Mobile Sidebar Fullscreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile navigation drawer occupy the full screen width instead of 80% + a black backdrop, fixing the dark-mode "black background" bug and letting the existing `TopAppBar` menu button toggle to a close icon.

**Architecture:** Single file change, `components/shell/app-mobile-shell.jsx`. `DRAWER_WIDTH` becomes `SCREEN_WIDTH`; the backdrop `Animated.View` is deleted (nothing behind it to dim); the drawer's internal duplicate brand header is deleted since `TopAppBar` now stays visible above the drawer at all times (higher `zIndex`) and its single button toggles between `menu` and `close` icons.

**Tech Stack:** React Native + react-native-web, react-native-reanimated (existing slide animation, untouched), NativeWind. Jest (no new tests — this project has no component-render tests; visual/layout components are verified manually, matching existing project convention, see `docs/superpowers/plans/2026-07-11-role-management-ui.md`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-mobile-sidebar-fullscreen-design.md`.
- Scope is exclusively `components/shell/app-mobile-shell.jsx` — no changes to `app-web-shell.jsx` or any other shell file.
- Animation timing/easing stays exactly as-is: `translateX` from `-DRAWER_WIDTH` to `0`, `{ duration: 280, easing: Easing.out(Easing.cubic) }`.
- No backend/toolbar-future work in this plan — bottom toolbar migration is explicitly out of scope.
- Tests must stay green: `npm test` → 32/32 baseline before this work, same 32 after (no new test files, per existing convention).

---

### Task 1: Fullscreen drawer — width, backdrop removal, header simplification

**Files:**
- Modify: `components/shell/app-mobile-shell.jsx:16-17` (constants), `:77-96` (backdrop + drawer header)

**Interfaces:**
- Consumes: nothing new.
- Produces: `NavigationDrawer` now renders at `SCREEN_WIDTH` with no backdrop element and no internal brand header row. `TopAppBar` (Task 2) becomes the sole place a brand/close affordance lives above the drawer.

- [ ] **Step 1: Change `DRAWER_WIDTH` to fullscreen**

Current (`components/shell/app-mobile-shell.jsx:16-17`):

```jsx
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 360);
```

Replace with:

```jsx
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH;
```

- [ ] **Step 2: Remove the backdrop `Animated.View`**

Current (`components/shell/app-mobile-shell.jsx:77-84`):

```jsx
  return (
    <>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 55, backgroundColor: 'black' }, backdropAnimatedStyle]}
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      <Animated.View
```

Replace with:

```jsx
  return (
    <>
      <Animated.View
```

- [ ] **Step 3: Remove the now-unused `backdropOpacity` shared value and its animated style**

Current (`components/shell/app-mobile-shell.jsx:56-70`):

```jsx
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
```

Replace with:

```jsx
  const translateX = useSharedValue(-DRAWER_WIDTH);

  useEffect(() => {
    translateX.value = withTiming(open ? 0 : -DRAWER_WIDTH, ANIMATION_CONFIG);
  }, [open]);

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
```

- [ ] **Step 4: Remove the drawer's internal duplicate brand header, add top padding matching the `TopAppBar` height**

Current (`components/shell/app-mobile-shell.jsx:92-96`, after Steps 1-3 line numbers will have shifted — locate by content):

```jsx
        <View className="flex-1 border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-surface">
          <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
            <View className="flex-row items-center border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <PaceronBrand size={18} />
            </View>

            {user ? (
```

Replace with (drops the brand row, adds `pt-[60px]` so content starts below the persistent `TopAppBar`):

```jsx
        <View className="flex-1 bg-white dark:bg-surface">
          <SafeAreaView className="flex-1 pt-[60px]" edges={['top', 'bottom']}>
            {user ? (
```

- [ ] **Step 5: Remove the now-unused `PaceronBrand` import if no longer referenced elsewhere in the file**

Run: `grep -n "PaceronBrand" components/shell/app-mobile-shell.jsx`
Expected: still one match at the top-level import line and one usage inside `TopAppBar` (line ~39) — `TopAppBar` keeps using `PaceronBrand`, so the import stays. Do not remove the import.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, 32/32 (this file has no dedicated tests; confirms no other suite broke).

- [ ] **Step 7: Commit**

```bash
git add components/shell/app-mobile-shell.jsx
git commit -m "feat(shell): make mobile drawer fullscreen, remove black backdrop"
```

---

### Task 2: Persistent TopAppBar with menu/close icon toggle

**Files:**
- Modify: `components/shell/app-mobile-shell.jsx:20-43` (`TopAppBar`), `:186-199` (`AppMobileShell`)

**Interfaces:**
- Consumes: `drawerOpen` state (already exists in `AppMobileShell` as `useState`).
- Produces: `TopAppBar({ open, onTogglePress })` — replaces the old `TopAppBar({ onMenuPress })` signature. Renders above the drawer (`zIndex` higher than the drawer's `60`) at all times, so it stays visible/clickable even when the fullscreen drawer is open. Icon is `menu` when `open` is `false`, `close` when `open` is `true`.

- [ ] **Step 1: Update `TopAppBar` to accept `open`/`onTogglePress` and toggle its icon**

Current (`components/shell/app-mobile-shell.jsx:20-43`):

```jsx
function TopAppBar({ onMenuPress }) {
  const colors = useThemeColors();

  return (
    <View className="h-[60px] w-full flex-row items-center justify-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-surface">
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
```

Replace with:

```jsx
function TopAppBar({ onTogglePress, open }) {
  const colors = useThemeColors();

  return (
    <View
      className="h-[60px] w-full flex-row items-center justify-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-surface"
      style={{ zIndex: 70 }}
    >
      <Pressable
        accessibilityLabel={open ? 'Cerrar menú' : 'Abrir menú'}
        className="absolute left-4 rounded-full p-2 active:opacity-70"
        onPress={onTogglePress}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name={open ? 'close' : 'menu'} size={24} />
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
```

- [ ] **Step 2: Wire the toggle in `AppMobileShell`**

Current (`components/shell/app-mobile-shell.jsx:186-199`):

```jsx
export function AppMobileShell({ children, pathname }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-surface"
      edges={isWeb ? ['top', 'left', 'right'] : ['top', 'bottom']}
    >
      <TopAppBar onMenuPress={() => setDrawerOpen(true)} />
      <NavigationDrawer onClose={() => setDrawerOpen(false)} open={drawerOpen} pathname={pathname} />
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
```

Replace with:

```jsx
export function AppMobileShell({ children, pathname }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-surface"
      edges={isWeb ? ['top', 'left', 'right'] : ['top', 'bottom']}
    >
      <TopAppBar onTogglePress={() => setDrawerOpen((v) => !v)} open={drawerOpen} />
      <NavigationDrawer onClose={() => setDrawerOpen(false)} open={drawerOpen} pathname={pathname} />
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Confirm the drawer's own `Animated.View` `zIndex` (currently `60`) stays lower than the `TopAppBar`'s new `70`**

Run: `grep -n "zIndex" components/shell/app-mobile-shell.jsx`
Expected: one match at `zIndex: 70` (`TopAppBar`) and one at `zIndex: 60` (drawer's `Animated.View`) — `TopAppBar` must be the higher of the two so it renders above the fullscreen drawer.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS, 32/32.

- [ ] **Step 5: Manual verification (web preview, mobile viewport)**

Start the web preview at a mobile viewport width, confirm:
- Tapping the `menu` icon opens the drawer fullscreen (100% width/height), no black rectangle visible anywhere.
- The `TopAppBar` (logo + button) stays visible and on top of the fullscreen drawer content — drawer content starts below it, not overlapping.
- The icon has switched to `close`.
- Tapping `close` slides the drawer back out (left→right entry, now reversing right→left exit) and the icon switches back to `menu`.
- Navigating to a route from the drawer list still closes it and the icon resets to `menu`.
- Guest and logged-in states both render correctly with the new layout (no clipped content under the `TopAppBar`).

- [ ] **Step 6: Commit**

```bash
git add components/shell/app-mobile-shell.jsx
git commit -m "feat(shell): TopAppBar stays visible above fullscreen drawer, toggles menu/close icon"
```

---

## Manual verification (after both tasks)

- [ ] Web preview, mobile viewport: full open/close cycle, dark mode and light mode (confirm no black backdrop flash in either), guest and logged-in states, navigating via a drawer link.
- [ ] Confirm `npm test` still reports 32/32 after both tasks.

## Notes / follow-ups (out of scope)

- Bottom toolbar migration (mentioned by the user as a possible future direction) — not implemented, not designed for beyond not being actively blocked by this change.
- No changes to `app-web-shell.jsx`.
