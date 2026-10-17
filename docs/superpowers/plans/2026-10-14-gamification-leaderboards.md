# Gamificación — Spec 3: Leaderboards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "Leaderboards" piece of gamificación — ranking por equipo con métrica/período
seleccionables, top 5 + fila propia, récord histórico, dentro de `team-detail-screen.jsx`.

**Architecture:** Una query TanStack por combinación equipo/métrica/período (clave incluye todos
los filtros), con formateo de valores delegado a utils puras y testeadas por métrica. El
componente de la pestaña es autocontenido — no reusa el hub de Logros de Specs 1/2, vive en el
detalle de equipo.

**Tech Stack:** React Native + Expo, NativeWind, TanStack Query, MaterialCommunityIcons.

**Spec:** `docs/superpowers/specs/2026-10-14-gamification-leaderboards-design.md`

## Global Constraints

- Backend (Gap 32): `GET /teams/{id}/leaderboard?metric=distance|duration|pace|peak_speed|sessions_count|attendance_count&period=week|month|year|custom|all&from=&to=`
  → `{rows: [{user_id, name, avatar_url, value, rank}], viewer_rank: {user_id, value, rank} |
  null, record?: {user_id, name, value, achieved_at}}`. `rows` ya es el top 5 (no cortar de
  nuevo en frontend). `value` siempre número plano (corrección 2026-10-14): `distance`→metros,
  `duration`→milisegundos, `pace`→minutos/km decimal, `peak_speed`→km/h decimal,
  `sessions_count`/`attendance_count`→entero.
- Desempate resuelto 100% server-side — el frontend no lo reimplementa.
- `period=custom` necesita `from`/`to` en `YYYY-MM-DD`; `DateField` (existente) entrega
  `DD/MM/YYYY` — convertir con `utils/date-field-format.js#toISODate` antes de mandarlo.
- `AvatarPicker` en modo solo-lectura (sin `onPick`/`onRemove`) para los avatares de fila — mismo
  patrón ya usado en `components/team/teams-list-screen.jsx:29`.
- Cada visual nuevo lleva `nativeID`/`testID` kebab-case.
- Responsive: `Row`/`Col` de `components/forms/fields.jsx` para el selector (apila en mobile,
  fila en web ancho, ya es su comportamiento por defecto).
- No tests de render de componentes — solo utils puras.
- Ejecución de este plan: inline en esta sesión, sin subagentes ni verificación de preview — la
  última tarea entrega un script de prueba manual.

---

### Task 1: Data layer (service, mock, normalizer)

**Files:**
- Create: `services/leaderboard.js`
- Create: `services/__mocks__/leaderboard-mock.js`
- Modify: `services/normalizers.js` (append `toLeaderboardModel`)
- Test: `__tests__/leaderboard-mock.test.js`

**Interfaces:**
- Produces: `getTeamLeaderboard(teamId, {metric, period, from, to})` (async, DTO crudo).
  `toLeaderboardModel(dto)` → `{rows: [{userId, name, avatarUrl, value, rank}], viewerRank:
  {userId, value, rank} | null, record: {userId, name, value, achievedAt} | null}`.

- [ ] **Step 1: Write the mock**

```js
// services/__mocks__/leaderboard-mock.js
// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true (Gap 32). Exactamente 5
// filas (ya es el "top 5" que manda el backend) + un `viewer_rank` en el
// puesto 7 (fuera del top 5, para poder ver la fila propia renderizada
// aparte) + un `record` fijo para el modo histórico. Ignora los params de
// metric/period a propósito -- es un fixture visual, no un simulador real
// de agregación.
const MOCK_ROWS = [
  { user_id: 1, name: 'Lucía Fernández', avatar_url: null, value: 42500, rank: 1 },
  { user_id: 2, name: 'Martín Gómez', avatar_url: null, value: 38200, rank: 2 },
  { user_id: 3, name: 'Sofía Ibarra', avatar_url: null, value: 35900, rank: 3 },
  { user_id: 4, name: 'Tomás Silva', avatar_url: null, value: 31000, rank: 4 },
  { user_id: 5, name: 'Valentina Ríos', avatar_url: null, value: 28700, rank: 5 },
];

const MOCK_VIEWER_RANK = { user_id: 42, value: 15400, rank: 7 };

const MOCK_RECORD = { user_id: 1, name: 'Lucía Fernández', value: 58300, achieved_at: '2026-06-12' };

export async function mockGetTeamLeaderboard() {
  return { rows: MOCK_ROWS, viewer_rank: MOCK_VIEWER_RANK, record: MOCK_RECORD };
}
```

