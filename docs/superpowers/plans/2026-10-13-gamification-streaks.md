# Gamificación — Spec 1: Rachas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "Rachas" piece of the gamificación module — two personal streaks (strict/flexible),
a Home card, a hub screen with tabs (starting with one tab), and the shared "punto rojo" mechanism
other specs extend.

**Architecture:** TanStack Query for the server state (`['streaks', userId]`, single query reused
by the card and the detail tab — no separate fetch per consumer). A pure util builds the
"racha rota" toast message so the logic is testable without mounting a hook. A reusable
`TabBar` (already in the repo) drives the hub screen. The 3 shells get one new icon/row each,
calling the shared badge hook directly — no new prop threading.

**Tech Stack:** React Native + Expo, NativeWind, TanStack Query, react-native-reanimated,
react-native-toast-message, expo-haptics, MaterialCommunityIcons.

**Spec:** `docs/superpowers/specs/2026-10-13-gamification-streaks-design.md`

## Global Constraints

- Backend contract: `GET /users/{id}/streaks?days=42` → `{strict: {current, best}, flexible:
  {current, best}, days: [{date, strict_status, flexible_status}], has_unseen}` (snake_case DTO —
  see `docs/BACKEND_API_GAPS.md` Gap 30/34). `strict_status`/`flexible_status` ∈
  `completed`/`failed`/`skipped`/`pending`.
- Every new visual component (`View`/`Text`/`Pressable`/etc.) needs `nativeID` + `testID`,
  kebab-case, unique in its context (enforced by `local/require-native-id` lint rule).
- Responsive web mandatory — no desktop-only screen.
- No component render tests (repo convention) — only pure logic gets Jest tests.
- `fire` pulse animation: mobile only (`!isWeb`), static icon on web.
- Toast on streak break: `notifyWarning()` haptics + non-punitive copy, never `notifyError()`.
- Execution for this plan: inline in this session (no subagent dispatch), no preview-tool browser
  verification during execution — Task 8 ends with a manual test script instead.

---

### Task 1: Streaks data layer (service, mock, normalizer)

**Files:**
- Create: `services/__mocks__/streaks-mock.js`
- Create: `services/streaks.js`
- Modify: `services/normalizers.js` (append `toStreaksModel`)
- Test: `__tests__/streaks-mock.test.js`

**Interfaces:**
- Produces: `getStreaks(userId, days = 42)` (async, returns raw DTO), `toStreaksModel(dto)` →
  `{strict: {current, best}, flexible: {current, best}, days: [{date, strictStatus,
  flexibleStatus}], hasUnseen}`.

- [ ] **Step 1: Write the mock**

```js
// services/__mocks__/streaks-mock.js
// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true -- sin backend real todavía
// (Gap 30). Patrón determinístico que se repite cada 7 días: deja ver los 4
// estados (completed/failed/skipped/pending) en la grilla sin levantar
// backend. `has_unseen: true` a propósito, para poder probar el flujo de
// "marcar como visto" (Gap 34) sin esperar a que una racha real se rompa.
const PATTERN = ['completed', 'completed', 'failed', 'completed', 'skipped', 'completed', 'completed'];

function buildMockDays(days) {
  const today = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);
    const status = i === 0 ? 'pending' : PATTERN[i % PATTERN.length];
    result.push({
      date: iso,
      strict_status: status,
      flexible_status: status === 'failed' ? 'completed' : status,
    });
  }
  return result;
}

export async function mockGetStreaks(days = 42) {
  return {
    strict: { current: 6, best: 14 },
    flexible: { current: 9, best: 20 },
    days: buildMockDays(days),
    has_unseen: true,
  };
}
```

- [ ] **Step 2: Write the failing test**

```js
// __tests__/streaks-mock.test.js
import { mockGetStreaks } from '../services/__mocks__/streaks-mock.js';

describe('streaks-mock', () => {
  test('devuelve exactamente `days` entradas', async () => {
    const dto = await mockGetStreaks(42);
    expect(dto.days).toHaveLength(42);
  });

  test('el último día (hoy) está pending en las dos rachas', async () => {
    const dto = await mockGetStreaks(42);
    const today = dto.days[dto.days.length - 1];
    expect(today.strict_status).toBe('pending');
    expect(today.flexible_status).toBe('pending');
  });

  test('el patrón de 7 días garantiza al menos un `failed` en una ventana de 42', async () => {
    const dto = await mockGetStreaks(42);
    expect(dto.days.some((d) => d.strict_status === 'failed')).toBe(true);
  });

  test('con menos días pedidos, devuelve menos días', async () => {
    const dto = await mockGetStreaks(7);
    expect(dto.days).toHaveLength(7);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest streaks-mock -v`
