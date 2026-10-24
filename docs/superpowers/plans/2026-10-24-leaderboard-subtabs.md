# Leaderboard Subtabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6 always-mounted collapsible leaderboard sections with metric subtabs (one `TabBar`, mirroring `competitions-tab.jsx`) sharing one global period selector in the same header row, and move custom date-range entry from inline `DateField`s to a dedicated modal.

**Architecture:** Lift `period`/`fromDate`/`toDate` state from per-section to `LeaderboardTab` itself; add `activeMetric` state driving a single `useTeamLeaderboard` call instead of 6 parallel ones; render one `TabBar` + period `ResponsiveSelectField` in the header row; add a new `LeaderboardDateRangeModal` for custom ranges, opened/cancelled/applied via one ref-based revert mechanism.

**Tech Stack:** React Native + react-native-web, NativeWind, TanStack Query (`useTeamLeaderboard`), existing `TabBar`/`IconTooltip`/`ResponsiveSelectField`/`DateField` components.

**Spec:** `docs/superpowers/specs/2026-10-24-leaderboard-subtabs-design.md`

## Global Constraints

- Every visual element (`View`, `Text`, `Pressable`, etc.) needs both `nativeID` and `testID`, kebab-case, scoped and unique (enforced by `local/require-native-id` lint rule).
- No new `SelectField`/`PickerField` direct imports — only `ResponsiveSelectField` (enforced by `local/no-direct-select-field`).
- Every `<Modal>` needs a descendant `nativeID` ending in `-backdrop` with an `onPress` handler that closes it (enforced by `local/require-modal-backdrop-close`).
- No component render tests — this repo's convention (`CLAUDE.md`, Testing section) is pure-logic-only Jest coverage; visual/interaction verification happens manually in preview.
- `npm test` and `npm run lint` must both be green before any commit.
- Period is GLOBAL across metric subtabs (confirmed with user 2026-10-24) — switching metric never resets `period`/`fromDate`/`toDate`.

---

### Task 1: Add `icon` field to `METRIC_OPTIONS`

**Files:**
- Modify: `utils/gamification-metric-options.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `METRIC_OPTIONS[i].icon` (string, a `MaterialCommunityIcons` name) — consumed by Task 3's `TabBar` tabs array.

- [ ] **Step 1: Add the `icon` field to each entry**

Replace the full array in `utils/gamification-metric-options.js`:

```js
// Las 6 métricas de gamificación (Gap 32/33) -- compartidas entre el
// selector del leaderboard (components/team/leaderboard-tab.jsx) y el de
// creación de competencia (components/team/create-competition-modal.jsx).
// `icon` (MaterialCommunityIcons) solo lo usa el leaderboard, para las
// subpestañas de TabBar -- el otro consumidor (ResponsiveSelectField de
// create-competition-modal.jsx) ignora el campo extra, no rompe nada.
export const METRIC_OPTIONS = [
  { id: 'distance', name: 'Distancia', icon: 'map-marker-distance' },
  { id: 'duration', name: 'Tiempo de entrenamiento', icon: 'clock-outline' },
  { id: 'pace', name: 'Mejor ritmo', icon: 'speedometer' },
  { id: 'peak_speed', name: 'Velocidad pico', icon: 'flash' },
  { id: 'sessions_count', name: 'Entrenamientos realizados', icon: 'run' },
  { id: 'attendance_count', name: 'Asistencias', icon: 'account-check-outline' },
];
```

- [ ] **Step 2: Run lint + tests to confirm nothing depends on the array's exact shape**

Run: `npm test && npm run lint`
Expected: both green, no new failures (no existing test enumerates `METRIC_OPTIONS` keys exactly — `utils/competition-title.js` and `create-competition-modal.jsx` only read `id`/`name`).

- [ ] **Step 3: Commit**

```bash
git add utils/gamification-metric-options.js
git commit -m "feat(leaderboard): add icon field to METRIC_OPTIONS for subtabs"
```

---

### Task 2: `LeaderboardDateRangeModal` component

**Files:**
- Create: `components/team/leaderboard-date-range-modal.jsx`

**Interfaces:**
- Consumes: `DateField` from `components/forms/fields.jsx`, `toISODate` from `utils/date-field-format.js`.
- Produces: `LeaderboardDateRangeModal({ visible, initialFrom, initialTo, onCancel, onConfirm })` — a presentational component with no store/query access. `onConfirm(from, to)` is called with the two `DateField`-format strings (`'DD/MM/YYYY'`) exactly as typed, same format `LeaderboardTab`'s existing `fromDate`/`toDate` state already uses today. Consumed by Task 3.

- [ ] **Step 1: Write the component**

```jsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateField } from '../forms/fields.jsx';
import { toISODate } from '../../utils/date-field-format.js';

