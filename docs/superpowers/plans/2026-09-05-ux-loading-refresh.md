# Loading & Refresh UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pull-to-refresh (mobile) and coherent skeleton loaders (all platforms) to the 7 screens that show server-fetched lists, and give teams a real visual placeholder (not initials, not a generic icon) when they have no uploaded icon.

**Architecture:** Two new shared primitives (`hooks/use-pull-to-refresh.js`, `components/shared/skeleton.jsx`) get wired into 7 existing screens, one task per screen (2 screens batched together since they're identical in shape). A third shared primitive (`components/shared/team-placeholder-art.jsx`) plugs into the existing `AvatarPicker` fallback branch. `expo-image` replaces `Image` in `AvatarPicker` for disk caching.

**Tech Stack:** Expo/React Native + React Native Web, NativeWind, `react-native-reanimated` (shimmer), `@tanstack/react-query` (cache invalidation for refresh), Zustand (store fetch actions), `expo-image` (new dependency).

**Spec:** `docs/superpowers/specs/2026-09-05-ux-loading-refresh-design.md`

## Global Constraints

- Every `View`/`Text`/`Pressable`/`ScrollView`/`TextInput`/`Animated.*` needs unique `nativeID` + `testID` (`local/require-native-id` ESLint rule, no exceptions except spread props).
- No render tests for screens/components/hooks — repo convention (CLAUDE.md "Testing"). Verification is manual preview (`EXPO_PUBLIC_USE_MOCKS=true`) + `npm test`/`npm run lint` green on every task.
- Pull-to-refresh is **mobile-only** (`isMobile` from `utils/platform.js`) — never render `RefreshControl` on web, `RefreshControl`'s `refreshing`/`onRefresh` props are simply omitted from the `ScrollView` there (`undefined`, not a no-op component).
- Skeletons replace centered `ActivityIndicator` loading blocks in lists only, never a submit-button's inline spinner.
- New dependency `expo-image` gets added via `npx expo install expo-image` (resolves the SDK-54-compatible version automatically), never a hand-guessed version number.

---

### Task 1: Shared primitives — `use-pull-to-refresh` hook + `skeleton.jsx`

**Files:**
- Create: `hooks/use-pull-to-refresh.js`
- Create: `components/shared/skeleton.jsx`

**Interfaces:**
- Produces: `usePullToRefresh(refreshFn)` → `{ refreshing: boolean, onRefresh: () => void }`. `refreshFn` is any `() => Promise<unknown>`.
- Produces: `SkeletonBlock({ width, height, rounded, className, nativeID, testID })` and `SkeletonCircle({ size, className, nativeID, testID })`, both plain components with no required props beyond the ids. Consumed by Tasks 3-8.

- [ ] **Step 1: Create the pull-to-refresh hook**

```js
// hooks/use-pull-to-refresh.js
import { useState, useCallback } from 'react';

// Envuelve cualquier función de refetch (Zustand fetch action o
// `refetch`/`invalidateQueries` de TanStack Query) en el contrato que
// espera `RefreshControl` de React Native: un booleano `refreshing` y un
// callback `onRefresh` sin argumentos. Silencioso ante error — el fetch
// ya dispara su propio Toast de error si falla, este hook no duplica
// feedback.
export function usePullToRefresh(refreshFn) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFn();
    } catch {
      // el propio refreshFn (store action / TanStack) ya maneja su error
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);

  return { refreshing, onRefresh };
}
```

- [ ] **Step 2: Create the skeleton primitives**

```jsx
// components/shared/skeleton.jsx
import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

function useShimmer() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

// Shimmer vía react-native-reanimated (no CSS-only) para que anime igual
// en web y nativo — mismo mecanismo que theme-toggle.jsx/section-card.jsx.
export function SkeletonBlock({ width, height, rounded = 'rounded-lg', className = '', nativeID, testID }) {
  const shimmerStyle = useShimmer();
  return (
    <Animated.View
      className={`bg-slate-200 dark:bg-slate-700 ${rounded} ${className}`}
      nativeID={nativeID}
      style={[{ width, height }, shimmerStyle]}
      testID={testID}
    />
  );
}

export function SkeletonCircle({ size, className = '', nativeID, testID }) {
  return <SkeletonBlock className={className} height={size} nativeID={nativeID} rounded="rounded-full" testID={testID} width={size} />;
}
```

- [ ] **Step 3: Run tests and lint**

Run: `npm test && npm run lint`
Expected: 334/334 tests pass (no new tests added — pure UI/hook, no unit-testable logic per repo convention), lint clean (both new files need `nativeID`/`testID` on every `Animated.View`, already present above).

- [ ] **Step 4: Commit**

```bash
git add hooks/use-pull-to-refresh.js components/shared/skeleton.jsx
git commit -m "feat(ux): add pull-to-refresh hook and skeleton primitives"
```

---

### Task 2: Team placeholder art + `AvatarPicker` wiring + `expo-image`

**Files:**
- Create: `components/shared/team-placeholder-art.jsx`
- Modify: `components/shared/avatar-picker.jsx`
- Modify: `components/team/teams-list-screen.jsx:24`
- Modify: `components/team/team-search-screen.jsx:35`
- Modify: `components/team/team-detail-screen.jsx:1046`
- Modify: `package.json` / `package-lock.json` (via `npx expo install`, not hand-edited)

**Interfaces:**
- Produces: `TeamPlaceholderArt({ size })`, consumed only by `AvatarPicker`.
- Produces: `AvatarPicker` gains a new optional prop `placeholder` (`'team'` today). When set and there's no `uri`/`initials`, it renders `TeamPlaceholderArt` instead of the `MaterialCommunityIcons` fallback. `fallbackIcon` stays required as a prop for backward compat but is ignored when `placeholder` is set.

- [ ] **Step 1: Install `expo-image`**

Run: `npx expo install expo-image`
Expected: `package.json` gains `"expo-image": "~<version>"` under `dependencies` (exact version resolved by the tool, do not hand-type it), `package-lock.json` updated accordingly, `node_modules/expo-image` present.

- [ ] **Step 2: Create the team placeholder art component**

```jsx
// components/shared/team-placeholder-art.jsx
import { View } from 'react-native';

// Ilustración abstracta para equipos sin ícono subido — 3 formas
// superpuestas en tonos `primary` graduados, en vez de un ícono de fuente
// genérico o iniciales (que leerían como avatar de persona). El padre
// (AvatarPicker) ya recorta a `rounded-full`, así que el overflow de las
// formas se clip automático sin lógica extra acá.
export function TeamPlaceholderArt({ size }) {
  return (
    <View nativeID="team-placeholder-art" style={{ height: size, width: size }} testID="team-placeholder-art">
      <View
        className="absolute rounded-full bg-primary/30 dark:bg-primary/20"
        nativeID="team-placeholder-art-circle-left"
        testID="team-placeholder-art-circle-left"
        style={{ height: size * 0.58, left: size * 0.02, top: size * 0.06, width: size * 0.58 }}
      />
      <View
        className="absolute rounded-full bg-primary/55 dark:bg-primary/40"
        nativeID="team-placeholder-art-circle-right"
        testID="team-placeholder-art-circle-right"
        style={{ height: size * 0.58, right: size * 0.02, top: size * 0.06, width: size * 0.58 }}
      />
      <View
        className="absolute self-center rounded-2xl bg-primary"
        nativeID="team-placeholder-art-base"
        testID="team-placeholder-art-base"
        style={{ bottom: size * 0.04, height: size * 0.5, width: size * 0.62 }}
      />
    </View>
  );
}
```

- [ ] **Step 3: Wire `AvatarPicker`**

Find this in `components/shared/avatar-picker.jsx`:

```jsx
// components/shared/avatar-picker.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
```

Replace with:

```jsx
// components/shared/avatar-picker.jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { TeamPlaceholderArt } from './team-placeholder-art.jsx';
```

Find:

```jsx
export function AvatarPicker({ uri, onPick, onRemove, loading = false, size = 64, fallbackIcon, initials, idPrefix, accessibilityLabel }) {
```

Replace with:

```jsx
export function AvatarPicker({ uri, onPick, onRemove, loading = false, size = 64, fallbackIcon, initials, placeholder, idPrefix, accessibilityLabel }) {
```

Find:

```jsx
        {showImage ? (
          <Image
            accessibilityLabel={accessibilityLabel}
            className="rounded-full"
            nativeID={`${idPrefix}-image`}
            onError={() => setImageFailed(true)}
            source={{ uri }}
            style={{ height: size, width: size }}
            testID={`${idPrefix}-image`}
          />
        ) : showInitials ? (
          <Text
            className="font-bold text-on-primary-tint dark:text-primary"
            nativeID={`${idPrefix}-initials`}
            style={{ fontSize: size * 0.35 }}
            testID={`${idPrefix}-initials`}
          >
            {initials}
          </Text>
        ) : (
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fallbackIcon} size={size * 0.5} />
        )}
```

Replace with:

```jsx
        {showImage ? (
          <Image
            accessibilityLabel={accessibilityLabel}
            className="rounded-full"
            nativeID={`${idPrefix}-image`}
            onError={() => setImageFailed(true)}
            source={{ uri }}
            style={{ height: size, width: size }}
            testID={`${idPrefix}-image`}
          />
        ) : showInitials ? (
          <Text
            className="font-bold text-on-primary-tint dark:text-primary"
            nativeID={`${idPrefix}-initials`}
            style={{ fontSize: size * 0.35 }}
            testID={`${idPrefix}-initials`}
          >
            {initials}
          </Text>
        ) : placeholder === 'team' ? (
          <TeamPlaceholderArt size={size} />
        ) : (
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fallbackIcon} size={size * 0.5} />
        )}
```

- [ ] **Step 4: Switch the 3 team call sites from `fallbackIcon="account-group"` to `placeholder="team"`**

In `components/team/teams-list-screen.jsx:24`, find:

```jsx
        <AvatarPicker fallbackIcon="account-group" idPrefix={`teams-list-team-${team.id}-avatar`} size={36} uri={team.iconUrl} />
```

Replace with:

```jsx
        <AvatarPicker idPrefix={`teams-list-team-${team.id}-avatar`} placeholder="team" size={36} uri={team.iconUrl} />
```

In `components/team/team-search-screen.jsx:35`, find:

```jsx
        <AvatarPicker fallbackIcon="account-group" idPrefix={`${idPrefix}-avatar`} size={44} uri={team.iconUrl} />
```

Replace with:

```jsx
        <AvatarPicker idPrefix={`${idPrefix}-avatar`} placeholder="team" size={44} uri={team.iconUrl} />
```

In `components/team/team-detail-screen.jsx:1044-1053`, find:

```jsx
          <AvatarPicker
            accessibilityLabel={`Ícono de ${team.name}`}
            fallbackIcon="account-group"
            idPrefix="team-detail-photo"
            loading={iconUploading}
            onPick={canDeleteTeam ? handlePickIcon : undefined}
            onRemove={canDeleteTeam ? handleRemoveIcon : undefined}
            size={64}
            uri={team.iconUrl}
          />
```

Replace with:

```jsx
          <AvatarPicker
            accessibilityLabel={`Ícono de ${team.name}`}
            idPrefix="team-detail-photo"
            loading={iconUploading}
            onPick={canDeleteTeam ? handlePickIcon : undefined}
            onRemove={canDeleteTeam ? handleRemoveIcon : undefined}
            placeholder="team"
            size={64}
            uri={team.iconUrl}
          />
```

- [ ] **Step 5: Run tests and lint**

Run: `npm test && npm run lint`
Expected: 334/334 pass, lint clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/shared/team-placeholder-art.jsx components/shared/avatar-picker.jsx components/team/teams-list-screen.jsx components/team/team-search-screen.jsx components/team/team-detail-screen.jsx
git commit -m "feat(ux): expo-image cache + abstract placeholder art for teams without an icon"
```

---

### Task 3: `teams-list-screen.jsx` — pull-to-refresh + skeleton

**Files:**
- Modify: `components/team/teams-list-screen.jsx`

**Interfaces:**
- Consumes: `usePullToRefresh` (Task 1), `SkeletonBlock`/`SkeletonCircle` (Task 1).

- [ ] **Step 1: Wire pull-to-refresh and skeleton**

Find:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { SectionCard } from '../forms/section-card.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
```

Replace with:

```jsx
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock, SkeletonCircle } from '../shared/skeleton.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
```

(`ActivityIndicator` import is dropped — the loading block it fed is fully replaced by skeleton rows below.)

Find:

```jsx
  const { byTeamId: pendingRequestsByTeamId } = useTeamsJoinRequestsMap(activeRole === 'trainer' ? administeredTeams.map((t) => t.id) : []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTeams().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeRole === 'trainer' || !user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyMemberTeams(user.userId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, user?.userId]);

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="teams-list-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="teams-list-screen-scroll"
    >
```

Replace with:

```jsx
  const { byTeamId: pendingRequestsByTeamId } = useTeamsJoinRequestsMap(activeRole === 'trainer' ? administeredTeams.map((t) => t.id) : []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTeams().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeRole === 'trainer' || !user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyMemberTeams(user.userId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, user?.userId]);

  const { refreshing, onRefresh } = usePullToRefresh(() => (activeRole === 'trainer' ? fetchTeams() : fetchMyMemberTeams(user?.userId)));

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="teams-list-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="teams-list-screen-scroll"
    >
```

Find:

```jsx
          {loading ? (
            <View className="items-center py-6" nativeID="teams-list-loading" testID="teams-list-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : myTeams.length === 0 ? (
```

Replace with:

```jsx
          {loading ? (
            <View className="gap-2" nativeID="teams-list-loading" testID="teams-list-loading">
              {[0, 1, 2].map((i) => (
                <View className="flex-row items-center gap-3 px-4 py-3" key={i} nativeID={`teams-list-loading-row-${i}`} testID={`teams-list-loading-row-${i}`}>
                  <SkeletonCircle nativeID={`teams-list-loading-row-${i}-avatar`} size={36} testID={`teams-list-loading-row-${i}-avatar`} />
                  <SkeletonBlock height={14} nativeID={`teams-list-loading-row-${i}-name`} testID={`teams-list-loading-row-${i}-name`} width="60%" />
                </View>
              ))}
            </View>
          ) : myTeams.length === 0 ? (
```

- [ ] **Step 2: Run tests and lint**

Run: `npm test && npm run lint`
Expected: 334/334 pass, lint clean.

- [ ] **Step 3: Commit**

```bash
git add components/team/teams-list-screen.jsx
git commit -m "feat(ux): pull-to-refresh and skeleton loading on teams list"
```

---

### Task 4: `team-search-screen.jsx` — pull-to-refresh + skeleton

**Files:**
- Modify: `components/team/team-search-screen.jsx`

**Interfaces:**
- Consumes: `usePullToRefresh`, `SkeletonBlock`/`SkeletonCircle` (Task 1).

- [ ] **Step 1: Wire pull-to-refresh and skeleton**

Find:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { useTeamSearch } from '../../hooks/use-team-search.js';
import { useMyJoinRequests, useJoinRequestMutations } from '../../hooks/use-join-requests.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { SectionCard } from '../forms/section-card.jsx';
import { Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { LEVEL_OPTIONS } from './team-general-info-fields.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
```

Replace with:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useAddressCascade } from '../../hooks/use-address-cascade.js';
import { useTeamSearch } from '../../hooks/use-team-search.js';
import { useMyJoinRequests, useJoinRequestMutations } from '../../hooks/use-join-requests.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { SectionCard } from '../forms/section-card.jsx';
import { Row, Col } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { SkeletonBlock, SkeletonCircle } from '../shared/skeleton.jsx';
import { LEVEL_OPTIONS } from './team-general-info-fields.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
```

(`ActivityIndicator` stays imported — still used by the request button's inline spinner and the "Cargar más" button.)

Find:

```jsx
  const handleSearch = () => {
    setSearched(true);
    search({ name: name.trim() || undefined, level: level || undefined, country: address.country || undefined, province: address.province || undefined, city: address.city || undefined });
    setFiltersCollapsed(true);
  };
```

Replace with:

```jsx
  const handleSearch = () => {
    setSearched(true);
    search({ name: name.trim() || undefined, level: level || undefined, country: address.country || undefined, province: address.province || undefined, city: address.city || undefined });
    setFiltersCollapsed(true);
  };

  const { refreshing, onRefresh } = usePullToRefresh(() => {
    if (!searched) return Promise.resolve();
    return search({ name: name.trim() || undefined, level: level || undefined, country: address.country || undefined, province: address.province || undefined, city: address.city || undefined });
  });
```

Find:

```jsx
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="team-search-screen-scroll" showsVerticalScrollIndicator={false} testID="team-search-screen-scroll">
```

Replace with:

```jsx
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="team-search-screen-scroll" refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined} showsVerticalScrollIndicator={false} testID="team-search-screen-scroll">
```

Find:

```jsx
        {searched && (
          loading && visibleResults.length === 0 ? (
            <View className="items-center py-6" nativeID="team-search-loading" testID="team-search-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : visibleResults.length === 0 ? (
```

Replace with:

```jsx
        {searched && (
          loading && visibleResults.length === 0 ? (
            <View className="flex-row flex-wrap gap-3" nativeID="team-search-loading" testID="team-search-loading">
              {[0, 1].map((i) => (
                <View className="w-full gap-3 rounded-xl border border-slate-200 p-4 lg:w-[calc(50%-6px)] xl:w-[calc(33.333%-8px)] dark:border-slate-700" key={i} nativeID={`team-search-loading-card-${i}`} testID={`team-search-loading-card-${i}`}>
                  <View className="flex-row items-center gap-3" nativeID={`team-search-loading-card-${i}-header`} testID={`team-search-loading-card-${i}-header`}>
                    <SkeletonCircle nativeID={`team-search-loading-card-${i}-avatar`} size={44} testID={`team-search-loading-card-${i}-avatar`} />
                    <SkeletonBlock height={14} nativeID={`team-search-loading-card-${i}-name`} testID={`team-search-loading-card-${i}-name`} width="70%" />
                  </View>
                  <SkeletonBlock height={36} nativeID={`team-search-loading-card-${i}-button`} rounded="rounded-full" testID={`team-search-loading-card-${i}-button`} width="100%" />
                </View>
              ))}
            </View>
          ) : visibleResults.length === 0 ? (
```

- [ ] **Step 2: Run tests and lint**

Run: `npm test && npm run lint`
Expected: 334/334 pass, lint clean.

- [ ] **Step 3: Commit**

```bash
git add components/team/team-search-screen.jsx
git commit -m "feat(ux): pull-to-refresh and skeleton loading on team search results"
```

---

### Task 5: `notifications-screen.jsx` — pull-to-refresh + skeleton

**Files:**
- Modify: `components/notifications/notifications-screen.jsx`

**Interfaces:**
- Consumes: `usePullToRefresh`, `SkeletonBlock` (Task 1). `useQueryClient` from `@tanstack/react-query` (already a project dependency, not yet imported in this file).

- [ ] **Step 1: Add imports**

Find:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useMyJoinRequests, useJoinRequestMutations, useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
```

Replace with:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, selectAdministeredTeams } from '../../store/team-store.js';
import { useMyJoinRequests, useJoinRequestMutations, useTeamsJoinRequestsMap } from '../../hooks/use-join-requests.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { formatRelativeTime } from '../../utils/relative-time.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
```

- [ ] **Step 2: Replace the 3 centered loading blocks with skeleton rows**

Find (inside `MyJoinRequestsSection`):

```jsx
      {loading ? (
        <View className="items-center py-6" nativeID="my-join-requests-loading" testID="my-join-requests-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
```

Replace with:

```jsx
      {loading ? (
        <View className="gap-2" nativeID="my-join-requests-loading" testID="my-join-requests-loading">
          {[0, 1].map((i) => <SkeletonBlock height={52} key={i} nativeID={`my-join-requests-loading-row-${i}`} testID={`my-join-requests-loading-row-${i}`} width="100%" />)}
        </View>
      ) : requests.length === 0 ? (
```

Find (inside `TrainerPendingRequestsSection`):

```jsx
      {loading ? (
        <View className="items-center py-6" nativeID="trainer-pending-requests-loading" testID="trainer-pending-requests-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : allPending.length === 0 ? (
```

Replace with:

```jsx
      {loading ? (
        <View className="gap-2" nativeID="trainer-pending-requests-loading" testID="trainer-pending-requests-loading">
          {[0, 1].map((i) => <SkeletonBlock height={52} key={i} nativeID={`trainer-pending-requests-loading-row-${i}`} testID={`trainer-pending-requests-loading-row-${i}`} width="100%" />)}
        </View>
      ) : allPending.length === 0 ? (
```

Find (inside `NotificationsScreenContent`, "Invitaciones recibidas"):

```jsx
          {loadingInvitations ? (
            <View className="items-center py-6" nativeID="received-invitations-loading" testID="received-invitations-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : myInvitations.length === 0 ? (
```

Replace with:

```jsx
          {loadingInvitations ? (
            <View className="gap-2" nativeID="received-invitations-loading" testID="received-invitations-loading">
              {[0, 1].map((i) => <SkeletonBlock height={78} key={i} nativeID={`received-invitations-loading-row-${i}`} testID={`received-invitations-loading-row-${i}`} width="100%" />)}
            </View>
          ) : myInvitations.length === 0 ? (
```

- [ ] **Step 3: Wire pull-to-refresh on the outer `ScrollView`**

Find:

```jsx
  const handleReject = async (invitationId) => {
    setRespondingId(invitationId);
    const result = await rejectMyInvitation(invitationId, user.userId);
    setRespondingId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos rechazar la invitación', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Invitación rechazada' });
  };

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="notifications-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="notifications-screen-scroll"
    >
```

Replace with:

```jsx
  const handleReject = async (invitationId) => {
    setRespondingId(invitationId);
    const result = await rejectMyInvitation(invitationId, user.userId);
    setRespondingId(null);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'No pudimos rechazar la invitación', text2: result.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Invitación rechazada' });
  };

  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    user?.userId ? fetchMyInvitations(user.userId, user.email) : Promise.resolve(),
    queryClient.invalidateQueries({ queryKey: ['join-requests-mine'] }),
    queryClient.invalidateQueries({ queryKey: ['join-requests-team'] }),
  ]));

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="notifications-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="notifications-screen-scroll"
    >
```

(`queryClient.invalidateQueries({ queryKey: ['join-requests-team'] })` invalidates every query whose key starts with `'join-requests-team'` — TanStack's default partial-match behavior — which covers both `useTeamJoinRequests` and every entry inside `useTeamsJoinRequestsMap` without needing to know team ids here.)

- [ ] **Step 4: Run tests and lint**

Run: `npm test && npm run lint`
Expected: 334/334 pass, lint clean.

- [ ] **Step 5: Commit**

```bash
git add components/notifications/notifications-screen.jsx
git commit -m "feat(ux): pull-to-refresh and skeleton loading on notifications"
```

---

### Task 6: `team-detail-screen.jsx` — pull-to-refresh + skeleton

**Files:**
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `usePullToRefresh`, `SkeletonCircle`/`SkeletonBlock` (Task 1). Reuses the file's existing `queryClient` (already declared at line 667) and `fetchTeam`/`fetchGroups` (Zustand, lines 511/513).

- [ ] **Step 1: Add imports**

Find:

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
```

Replace with:

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
```

Find:

```jsx
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
```

Replace with:

```jsx
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTeamStore, TRAINING_PLAN_OPTIONS } from '../../store/team-store.js';
import { useTeamRoster } from '../../hooks/use-team-roster.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
```

Find:

```jsx
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
```

Replace with:

```jsx
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { SkeletonBlock, SkeletonCircle } from '../shared/skeleton.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
```

- [ ] **Step 2: Add the refresh function and wire the `ScrollView`**

Find (right after the two `useEffect`s that call `fetchTeam`/`fetchGroups`, i.e. immediately before the `groupOptions` memo):

```jsx
  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoadingGroups(true);
    fetchGroups(teamId, user.userId).finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, user?.userId]);

  // Sin la opción sintética "Todos los grupos" — InlinePicker ya resuelve
```

Replace with:

```jsx
  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoadingGroups(true);
    fetchGroups(teamId, user.userId).finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, user?.userId]);

  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    fetchTeam(teamId),
    user?.userId ? fetchGroups(teamId, user.userId) : Promise.resolve(),
    queryClient.invalidateQueries({ queryKey: ['team-users', teamId] }),
    queryClient.invalidateQueries({ queryKey: ['group-users'] }),
    queryClient.invalidateQueries({ queryKey: ['join-requests-team', teamId] }),
  ]));

  // Sin la opción sintética "Todos los grupos" — InlinePicker ya resuelve
```

Find:

```jsx
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="team-detail-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="team-detail-screen-scroll"
    >
```

Replace with:

```jsx
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="team-detail-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="team-detail-screen-scroll"
    >
```

- [ ] **Step 3: Replace the roster loading block with a skeleton**

Find (`team-detail-screen.jsx:899-903`, the "Corredores" tab's loading branch):

```jsx
      {loadingRoster ? (
        <View className="items-center py-4" nativeID="team-detail-runners-loading" testID="team-detail-runners-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : members.length === 0 ? (
```

Replace with:

```jsx
      {loadingRoster ? (
        <View className="gap-2" nativeID="team-detail-runners-loading" testID="team-detail-runners-loading">
          {[0, 1, 2].map((i) => (
            <View className="flex-row items-center gap-3 px-4 py-3" key={i} nativeID={`team-detail-runners-loading-row-${i}`} testID={`team-detail-runners-loading-row-${i}`}>
              <SkeletonCircle nativeID={`team-detail-runners-loading-row-${i}-avatar`} size={36} testID={`team-detail-runners-loading-row-${i}-avatar`} />
              <SkeletonBlock height={14} nativeID={`team-detail-runners-loading-row-${i}-name`} testID={`team-detail-runners-loading-row-${i}-name`} width="50%" />
            </View>
          ))}
        </View>
      ) : members.length === 0 ? (
```

- [ ] **Step 4: Run tests and lint**

Run: `npm test && npm run lint`
Expected: 334/334 pass, lint clean.

- [ ] **Step 5: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(ux): pull-to-refresh and roster skeleton on team detail"
```

---

### Task 7: `training-plans-screen.jsx` + `my-plans-screen.jsx` — pull-to-refresh + skeleton (batch)

**Files:**
- Modify: `components/plans/training-plans-screen.jsx`
- Modify: `components/plans/my-plans-screen.jsx`

**Interfaces:**
- Consumes: `usePullToRefresh`, `SkeletonBlock` (Task 1).

- [ ] **Step 1: `training-plans-screen.jsx` — imports**

Find (the file's full top import block):

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { SessionsCatalogTab } from './sessions-catalog-tab.jsx';
import { ExercisesCatalogTab } from './exercises-catalog-tab.jsx';
```

Replace with:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus } from '../../store/training-plan-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { SessionsCatalogTab } from './sessions-catalog-tab.jsx';
import { ExercisesCatalogTab } from './exercises-catalog-tab.jsx';
```

- [ ] **Step 2: `training-plans-screen.jsx` — skeleton in `PlansTab`**

Find:

```jsx
      {loading ? (
        <View className="items-center py-6" nativeID="training-plans-loading" testID="training-plans-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : plans.length === 0 ? (
```

Replace with:

```jsx
      {loading ? (
        <View className="gap-2" nativeID="training-plans-loading" testID="training-plans-loading">
          {[0, 1, 2].map((i) => <SkeletonBlock height={48} key={i} nativeID={`training-plans-loading-row-${i}`} testID={`training-plans-loading-row-${i}`} width="100%" />)}
        </View>
      ) : plans.length === 0 ? (
```

- [ ] **Step 3: `training-plans-screen.jsx` — pull-to-refresh on `TrainingPlansScreenContent`**

Find:

```jsx
function TrainingPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState('planes');

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="training-plans-screen-scroll"
```

Replace with:

```jsx
function TrainingPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState('planes');
  const user = useAuthStore((s) => s.user);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    if (!user?.userId) return Promise.resolve();
    return Promise.all([fetchPlans(user.userId), fetchExercises(user.userId), fetchSessions(user.userId)]);
  });

  return (
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="training-plans-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
```

(This refreshes all 3 tabs' data together regardless of which one is active — simpler than plumbing a callback between `TrainingPlansScreenContent` and its 3 tab sub-components, and the extra fetches are cheap relative to a manual pull gesture. Imports were already added in Step 1.)

- [ ] **Step 4: `my-plans-screen.jsx` — imports**

Find (the file's full top import block):

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus, getPlanDaysRemaining } from '../../store/training-plan-store.js';
import { SectionCard } from '../forms/section-card.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { TodaySessionHero } from './today-session-hero.jsx';
```

Replace with:

```jsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus, getPlanDaysRemaining } from '../../store/training-plan-store.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';
import { TodaySessionHero } from './today-session-hero.jsx';
```

- [ ] **Step 5: `my-plans-screen.jsx` — pull-to-refresh + skeleton**

Find:

```jsx
  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyPlans(user.userId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);
```

Replace with:

```jsx
  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchMyPlans(user.userId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const { refreshing, onRefresh } = usePullToRefresh(() => (user?.userId ? fetchMyPlans(user.userId) : Promise.resolve()));
```

Find:

```jsx
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="my-plans-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="my-plans-screen-scroll"
    >
```

Replace with:

```jsx
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="my-plans-screen-scroll"
      refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined}
      showsVerticalScrollIndicator={false}
      testID="my-plans-screen-scroll"
    >
```

Find:

```jsx
          {loading ? (
            <View className="items-center py-6" nativeID="my-plans-loading" testID="my-plans-loading">
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : myPlans.length === 0 ? (
```

Replace with:

```jsx
          {loading ? (
            <View className="gap-2" nativeID="my-plans-loading" testID="my-plans-loading">
              {[0, 1, 2].map((i) => <SkeletonBlock height={48} key={i} nativeID={`my-plans-loading-row-${i}`} testID={`my-plans-loading-row-${i}`} width="100%" />)}
            </View>
          ) : myPlans.length === 0 ? (
```

- [ ] **Step 6: Run tests and lint**

Run: `npm test && npm run lint`
Expected: 334/334 pass, lint clean.

- [ ] **Step 7: Commit**

```bash
git add components/plans/training-plans-screen.jsx components/plans/my-plans-screen.jsx
git commit -m "feat(ux): pull-to-refresh and skeleton loading on training plans screens"
```

---

### Task 8: `profile-screen.jsx` — pull-to-refresh only

**Files:**
- Modify: `components/profile/profile-screen.jsx`

**Interfaces:**
- Consumes: `usePullToRefresh` (Task 1). No skeleton here — the screen already renders synchronously from the cached `user` in the store, there is no "loading list" state to skeleton.

- [ ] **Step 1: Wire pull-to-refresh**

Find (the file's full top import block):

```jsx
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { DeactivateAccountModal } from './deactivate-account-modal.jsx';
import { DeactivateTrainerModal } from './deactivate-trainer-modal.jsx';
import { RoleSwitchToggle } from './role-switch-toggle.jsx';
import { SectionCard } from '../forms/section-card.jsx';
```

Replace with:

```jsx
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth-store.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb, isMobile } from '../../utils/platform.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { getCountryName, getProvinceName } from '../../data/locations.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { DeactivateAccountModal } from './deactivate-account-modal.jsx';
import { DeactivateTrainerModal } from './deactivate-trainer-modal.jsx';
import { RoleSwitchToggle } from './role-switch-toggle.jsx';
import { SectionCard } from '../forms/section-card.jsx';
```

Find:

```jsx
  useEffect(() => {
    if (user?.userId) refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  if (!user) return null;
```

Replace with:

```jsx
  useEffect(() => {
    if (user?.userId) refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const { refreshing, onRefresh } = usePullToRefresh(refreshUser);

  if (!user) return null;
```

Find:

```jsx
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="profile-screen" testID="profile-screen">
```

Replace with:

```jsx
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="profile-screen" refreshControl={isMobile ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} /> : undefined} testID="profile-screen">
```

(`colors` is already declared at `profile-screen.jsx:206` via `useThemeColors()`, well before this `ScrollView` — no new declaration needed.)

- [ ] **Step 2: Run tests and lint**

Run: `npm test && npm run lint`
Expected: 334/334 pass, lint clean.

- [ ] **Step 3: Commit**

```bash
git add components/profile/profile-screen.jsx
git commit -m "feat(ux): pull-to-refresh on profile screen"
```

---

### Task 9: Version bump + final manual verification + close

**Files:**
- Modify: `package.json`, `package-lock.json` (version field only — `expo-image`'s own version was already set correctly by Task 2's `npx expo install`, do not touch it here)

**Interfaces:** None — this task only bumps the version and verifies the whole branch manually; it produces nothing later tasks consume.

- [ ] **Step 1: Bump the version**

Find in `package.json`:

```json
  "version": "0.11.0",
```

Replace with:

```json
  "version": "0.12.0",
```

Apply the identical string replacement in `package-lock.json` (both occurrences — the top-level `version` field and the `packages[""].version` field).

- [ ] **Step 2: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: all test suites pass, lint clean.

- [ ] **Step 3: Manual preview verification**

Web preview (`EXPO_PUBLIC_USE_MOCKS=true`): confirm skeleton rows render briefly on first load of `/teams`, `/teams/search` (after searching), `/notifications`, a team's detail page (Corredores tab), `/training-plans`, `/my-plans`; confirm a team without an uploaded icon shows the new abstract placeholder art (not a generic account-group glyph, not initials) in all 3 places (teams list, search results, team detail header).

Mobile (Expo Go or Android emulator — pull-to-refresh cannot be verified in the web preview, `RefreshControl` needs a real touch gesture): swipe down on each of the 7 screens above, confirm the native refresh spinner appears and disappears, and that data visibly updates (or at minimum doesn't error) after each pull.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version for loading & refresh UX subproyecto A"
```