Expected: FAIL with "Cannot find module '../services/__mocks__/streaks-mock.js'"

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest streaks-mock -v`
Expected: PASS (4/4) — el mock de Step 1 ya está escrito, no hace falta más código.

- [ ] **Step 5: Write the service**

```js
// services/streaks.js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetStreaks } from './__mocks__/streaks-mock.js';

// GET /api/v1/users/{id}/streaks?days= -- Gap 30. Cálculo 100% server-side,
// sin tabla de rachas del lado backend ni recálculo local del lado cliente
// -- esta función solo pide y devuelve el DTO crudo (snake_case).
export async function getStreaks(userId, days = 42) {
  if (USE_MOCKS) return await mockGetStreaks(days);
  return await api.get(`/users/${userId}/streaks?days=${days}`);
}
```

- [ ] **Step 6: Append the normalizer**

Add to the end of `services/normalizers.js`:

```js
// Rachas del corredor (Gap 30). `hasUnseen` alimenta el punto rojo
// transversal (Gap 34) -- hooks/use-gamification-badge.js lo lee de acá.
export function toStreaksModel(dto) {
  if (!dto) return null;
  return {
    strict: { current: dto.strict.current, best: dto.strict.best },
    flexible: { current: dto.flexible.current, best: dto.flexible.best },
    days: dto.days.map((d) => ({
      date: d.date,
      strictStatus: d.strict_status,
      flexibleStatus: d.flexible_status,
    })),
    hasUnseen: dto.has_unseen ?? false,
  };
}
```

- [ ] **Step 7: Commit**

```bash
git add services/streaks.js services/__mocks__/streaks-mock.js services/normalizers.js __tests__/streaks-mock.test.js
git commit -m "feat(streaks): data layer — service, mock and normalizer (Gap 30/34)"
```

---

### Task 2: `streakDayVisual` pure util

**Files:**
- Create: `utils/streak-day-status.js`
- Test: `__tests__/streak-day-status.test.js`

**Interfaces:**
- Consumes: none (pure).
- Produces: `streakDayVisual(status)` → `{color, label}`. Used by Task 5 (home card) and Task 6
  (streaks tab grid).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/streak-day-status.test.js
import { streakDayVisual } from '../utils/streak-day-status.js';

describe('streakDayVisual', () => {
  test('completed -> verde', () => {
    expect(streakDayVisual('completed')).toEqual({ color: '#22c55e', label: 'Completado' });
  });

  test('failed -> rojo', () => {
    expect(streakDayVisual('failed').color).toBe('#ef4444');
  });

  test('skipped -> gris', () => {
    expect(streakDayVisual('skipped').color).toBe('#94a3b8');
  });

  test('pending -> neutro', () => {
    expect(streakDayVisual('pending').color).toBe('#cbd5e1');
  });

  test('estado desconocido cae a pending', () => {
    expect(streakDayVisual('bogus')).toEqual(streakDayVisual('pending'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest streak-day-status -v`
Expected: FAIL with "Cannot find module '../utils/streak-day-status.js'"

- [ ] **Step 3: Write the implementation**

```js
// utils/streak-day-status.js
// Color/label por estado de día de racha (Gap 30) -- mismo espíritu que
// utils/calendar-kind-colors.js, pero con 4 estados propios de este módulo
// (no se reusa KIND_DOT_COLORS: son conceptos distintos aunque los dos
// sean "color de un día").
const STREAK_DAY_VISUALS = {
  completed: { color: '#22c55e', label: 'Completado' },
  failed: { color: '#ef4444', label: 'Fallido' },
  skipped: { color: '#94a3b8', label: 'Sin entrenamiento asignado' },
  pending: { color: '#cbd5e1', label: 'Pendiente' },
};

export function streakDayVisual(status) {
  return STREAK_DAY_VISUALS[status] ?? STREAK_DAY_VISUALS.pending;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest streak-day-status -v`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add utils/streak-day-status.js __tests__/streak-day-status.test.js