// Rango personalizado del leaderboard (Gap 32) -- antes eran 2 DateField
// inline al lado del selector de período; pedido real 2026-10-24: mover a
// un modal dedicado, mismo criterio que cualquier otro form de 2 campos
// relacionados. Estado local sembrado una vez por apertura (mismo patrón de
// reset-on-reopen que create-competition-modal.jsx, pero gateado solo por
// `visible` -- este modal no tiene concepto de "resetKey" porque no hay
// distintos registros que editar, uno por vez).
export function LeaderboardDateRangeModal({ visible, initialFrom, initialTo, onCancel, onConfirm }) {
  const [fromDate, setFromDate] = useState(initialFrom ?? '');
  const [toDate, setToDate] = useState(initialTo ?? '');

  useEffect(() => {
    if (visible) {
      setFromDate(initialFrom ?? '');
      setToDate(initialTo ?? '');
    }
  }, [visible, initialFrom, initialTo]);

  const fromIso = toISODate(fromDate);
  const toIso = toISODate(toDate);
  const bothFilled = Boolean(fromIso) && Boolean(toIso);
  const rangeInverted = bothFilled && fromIso > toIso;
  const canApply = bothFilled && !rangeInverted;

  return (
    <Modal animationType="fade" nativeID="leaderboard-date-range-modal" onRequestClose={onCancel} testID="leaderboard-date-range-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="leaderboard-date-range-modal-backdrop" onPress={onCancel} testID="leaderboard-date-range-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="leaderboard-date-range-modal-card" onPress={() => {}} testID="leaderboard-date-range-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="leaderboard-date-range-modal-header" testID="leaderboard-date-range-modal-header">
            <MaterialCommunityIcons name="calendar-range" size={20} />
            <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID="leaderboard-date-range-modal-title" testID="leaderboard-date-range-modal-title">
              Rango personalizado
            </Text>
          </View>

          <View className="gap-3" nativeID="leaderboard-date-range-modal-fields" testID="leaderboard-date-range-modal-fields">
            <DateField label="Desde" onChange={setFromDate} value={fromDate} />
            <DateField label="Hasta" onChange={setToDate} value={toDate} />
          </View>

          {rangeInverted && (
            <Text className="mb-2 text-xs text-red-600 dark:text-red-400" nativeID="leaderboard-date-range-modal-error" testID="leaderboard-date-range-modal-error">
              "Desde" tiene que ser anterior o igual a "Hasta".
            </Text>
          )}

          <View className="mt-2 flex-row gap-3" nativeID="leaderboard-date-range-modal-actions" testID="leaderboard-date-range-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="leaderboard-date-range-modal-cancel-button"
              onPress={onCancel}
              testID="leaderboard-date-range-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="leaderboard-date-range-modal-cancel-label" testID="leaderboard-date-range-modal-cancel-label">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              className={`h-11 flex-1 items-center justify-center rounded-full ${canApply ? 'bg-primary hover:opacity-90 active:opacity-80' : 'bg-slate-300 dark:bg-slate-700'}`}
              disabled={!canApply}
              nativeID="leaderboard-date-range-modal-apply-button"
              onPress={() => onConfirm(fromDate, toDate)}
              testID="leaderboard-date-range-modal-apply-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="leaderboard-date-range-modal-apply-label" testID="leaderboard-date-range-modal-apply-label">
                Aplicar
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (confirms `nativeID`/`testID`/backdrop-close rules pass on the new file).

- [ ] **Step 3: Commit**

```bash
git add components/team/leaderboard-date-range-modal.jsx
git commit -m "feat(leaderboard): add custom date-range modal"
```

---

### Task 3: Restructure `LeaderboardTab`

**Files:**
- Modify: `components/team/leaderboard-tab.jsx`

**Interfaces:**
- Consumes: `TabBar` from `../shared/tab-bar.jsx` (`{active, onChange, tabs: [{id, icon, label}], scope, variant}`), `IconTooltip` from `../shared/icon-tooltip.jsx` (already imported), `LeaderboardDateRangeModal` from Task 2, `METRIC_OPTIONS` (now with `icon`) from Task 1.
- Produces: no exports change — `LeaderboardTab({ teamId })` keeps the same public signature.

This task removes `MetricSection` entirely and inlines its render logic (the `visibleRows`/record computation) directly into `LeaderboardTab`, since there's now only one metric visible at a time — extracting it to a separate component would have no second consumer.

- [ ] **Step 1: Replace the full file**

```jsx
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { AvatarPicker } from '../shared/avatar-picker.jsx';
import { IconTooltip } from '../shared/icon-tooltip.jsx';
import { TabBar } from '../shared/tab-bar.jsx';
import { LeaderboardDateRangeModal } from './leaderboard-date-range-modal.jsx';
import { useTeamLeaderboard } from '../../hooks/use-team-leaderboard.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useThemeColors } from '../../theme/colors.js';
import { formatMetricValue } from '../../utils/leaderboard-metric-format.js';
import { rankMeta } from '../../utils/leaderboard-rank-meta.js';
import { toISODate } from '../../utils/date-field-format.js';
import { getUserInitials } from '../../utils/user-initials.js';
import { METRIC_OPTIONS } from '../../utils/gamification-metric-options.js';

const PERIOD_OPTIONS = [
  { id: 'week', name: 'Última semana' },
  { id: 'month', name: 'Último mes' },
  { id: 'year', name: 'Último año' },
  { id: 'custom', name: 'Rango personalizado' },
  { id: 'all', name: 'Histórico' },
];

const METRIC_TABS = METRIC_OPTIONS.map((m) => ({ id: m.id, icon: m.icon, label: m.name }));

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

// `isRecord` (puesto 1 en modo Histórico) reusa el estilo ámbar que antes
// vivía en una card aparte, debajo de las 5 filas -- mezclado acá para que
// el puesto 1 sea LA MISMA fila que el récord, no dos números distintos
// para la misma persona compitiendo por atención (pedido real, 2026-10-15).
function LeaderboardRow({ row, metric, idPrefix, accent = false, isRecord = false }) {
  const containerClass = isRecord
    ? 'border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10'
    : accent
    ? 'border-l-4 border-primary bg-primary-tint-subtle dark:bg-primary/10'
    : 'bg-white dark:bg-surface';

  return (
    <View className={`flex-row items-center gap-3 rounded-xl p-2 ${containerClass}`} nativeID={idPrefix} testID={idPrefix}>
      <RankBadge rank={row.rank} />
      <AvatarPicker accessibilityLabel={`Foto de ${row.name}`} idPrefix={`${idPrefix}-avatar`} initials={getUserInitials(row.name)} size={32} uri={row.avatarUrl} />
      <View className="flex-1" nativeID={`${idPrefix}-text`} testID={`${idPrefix}-text`}>
        {isRecord && (
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-record-label`} testID={`${idPrefix}-record-label`}>
            Récord del equipo
          </Text>
        )}
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {row.name}
        </Text>
      </View>
      <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-value`} testID={`${idPrefix}-value`}>
        {formatMetricValue(metric, row.value)}
      </Text>
    </View>
  );
}

export function LeaderboardTab({ teamId }) {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const viewerName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim() || 'Vos';

  const [activeMetric, setActiveMetric] = useState(METRIC_OPTIONS[0].id);
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  // Período justo antes de abrir el modal de rango -- si el usuario
  // cancela sin aplicar, se restaura este valor. Cuando se abre desde el
  // lápiz del chip (ya en 'custom') esto es un no-op: cancelar deja
  // `period` como estaba. Cuando se abre por elegir 'custom' en el select
  // desde otro período, cancelar vuelve a ese período anterior -- así
  // nunca queda trabado en 'custom' sin rango confirmado.
  const periodBeforeCustomRef = useRef('month');

  const handlePeriodChange = (next) => {
    if (next === 'custom') {
      periodBeforeCustomRef.current = period;
      setRangeModalVisible(true);
    }
    setPeriod(next);
  };

  const openRangeModal = () => {
    periodBeforeCustomRef.current = period;
    setRangeModalVisible(true);
  };

  const cancelRangeModal = () => {
    setRangeModalVisible(false);
    setPeriod(periodBeforeCustomRef.current);
  };

  const applyRangeModal = (from, to) => {
    setFromDate(from);
    setToDate(to);
    setRangeModalVisible(false);
  };

  const from = period === 'custom' && fromDate ? toISODate(fromDate) : undefined;
  const to = period === 'custom' && toDate ? toISODate(toDate) : undefined;
  const hasConfirmedRange = period === 'custom' && Boolean(fromDate) && Boolean(toDate);

  const { leaderboard, loading, error } = useTeamLeaderboard(teamId, { metric: activeMetric, period, from, to });

  const viewerInTop = Boolean(leaderboard?.rows?.some((row) => String(row.userId) === String(leaderboard?.viewerRank?.userId)));
  const isHistoric = period === 'all';
  // Histórico: mismas 5 filas de siempre + la posición propia si no está
  // en el top 5 -- el puesto 1 pasa a ser el récord del equipo (mismo dato,
  // no uno aparte) con estilo ámbar. Mismo criterio que antes de esta
  // reestructura (CLAUDE.md, pedido real 2026-10-15), sin cambios de
  // comportamiento -- solo se movió de "una vez por sección" a "una vez
  // para la métrica activa".
  const visibleRows = isHistoric && leaderboard?.record
    ? [
        { userId: leaderboard.record.userId, name: leaderboard.record.name, avatarUrl: null, value: leaderboard.record.value, rank: 1 },
        ...(leaderboard?.rows ?? []).filter((row) => row.rank !== 1),
      ]
    : (leaderboard?.rows ?? []);

  return (
    <View className="rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="leaderboard-tab-root" testID="leaderboard-tab-root">
      <View className="flex-row items-start justify-between gap-3" nativeID="leaderboard-tab-header" testID="leaderboard-tab-header">
        <View className="flex-1" nativeID="leaderboard-tab-subtabs-wrap" testID="leaderboard-tab-subtabs-wrap">
          <TabBar active={activeMetric} onChange={setActiveMetric} scope="leaderboard-tab-subtabs" tabs={METRIC_TABS} variant="compact" />
        </View>
        <View nativeID="leaderboard-tab-period-wrap" style={{ width: 160 }} testID="leaderboard-tab-period-wrap">
          <ResponsiveSelectField className="mb-0" dense hideErrorRow hideLabel label="Período" onChange={handlePeriodChange} options={PERIOD_OPTIONS} plain required value={period} />
        </View>
      </View>

      {hasConfirmedRange && (
        <View className="mb-3 flex-row items-center gap-2" nativeID="leaderboard-tab-range-chip" testID="leaderboard-tab-range-chip">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="calendar-range" size={14} />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID="leaderboard-tab-range-chip-label" testID="leaderboard-tab-range-chip-label">
            {fromDate} – {toDate}
          </Text>
          <IconTooltip idPrefix="leaderboard-tab-range-edit-tooltip" label="Editar rango" position="bottom">
            <Pressable
              className="h-6 w-6 items-center justify-center rounded-full hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
              nativeID="leaderboard-tab-range-edit-button"
              onPress={openRangeModal}
              testID="leaderboard-tab-range-edit-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={14} />
            </Pressable>
          </IconTooltip>
        </View>
      )}

      <View className="border-t border-slate-100 pt-3 dark:border-slate-800" nativeID="leaderboard-tab-body" testID="leaderboard-tab-body">
        {loading && (
          <View className="items-center py-4" nativeID="leaderboard-tab-loading" testID="leaderboard-tab-loading">
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        )}

        {!loading && error && (
          <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-error" testID="leaderboard-tab-error">
            No pudimos cargar este leaderboard.
          </Text>
        )}

        {!loading && !error && leaderboard && visibleRows.length === 0 && (
          <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="leaderboard-tab-empty" testID="leaderboard-tab-empty">
            Todavía no hay datos para esta métrica en este período.
          </Text>
        )}

        {!loading && !error && leaderboard && visibleRows.length > 0 && (
          <View className="gap-2" nativeID="leaderboard-tab-rows" testID="leaderboard-tab-rows">
            {visibleRows.map((row) => (
              <LeaderboardRow idPrefix={`leaderboard-tab-row-${row.userId}`} isRecord={isHistoric && row.rank === 1} key={row.userId} metric={activeMetric} row={row} />
            ))}
            {leaderboard.viewerRank && !viewerInTop && (
              <LeaderboardRow accent idPrefix="leaderboard-tab-viewer-row" metric={activeMetric} row={{ ...leaderboard.viewerRank, name: viewerName }} />
            )}
          </View>
        )}
      </View>

      <LeaderboardDateRangeModal
        initialFrom={fromDate}
        initialTo={toDate}
        onCancel={cancelRangeModal}
        onConfirm={applyRangeModal}
        visible={rangeModalVisible}
      />
    </View>
  );
}
```

