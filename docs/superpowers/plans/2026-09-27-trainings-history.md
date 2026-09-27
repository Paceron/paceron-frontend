# Historial de Entrenamientos (piezas 2/3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el stub `components/calendar/trainings-history-tab.jsx` por una pestaña de
historial funcional, compartida entre corredor y entrenador, contra los endpoints reales de
Gap 13 (`docs/BACKEND_API_GAPS.md`).

**Architecture:** Capa de datos (service + normalizers + hook con paginación "cargar más")
independiente de la UI. La UI es un único componente `TrainingsHistoryTab` parametrizado por
`role`, compuesto de: filtros de primer/segundo nivel dentro del `FilterPanel` ya existente,
una lista de cards (`TrainingsHistoryRow`) con menú "..." (`AnimatedDropdown` montado una sola
vez) y selección múltiple + borrado en lote (mismo patrón ya implementado en
`components/team/group-calendar-screen.jsx`/`exercises-catalog-tab.jsx`), y navegación a la
pantalla de revisión ya construida (`session-review-screen.jsx`).

**Tech Stack:** React Native + React Native Web, NativeWind, TanStack Query, Zustand
(`session-review-store.js` para la navegación de salida), Jest para lógica pura.

**Spec:** `docs/superpowers/specs/2026-09-27-trainings-history-design.md`

## Global Constraints

- Todo elemento visual (`View`/`Text`/`Pressable`/`Modal`/etc., incluidas variantes
  `Animated.*`) lleva `nativeID` y `testID` kebab-case, únicos en su contexto — enforced por
  `local/require-native-id`.
- Todo `Modal` con backdrop cierra al tocar afuera (`Pressable` backdrop con el mismo handler
  que `onRequestClose`) — enforced por `local/require-modal-backdrop-close`.
- Nunca `SelectField`/`PickerField` directo — siempre `ResponsiveSelectField` — enforced por
  `local/no-direct-select-field`.
- Sin tests de render de componentes (convención del proyecto) — solo Jest sobre lógica pura.
  La lógica no trivial de paginación/filtros se extrae a funciones puras exportadas
  específicamente para poder testearla sin renderizar nada ni montar `QueryClientProvider`
  (este repo no tiene ningún precedente de test de hook vía `renderHook` — no se introduce
  ahora).
- `DateField` (`components/forms/fields.jsx`) devuelve `'YYYY-MM-DD'` en web pero
  `'DD/MM/YYYY'` en nativo — **siempre** pasar su valor por `toISODate()`
  (`utils/date-field-format.js`) antes de comparar o mandar al backend.
- Estado de servidor via TanStack Query (hooks `use-*.js`), nunca Zustand para esto.
- Sumarización y agrupación visual quedan explícitamente fuera de esta pieza (mejora futura).

---

## Task 1: Utilidades puras de paginación (`utils/trainings-history-pagination.js`)

**Files:**
- Create: `utils/trainings-history-pagination.js`
- Test: `__tests__/trainings-history-pagination.test.js`

**Interfaces:**
- Produces: `computeFiltersKey(filters: object): string`,
  `shouldResetPage(prevFiltersKey: string|null, nextFiltersKey: string, currentPage: number): boolean`,
  `mergeHistoryPage(accumulated: {filtersKey, pageKey, items}, filtersKey: string, pageKey: string, page: number, incomingItems: array): {filtersKey, pageKey, items}`,
  `computeHasMore(page: number, pageSize: number, total: number): boolean`,
  `visibleHistoryItems(accumulated: {filtersKey, items}, filtersKey: string): array`.
  Consumidas por Task 5 (`hooks/use-trainings-history.js`).

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/trainings-history-pagination.test.js
import {
  computeFiltersKey,
  shouldResetPage,
  mergeHistoryPage,
  computeHasMore,
  visibleHistoryItems,
} from '../utils/trainings-history-pagination.js';

describe('computeFiltersKey', () => {
  test('ignora el campo page', () => {
    expect(computeFiltersKey({ teamId: '3', page: 1 })).toBe(computeFiltersKey({ teamId: '3', page: 2 }));
  });

  test('distingue filtros distintos', () => {
    expect(computeFiltersKey({ teamId: '3' })).not.toBe(computeFiltersKey({ teamId: '4' }));
  });
});

describe('shouldResetPage', () => {
  test('false en la primera carga (prevFiltersKey null)', () => {
    expect(shouldResetPage(null, 'a', 1)).toBe(false);
  });

  test('false si los filtros no cambiaron', () => {
    expect(shouldResetPage('a', 'a', 3)).toBe(false);
  });

  test('false si ya está en página 1 (nada que resetear)', () => {
    expect(shouldResetPage('a', 'b', 1)).toBe(false);
  });

  test('true si cambian los filtros estando en página > 1', () => {
    expect(shouldResetPage('a', 'b', 2)).toBe(true);
  });
});

describe('mergeHistoryPage', () => {
  const accumulated = { filtersKey: 'a', pageKey: 'a:1', items: [{ id: '1' }, { id: '2' }] };

  test('página 1 reemplaza el acumulado', () => {
    const result = mergeHistoryPage(accumulated, 'b', 'b:1', 1, [{ id: '9' }]);
    expect(result).toEqual({ filtersKey: 'b', pageKey: 'b:1', items: [{ id: '9' }] });
  });

  test('página > 1 concatena al acumulado existente', () => {
    const result = mergeHistoryPage(accumulated, 'a', 'a:2', 2, [{ id: '3' }]);
    expect(result).toEqual({ filtersKey: 'a', pageKey: 'a:2', items: [{ id: '1' }, { id: '2' }, { id: '3' }] });
  });
});

describe('computeHasMore', () => {
  test('true cuando quedan más resultados', () => {
    expect(computeHasMore(1, 20, 45)).toBe(true);
  });

  test('false cuando la página cubre el total', () => {
    expect(computeHasMore(3, 20, 45)).toBe(false);
  });

  test('false cuando calza exacto', () => {
    expect(computeHasMore(2, 20, 40)).toBe(false);
  });
});