git commit -m "feat(streaks): pure day-status -> color/label mapping"
```

---

### Task 3: `use-streaks` hook + "racha rota" toast message

**Files:**
- Create: `utils/streak-break-message.js`
- Create: `hooks/use-streaks.js`
- Test: `__tests__/streak-break-message.test.js`

**Interfaces:**
- Consumes: `getStreaks`/`toStreaksModel` (Task 1), `formatDisplayDate` (`utils/format-date-display.js`,
  existing — takes `YYYY-MM-DD`, returns `DD-MM-YYYY`).
- Produces: `buildStreakBrokenMessage(previousCurrent, nextStreaks)` → `{text1, text2} | null`.
  `useStreaks()` → `{streaks, loading, error}`. Used by Task 4 (badge hook), Task 5 (home card),
  Task 6 (streaks tab).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/streak-break-message.test.js
import { buildStreakBrokenMessage } from '../utils/streak-break-message.js';

const streaksWithFailedDay = {
  strict: { current: 0, best: 10 },
  flexible: { current: 0, best: 12 },
  days: [
    { date: '2026-10-10', strictStatus: 'completed', flexibleStatus: 'completed' },
    { date: '2026-10-11', strictStatus: 'failed', flexibleStatus: 'completed' },
    { date: '2026-10-12', strictStatus: 'skipped', flexibleStatus: 'failed' },
  ],
};

const streaksWithoutFailedDay = {
  strict: { current: 0, best: 10 },
  flexible: { current: 0, best: 12 },
  days: [
    { date: '2026-10-11', strictStatus: 'skipped', flexibleStatus: 'completed' },
    { date: '2026-10-12', strictStatus: 'skipped', flexibleStatus: 'completed' },
  ],
};

const streaksStillGoing = {
  strict: { current: 3, best: 10 },
  flexible: { current: 5, best: 12 },
  days: [{ date: '2026-10-12', strictStatus: 'completed', flexibleStatus: 'completed' }],
};

describe('buildStreakBrokenMessage', () => {
  test('sin racha previa (null) -> no hay mensaje', () => {
    expect(buildStreakBrokenMessage(null, streaksWithFailedDay)).toBeNull();
  });

  test('racha previa ya era 0 -> no hay mensaje (no se "rompió" de nuevo)', () => {
    expect(buildStreakBrokenMessage(0, streaksWithFailedDay)).toBeNull();
  });

  test('racha previa > 0, racha actual sigue > 0 -> no hay mensaje', () => {
    expect(buildStreakBrokenMessage(2, streaksStillGoing)).toBeNull();
  });

  test('racha previa > 0, racha actual 0, con día failed -> mensaje con fecha', () => {
    const msg = buildStreakBrokenMessage(5, streaksWithFailedDay);
    expect(msg.text1).toBe('Racha reiniciada');
    expect(msg.text2).toBe('Tu racha de entrenamientos consecutivos se reinició el 11-10-2026. ¡A por una nueva!');
  });

  test('racha previa > 0, racha actual 0, sin día failed en la ventana -> mensaje genérico', () => {
    const msg = buildStreakBrokenMessage(5, streaksWithoutFailedDay);
    expect(msg.text2).toBe('Tu racha de entrenamientos consecutivos se reinició. ¡A por una nueva!');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest streak-break-message -v`
Expected: FAIL with "Cannot find module '../utils/streak-break-message.js'"

- [ ] **Step 3: Write the implementation**

```js
// utils/streak-break-message.js
import { formatDisplayDate } from './format-date-display.js';

// Pura y testeable a propósito (ver CLAUDE.md "Testing"): hooks/use-streaks.js
// solo compara el `current` anterior contra el nuevo y delega el armado del
// mensaje acá -- toda la lógica de negocio queda cubierta por Jest, nada
// vive sin test dentro del hook.
export function buildStreakBrokenMessage(previousCurrent, nextStreaks) {
  if (previousCurrent == null || previousCurrent <= 0) return null;
  if (nextStreaks.strict.current !== 0) return null;

  const lastFailedDay = [...nextStreaks.days].reverse().find((d) => d.strictStatus === 'failed');

  return {
    text1: 'Racha reiniciada',
    text2: lastFailedDay
      ? `Tu racha de entrenamientos consecutivos se reinició el ${formatDisplayDate(lastFailedDay.date)}. ¡A por una nueva!`
      : 'Tu racha de entrenamientos consecutivos se reinició. ¡A por una nueva!',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest streak-break-message -v`
Expected: PASS (5/5)