- [ ] **Step 2: Run tests + lint**

Run: `npm test && npm run lint`
Expected: both green. No existing test imports `MetricSection` (it was never exported), so removing it cannot break a test.

- [ ] **Step 3: Commit**

```bash
git add components/team/leaderboard-tab.jsx
git commit -m "feat(leaderboard): metric subtabs with shared period + range modal

Reemplaza las 6 secciones colapsables por subpestañas (TabBar, igual que
competitions-tab.jsx) con período global compartido y rango personalizado
en modal en vez de inputs inline."
```

---

### Task 4: Manual preview verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and open the team detail screen's Leaderboard tab (web preview)**

- [ ] **Step 2: Verify metric switching preserves period**

Select "Último año" on the Distancia tab, switch to the Ritmo tab, confirm the period selector still reads "Último año" and the data shown corresponds to that period.

- [ ] **Step 3: Verify custom-range open/cancel/apply cycle**

Select "Rango personalizado" from the period selector — the modal opens. Click Cancelar without filling dates — confirm the period selector reverts to whatever it was before (not stuck on "Rango personalizado" with no chip shown). Reopen, fill both dates with Desde ≤ Hasta, click Aplicar — confirm the modal closes, the chip appears with the chosen range, and the leaderboard refetches for that range.

- [ ] **Step 4: Verify the edit pencil**