- [ ] **Step 2: Write the failing test**

```js
// __tests__/leaderboard-mock.test.js
import { mockGetTeamLeaderboard } from '../services/__mocks__/leaderboard-mock.js';

describe('leaderboard-mock', () => {
  test('`rows` tiene exactamente 5 entradas (ya es el top 5)', async () => {
    const dto = await mockGetTeamLeaderboard();
    expect(dto.rows).toHaveLength(5);
  });

  test('`viewer_rank` está fuera del top 5, para poder probar la fila propia aparte', async () => {
    const dto = await mockGetTeamLeaderboard();
    expect(dto.viewer_rank.rank).toBeGreaterThan(5);
  });

  test('`record` está presente para el modo histórico', async () => {
    const dto = await mockGetTeamLeaderboard();
    expect(dto.record).toBeTruthy();
    expect(dto.record.value).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest leaderboard-mock --verbose`
Expected: FAIL with "Cannot find module '../services/__mocks__/leaderboard-mock.js'"

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest leaderboard-mock --verbose`
Expected: PASS (3/3)

- [ ] **Step 5: Write the service**

```js
// services/leaderboard.js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetTeamLeaderboard } from './__mocks__/leaderboard-mock.js';

// GET /api/v1/teams/{id}/leaderboard -- Gap 32. `from`/`to` solo se mandan
// si vienen (period=custom); el resto de los períodos los resuelve el
// backend.
export async function getTeamLeaderboard(teamId, { metric, period, from, to } = {}) {
  if (USE_MOCKS) return await mockGetTeamLeaderboard();
  const params = new URLSearchParams({ metric, period });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return await api.get(`/teams/${teamId}/leaderboard?${params.toString()}`);
}
```

- [ ] **Step 6: Append the normalizer**

Add to the end of `services/normalizers.js`:

```js
// Leaderboard de equipo (Gap 32). `value` siempre número plano -- el
// formateo por métrica vive en utils/leaderboard-metric-format.js, nunca
// acá.
export function toLeaderboardModel(dto) {
  if (!dto) return null;
  return {
    rows: (dto.rows ?? []).map((r) => ({ userId: r.user_id, name: r.name, avatarUrl: r.avatar_url ?? null, value: r.value, rank: r.rank })),
    viewerRank: dto.viewer_rank ? { userId: dto.viewer_rank.user_id, value: dto.viewer_rank.value, rank: dto.viewer_rank.rank } : null,
    record: dto.record ? { userId: dto.record.user_id, name: dto.record.name, value: dto.record.value, achievedAt: dto.record.achieved_at } : null,
  };
}
```

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add services/leaderboard.js services/__mocks__/leaderboard-mock.js services/normalizers.js __tests__/leaderboard-mock.test.js
git commit -m "feat(leaderboard): data layer — service, mock and normalizer (Gap 32)"
```

---

### Task 2: `formatMetricValue` pure util

**Files:**
- Create: `utils/leaderboard-metric-format.js`
- Test: `__tests__/leaderboard-metric-format.test.js`

**Interfaces:**
- Consumes: `formatMeters` (`utils/distance.js`, existing), `formatClock` (`utils/time.js`,
  existing).