- [ ] **Step 5: Write the hook (no dedicated test — matches repo convention: hooks wrapping TanStack Query aren't unit-tested, only the pure logic they call is)**

```js
// hooks/use-streaks.js
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/auth-store.js';
import { getStreaks } from '../services/streaks.js';
import { toStreaksModel } from '../services/normalizers.js';
import { buildStreakBrokenMessage } from '../utils/streak-break-message.js';
import { notifyWarning } from '../utils/haptics.js';

// Rachas del corredor (Gap 30) -- estado de servidor, TanStack Query (ver
// CLAUDE.md "Estado de aplicación vs. de servidor"). Una sola query,
// reusada por la card del Home y la pestaña de detalle (ambas piden los
// mismos 42 días; el Home recorta a los últimos 14 client-side, ver
// components/home/streak-banner.jsx) -- mismo cache, sin fetch duplicado.
export function useStreaks() {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: ['streaks', userId],
    queryFn: () => getStreaks(userId, 42).then(toStreaksModel),
    enabled: Boolean(userId),
  });

  const streaks = query.data ?? null;
  const previousCurrent = useRef(null);

  useEffect(() => {
    if (!streaks) return;
    const message = buildStreakBrokenMessage(previousCurrent.current, streaks);
    if (message) {
      notifyWarning();
      Toast.show({ type: 'info', ...message });
    }
    previousCurrent.current = streaks.strict.current;
  }, [streaks]);

  return { streaks, loading: query.isLoading, error: query.error ?? null };
}
```

- [ ] **Step 6: Commit**

```bash
git add utils/streak-break-message.js hooks/use-streaks.js __tests__/streak-break-message.test.js
git commit -m "feat(streaks): use-streaks hook with non-punitive break toast"
```

---

### Task 4: shared "punto rojo" mechanism (`use-gamification-badge`)

**Files:**
- Create: `services/gamification.js`
- Create: `hooks/use-gamification-badge.js`

**Interfaces:**
- Consumes: `useStreaks()` (Task 3).
- Produces: `useGamificationBadge()` → `{hasUnseen, ackSection(section)}`. Specs 2/4 will later OR
  their own `hasUnseen` into this hook's return without changing its public shape — they add a
  line to the `hasUnseen` computation here, not a new hook.

- [ ] **Step 1: Write the service**

```js
// services/gamification.js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';

// POST /api/v1/users/{id}/gamification/seen -- Gap 34. Único endpoint
// compartido entre rachas/logros/competencias para marcar una sección
// como vista; el resto del mecanismo son flags `has_unseen` embebidos en
// cada recurso (streaks: Gap 30, achievements: Gap 31).
export async function ackGamificationSeen(userId, section) {
  if (USE_MOCKS) return;
  return await api.post(`/users/${userId}/gamification/seen`, { section });
}
```

- [ ] **Step 2: Write the hook (no dedicated test — thin wiring over Task 3's already-tested logic plus a fire-and-forget mutation, same convention as Task 3's hook)**

```js
// hooks/use-gamification-badge.js
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { useStreaks } from './use-streaks.js';
import { ackGamificationSeen } from '../services/gamification.js';

// Punto rojo compartido del header/sidebar/home (Gap 34). Por ahora el
// único input es el `hasUnseen` de rachas -- Spec 2 (logros) y Spec 4
// (competencias) suman su propio OR acá cuando existan, sin tocar la firma
// pública de este hook (los 3 shells y el hub ya lo consumen tal cual).
export function useGamificationBadge() {
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { streaks } = useStreaks();

  const hasUnseen = Boolean(streaks?.hasUnseen);

  const ackSection = async (section) => {
    if (!userId) return;
    await ackGamificationSeen(userId, section);
    queryClient.invalidateQueries({ queryKey: ['streaks', userId] });
  };

  return { hasUnseen, ackSection };
}
```

- [ ] **Step 3: Commit**

```bash
git add services/gamification.js hooks/use-gamification-badge.js
git commit -m "feat(gamification): shared unseen-badge mechanism (Gap 34)"
```

---

### Task 5: Home card (`StreakBanner`)

**Files:**
- Create: `components/home/streak-banner.jsx`
- Modify: `components/home/authenticated-home-screen.jsx`

**Interfaces:**
- Consumes: `useStreaks()` (Task 3), `streakDayVisual()` (Task 2).
- Produces: `<StreakBanner />` (no props).

- [ ] **Step 1: Write the component**

```jsx
// components/home/streak-banner.jsx
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useStreaks } from '../../hooks/use-streaks.js';
import { streakDayVisual } from '../../utils/streak-day-status.js';
import { useThemeColors } from '../../theme/colors.js';
import { isWeb } from '../../utils/platform.js';

// Ícono de racha con pulso sutil -- solo mobile (ver CLAUDE.md "Theming" y
// la spec: en web no aporta y evita trabajo de animación donde no hace
// falta). Mismo mecanismo de useSharedValue/withRepeat que
// components/shared/skeleton.jsx.
function useFirePulse() {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isWeb) return;
    scale.value = withRepeat(withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

export function StreakBanner() {
  const colors = useThemeColors();
  const { streaks, loading, error } = useStreaks();
  const pulseStyle = useFirePulse();

  if (loading) {
    return (
      <View className="mb-6 h-24 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-surface" nativeID="streak-banner-loading" testID="streak-banner-loading">
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streak-banner-loading-label" testID="streak-banner-loading-label">Cargando racha…</Text>
      </View>
    );
  }

  if (error || !streaks) {
    return (
      <View className="mb-6 h-24 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-surface" nativeID="streak-banner-error" testID="streak-banner-error">
        <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streak-banner-error-label" testID="streak-banner-error-label">No pudimos cargar tu racha.</Text>
      </View>
    );
  }

  const lastDays = streaks.days.slice(-14);

  return (
    <View className="mb-6 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="streak-banner-root" testID="streak-banner-root">
      <View className="flex-row items-center gap-3" nativeID="streak-banner-current-row" testID="streak-banner-current-row">
        <Animated.View style={pulseStyle}>
          <MaterialCommunityIcons color={colors.primary} name="fire" size={28} />
        </Animated.View>
        <View nativeID="streak-banner-current-text" testID="streak-banner-current-text">
          <Text className="text-3xl font-bold text-slate-900 dark:text-white" nativeID="streak-banner-current-value" testID="streak-banner-current-value">
            {streaks.strict.current} días
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="streak-banner-best-value" testID="streak-banner-best-value">
            Mejor racha: {streaks.strict.best} días
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row gap-1" nativeID="streak-banner-days-row" testID="streak-banner-days-row">
        {lastDays.map((day) => {
          const visual = streakDayVisual(day.strictStatus);
          return (
            <View
              accessibilityLabel={visual.label}
              className="h-2.5 w-2.5 flex-1 rounded-full"
              key={day.date}
              nativeID={`streak-banner-day-${day.date}`}
              style={{ backgroundColor: visual.color }}
              testID={`streak-banner-day-${day.date}`}
            />
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Wire it into the Home screen**

In `components/home/authenticated-home-screen.jsx`, add the import and render it after
`<NextTrainingBanner />`:

```diff
 import { NextTrainingBanner } from './next-training-banner.jsx';
+import { StreakBanner } from './streak-banner.jsx';
```

```diff
         <NextTrainingBanner />
+        <StreakBanner />
       </View>
```

- [ ] **Step 3: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all tests still pass (this task adds no new test files — pure logic is already covered
by Tasks 2/3).

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: 0 errors (watch for `nativeID`/`testID` pairing — count both tags in the new file and
confirm they match).

- [ ] **Step 5: Commit**

```bash
git add components/home/streak-banner.jsx components/home/authenticated-home-screen.jsx
git commit -m "feat(streaks): Home quick-view card"
```

---

### Task 6: Achievements hub shell + Streaks tab + route

**Files:**
- Create: `app/(tabs)/achievements.jsx`
- Create: `components/achievements/achievements-screen.jsx`
- Create: `components/achievements/streaks-tab.jsx`

**Interfaces:**
- Consumes: `useStreaks()` (Task 3), `streakDayVisual()` (Task 2), `useGamificationBadge()`
  (Task 4 — used here for `ackSection`, marking "streaks" as seen on mount), `TabBar`
  (`components/shared/tab-bar.jsx`, existing — props `{active, onChange, tabs, scope}`).
- Produces: route `/achievements`. `TABS` array in `achievements-screen.jsx` — Spec 2 appends
  `{id: 'achievements', ...}` and `{id: 'trophies', ...}` to this same array, no other change to
  the shell.

- [ ] **Step 1: Write the route file**

```jsx
// app/(tabs)/achievements.jsx
import { AchievementsScreen } from '../../components/achievements/achievements-screen.jsx';

export default function Achievements() {
  return <AchievementsScreen />;
}
```

- [ ] **Step 2: Write the Streaks tab (detail view)**

```jsx
// components/achievements/streaks-tab.jsx
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStreaks } from '../../hooks/use-streaks.js';
import { streakDayVisual } from '../../utils/streak-day-status.js';
import { useThemeColors } from '../../theme/colors.js';