Click the pencil on the chip — confirm the modal reopens pre-filled with the same two dates already chosen.

- [ ] **Step 5: Verify inverted-range guard**

Open the modal, set Desde after Hasta — confirm the Aplicar button is disabled and the inline error shows.

- [ ] **Step 6: Verify Histórico record styling unchanged**

Select "Histórico" — confirm rank 1 still renders with the amber "Récord del equipo" styling, same as before this change.

- [ ] **Step 7: Verify mobile-width layout**

Resize the preview to mobile width — confirm `TabBar` scrolls horizontally without breaking the header row layout, same as `competitions-tab.jsx`'s subtabs do today.

- [ ] **Step 8: Report findings**

If every check in Steps 2-7 passes, the task is done — no commit needed (verification-only task). If anything fails, fix the relevant file from Task 2 or 3, re-run `npm test && npm run lint`, commit the fix, and re-verify.

---

## Self-Review Notes

- **Spec coverage:** header layout (Task 3 Step 1), icon per metric (Task 1), global period (Task 3's single `period` state, no per-metric duplication), modal instead of inline dates (Task 2 + Task 3's wiring), chip with edit pencil (Task 3), removed collapse toggle (Task 3 — `MetricSection`/`expanded` gone), single data fetch (Task 3 — one `useTeamLeaderboard` call) — all covered.
- **Type consistency:** `LeaderboardDateRangeModal`'s `onConfirm(from, to)` signature (Task 2) matches `applyRangeModal(from, to)`'s call site in Task 3. `METRIC_TABS` built from `METRIC_OPTIONS[i].icon` (Task 1) matches what `TabBar` expects (`tabs: [{id, icon, label}]`).
- **No placeholders:** every step has literal code, not a description of code.