- Produces: `formatMetricValue(metric, value)` → string. Used by Task 5 (`leaderboard-tab.jsx`).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/leaderboard-metric-format.test.js
import { formatMetricValue } from '../utils/leaderboard-metric-format.js';

describe('formatMetricValue', () => {
  test('distance -> usa formatMeters (km con 2 decimales sobre 1000m)', () => {
    expect(formatMetricValue('distance', 1500)).toBe('1.50 km');
  });

  test('duration -> usa formatClock (mm:ss)', () => {
    expect(formatMetricValue('duration', 125000)).toBe('02:05');
  });

  test('duration null -> guión, no "00:00" (formatClock trata null como 0, hay que guardear antes)', () => {
    expect(formatMetricValue('duration', null)).toBe('—');
  });

  test('pace -> mm:ss /km desde minutos decimales', () => {
    expect(formatMetricValue('pace', 5.4167)).toBe('5:25 /km');
  });

  test('peak_speed -> X.X km/h', () => {
    expect(formatMetricValue('peak_speed', 14.33)).toBe('14.3 km/h');
  });

  test('sessions_count -> entero plano', () => {
    expect(formatMetricValue('sessions_count', 12)).toBe('12');
  });

  test('attendance_count null -> guión', () => {
    expect(formatMetricValue('attendance_count', null)).toBe('—');
  });

  test('métrica desconocida -> guión', () => {
    expect(formatMetricValue('bogus', 10)).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest leaderboard-metric-format --verbose`
Expected: FAIL with "Cannot find module '../utils/leaderboard-metric-format.js'"

- [ ] **Step 3: Write the implementation**

```js
// utils/leaderboard-metric-format.js
import { formatMeters } from './distance.js';
import { formatClock } from './time.js';

// `value` siempre viaja como número plano (Gap 32) -- acá se decide cómo
// se ve cada métrica. Pura y testeada: hooks/use-team-leaderboard.js no
// formatea nada, components/team/leaderboard-tab.jsx solo llama a esto.
function formatPace(minutesPerKm) {
  const value = Number(minutesPerKm);
  if (minutesPerKm == null || !Number.isFinite(value)) return '—';
  const totalSeconds = Math.round(value * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

function formatPeakSpeed(kmh) {
  const value = Number(kmh);
  if (kmh == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} km/h`;
}

function formatCount(value) {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return '—';
  return `${n}`;
}

export function formatMetricValue(metric, value) {
  if (metric === 'distance') return formatMeters(value);
  if (metric === 'duration') return value == null ? '—' : formatClock(value);
  if (metric === 'pace') return formatPace(value);
  if (metric === 'peak_speed') return formatPeakSpeed(value);
  if (metric === 'sessions_count' || metric === 'attendance_count') return formatCount(value);
  return '—';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest leaderboard-metric-format --verbose`
Expected: PASS (8/8)

- [ ] **Step 5: Commit**

```bash
git add utils/leaderboard-metric-format.js __tests__/leaderboard-metric-format.test.js
git commit -m "feat(leaderboard): pure per-metric value formatting"
```

---

### Task 3: `rankMeta` pure util

**Files:**
- Create: `utils/leaderboard-rank-meta.js`
- Test: `__tests__/leaderboard-rank-meta.test.js`

**Interfaces:**
- Produces: `rankMeta(rank)` → `{icon, color} | null`. Used by Task 5 (`leaderboard-tab.jsx`).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/leaderboard-rank-meta.test.js
import { rankMeta } from '../utils/leaderboard-rank-meta.js';

describe('rankMeta', () => {
  test('puesto 1 -> medalla dorada', () => {
    expect(rankMeta(1)).toEqual({ icon: 'medal', color: '#eab308' });
  });

  test('puesto 2 -> medalla plateada', () => {
    expect(rankMeta(2)).toEqual({ icon: 'medal', color: '#94a3b8' });
  });

  test('puesto 3 -> medalla bronce', () => {
    expect(rankMeta(3)).toEqual({ icon: 'medal', color: '#b45309' });
  });

  test('puesto 4 -> sin medalla (null)', () => {
    expect(rankMeta(4)).toBeNull();
  });

  test('puesto 7 (fuera del top 5, fila propia) -> sin medalla (null)', () => {
    expect(rankMeta(7)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest leaderboard-rank-meta --verbose`
Expected: FAIL with "Cannot find module '../utils/leaderboard-rank-meta.js'"

- [ ] **Step 3: Write the implementation**

```js
// utils/leaderboard-rank-meta.js
// Medalla para los primeros 3 puestos -- el resto (incluida la fila
// propia cuando no entra en el top 5) se muestra como número plano,
// decisión del componente, no de esta util.
const RANK_META = {
  1: { icon: 'medal', color: '#eab308' },
  2: { icon: 'medal', color: '#94a3b8' },
  3: { icon: 'medal', color: '#b45309' },
};

export function rankMeta(rank) {
  return RANK_META[rank] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest leaderboard-rank-meta --verbose`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add utils/leaderboard-rank-meta.js __tests__/leaderboard-rank-meta.test.js
git commit -m "feat(leaderboard): pure rank -> medal mapping"
```

---

### Task 4: `use-team-leaderboard` hook

**Files:**
- Create: `hooks/use-team-leaderboard.js`

**Interfaces:**
- Consumes: `getTeamLeaderboard` + `toLeaderboardModel` (Task 1).
- Produces: `useTeamLeaderboard(teamId, {metric, period, from, to})` → `{leaderboard, loading,
  error}`. Used by Task 5 (`leaderboard-tab.jsx`).

- [ ] **Step 1: Write the hook (no dedicated test — thin wiring, same convention as the repo's other query hooks)**

```js
// hooks/use-team-leaderboard.js
import { useQuery } from '@tanstack/react-query';
import { getTeamLeaderboard } from '../services/leaderboard.js';
import { toLeaderboardModel } from '../services/normalizers.js';

// Leaderboard de equipo (Gap 32) -- una query por combinación de filtros,
// la clave incluye todos para no mezclar cachés entre métrica/período
// distintos.
export function useTeamLeaderboard(teamId, { metric, period, from, to } = {}) {
  const query = useQuery({
    queryKey: ['leaderboard', teamId, metric, period, from, to],
    queryFn: () => getTeamLeaderboard(teamId, { metric, period, from, to }).then(toLeaderboardModel),
    enabled: Boolean(teamId) && Boolean(metric) && Boolean(period),
  });

  return {
    leaderboard: query.data ?? null,
    loading: query.isLoading,
    error: query.error ?? null,
  };
}
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-team-leaderboard.js
git commit -m "feat(leaderboard): use-team-leaderboard hook"
```

---

### Task 5: `LeaderboardTab` component

**Files:**
- Create: `components/team/leaderboard-tab.jsx`

**Interfaces:**
- Consumes: `useTeamLeaderboard()` (Task 4), `formatMetricValue()` (Task 2), `rankMeta()`
  (Task 3), `Row`/`Col`/`DateField` (`components/forms/fields.jsx`, existing),
  `ResponsiveSelectField` (existing), `AvatarPicker` (existing, modo solo-lectura),
  `toISODate()` (`utils/date-field-format.js`, existing), `getUserInitials()`
  (`utils/user-initials.js`, existing).
- Produces: `<LeaderboardTab teamId />`. Used by Task 6 (`team-detail-screen.jsx`).

- [ ] **Step 1: Write the component**

```jsx
// components/team/leaderboard-tab.jsx
import { useState } from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Row, Col, DateField } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { useTeamLeaderboard } from '../../hooks/use-team-leaderboard.js';
import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
import { rankMeta } from '../../utils/leaderboard-rank-meta.js';
import { toISODate } from '../../utils/date-field-format.js';
import { getUserInitials } from '../../utils/user-initials.js';

const METRIC_OPTIONS = [
  { id: 'distance', name: 'Distancia' },
  { id: 'duration', name: 'Tiempo de entrenamiento' },
  { id: 'pace', name: 'Mejor ritmo' },
  { id: 'peak_speed', name: 'Velocidad pico' },
  { id: 'sessions_count', name: 'Entrenamientos realizados' },
  { id: 'attendance_count', name: 'Asistencias' },
];

const PERIOD_OPTIONS = [
  { id: 'week', name: 'Última semana' },
  { id: 'month', name: 'Último mes' },
  { id: 'year', name: 'Último año' },
  { id: 'custom', name: 'Rango personalizado' },
  { id: 'all', name: 'Histórico' },
];

function RankBadge({ rank }) {
  const meta = rankMeta(rank);
  const idPrefix = `leaderboard-tab-rank-badge-${rank}`;

  if (meta) return <MaterialCommunityIcons color={meta.color} name={meta.icon} size={20} />;

  return (
    <View className="h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700" nativeID={idPrefix} testID={idPrefix}>
      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        {rank}
      </Text>
    </View>
  );
}

function LeaderboardRow({ row, metric, idPrefix, accent = false }) {
  return (
    <View
      className={`flex-row items-center gap-3 rounded-xl p-3 ${accent ? 'border-l-4 border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'bg-white dark:bg-surface'}`}
      nativeID={idPrefix}
      testID={idPrefix}
    >
      <RankBadge rank={row.rank} />
      <AvatarPicker accessibilityLabel={`Foto de ${row.name}`} idPrefix={`${idPrefix}-avatar`} initials={getUserInitials(row.name)} size={32} uri={row.avatarUrl} />
      <Text className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
        {row.name}
      </Text>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-value`} testID={`${idPrefix}-value`}>
        {formatMetricValue(metric, row.value)}
      </Text>
    </View>
  );
}

export function LeaderboardTab({ teamId }) {
  const [metric, setMetric] = useState('distance');
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const from = period === 'custom' && fromDate ? toISODate(fromDate) : undefined;
  const to = period === 'custom' && toDate ? toISODate(toDate) : undefined;

  const { leaderboard, loading, error } = useTeamLeaderboard(teamId, { metric, period, from, to });

  const viewerInTop = Boolean(leaderboard?.rows?.some((row) => String(row.userId) === String(leaderboard?.viewerRank?.userId)));

  return (
    <View nativeID="leaderboard-tab-root" testID="leaderboard-tab-root">
      <Row>
        <Col>
          <ResponsiveSelectField dense label="Métrica" onChange={setMetric} options={METRIC_OPTIONS} value={metric} />
        </Col>
        <Col>
          <ResponsiveSelectField dense label="Período" onChange={setPeriod} options={PERIOD_OPTIONS} value={period} />
        </Col>
      </Row>

      {period === 'custom' && (
        <Row>
          <Col>
            <DateField label="Desde" onChange={setFromDate} value={fromDate} />
          </Col>
          <Col>
            <DateField label="Hasta" onChange={setToDate} value={toDate} />
          </Col>
        </Row>
      )}

      {loading && (
        <Text className="mt-4 text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-loading" testID="leaderboard-tab-loading">
          Cargando…
        </Text>
      )}

      {!loading && error && (
        <Text className="mt-4 text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-error" testID="leaderboard-tab-error">
          No pudimos cargar el leaderboard.
        </Text>
      )}

      {!loading && !error && leaderboard && leaderboard.rows.length === 0 && (
        <Text className="mt-4 text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-empty" testID="leaderboard-tab-empty">
          Todavía no hay datos para esta métrica en este período.
        </Text>
      )}

      {!loading && !error && leaderboard && leaderboard.rows.length > 0 && (
        <View className="mt-4 gap-2" nativeID="leaderboard-tab-rows" testID="leaderboard-tab-rows">
          {leaderboard.rows.map((row) => (
            <LeaderboardRow idPrefix={`leaderboard-tab-row-${row.userId}`} key={row.userId} metric={metric} row={row} />
          ))}
          {leaderboard.viewerRank && !viewerInTop && (
            <LeaderboardRow accent idPrefix="leaderboard-tab-viewer-row" metric={metric} row={{ ...leaderboard.viewerRank, name: 'Tu posición' }} />
          )}
        </View>
      )}

      {!loading && !error && period === 'all' && leaderboard?.record && (
        <View className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/10" nativeID="leaderboard-tab-record" testID="leaderboard-tab-record">
          <Text className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID="leaderboard-tab-record-title" testID="leaderboard-tab-record-title">
            Récord del equipo
          </Text>
          <Text className="mt-1 text-sm text-slate-700 dark:text-slate-200" nativeID="leaderboard-tab-record-value" testID="leaderboard-tab-record-value">
            {leaderboard.record.name} — {formatMetricValue(metric, leaderboard.record.value)}
          </Text>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green. Pay attention to `nativeID`/`testID` pairing in the new file.

- [ ] **Step 3: Commit**

```bash
git add components/team/leaderboard-tab.jsx
git commit -m "feat(leaderboard): LeaderboardTab component"
```

---

### Task 6: Wire into `team-detail-screen.jsx`

**Files:**
- Modify: `components/team/team-detail-screen.jsx`

**Interfaces:**
- Consumes: `<LeaderboardTab teamId />` (Task 5).

- [ ] **Step 1: Add the import**

Near the other component imports (the file already imports `AvatarPicker`, `IconTooltip`, etc.):

```diff
+import { LeaderboardTab } from './leaderboard-tab.jsx';
```

- [ ] **Step 2: Add the tab definition**

Find the `TABS` array (near the top of the file, right before `const DASH = '—';`):

```diff
 const TABS = [
   { id: 'general', label: 'Información general y estadísticas', icon: 'information-outline' },
   { id: 'corredores', label: 'Corredores', icon: 'account-multiple' },
   { id: 'grupos', label: 'Grupos', icon: 'account-group' },
+  { id: 'leaderboard', label: 'Leaderboard', icon: 'podium-gold' },
   { id: 'solicitudes', label: 'Solicitudes', icon: 'account-question-outline' },
 ];
```

No change needed to the `visibleTabs` filter (`const visibleTabs = TABS.filter((tab) =>
(tab.id !== 'grupos' || isTrainerView) && (tab.id !== 'solicitudes' || canDeleteTeam));`) — a
`leaderboard` tab is neither `grupos` nor `solicitudes`, so both conditions evaluate `true` for
it regardless of role, and it passes through automatically. This tab is visible to corredor and
entrenador alike, per the spec.

- [ ] **Step 3: Add the content variable**

Find where `const solicitudesContent = canDeleteTeam && <TeamRequestsTab teamId={team.id} />;` is
defined, and add right after it:

```diff
   const solicitudesContent = canDeleteTeam && <TeamRequestsTab teamId={team.id} />;
+  const leaderboardContent = <LeaderboardTab teamId={team.id} />;
```

- [ ] **Step 4: Render it**

Find the block rendering tab content (`{activeTab === 'solicitudes' && solicitudesContent}`) and
add a sibling line:

```diff
         <TabBar active={activeTab} onChange={setActiveTab} scope="team-detail-tab-bar" tabs={visibleTabs} />
         {activeTab === 'general' && generalContent}
         {activeTab === 'corredores' && corredoresContent}
         {activeTab === 'grupos' && gruposContent}
+        {activeTab === 'leaderboard' && leaderboardContent}
         {activeTab === 'solicitudes' && solicitudesContent}
```

- [ ] **Step 5: Invalidate leaderboard queries on pull-to-refresh**

Find the `usePullToRefresh` call (its `Promise.all` already invalidates `['team', teamId]`,
`['groups', teamId]`, etc.) and add one more entry:

```diff
   const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
     queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
     queryClient.invalidateQueries({ queryKey: ['groups', teamId] }),
     queryClient.invalidateQueries({ queryKey: ['team-users', teamId] }),
     queryClient.invalidateQueries({ queryKey: ['group-users'] }),
     queryClient.invalidateQueries({ queryKey: ['join-requests-team', teamId] }),
     queryClient.invalidateQueries({ queryKey: ['users-batch', teamId] }),
+    queryClient.invalidateQueries({ queryKey: ['leaderboard', teamId] }),
   ]));
```

(TanStack Query's `invalidateQueries` matches by key prefix by default, so this one entry covers
every cached métrica/período combination for this team — no need to enumerate them.)

- [ ] **Step 6: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add components/team/team-detail-screen.jsx
git commit -m "feat(leaderboard): wire Leaderboard tab into team-detail-screen"
```

---

### Task 7: Final verification + manual test script

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including every new test file from Tasks 1/2/3.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Grep-check `nativeID`/`testID` balance on every new/modified file**

```bash
for f in services/leaderboard.js services/__mocks__/leaderboard-mock.js utils/leaderboard-metric-format.js utils/leaderboard-rank-meta.js hooks/use-team-leaderboard.js components/team/leaderboard-tab.jsx components/team/team-detail-screen.jsx; do
  n=$(grep -o 'nativeID=' "$f" | wc -l); t=$(grep -o 'testID=' "$f" | wc -l)
  result="OK"; [ "$n" != "$t" ] && result="MISMATCH"
  echo "$f: nativeID=$n testID=$t $result"
done
```

Expected: `nativeID` count equals `testID` count on every line (the pure-logic files show 0/0).

- [ ] **Step 4: Output the manual test script (paste verbatim in the final chat reply — do not skip)**

```
Manual test script — Gamificación Spec 3 (Leaderboards)

Setup: EXPO_PUBLIC_USE_MOCKS=true, reiniciar el dev server tras cualquier cambio de env.

1. Entrar al detalle de cualquier equipo (como corredor o entrenador) — confirmar una pestaña
   nueva "Leaderboard" entre "Grupos" y "Solicitudes" (visible para los dos roles).
2. Abrir la pestaña — confirmar 5 filas con medalla (oro/plata/bronce en los primeros 3, número
   plano en 4 y 5), avatar (iniciales si no hay foto), nombre y valor formateado en "km" (métrica
   por defecto: Distancia).
3. Como corredor: confirmar una 6ta fila aparte, con borde/fondo de acento, mostrando "Tu
   posición" con puesto 7 (fuera del top 5) — el mock siempre la trae así.
4. Como entrenador: confirmar que esa fila de "Tu posición" NO aparece (el mock la trae, pero
   el criterio real es `viewer_rank: null` para entrenador — para probarlo de verdad hace falta
   que el backend ya distinga el rol; con el mock actual, confirmar al menos que el resto del
   flujo no rompe si se simula `viewer_rank: null` editando el mock a mano).
5. Cambiar el selector de Métrica a "Tiempo de entrenamiento" — confirmar que los valores pasan a
   formato `mm:ss`. Cambiar a "Mejor ritmo" — confirmar formato `m:ss /km`.
6. Cambiar el selector de Período a "Histórico" — confirmar que aparece la card ámbar "Récord del
   equipo" debajo de las filas. Cambiar a "Rango personalizado" — confirmar que aparecen 2 campos
   de fecha (Desde/Hasta).
7. Confirmar responsive: angostar el viewport web progresivamente — el selector de
   métrica/período debe apilarse en mobile/narrow y quedar en fila en web ancho, sin romperse en
   ningún punto intermedio.
8. Pull-to-refresh (mobile): deslizar hacia abajo en el detalle de equipo con la pestaña
   Leaderboard activa — confirmar que no rompe nada (no hace falta ver un cambio visual, solo que
   no haya errores).
```

- [ ] **Step 5: Confirm clean working tree**

```bash
git status --porcelain
```

Expected: clean.