describe('visibleHistoryItems', () => {
  test('devuelve el acumulado si la key coincide', () => {
    const accumulated = { filtersKey: 'a', items: [{ id: '1' }] };
    expect(visibleHistoryItems(accumulated, 'a')).toEqual([{ id: '1' }]);
  });

  test('devuelve vacío si la key no coincide (filtros cambiaron, todavía sin respuesta nueva)', () => {
    const accumulated = { filtersKey: 'a', items: [{ id: '1' }] };
    expect(visibleHistoryItems(accumulated, 'b')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest trainings-history-pagination -v`
Expected: FAIL — `Cannot find module '../utils/trainings-history-pagination.js'`

- [ ] **Step 3: Write the implementation**

```js
// utils/trainings-history-pagination.js

// Estado acumulado de "cargar más" (mismo espíritu que hooks/use-team-search.js,
// pero acá los filtros se recalculan cada render en vez de dispararse por una
// acción explícita de "buscar" — estas funciones puras son las que deciden
// cuándo se resetea la página y cómo se combina cada respuesta nueva, para que
// hooks/use-trainings-history.js quede como un wrapper fino sobre useQuery.

export function computeFiltersKey(filters) {
  const { page: _page, ...rest } = filters;
  return JSON.stringify(rest);
}

export function shouldResetPage(prevFiltersKey, nextFiltersKey, currentPage) {
  return prevFiltersKey !== null && prevFiltersKey !== nextFiltersKey && currentPage !== 1;
}

export function mergeHistoryPage(accumulated, filtersKey, pageKey, page, incomingItems) {
  return {
    filtersKey,
    pageKey,
    items: page === 1 ? incomingItems : [...accumulated.items, ...incomingItems],
  };
}

export function computeHasMore(page, pageSize, total) {
  return page * pageSize < total;
}

export function visibleHistoryItems(accumulated, filtersKey) {
  return accumulated.filtersKey === filtersKey ? accumulated.items : [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest trainings-history-pagination -v`
Expected: PASS, 9/9.

- [ ] **Step 5: Commit**

```bash
git add utils/trainings-history-pagination.js __tests__/trainings-history-pagination.test.js
git commit -m "feat(trainings-history): add pure pagination-accumulation helpers"
```

---

## Task 2: Utilidades puras de rango de fechas (`utils/trainings-history-filters.js`)

**Files:**
- Create: `utils/trainings-history-filters.js`
- Test: `__tests__/trainings-history-filters.test.js`

**Interfaces:**
- Consumes: `toISODate(value: string): string` de `utils/date-field-format.js` (ya existe).
- Produces: `buildDateRangeFilters(dateFromRaw: string, dateToRaw: string): {dateFrom: string|null, dateTo: string|null, error: string|null}`.
  Consumido por Task 9 (`trainings-history-tab.jsx`).

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/trainings-history-filters.test.js
import { buildDateRangeFilters } from '../utils/trainings-history-filters.js';

describe('buildDateRangeFilters', () => {
  test('sin ninguna fecha cargada, no filtra y sin error', () => {
    expect(buildDateRangeFilters('', '')).toEqual({ dateFrom: null, dateTo: null, error: null });
  });

  test('con una sola fecha cargada, no manda ninguna (política de a par)', () => {
    expect(buildDateRangeFilters('2026-09-20', '')).toEqual({ dateFrom: null, dateTo: null, error: null });
    expect(buildDateRangeFilters('', '2026-09-20')).toEqual({ dateFrom: null, dateTo: null, error: null });
  });

  test('con ambas en formato ISO (web), rango válido', () => {
    expect(buildDateRangeFilters('2026-09-01', '2026-09-20')).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-20', error: null });
  });

  test('con ambas en formato DD/MM/YYYY (nativo), normaliza a ISO', () => {
    expect(buildDateRangeFilters('01/09/2026', '20/09/2026')).toEqual({ dateFrom: '2026-09-01', dateTo: '2026-09-20', error: null });
  });

  test('mismo día en ambos extremos es válido', () => {
    expect(buildDateRangeFilters('2026-09-20', '2026-09-20')).toEqual({ dateFrom: '2026-09-20', dateTo: '2026-09-20', error: null });
  });

  test('dateFrom posterior a dateTo devuelve error y no filtra', () => {
    expect(buildDateRangeFilters('2026-09-20', '2026-09-01')).toEqual({
      dateFrom: null,
      dateTo: null,
      error: 'La fecha "desde" no puede ser posterior a la fecha "hasta".',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest trainings-history-filters -v`
Expected: FAIL — `Cannot find module '../utils/trainings-history-filters.js'`

- [ ] **Step 3: Write the implementation**

```js
// utils/trainings-history-filters.js
import { toISODate } from './date-field-format.js';

// Política "de a par": si falta cualquiera de las dos fechas, ninguna viaja
// al backend (evita el 400 de date_from/date_to sueltos, ver Gap 13). Los
// valores crudos vienen de DateField, que devuelve 'YYYY-MM-DD' en web pero
// 'DD/MM/YYYY' en nativo — toISODate() normaliza antes de comparar.
export function buildDateRangeFilters(dateFromRaw, dateToRaw) {
  const dateFrom = toISODate(dateFromRaw);
  const dateTo = toISODate(dateToRaw);
  if (!dateFrom || !dateTo) return { dateFrom: null, dateTo: null, error: null };
  if (dateFrom > dateTo) {
    return { dateFrom: null, dateTo: null, error: 'La fecha "desde" no puede ser posterior a la fecha "hasta".' };
  }
  return { dateFrom, dateTo, error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest trainings-history-filters -v`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add utils/trainings-history-filters.js __tests__/trainings-history-filters.test.js
git commit -m "feat(trainings-history): add pure date-range filter validation"
```

---

## Task 3: Service layer (`services/trainingsHistory.js`)

**Files:**
- Create: `services/trainingsHistory.js`

**Interfaces:**
- Consumes: `api` default export from `services/api.js` (`.get(path)`, `.delete(path)` — both
  already exist, confirmed in `services/api.js:88-94`).
- Produces: `getWorkoutFeedbackHistory(userId: string, filters: object): Promise<dto>`,
  `getAdministeredWorkoutFeedbackHistory(userId: string, filters: object): Promise<dto>`,
  `deleteWorkoutFeedback(feedbackId: string): Promise<void>`. Consumidos por Task 5 y Task 6.
  `filters` shape: `{ teamId, groupId, dateFrom, dateTo, exerciseId, setNumber, athleteUserId, sort, order, page, pageSize }` — todos opcionales salvo `sort`/`order`/`page`/`pageSize` que tienen default.

- [ ] **Step 1: Write the implementation**

No hay lógica pura que testear acá (es transporte HTTP directo, mismo criterio que
`services/calendar.js` — sin test dedicado, se verifica junto con el hook que lo consume).

```js
// services/trainingsHistory.js
import api from './api.js';

function buildHistoryParams(filters) {
  const params = new URLSearchParams();
  if (filters.teamId) params.set('team_id', filters.teamId);
  if (filters.groupId) params.set('group_id', filters.groupId);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.exerciseId) params.set('exercise_id', filters.exerciseId);
  if (filters.setNumber) params.set('set_number', filters.setNumber);
  if (filters.athleteUserId) params.set('athlete_user_id', filters.athleteUserId);
  params.set('sort', filters.sort ?? 'feedback_date');
  params.set('order', filters.order ?? 'desc');
  params.set('page', String(filters.page ?? 1));
  params.set('page_size', String(filters.pageSize ?? 20));
  return params;
}

export async function getWorkoutFeedbackHistory(userId, filters) {
  return await api.get(`/users/${userId}/workout-feedback-history?${buildHistoryParams(filters).toString()}`);
}

export async function getAdministeredWorkoutFeedbackHistory(userId, filters) {
  return await api.get(`/users/${userId}/administered-workout-feedback-history?${buildHistoryParams(filters).toString()}`);
}

export async function deleteWorkoutFeedback(feedbackId) {
  return await api.delete(`/workout-feedback/${feedbackId}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add services/trainingsHistory.js
git commit -m "feat(trainings-history): add service layer for Gap 13 endpoints"
```

---

## Task 4: Normalizers (`services/normalizers.js`)

**Files:**
- Modify: `services/normalizers.js` (agregar al final del archivo, junto a las demás
  funciones `to*Model`)
- Test: `__tests__/trainings-history-normalizers.test.js`

**Interfaces:**
- Produces: `toWorkoutFeedbackHistoryItemModel(dto: object): object`,
  `toWorkoutFeedbackHistoryResponseModel(dto: object): {items, total, page, pageSize, availableAthletes, availableExercises}`.
  Consumidos por Task 5.

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/trainings-history-normalizers.test.js
import { toWorkoutFeedbackHistoryItemModel, toWorkoutFeedbackHistoryResponseModel } from '../services/normalizers.js';

const rawItem = {
  id: 501, athlete_user_id: 12, athlete_name: 'Juan Pérez',
  team_id: 3, team_name: 'Runners Norte', group_id: 7, group_name: 'Elite AM',
  session_instance_id: 88, date: '2026-09-25', session_name: 'Series de velocidad',
  exercise_id: 44, exercise_name: 'Series 400m', catalog_exercise_id: 9, set_number: 2,
  completion_status: 'completed', duration_ms: 95000, active_duration_ms: 90000,
  distance_meters: 412.5, started_at: '2026-09-25T08:15:00Z', ended_at: '2026-09-25T08:16:35Z',
};

describe('toWorkoutFeedbackHistoryItemModel', () => {
  test('mapea snake_case a camelCase con ids como string', () => {
    expect(toWorkoutFeedbackHistoryItemModel(rawItem)).toEqual({
      id: '501', athleteUserId: '12', athleteName: 'Juan Pérez',
      teamId: '3', teamName: 'Runners Norte', groupId: '7', groupName: 'Elite AM',
      sessionInstanceId: '88', date: '2026-09-25', sessionName: 'Series de velocidad',
      exerciseId: '44', exerciseName: 'Series 400m', catalogExerciseId: '9', setNumber: 2,
      completionStatus: 'completed', durationMs: 95000, activeDurationMs: 90000,
      distanceMeters: 412.5, startedAt: '2026-09-25T08:15:00Z', endedAt: '2026-09-25T08:16:35Z',
    });
  });

  test('huérfano: team/group/catalog null se preservan como null, no como "null" string', () => {
    const orphan = { ...rawItem, team_id: null, team_name: null, group_id: null, group_name: null, catalog_exercise_id: null, session_name: null, exercise_name: null };
    const result = toWorkoutFeedbackHistoryItemModel(orphan);
    expect(result.teamId).toBeNull();
    expect(result.groupId).toBeNull();
    expect(result.catalogExerciseId).toBeNull();
    expect(result.sessionName).toBeNull();
    expect(result.exerciseName).toBeNull();
  });
});

describe('toWorkoutFeedbackHistoryResponseModel', () => {
  test('mapea items, paginación y pools de segundo nivel', () => {
    const dto = {
      items: [rawItem],
      total: 137, page: 1, page_size: 20,
      available_athletes: [{ id: 12, name: 'Juan Pérez' }],
      available_exercises: [{ id: 9, name: 'Series 400m' }],
    };
    const result = toWorkoutFeedbackHistoryResponseModel(dto);
    expect(result.total).toBe(137);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('501');
    expect(result.availableAthletes).toEqual([{ id: '12', name: 'Juan Pérez' }]);
    expect(result.availableExercises).toEqual([{ id: '9', name: 'Series 400m' }]);
  });

  test('items/pools ausentes no rompen (arrays vacíos)', () => {
    const result = toWorkoutFeedbackHistoryResponseModel({ total: 0, page: 1, page_size: 20 });
    expect(result.items).toEqual([]);
    expect(result.availableAthletes).toEqual([]);
    expect(result.availableExercises).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest trainings-history-normalizers -v`
Expected: FAIL — `toWorkoutFeedbackHistoryItemModel is not a function`

- [ ] **Step 3: Write the implementation**

Agregar al final de `services/normalizers.js`:

```js
// Historial de entrenamientos realizados (Gap 13) — una fila por
// serie/set de workout_feedback, cruzando sesiones/equipos/grupos.
export function toWorkoutFeedbackHistoryItemModel(dto) {
  return {
    id: String(dto.id),
    athleteUserId: String(dto.athlete_user_id),
    athleteName: dto.athlete_name,
    teamId: dto.team_id != null ? String(dto.team_id) : null,
    teamName: dto.team_name,
    groupId: dto.group_id != null ? String(dto.group_id) : null,
    groupName: dto.group_name,
    sessionInstanceId: String(dto.session_instance_id),
    date: dto.date,
    sessionName: dto.session_name,
    exerciseId: String(dto.exercise_id),
    exerciseName: dto.exercise_name,
    catalogExerciseId: dto.catalog_exercise_id != null ? String(dto.catalog_exercise_id) : null,
    setNumber: dto.set_number,
    completionStatus: dto.completion_status,
    durationMs: dto.duration_ms,
    activeDurationMs: dto.active_duration_ms,
    distanceMeters: dto.distance_meters,
    startedAt: dto.started_at,
    endedAt: dto.ended_at,
  };
}

export function toWorkoutFeedbackHistoryResponseModel(dto) {
  return {
    items: (dto.items ?? []).map(toWorkoutFeedbackHistoryItemModel),
    total: dto.total,
    page: dto.page,
    pageSize: dto.page_size,
    availableAthletes: (dto.available_athletes ?? []).map((a) => ({ id: String(a.id), name: a.name })),
    availableExercises: (dto.available_exercises ?? []).map((e) => ({ id: String(e.id), name: e.name })),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest trainings-history-normalizers -v`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add services/normalizers.js __tests__/trainings-history-normalizers.test.js
git commit -m "feat(trainings-history): add normalizers for Gap 13 response shape"
```

---

## Task 5: Hook de datos (`hooks/use-trainings-history.js`)

**Files:**
- Create: `hooks/use-trainings-history.js`

**Interfaces:**
- Consumes: `getWorkoutFeedbackHistory`, `getAdministeredWorkoutFeedbackHistory`, `deleteWorkoutFeedback`
  (Task 3); `toWorkoutFeedbackHistoryResponseModel` (Task 4); `computeFiltersKey`, `shouldResetPage`,
  `mergeHistoryPage`, `computeHasMore`, `visibleHistoryItems` (Task 1).
- Produces: `useTrainingsHistory(role: 'runner'|'trainer', userId: string, filters: object): {items, total, hasMore, availableAthletes, availableExercises, loading, isFetching, loadMore: () => void}`.
  `useDeleteWorkoutFeedbackMutation(role, userId, filters): {deleteFeedback: (feedbackId: string) => Promise<{success: boolean, error?: string}>, isDeleting: boolean}`.
  Ambos consumidos por Task 9 (`trainings-history-tab.jsx`).

Sin test dedicado a este archivo (wrapper fino sobre `useQuery`/`useMutation`, la lógica que
importa ya está testeada en Task 1 — mismo criterio que `hooks/use-aggregated-calendar.js`,
sin test file propio en este repo).

- [ ] **Step 1: Write the implementation**

```js
// hooks/use-trainings-history.js
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWorkoutFeedbackHistory,
  getAdministeredWorkoutFeedbackHistory,
  deleteWorkoutFeedback,
} from '../services/trainingsHistory.js';
import { toWorkoutFeedbackHistoryResponseModel } from '../services/normalizers.js';
import {
  computeFiltersKey,
  shouldResetPage,
  mergeHistoryPage,
  computeHasMore,
  visibleHistoryItems,
} from '../utils/trainings-history-pagination.js';

function historyQueryKey(role, userId, filtersKey, page) {
  return ['trainings-history', role, userId, filtersKey, page];
}

export function useTrainingsHistory(role, userId, filters) {
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState({ filtersKey: null, pageKey: null, items: [] });

  const filtersKey = computeFiltersKey(filters);
  if (shouldResetPage(accumulated.filtersKey, filtersKey, page)) {
    setPage(1);
  }

  const fetcher = role === 'trainer' ? getAdministeredWorkoutFeedbackHistory : getWorkoutFeedbackHistory;
  const query = useQuery({
    queryKey: historyQueryKey(role, userId, filtersKey, page),
    queryFn: () => fetcher(userId, { ...filters, page }).then(toWorkoutFeedbackHistoryResponseModel),
    enabled: Boolean(userId && (role !== 'trainer' || filters.teamId)),
  });

  const pageKey = `${filtersKey}:${page}`;
  if (query.isSuccess && accumulated.pageKey !== pageKey) {
    setAccumulated(mergeHistoryPage(accumulated, filtersKey, pageKey, page, query.data.items));
  }

  return {
    items: visibleHistoryItems(accumulated, filtersKey),
    total: query.data?.total ?? 0,
    hasMore: query.data ? computeHasMore(page, query.data.pageSize ?? 20, query.data.total) : false,
    availableAthletes: query.data?.availableAthletes ?? [],
    availableExercises: query.data?.availableExercises ?? [],
    loading: query.isLoading,
    isFetching: query.isFetching,
    loadMore: () => setPage((p) => p + 1),
  };
}

// Borrado individual (usado en lote desde el caller vía Promise.all, ver
// trainings-history-tab.jsx) — mismo shape {success, error} que
// hooks/use-exercises.js#useExerciseMutations para que el caller maneje
// éxito/fallo parcial de la misma forma ya establecida en el repo.
export function useDeleteWorkoutFeedbackMutation(role, userId, filters) {
  const queryClient = useQueryClient();
  const filtersKey = computeFiltersKey(filters);

  const mutation = useMutation({
    mutationFn: async (feedbackId) => {
      try {
        await deleteWorkoutFeedback(feedbackId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings-history', role, userId, filtersKey] });
    },
  });

  return { deleteFeedback: mutation.mutateAsync, isDeleting: mutation.isPending };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-trainings-history.js
git commit -m "feat(trainings-history): add data hook with load-more pagination"
```

---

## Task 6: Card de fila (`components/calendar/trainings-history-row.jsx`)

**Files:**
- Create: `components/calendar/trainings-history-row.jsx`

**Interfaces:**
- Consumes: `formatClock(ms)` de `utils/time.js`, `formatMeters(meters)` de `utils/distance.js`,
  `formatDisplayDate(isoDate)` de `utils/format-date-display.js` (las tres ya existen).
- Produces: `TrainingsHistoryRow({ item, role, selectionMode, selected, onToggleSelected, onOpenMenu, containerRef })`
  — `item` es un `WorkoutFeedbackHistoryItemModel` (Task 4). `onOpenMenu(anchor, item)` reporta
  la posición medida contra `containerRef` (mismo patrón que `ExerciseMenuButton`,
  `components/plans/exercises-catalog-tab.jsx:40-65`). Consumido por Task 9.

- [ ] **Step 1: Write the implementation**

No hay lógica pura nueva acá (presentacional) — sin test dedicado, mismo criterio que el resto
de las cards del repo (`upcoming-trainings-grid.jsx`, sin test de render).

```jsx
// components/calendar/trainings-history-row.jsx
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatClock } from '../../utils/time.js';
import { formatMeters } from '../../utils/distance.js';
import { formatDisplayDate } from '../../utils/format-date-display.js';

const STATUS_META = {
  completed: { label: 'Completada', color: 'text-emerald-700 dark:text-emerald-400', icon: 'check-circle' },
  skipped: { label: 'Saltada', color: 'text-slate-500 dark:text-slate-400', icon: 'skip-next-circle-outline' },
};

function StatusBadge({ status, idPrefix }) {
  const meta = STATUS_META[status] ?? { label: status ?? 'Sin estado', color: 'text-slate-400 dark:text-slate-500', icon: 'circle-outline' };
  return (
    <View className="flex-row items-center gap-1" nativeID={idPrefix} testID={idPrefix}>
      <MaterialCommunityIcons color="currentColor" name={meta.icon} size={13} style={{ color: 'inherit' }} />
      <Text className={`text-xs font-medium ${meta.color}`} nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>{meta.label}</Text>
    </View>
  );
}

function MenuToggle({ item, onOpenMenu, containerRef, idPrefix }) {
  const colors = useThemeColors();
  const ref = useRef(null);

  const handlePress = () => {
    if (!containerRef.current || !ref.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu({ x: x - containerX, y: y - containerY, width, height }, item);
      });
    });
  };

  return (
    <Pressable
      ref={ref}
      accessibilityLabel="Más opciones"
      className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800"
      nativeID={idPrefix}
      onPress={handlePress}
      testID={idPrefix}
    >
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-vertical" size={18} />
    </Pressable>
  );
}

export function TrainingsHistoryRow({ item, role, selectionMode, selected, onToggleSelected, onOpenMenu, containerRef }) {
  const idPrefix = `trainings-history-row-${item.id}`;
  const statLine = [
    `Serie ${item.setNumber}`,
    item.durationMs != null ? formatClock(item.durationMs) : null,
    item.distanceMeters != null ? formatMeters(item.distanceMeters) : null,
  ].filter(Boolean).join(' · ');

  const chipLabel = role === 'trainer'
    ? (item.groupName ?? 'Sin grupo')
    : [item.teamName, item.groupName].filter(Boolean).join(' · ') || 'Sin equipo';

  return (
    <Pressable
      className={`gap-1 rounded-xl border p-3 ${selected ? 'border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface'}`}
      nativeID={idPrefix}
      onPress={() => selectionMode && onToggleSelected(item.id)}
      testID={idPrefix}
    >
      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-top`} testID={`${idPrefix}-top`}>
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-primary-label`} numberOfLines={1} testID={`${idPrefix}-primary-label`}>
          {role === 'trainer' ? (item.athleteName ?? 'Corredor') : formatDisplayDate(item.date)}
        </Text>
        <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-top-right`} testID={`${idPrefix}-top-right`}>
          <StatusBadge idPrefix={`${idPrefix}-status`} status={item.completionStatus} />
          {selectionMode ? (
            <Pressable
              accessibilityLabel={selected ? 'Quitar de la selección' : 'Agregar a la selección'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              nativeID={`${idPrefix}-checkbox`}
              onPress={() => onToggleSelected(item.id)}
              testID={`${idPrefix}-checkbox`}
            >
              <MaterialCommunityIcons color={selected ? '#8cc63e' : '#94a3b8'} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} />
            </Pressable>
          ) : (
            <MenuToggle containerRef={containerRef} idPrefix={`${idPrefix}-menu-toggle`} item={item} onOpenMenu={onOpenMenu} />
          )}
        </View>
      </View>

      {role === 'trainer' && (
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
          {formatDisplayDate(item.date)}
        </Text>
      )}

      <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-session-exercise`} numberOfLines={1} testID={`${idPrefix}-session-exercise`}>
        {[item.sessionName, item.exerciseName].filter(Boolean).join(' · ') || 'Sesión eliminada'}
      </Text>

      <View className="flex-row items-center justify-between" nativeID={`${idPrefix}-bottom`} testID={`${idPrefix}-bottom`}>
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-stat-line`} testID={`${idPrefix}-stat-line`}>
          {statLine || '—'}
        </Text>
        <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-chip`} numberOfLines={1} testID={`${idPrefix}-chip`}>
          {chipLabel}
        </Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/trainings-history-row.jsx
git commit -m "feat(trainings-history): add shared history row card"
```

---

## Task 7: Modal de borrado en lote (`components/calendar/bulk-delete-feedback-modal.jsx`)

**Files:**
- Create: `components/calendar/bulk-delete-feedback-modal.jsx`

**Interfaces:**
- Produces: `BulkDeleteFeedbackModal({ visible, count, onCancel, onConfirm })` — `onConfirm` es
  async, el modal muestra su propio spinner mientras corre. Consumido por Task 9.

Mismo patrón que `components/plans/bulk-delete-exercises-modal.jsx`, simplificado (sin la
sección de "en uso" — un feedback no tiene ese concepto).

- [ ] **Step 1: Write the implementation**

```jsx
// components/calendar/bulk-delete-feedback-modal.jsx
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function BulkDeleteFeedbackModal({ visible, count, onCancel, onConfirm }) {
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
    <Modal animationType="fade" nativeID="bulk-delete-feedback-modal" onRequestClose={handleCancel} testID="bulk-delete-feedback-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="bulk-delete-feedback-modal-backdrop" onPress={handleCancel} testID="bulk-delete-feedback-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-red-300 bg-white p-6 shadow-xl dark:border-red-900/50 dark:bg-surface" nativeID="bulk-delete-feedback-modal-card" onPress={() => {}} testID="bulk-delete-feedback-modal-card">
          <View className="mb-3 flex-row items-center gap-2" nativeID="bulk-delete-feedback-modal-header" testID="bulk-delete-feedback-modal-header">
            <MaterialCommunityIcons color="#ef4444" name="alert-outline" size={20} />
            <Text className="text-lg font-bold text-red-700 dark:text-red-400" nativeID="bulk-delete-feedback-modal-title" testID="bulk-delete-feedback-modal-title">
              Eliminar {count} registro{count === 1 ? '' : 's'}
            </Text>
          </View>

          <Text className="mb-4 text-sm leading-5 text-slate-600 dark:text-slate-300" nativeID="bulk-delete-feedback-modal-description" testID="bulk-delete-feedback-modal-description">
            Esta acción no se puede deshacer.
          </Text>

          <View className="flex-row gap-3" nativeID="bulk-delete-feedback-modal-actions" testID="bulk-delete-feedback-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={loading}
              nativeID="bulk-delete-feedback-modal-cancel-button"
              onPress={handleCancel}
              testID="bulk-delete-feedback-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="bulk-delete-feedback-modal-cancel-label" testID="bulk-delete-feedback-modal-cancel-label">Cancelar</Text>
            </Pressable>
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full bg-red-600 hover:opacity-90 active:opacity-80 disabled:opacity-50"
              disabled={loading}
              nativeID="bulk-delete-feedback-modal-confirm-button"
              onPress={handleConfirm}
              testID="bulk-delete-feedback-modal-confirm-button"
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="bulk-delete-feedback-modal-confirm-label" testID="bulk-delete-feedback-modal-confirm-label">Eliminar</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/bulk-delete-feedback-modal.jsx
git commit -m "feat(trainings-history): add bulk-delete confirmation modal"
```

---

## Task 8: Menú de fila (`components/calendar/trainings-history-row-menu.jsx`)

**Files:**
- Create: `components/calendar/trainings-history-row-menu.jsx`

**Interfaces:**
- Produces: `TrainingsHistoryRowMenu({ onSelect, onViewReview })` — panel sin estado propio,
  mismo patrón que `CalendarDayMenu` (`components/team/calendar-day-menu.jsx:8`) y
  `ExerciseActionsMenu` (`components/plans/exercises-catalog-tab.jsx:67-101`). Consumido por
  Task 9, montado dentro de un `AnimatedDropdown` (`components/shared/animated-dropdown.jsx`,
  ya existe, sin cambios).

- [ ] **Step 1: Write the implementation**

```jsx
// components/calendar/trainings-history-row-menu.jsx
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function TrainingsHistoryRowMenu({ onSelect, onViewReview }) {
  return (
    <View className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2" nativeID="trainings-history-row-menu-panel" testID="trainings-history-row-menu-panel">
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="trainings-history-row-menu-select"
        onPress={onSelect}
        testID="trainings-history-row-menu-select"
      >
        <MaterialCommunityIcons color="#64748b" name="checkbox-marked-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="trainings-history-row-menu-select-label" testID="trainings-history-row-menu-select-label">
          Seleccionar
        </Text>
      </Pressable>
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="trainings-history-row-menu-review"
        onPress={onViewReview}
        testID="trainings-history-row-menu-review"
      >
        <MaterialCommunityIcons color="#64748b" name="clipboard-text-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="trainings-history-row-menu-review-label" testID="trainings-history-row-menu-review-label">
          Ver/editar registro
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/trainings-history-row-menu.jsx
git commit -m "feat(trainings-history): add per-row context menu panel"
```

---

## Task 9: Pantalla principal (`components/calendar/trainings-history-tab.jsx`)

**Files:**
- Modify: `components/calendar/trainings-history-tab.jsx` (reemplaza el stub completo de 17
  líneas: icono + texto placeholder, `nativeID="trainings-history-tab-root"`).

**Interfaces:**
- Consumes: `useTrainingsHistory`, `useDeleteWorkoutFeedbackMutation` (Task 5);
  `TrainingsHistoryRow` (Task 6); `BulkDeleteFeedbackModal` (Task 7); `TrainingsHistoryRowMenu`
  (Task 8); `buildDateRangeFilters` (Task 2); `FilterPanel` (`components/shared/filter-panel.jsx`,
  ya existe); `AnimatedDropdown` (`components/shared/animated-dropdown.jsx`, ya existe);
  `ResponsiveSelectField` (`components/forms/responsive-select-field.jsx`, ya existe);
  `DateField` (`components/forms/fields.jsx`, ya existe); `useTeams`, `useMyMemberTeams`
  (`hooks/use-teams.js`, ya existen); `selectAdministeredTeams`
  (`store/team-store.js`, ya existe); `useGroups` (`hooks/use-groups.js`, ya existe);
  `useSessionReviewStore` (`store/session-review-store.js`, ya existe); `useAuthStore`
  (`store/auth-store.js`, ya existe, para `userId`).
- Produces: `TrainingsHistoryTab({ role })` — `role: 'runner' | 'trainer'`. Consumido por Task 10.

Sin test de render (convención del proyecto) — verificación manual: correr `npm run lint` y
`npm test` (no debe romper nada existente), y una pasada manual en preview cubriendo: filtro de
equipo, fechas de a par, selección múltiple + borrado, menú "Ver/editar registro".

- [ ] **Step 1: Write the implementation**

```jsx
// components/calendar/trainings-history-tab.jsx
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useSessionReviewStore } from '../../store/session-review-store.js';
import { useTeams, useMyMemberTeams } from '../../hooks/use-teams.js';
import { useGroups } from '../../hooks/use-groups.js';
import { selectAdministeredTeams } from '../../store/team-store.js';
import { useTrainingsHistory, useDeleteWorkoutFeedbackMutation } from '../../hooks/use-trainings-history.js';
import { buildDateRangeFilters } from '../../utils/trainings-history-filters.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { DateField, InputField } from '../forms/fields.jsx';
import { FilterPanel } from '../shared/filter-panel.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { TrainingsHistoryRow } from './trainings-history-row.jsx';
import { TrainingsHistoryRowMenu } from './trainings-history-row-menu.jsx';
import { BulkDeleteFeedbackModal } from './bulk-delete-feedback-modal.jsx';

const SORT_OPTIONS = [
  { id: 'feedback_date', name: 'Fecha' },
  { id: 'set_number', name: 'Serie' },
  { id: 'exercise_name', name: 'Ejercicio' },
];

export function TrainingsHistoryTab({ role }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const setReviewSlot = useSessionReviewStore((s) => s.setReviewSlot);
  const containerRef = useRef(null);

  const { teams: myTeams } = useMyMemberTeams(role === 'runner' ? userId : null);
  const { teams: allTeams } = useTeams();
  const administeredTeams = role === 'trainer' ? selectAdministeredTeams(allTeams, userId) : [];
  const teamOptions = role === 'trainer' ? administeredTeams : myTeams;

  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');
  const { groups: groupOptions } = useGroups(role === 'trainer' ? filterTeamId : null, userId);

  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const { dateFrom, dateTo, error: dateRangeError } = buildDateRangeFilters(dateFromInput, dateToInput);

  const [sort, setSort] = useState('feedback_date');
  const [order, setOrder] = useState('desc');
  const [filterExerciseId, setFilterExerciseId] = useState('');
  const [filterSetNumber, setFilterSetNumber] = useState('');
  const [filterAthleteId, setFilterAthleteId] = useState('');

  const handleTeamChange = (teamId) => {
    setFilterTeamId(teamId);
    setFilterGroupId('');
  };

  const filters = {
    teamId: filterTeamId || null,
    groupId: filterGroupId || null,
    dateFrom,
    dateTo,
    exerciseId: filterExerciseId || null,
    setNumber: filterSetNumber || null,
    athleteUserId: role === 'trainer' ? (filterAthleteId || null) : null,
    sort,
    order,
  };

  const { items, hasMore, availableAthletes, availableExercises, loading, isFetching, loadMore } = useTrainingsHistory(role, userId, filters);
  const { deleteFeedback } = useDeleteWorkoutFeedbackMutation(role, userId, filters);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rowMenu, setRowMenu] = useState(null); // { anchor, item } | null
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);

  const handleOpenRowMenu = (anchor, item) => setRowMenu({ anchor, item });
  const handleCloseRowMenu = () => setRowMenu(null);

  const handleToggleSelected = (itemId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const handleSelectFromMenu = () => {
    const itemId = rowMenu.item.id;
    handleCloseRowMenu();
    setSelectionMode(true);
    setSelectedIds(new Set([itemId]));
  };

  const handleExitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleViewReview = () => {
    const item = rowMenu.item;
    handleCloseRowMenu();
    setReviewSlot({
      sessionInstanceId: item.sessionInstanceId,
      date: item.date,
      sessionName: item.sessionName,
      role: role === 'trainer' ? 'trainer' : 'runner',
      athleteUserId: item.athleteUserId,
      mode: 'review',
      teamId: item.teamId,
      teamName: item.teamName,
      groupName: item.groupName,
    });
    router.push('/training-session-review');
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => deleteFeedback(id)));
    const failed = results.filter((r) => !r.success).length;
    setBulkDeleteVisible(false);
    handleExitSelection();
    if (failed > 0) {
      Toast.show({ type: 'error', text1: 'Algunos registros no se pudieron eliminar', text2: `${failed} de ${ids.length} fallaron.` });
      return;
    }
    Toast.show({ type: 'success', text1: `${ids.length} registro${ids.length === 1 ? '' : 's'} eliminado${ids.length === 1 ? '' : 's'}` });
  };

  const hasActiveFilters = Boolean(filterTeamId || filterGroupId || dateFromInput || dateToInput || filterExerciseId || filterSetNumber || filterAthleteId);
  const handleClearFilters = () => {
    setFilterTeamId('');
    setFilterGroupId('');
    setDateFromInput('');
    setDateToInput('');
    setFilterExerciseId('');
    setFilterSetNumber('');
    setFilterAthleteId('');
  };

  return (
    <View className="relative flex-1" nativeID="trainings-history-tab-root" ref={containerRef} testID="trainings-history-tab-root">
      <FilterPanel hasActiveFilters={hasActiveFilters} idPrefix="trainings-history-tab-filter" loading={loading} onClear={handleClearFilters}>
        <View className="flex-1" nativeID="trainings-history-tab-filter-team-wrapper" testID="trainings-history-tab-filter-team-wrapper">
          <ResponsiveSelectField
            dense
            disabled={teamOptions.length === 0}
            hideErrorRow
            label="Equipo"
            onChange={handleTeamChange}
            options={teamOptions.map((t) => ({ id: t.id, name: t.name }))}
            placeholder={role === 'trainer' ? 'Elegí un equipo' : 'Todos los equipos'}
            value={filterTeamId}
          />
        </View>
        {role === 'trainer' && (
          <View className="flex-1" nativeID="trainings-history-tab-filter-group-wrapper" testID="trainings-history-tab-filter-group-wrapper">
            <ResponsiveSelectField
              dense
              disabled={!filterTeamId || groupOptions.length === 0}
              hideErrorRow
              label="Grupo"
              onChange={setFilterGroupId}
              options={groupOptions.map((g) => ({ id: g.id, name: g.name }))}
              placeholder="Todos los grupos"
              value={filterGroupId}
            />
          </View>
        )}
        <View className="flex-1" nativeID="trainings-history-tab-filter-date-from-wrapper" testID="trainings-history-tab-filter-date-from-wrapper">
          <DateField label="Desde" onChange={setDateFromInput} value={dateFromInput} />
        </View>
        <View className="flex-1" nativeID="trainings-history-tab-filter-date-to-wrapper" testID="trainings-history-tab-filter-date-to-wrapper">
          <DateField label="Hasta" onChange={setDateToInput} value={dateToInput} />
        </View>
        <View className="flex-1" nativeID="trainings-history-tab-filter-sort-wrapper" testID="trainings-history-tab-filter-sort-wrapper">
          <ResponsiveSelectField dense hideErrorRow label="Ordenar por" onChange={setSort} options={SORT_OPTIONS} value={sort} />
        </View>
        <Pressable
          className="mt-6 h-12 w-12 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          nativeID="trainings-history-tab-order-toggle"
          onPress={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
          testID="trainings-history-tab-order-toggle"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name={order === 'desc' ? 'sort-descending' : 'sort-ascending'} size={20} />
        </Pressable>
        {items.length > 0 && (
          <>
            <View className="flex-1" nativeID="trainings-history-tab-filter-exercise-wrapper" testID="trainings-history-tab-filter-exercise-wrapper">
              <ResponsiveSelectField
                dense
                hideErrorRow
                label="Ejercicio"
                onChange={(value) => { setFilterExerciseId(value); setFilterSetNumber(''); }}
                options={availableExercises}
                placeholder="Todos"
                value={filterExerciseId}
              />
            </View>
            <View className="flex-1" nativeID="trainings-history-tab-filter-set-wrapper" testID="trainings-history-tab-filter-set-wrapper">
              <InputField
                dense
                disabled={!filterExerciseId}
                hideErrorRow
                keyboardType="numeric"
                label="Serie"
                onChange={setFilterSetNumber}
                placeholder="Todas"
                value={filterSetNumber}
              />
            </View>
            {role === 'trainer' && (
              <View className="flex-1" nativeID="trainings-history-tab-filter-athlete-wrapper" testID="trainings-history-tab-filter-athlete-wrapper">
                <ResponsiveSelectField
                  dense
                  hideErrorRow
                  label="Corredor"
                  onChange={setFilterAthleteId}
                  options={availableAthletes}
                  placeholder="Todos"
                  value={filterAthleteId}
                />
              </View>
            )}
          </>
        )}
      </FilterPanel>

      {dateRangeError && (
        <Text className="mb-3 text-xs text-red-500 dark:text-red-400" nativeID="trainings-history-tab-date-range-error" testID="trainings-history-tab-date-range-error">
          {dateRangeError}
        </Text>
      )}

      {selectionMode && (
        <View className="mb-3 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-surface" nativeID="trainings-history-tab-selection-bar" testID="trainings-history-tab-selection-bar">
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trainings-history-tab-selection-count" testID="trainings-history-tab-selection-count">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
          </Text>
          <View className="flex-row items-center gap-2" nativeID="trainings-history-tab-selection-actions" testID="trainings-history-tab-selection-actions">
            <Pressable
              accessibilityLabel="Eliminar seleccionados"
              className="h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              disabled={selectedIds.size === 0}
              nativeID="trainings-history-tab-bulk-delete-button"
              onPress={() => setBulkDeleteVisible(true)}
              testID="trainings-history-tab-bulk-delete-button"
            >
              <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="Salir de selección"
              className="h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              nativeID="trainings-history-tab-selection-exit-button"
              onPress={handleExitSelection}
              testID="trainings-history-tab-selection-exit-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close" size={18} />
            </Pressable>
          </View>
        </View>
      )}

      {loading ? (
        <View className="items-center py-6" nativeID="trainings-history-tab-loading" testID="trainings-history-tab-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View className="items-center rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-surface" nativeID="trainings-history-tab-empty" testID="trainings-history-tab-empty">
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="history" size={32} />
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="trainings-history-tab-empty-label" testID="trainings-history-tab-empty-label">
            {role === 'trainer' && !filterTeamId ? 'Elegí un equipo para ver su historial.' : 'Todavía no hay registros para estos filtros.'}
          </Text>
        </View>
      ) : (
        <View className="gap-2" nativeID="trainings-history-tab-list" testID="trainings-history-tab-list">
          {items.map((item) => (
            <TrainingsHistoryRow
              containerRef={containerRef}
              item={item}
              key={item.id}
              onOpenMenu={handleOpenRowMenu}
              onToggleSelected={handleToggleSelected}
              role={role}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
            />
          ))}
          {hasMore && (
            <Pressable
              className="mt-2 h-11 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={isFetching}
              nativeID="trainings-history-tab-load-more-button"
              onPress={loadMore}
              testID="trainings-history-tab-load-more-button"
            >
              {isFetching ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trainings-history-tab-load-more-label" testID="trainings-history-tab-load-more-label">Cargar más</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      <AnimatedDropdown anchorStyle={rowMenu?.anchor} onClose={handleCloseRowMenu} open={Boolean(rowMenu)}>
        {rowMenu && <TrainingsHistoryRowMenu onSelect={handleSelectFromMenu} onViewReview={handleViewReview} />}
      </AnimatedDropdown>

      <BulkDeleteFeedbackModal count={selectedIds.size} onCancel={() => setBulkDeleteVisible(false)} onConfirm={handleBulkDelete} visible={bulkDeleteVisible} />
    </View>
  );
}
```

- [ ] **Step 2: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: PASS, mismo número de tests que antes de este task + los agregados en Tasks 1/2/4.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: sin errores — presta atención en particular a `local/require-native-id` (todo
elemento visual nuevo de este archivo) y `local/require-modal-backdrop-close` (ya cubierto en
Task 7, no aplica acá directamente).

- [ ] **Step 4: Commit**

```bash
git add components/calendar/trainings-history-tab.jsx
git commit -m "feat(trainings-history): implement full history tab (filters, list, selection, delete)"
```

---

## Task 10: Wiring en las dos pantallas de calendario

**Files:**
- Modify: `components/calendar/my-calendar-screen.jsx:189`
- Modify: `components/calendar/administered-calendar-screen.jsx:197`

**Interfaces:**
- Consumes: `TrainingsHistoryTab` (Task 9), ya importado en ambos archivos (el import no
  cambia, solo el uso).

- [ ] **Step 1: Modificar `my-calendar-screen.jsx`**

Reemplazar la línea 189:

```jsx
{activeTab === 'historial' && <TrainingsHistoryTab />}
```

por:

```jsx
{activeTab === 'historial' && <TrainingsHistoryTab role="runner" />}
```

- [ ] **Step 2: Modificar `administered-calendar-screen.jsx`**

Reemplazar la línea 197:

```jsx
{activeTab === 'historial' && <TrainingsHistoryTab />}
```

por:

```jsx
{activeTab === 'historial' && <TrainingsHistoryTab role="trainer" />}
```

- [ ] **Step 3: Run the full suite**

Run: `npm test && npm run lint`
Expected: ambos en verde.

- [ ] **Step 4: Commit**

```bash
git add components/calendar/my-calendar-screen.jsx components/calendar/administered-calendar-screen.jsx
git commit -m "feat(trainings-history): wire role-aware history tab into both calendar screens"
```

---

## Task 11: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: 100% verde, incluye los ~19 tests nuevos de Tasks 1/2/4.

- [ ] **Step 2: Lint completo**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Verificación manual (sin preview de Claude, per convención del proyecto)**

Documentar en la PR un script de prueba manual mínimo para el usuario, cubriendo:
1. Pestaña Historial, corredor: cambiar equipo, cargar fecha desde/hasta, ordenar por
   columna, cambiar orden asc/desc.
2. Pestaña Historial, entrenador: sin equipo elegido no aparece nada; elegir equipo carga
   resultados; elegir grupo los acota.
3. Segundo nivel: elegir un ejercicio puebla el filtro de serie; entrenador además filtra
   por corredor.
4. Menú "..." de una fila → "Seleccionar" entra a modo selección con esa fila marcada →
   marcar una segunda fila → ícono de basura → confirmar → toast de éxito, filas
   desaparecen de la lista tras refetch.
5. Menú "..." de una fila → "Ver/editar registro" → navega a la pantalla de revisión con
   los datos correctos precargados.
6. "Cargar más" (si hay más de 20 resultados) trae la página siguiente sin perder la
   anterior.

- [ ] **Step 4: No commit adicional** — este task es solo verificación.

---

## Self-Review (completado durante la escritura de este plan)

**Cobertura de la spec:** §2 (data layer) → Tasks 1, 3, 4, 5. §3/§4 (filtros) → Task 9.
§5 (card) → Task 6. §6 (menú + selección + borrado) → Tasks 7, 8, 9. §7 (navegación a
revisión) → Task 9. §8 (archivos) → todos los tasks. Sin gaps encontrados.

**Placeholders:** ninguno — cada step tiene código completo, ningún "TODO"/"agregar
validación"/referencia a un task por número sin repetir el código.

**Consistencia de tipos/firmas:** `WorkoutFeedbackHistoryItemModel` (Task 4) usa
`sessionInstanceId`/`athleteUserId`/`teamId`/`groupId`/`teamName`/`groupName`/`date`/
`sessionName` — exactamente los campos que Task 9 lee para armar `reviewSlot` (§7 de la
spec). `filters` shape (`teamId`, `groupId`, `dateFrom`, `dateTo`, `exerciseId`,
`setNumber`, `athleteUserId`, `sort`, `order`) es idéntico entre Task 3
(`buildHistoryParams`), Task 5 (`useTrainingsHistory`) y Task 9 (objeto `filters`
armado en el tab). `useTrainingsHistory`/`useDeleteWorkoutFeedbackMutation` (Task 5) y su
consumo en Task 9 coinciden en nombres (`items`, `hasMore`, `availableAthletes`,
`availableExercises`, `loading`, `isFetching`, `loadMore`, `deleteFeedback`).

**Ajuste hecho durante la escritura (no estaba en la spec, descubierto al leer
`components/forms/fields.jsx` fresco):** `DateField` devuelve `'YYYY-MM-DD'` en web pero
`'DD/MM/YYYY'` en nativo — la spec no lo mencionaba. Se agregó `utils/date-field-format.js#toISODate`
(ya existente en el repo, usado en otro lado) a `buildDateRangeFilters` (Task 2) para
normalizar antes de comparar/enviar — sin esto, la comparación `dateFrom > dateTo` y el
envío al backend hubieran sido incorrectos en nativo.