function StreakCard({ icon, title, current, best, idPrefix }) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={colors.primary} name={icon} size={20} />
        <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-title`} testID={`${idPrefix}-title`}>{title}</Text>
      </View>
      <Text className="mt-2 text-2xl font-bold text-slate-900 dark:text-white" nativeID={`${idPrefix}-current`} testID={`${idPrefix}-current`}>
        {current} días
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-best`} testID={`${idPrefix}-best`}>
        Mejor racha: {best} días
      </Text>
    </View>
  );
}

export function StreaksTab() {
  const { streaks, loading, error } = useStreaks();

  if (loading) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streaks-tab-loading" testID="streaks-tab-loading">Cargando…</Text>;
  }

  if (error || !streaks) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="streaks-tab-error" testID="streaks-tab-error">No pudimos cargar tus rachas.</Text>;
  }

  return (
    <View nativeID="streaks-tab-root" testID="streaks-tab-root">
      <View className="flex-row gap-3" nativeID="streaks-tab-cards-row" testID="streaks-tab-cards-row">
        <StreakCard best={streaks.strict.best} current={streaks.strict.current} icon="fire" idPrefix="streaks-tab-strict-card" title="Entrenamientos consecutivos" />
        <StreakCard best={streaks.flexible.best} current={streaks.flexible.current} icon="calendar-check" idPrefix="streaks-tab-flexible-card" title="Días entrenando" />
      </View>
      <Text className="mb-2 mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="streaks-tab-grid-title" testID="streaks-tab-grid-title">
        Últimas 6 semanas
      </Text>
      <View className="flex-row flex-wrap gap-1" nativeID="streaks-tab-grid" testID="streaks-tab-grid">
        {streaks.days.map((day) => {
          const visual = streakDayVisual(day.strictStatus);
          return (
            <View
              accessibilityLabel={`${day.date}: ${visual.label}`}
              className="h-4 w-4 rounded-sm"
              key={day.date}
              nativeID={`streaks-tab-grid-day-${day.date}`}
              style={{ backgroundColor: visual.color }}
              testID={`streaks-tab-grid-day-${day.date}`}
            />
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Write the hub shell**

```jsx
// components/achievements/achievements-screen.jsx
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { StreaksTab } from './streaks-tab.jsx';
import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
import { isWeb } from '../../utils/platform.js';

// Hub de gamificación con pestañas (arranca con una sola -- Spec 2 agrega
// 'achievements'/'trophies' a este mismo array, sin tocar el resto del
// shell). Sin persistencia de la pestaña activa entre sesiones -- no lo
// pide la spec 1.
const TABS = [{ id: 'streaks', label: 'Rachas', icon: 'fire' }];

export function AchievementsScreen() {
  const [activeTab, setActiveTab] = useState('streaks');
  const { ackSection } = useGamificationBadge();

  // Marca "rachas" como visto al entrar al hub -- apaga el punto rojo
  // (Gap 34) sin esperar a que el usuario haga nada más. Spec 2 hará lo
  // mismo con 'achievements' cuando esa pestaña exista. El warning de
  // `react-hooks/exhaustive-deps` por el dep array vacío es uno de los
  // preexistentes que el repo no bloquea (ver CLAUDE.md "Testing") --
  // `ackSection` se recrea cada render (no está memoizado en el hook) pero
  // solo nos interesa dispararlo una vez al montar, no en cada render.
  useEffect(() => {
    ackSection('streaks');
  }, []);

  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="achievements-screen-root" testID="achievements-screen-root">
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="achievements-screen-container" testID="achievements-screen-container">
        <Text className="mb-6 text-2xl text-slate-900 dark:text-white" nativeID="achievements-screen-title" testID="achievements-screen-title">
          Logros
        </Text>
        <TabBar active={activeTab} onChange={setActiveTab} scope="achievements-tab-bar" tabs={TABS} />
        {activeTab === 'streaks' && <StreaksTab />}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green, 0 new lint errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/achievements.jsx" components/achievements/achievements-screen.jsx components/achievements/streaks-tab.jsx
git commit -m "feat(streaks): achievements hub shell + streaks tab + route"
```

---

### Task 7: "Logros" entry point in the 3 shells

**Files:**
- Modify: `components/shell/app-web-shell.jsx` (near line 275 and the notifications block ~204-217)
- Modify: `components/shell/app-web-shell-narrow.jsx` (near line 70 and the quick-actions row ~157-180)
- Modify: `components/shell/app-mobile-shell.jsx` (near line 79 and the quick-actions row ~175-199)

**Interfaces:**
- Consumes: `useGamificationBadge()` (Task 4).

- [ ] **Step 1: `app-web-shell.jsx` — add the hook call and the TopBar icon**

Find the line (near L275) `const notificationsBadgeCount = activeRole === 'trainer' ? ...` inside
`TopBar` and add right after it:

```diff
   const notificationsBadgeCount = activeRole === 'trainer' ? pendingRequestsCount : myInvitationsCount;
+  const { hasUnseen: gamificationHasUnseen } = useGamificationBadge();
```

Add the import at the top of the file, next to the other hook imports:

```diff
+import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
```

Add the new button right after the notifications `IconTooltip` block (the one ending with
`</Pressable></IconTooltip>` before the user pill `<Pressable className="ml-1 flex-row...`):

```jsx
<IconTooltip idPrefix="web-shell-topbar-achievements-button-tooltip" label="Logros">
  <Pressable
    accessibilityLabel="Logros"
    className="relative rounded-full p-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
    nativeID="web-shell-topbar-achievements-button"
    onPress={() => router.push('/achievements')}
    testID="web-shell-topbar-achievements-button"
  >
    <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trophy-outline" size={20} />
    {gamificationHasUnseen && (
      <View className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" nativeID="web-shell-topbar-achievements-badge" testID="web-shell-topbar-achievements-badge" />
    )}
  </Pressable>
</IconTooltip>
```

- [ ] **Step 2: `app-web-shell-narrow.jsx` — add the hook call and the drawer row**

Add the import next to the other hook imports:

```diff
+import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
```

Find the line (near L70) where `notificationsBadgeCount` is computed in this file's component and
add right after it:

```diff
   const notificationsBadgeCount = activeRole === 'trainer' ? pendingRequestsCount : myInvitationsCount;
+  const { hasUnseen: gamificationHasUnseen } = useGamificationBadge();
```

In the `quick-actions-row` block (~L157-180), the notifications `Pressable` is currently the LAST
item (no `border-r`) — give it a `border-r` (it's no longer last) and add the new "Logros"
`Pressable` after it:

```diff
                 <Pressable
-                  className="flex-1 flex-row items-center justify-center gap-2 py-2.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
+                  className="flex-1 flex-row items-center justify-center gap-2 border-r border-slate-200 py-2.5 hover:bg-slate-100 active:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800"
                   nativeID="web-narrow-drawer-notifications-row"
                   onPress={() => goTo('/notifications')}
                   testID="web-narrow-drawer-notifications-row"
                 >
                   <View className="relative" nativeID="web-narrow-drawer-notifications-icon-wrapper" testID="web-narrow-drawer-notifications-icon-wrapper">
                     <MaterialCommunityIcons color={colors.onSurfaceVariant} name="bell-outline" size={18} />
                     {notificationsBadgeCount > 0 && (
                       <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="web-narrow-drawer-notifications-badge" testID="web-narrow-drawer-notifications-badge" />
                     )}
                   </View>
                   <Text className="text-sm font-medium text-slate-700 dark:text-slate-200" nativeID="web-narrow-drawer-notifications-label" testID="web-narrow-drawer-notifications-label">Notificaciones</Text>
                 </Pressable>
+                <Pressable
+                  className="flex-1 flex-row items-center justify-center gap-2 py-2.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
+                  nativeID="web-narrow-drawer-achievements-row"
+                  onPress={() => goTo('/achievements')}
+                  testID="web-narrow-drawer-achievements-row"
+                >
+                  <View className="relative" nativeID="web-narrow-drawer-achievements-icon-wrapper" testID="web-narrow-drawer-achievements-icon-wrapper">
+                    <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trophy-outline" size={18} />
+                    {gamificationHasUnseen && (
+                      <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="web-narrow-drawer-achievements-badge" testID="web-narrow-drawer-achievements-badge" />
+                    )}
+                  </View>
+                  <Text className="text-sm font-medium text-slate-700 dark:text-slate-200" nativeID="web-narrow-drawer-achievements-label" testID="web-narrow-drawer-achievements-label">Logros</Text>
+                </Pressable>
```

Also find the `routes.map` filter a few lines below (`if (route.name === 'notifications') return
null;`) and leave it as-is — "Logros" isn't part of `routesTab`, same as "Notificaciones" today
(both are hand-rendered rows, not part of that list).

- [ ] **Step 3: `app-mobile-shell.jsx` — same two edits, mobile drawer**

Add the import:

```diff
+import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
```

Add the hook call right after the line (near L79) computing `notificationsBadgeCount`:

```diff
   const notificationsBadgeCount = activeRole === 'trainer' ? pendingRequestsCount : myInvitationsCount;
+  const { hasUnseen: gamificationHasUnseen } = useGamificationBadge();
```

In the `quick-actions-row` block (~L175-199), same two changes as Step 2 — give the notifications
row a `border-r`, add the new row after it:

```diff
                   <Pressable
-                    className="flex-1 flex-row items-center justify-center gap-2 py-2.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
+                    className="flex-1 flex-row items-center justify-center gap-2 border-r border-slate-200 py-2.5 hover:bg-slate-100 active:opacity-70 dark:border-slate-800 dark:hover:bg-slate-800"
                     nativeID="mobile-drawer-notifications-row"
                     onPress={() => goTo('/notifications')}
                     testID="mobile-drawer-notifications-row"
                   >
                     <View className="relative" nativeID="mobile-drawer-notifications-icon-wrapper" testID="mobile-drawer-notifications-icon-wrapper">
                       <MaterialCommunityIcons color={colors.onSurfaceVariant} name="bell-outline" size={18} />
                       {notificationsBadgeCount > 0 && (
                         <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="mobile-drawer-notifications-badge" testID="mobile-drawer-notifications-badge" />
                       )}
                     </View>
                     <Text className="text-sm font-medium text-slate-700 dark:text-slate-200" nativeID="mobile-drawer-notifications-label" testID="mobile-drawer-notifications-label">Notificaciones</Text>
                   </Pressable>
+                  <Pressable
+                    className="flex-1 flex-row items-center justify-center gap-2 py-2.5 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
+                    nativeID="mobile-drawer-achievements-row"
+                    onPress={() => goTo('/achievements')}
+                    testID="mobile-drawer-achievements-row"
+                  >
+                    <View className="relative" nativeID="mobile-drawer-achievements-icon-wrapper" testID="mobile-drawer-achievements-icon-wrapper">
+                      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="trophy-outline" size={18} />
+                      {gamificationHasUnseen && (
+                        <View className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" nativeID="mobile-drawer-achievements-badge" testID="mobile-drawer-achievements-badge" />
+                      )}
+                    </View>
+                    <Text className="text-sm font-medium text-slate-700 dark:text-slate-200" nativeID="mobile-drawer-achievements-label" testID="mobile-drawer-achievements-label">Logros</Text>
+                  </Pressable>
```

- [ ] **Step 4: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green. Pay special attention to `local/require-native-id` — every new tag added in
this task must keep its `nativeID`/`testID` pair.

- [ ] **Step 5: Commit**

```bash
git add components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx
git commit -m "feat(streaks): Logros entry point in the 3 shells, wired to the shared badge"
```

---

### Task 8: Final verification + manual test script

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new ones from Tasks 1/2/3.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Grep-check `nativeID`/`testID` balance on every new/modified file**

```bash
for f in services/streaks.js services/gamification.js utils/streak-day-status.js utils/streak-break-message.js hooks/use-streaks.js hooks/use-gamification-badge.js components/home/streak-banner.jsx components/home/authenticated-home-screen.jsx "app/(tabs)/achievements.jsx" components/achievements/achievements-screen.jsx components/achievements/streaks-tab.jsx components/shell/app-web-shell.jsx components/shell/app-web-shell-narrow.jsx components/shell/app-mobile-shell.jsx; do
  echo "$f: nativeID=$(grep -o 'nativeID=' "$f" | wc -l) testID=$(grep -o 'testID=' "$f" | wc -l)"
done
```

Expected: `nativeID` count equals `testID` count on every line.

- [ ] **Step 4: Output the manual test script (paste verbatim in the final chat reply — do not skip)**

```
Manual test script — Gamificación Spec 1 (Rachas)

Setup: EXPO_PUBLIC_USE_MOCKS=true (ver .env), reiniciar el dev server tras cualquier cambio de env.

1. Login como corredor. En el Home, confirmar que aparece la card "Racha" debajo de la de
   próximo entrenamiento, con un número de días, "Mejor racha: 14 días", y una fila de 14
   puntos de colores (predominan verdes, con algún rojo y gris mezclados).
2. (Mobile real) Confirmar que el ícono de fuego de la card pulsa suavemente. (Web) confirmar
   que el ícono queda estático, sin animación.
3. Click/tap en el ícono "Logros" del header (web ancho) / fila "Logros" del drawer (web angosto
   y mobile) — confirmar que navega a /achievements y que el ícono tiene un punto rojo antes de
   entrar (el mock arranca con has_unseen=true).
4. En /achievements, confirmar pestaña única "Rachas" ya seleccionada, con 2 tarjetas
   ("Entrenamientos consecutivos" con ícono de fuego, "Días entrenando" con ícono de
   calendario-check") mostrando días actuales/mejor racha, y una grilla de 42 cuadraditos de
   colores debajo.
5. Confirmar responsive: angostar el viewport web progresivamente desde ancho completo hasta
   mobile — ni la card del Home ni el hub de Logros deben romperse ni quedar cortados en ningún
   punto intermedio.
6. (Opcional, si hay forma de forzar refetch) Editar services/__mocks__/streaks-mock.js para que
   `strict.current` sea 0 en una segunda carga tras haber sido >0, recargar — confirmar que
   aparece un toast "Racha reiniciada" con la fecha del último día fallido, y (mobile real) una
   vibración de advertencia.
```

- [ ] **Step 5: Commit any leftover (should be none — every task already committed)**

```bash
git status --porcelain
```

Expected: clean working tree. If not, something from an earlier task wasn't committed — fix
before considering this plan done.
