# Gamificación — Spec 2: Logros y trofeos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "Logros y trofeos" piece of gamificación — 3 familias de logros con progreso,
identidad visual de 5 niveles, vitrina de estampas/trofeos, toast de desbloqueo, card de Home, y
la extensión del hub de pestañas + punto rojo compartido construidos en Spec 1.

**Architecture:** Dos queries TanStack (catálogo estático + progreso por usuario) combinadas
client-side en una sola lista ya lista para renderizar. Toda la lógica de negocio (cálculo de
progreso al siguiente nivel, detección de desbloqueo para el toast) vive en utils puras y
testeadas — los hooks solo cablean queries + delegan a esas utils, mismo patrón que
`hooks/use-streaks.js` de Spec 1.

**Tech Stack:** React Native + Expo, NativeWind, TanStack Query, react-native-toast-message,
expo-haptics, MaterialCommunityIcons.

**Spec:** `docs/superpowers/specs/2026-10-14-gamification-achievements-design.md`

## Global Constraints

- Backend contract (Gap 31, `docs/BACKEND_API_GAPS.md`): `GET /achievements/catalog` →
  `[{id, family, name, description, icon_key, once_threshold?, levels?: [{level, name,
  threshold}], counter_trophy_every?}]`. `GET /users/{id}/achievements` → `[{achievement_id,
  current_level?, count, unlocked_at, last_unlocked_at, has_unseen}]` — `count` siempre presente,
  también para `leveled` (corrección 2026-10-14). `GET /users/{id}/stamps` →
  `[{id, type: 'achievement_counter'|'post_legend'|'competition', source_id, source_name,
  icon_key, granted_at, count}]`.
- Mismo mecanismo de punto rojo de Spec 1 (`POST /users/{id}/gamification/seen
  {section: 'achievements'}` — logros y vitrina comparten esa `section`, no hay una separada
  para la vitrina).
- Cada visual nuevo lleva `nativeID`/`testID` kebab-case (enforced por lint).
- Responsive web: columnas de grilla decididas en JS (`useIsNarrowWeb()`), nunca con clases
  `sm:`/`md:` de NativeWind.
- No tests de render de componentes — solo utils puras.
- Nombres de nivel ("Chispa", "Fuego", ...) SIEMPRE de `levels[].name` del catálogo, nunca
  hardcodeados en un componente.
- `utils/format-date-display.js` NUNCA se importa desde un archivo que un test de Jest
  pueda arrastrar transitivamente — ese módulo importa `react-native-calendars`, que rompe el
  parseo de Jest (`Unexpected token 'export'`, ver Spec 1 Task 3). Ningún archivo de este plan
  que tenga test propio debe importarlo, directa ni transitivamente.
- Ejecución de este plan: inline en esta sesión (sin subagentes), sin verificación de preview —
  la última tarea entrega un script de prueba manual.

---

### Task 1: Data layer (service, mock, normalizers)

**Files:**
- Create: `services/achievements.js`
- Create: `services/__mocks__/achievements-mock.js`
- Modify: `services/normalizers.js` (append 3 funciones)
- Test: `__tests__/achievements-mock.test.js`

**Interfaces:**
- Produces: `getAchievementsCatalog()`, `getUserAchievements(userId)`, `getStamps(userId)`
  (todas async, DTOs crudos). `toAchievementCatalogItemModel(dto)` →
  `{id, family, name, description, iconKey, onceThreshold, levels, counterTrophyEvery}`.
  `toUserAchievementModel(dto)` → `{achievementId, currentLevel, count, unlockedAt,
  lastUnlockedAt, hasUnseen}`. `toStampModel(dto)` → `{id, type, sourceId, sourceName, iconKey,
  grantedAt, count}`.

- [ ] **Step 1: Write the mock**

```js
// services/__mocks__/achievements-mock.js
// Fixture visual para EXPO_PUBLIC_USE_MOCKS=true (Gap 31). Un ítem de cada
// familia, con el `leveled` a mitad de camino entre nivel 2 y 3 para poder
// ver la barra de progreso sin levantar backend. `has_unseen: true` en el
// leveled, para poder probar el punto rojo (Gap 34) sin esperar un
// desbloqueo real.
const MOCK_CATALOG = [
  {
    id: 'first_training',
    family: 'once',
    name: 'Primera vez',
    description: 'Completaste tu primer entrenamiento.',
    icon_key: 'star-outline',
    once_threshold: 1,
  },
  {
    id: 'consecutive_trainings',
    family: 'leveled',
    name: 'Entrenamientos Consecutivos',
    description: 'Entrená días consecutivos sin cortar la racha.',
    icon_key: 'fire',
    levels: [
      { level: 1, name: 'Chispa', threshold: 5 },
      { level: 2, name: 'Fuego', threshold: 10 },
      { level: 3, name: 'Imparable', threshold: 20 },
      { level: 4, name: 'Máquina', threshold: 40 },
      { level: 5, name: 'Leyenda', threshold: 100 },
    ],
    counter_trophy_every: 25,
  },
  {
    id: 'total_trainings',
    family: 'counter',
    name: 'Entrenamientos totales',
    description: 'Cada entrenamiento completado suma una estampa.',
    icon_key: 'medal-outline',
    counter_trophy_every: 1,
  },
];

const MOCK_PROGRESS = [
  { achievement_id: 'first_training', count: 1, unlocked_at: '2026-09-01', last_unlocked_at: '2026-09-01', has_unseen: false },
  { achievement_id: 'consecutive_trainings', current_level: 2, count: 15, unlocked_at: '2026-09-15', last_unlocked_at: '2026-10-01', has_unseen: true },
  { achievement_id: 'total_trainings', count: 7, unlocked_at: '2026-09-01', last_unlocked_at: '2026-10-05', has_unseen: false },
];

const MOCK_STAMPS = [
  { id: 1, type: 'achievement_counter', source_id: 'total_trainings', source_name: 'Entrenamientos totales', icon_key: 'medal-outline', granted_at: '2026-10-05', count: 7 },
  { id: 2, type: 'competition', source_id: 'comp-42', source_name: 'Desafío de octubre', icon_key: 'trophy', granted_at: '2026-09-20', count: 1 },
  { id: 3, type: 'post_legend', source_id: 'consecutive_trainings', source_name: 'Entrenamientos Consecutivos — más allá de Leyenda', icon_key: 'crown', granted_at: '2026-10-10', count: 1 },
];

export async function mockGetAchievementsCatalog() {
  return MOCK_CATALOG;
}

export async function mockGetUserAchievements() {
  return MOCK_PROGRESS;
}

export async function mockGetStamps() {
  return MOCK_STAMPS;
}
```

- [ ] **Step 2: Write the failing test**

```js
// __tests__/achievements-mock.test.js
import { mockGetAchievementsCatalog, mockGetUserAchievements, mockGetStamps } from '../services/__mocks__/achievements-mock.js';

describe('achievements-mock', () => {
  test('el catálogo tiene al menos un ítem de cada familia', async () => {
    const catalog = await mockGetAchievementsCatalog();
    const families = catalog.map((item) => item.family);
    expect(families).toContain('once');
    expect(families).toContain('leveled');
    expect(families).toContain('counter');
  });

  test('el progreso referencia solo ids que existen en el catálogo', async () => {
    const catalog = await mockGetAchievementsCatalog();
    const progress = await mockGetUserAchievements();
    const catalogIds = catalog.map((item) => item.id);
    for (const entry of progress) {
      expect(catalogIds).toContain(entry.achievement_id);
    }
  });

  test('las estampas incluyen al menos un `achievement_counter` y un `competition`', async () => {
    const stamps = await mockGetStamps();
    const types = stamps.map((s) => s.type);
    expect(types).toContain('achievement_counter');
    expect(types).toContain('competition');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest achievements-mock --verbose`
Expected: FAIL with "Cannot find module '../services/__mocks__/achievements-mock.js'"

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest achievements-mock --verbose`
Expected: PASS (3/3) — el mock de Step 1 ya cumple las 3 aserciones.

- [ ] **Step 5: Write the service**

```js
// services/achievements.js
import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockGetAchievementsCatalog, mockGetUserAchievements, mockGetStamps } from './__mocks__/achievements-mock.js';

// GET /api/v1/achievements/catalog -- Gap 31. Config estática, sin cambios
// por usuario.
export async function getAchievementsCatalog() {
  if (USE_MOCKS) return await mockGetAchievementsCatalog();
  return await api.get('/achievements/catalog');
}

// GET /api/v1/users/{id}/achievements -- progreso real por logro.
export async function getUserAchievements(userId) {
  if (USE_MOCKS) return await mockGetUserAchievements();
  return await api.get(`/users/${userId}/achievements`);
}

// GET /api/v1/users/{id}/stamps -- estampas y trofeos emitidos (vitrina).
export async function getStamps(userId) {
  if (USE_MOCKS) return await mockGetStamps();
  return await api.get(`/users/${userId}/stamps`);
}
```

- [ ] **Step 6: Append the normalizers**

Add to the end of `services/normalizers.js`:

```js
// Catálogo de logros (Gap 31) -- config estática, no cambia por usuario.
export function toAchievementCatalogItemModel(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    family: dto.family,
    name: dto.name,
    description: dto.description,
    iconKey: dto.icon_key,
    onceThreshold: dto.once_threshold ?? null,
    levels: dto.levels ? dto.levels.map((l) => ({ level: l.level, name: l.name, threshold: l.threshold })) : null,
    counterTrophyEvery: dto.counter_trophy_every ?? null,
  };
}

// Progreso real de un usuario para un logro puntual (Gap 31). `count`
// siempre presente (corrección 2026-10-14) -- `?? null` es defensivo para
// mientras el backend no tenga el fix desplegado, no para el caso normal.
export function toUserAchievementModel(dto) {
  if (!dto) return null;
  return {
    achievementId: dto.achievement_id,
    currentLevel: dto.current_level ?? 0,
    count: dto.count ?? null,
    unlockedAt: dto.unlocked_at ?? null,
    lastUnlockedAt: dto.last_unlocked_at ?? null,
    hasUnseen: dto.has_unseen ?? false,
  };
}

// Estampa o trofeo de la vitrina (Gap 31) -- entidad transversal, compartida
// entre logros contador y competencias (Spec 4 emitirá las de tipo
// 'competition', acá solo se consumen).
export function toStampModel(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    type: dto.type,
    sourceId: dto.source_id,
    sourceName: dto.source_name,
    iconKey: dto.icon_key,
    grantedAt: dto.granted_at,
    count: dto.count,
  };
}
```

- [ ] **Step 7: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add services/achievements.js services/__mocks__/achievements-mock.js services/normalizers.js __tests__/achievements-mock.test.js
git commit -m "feat(achievements): data layer — service, mock and normalizers (Gap 31)"
```

---

### Task 2: `computeLevelProgress` pure util

**Files:**
- Create: `utils/achievement-progress.js`
- Test: `__tests__/achievement-progress.test.js`

**Interfaces:**
- Consumes: catalog item shape from Task 1 (`{family, levels}`), user achievement shape from
  Task 1 (`{currentLevel, count}`).
- Produces: `computeLevelProgress(catalogItem, userAchievement)` → `{levelName, nextLevelName,
  percent} | null`. Used by Task 5 (`use-achievements.js`).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/achievement-progress.test.js
import { computeLevelProgress } from '../utils/achievement-progress.js';

const LEVELED_CATALOG_ITEM = {
  family: 'leveled',
  levels: [
    { level: 1, name: 'Chispa', threshold: 5 },
    { level: 2, name: 'Fuego', threshold: 10 },
    { level: 3, name: 'Imparable', threshold: 20 },
    { level: 4, name: 'Máquina', threshold: 40 },
    { level: 5, name: 'Leyenda', threshold: 100 },
  ],
};

describe('computeLevelProgress', () => {
  test('familia `once` -> null (no aplica progreso de nivel)', () => {
    expect(computeLevelProgress({ family: 'once' }, { currentLevel: 0, count: 1 })).toBeNull();
  });

  test('familia `counter` -> null', () => {
    expect(computeLevelProgress({ family: 'counter' }, { currentLevel: 0, count: 7 })).toBeNull();
  });

  test('`leveled` sin `count` (backend sin el fix de Gap 31) -> null, degradación segura', () => {
    expect(computeLevelProgress(LEVELED_CATALOG_ITEM, { currentLevel: 2, count: null })).toBeNull();
  });

  test('`leveled`, nivel 2, a mitad de camino a nivel 3 -> 50%', () => {
    const result = computeLevelProgress(LEVELED_CATALOG_ITEM, { currentLevel: 2, count: 15 });
    expect(result).toEqual({ levelName: 'Fuego', nextLevelName: 'Imparable', percent: 50 });
  });

  test('`leveled`, todavía sin desbloquear nivel 1, con progreso parcial -> levelName null', () => {
    const result = computeLevelProgress(LEVELED_CATALOG_ITEM, { currentLevel: 0, count: 3 });
    expect(result).toEqual({ levelName: null, nextLevelName: 'Chispa', percent: 60 });
  });

  test('`leveled`, ya en nivel 5 (Leyenda, el máximo) -> null, no hay "siguiente" para una barra', () => {
    expect(computeLevelProgress(LEVELED_CATALOG_ITEM, { currentLevel: 5, count: 130 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest achievement-progress --verbose`
Expected: FAIL with "Cannot find module '../utils/achievement-progress.js'"

- [ ] **Step 3: Write the implementation**

```js
// utils/achievement-progress.js
// Progreso al siguiente nivel de un logro `leveled` (Gap 31). Pura y
// testeada a propósito -- hooks/use-achievements.js solo llama a esto por
// cada ítem del catálogo, nada de esta cuenta vive sin test.
export function computeLevelProgress(catalogItem, userAchievement) {
  if (catalogItem.family !== 'leveled') return null;
  if (userAchievement?.count == null) return null;

  const currentLevel = userAchievement.currentLevel ?? 0;
  const nextLevelDef = catalogItem.levels.find((l) => l.level === currentLevel + 1);
  if (!nextLevelDef) return null;

  const currentLevelDef = currentLevel === 0 ? null : catalogItem.levels.find((l) => l.level === currentLevel);
  const previousThreshold = currentLevelDef?.threshold ?? 0;
  const span = nextLevelDef.threshold - previousThreshold;
  const progressInSpan = userAchievement.count - previousThreshold;
  const percent = span > 0 ? Math.min(100, Math.max(0, Math.round((progressInSpan / span) * 100))) : 0;

  return {
    levelName: currentLevelDef?.name ?? null,
    nextLevelName: nextLevelDef.name,
    percent,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest achievement-progress --verbose`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add utils/achievement-progress.js __tests__/achievement-progress.test.js
git commit -m "feat(achievements): pure level-progress calculation"
```

---

### Task 3: `buildAchievementUnlockMessage` pure util

**Files:**
- Create: `utils/achievement-unlock-message.js`
- Test: `__tests__/achievement-unlock-message.test.js`

**Interfaces:**
- Consumes: the ENRICHED achievement shape Task 5 will produce — `{id, name, levelName,
  unlockedAt}` (subset used here).
- Produces: `buildAchievementUnlockMessage(previousList, nextList)` → `{text1, text2} | null`.
  Used by Task 5 (`use-achievements.js`).

- [ ] **Step 1: Write the failing test**

```js
// __tests__/achievement-unlock-message.test.js
import { buildAchievementUnlockMessage } from '../utils/achievement-unlock-message.js';

const base = [
  { id: 'first_training', name: 'Primera vez', levelName: null, unlockedAt: null },
  { id: 'consecutive_trainings', name: 'Entrenamientos Consecutivos', levelName: 'Chispa', unlockedAt: '2026-09-15' },
  { id: 'total_trainings', name: 'Entrenamientos totales', levelName: null, unlockedAt: '2026-09-01' },
];

describe('buildAchievementUnlockMessage', () => {
  test('sin lista previa (primer render) -> no hay mensaje', () => {
    expect(buildAchievementUnlockMessage(null, base)).toBeNull();
  });

  test('nada cambió -> no hay mensaje', () => {
    expect(buildAchievementUnlockMessage(base, base)).toBeNull();
  });

  test('un logro `once` se desbloquea por primera vez -> mensaje genérico', () => {
    const next = base.map((a) => (a.id === 'first_training' ? { ...a, unlockedAt: '2026-10-14' } : a));
    const msg = buildAchievementUnlockMessage(base, next);
    expect(msg).toEqual({ text1: '¡Logro desbloqueado!', text2: 'Primera vez' });
  });

  test('un logro `leveled` sube de nivel -> mensaje con el nombre del nuevo nivel', () => {
    const next = base.map((a) => (a.id === 'consecutive_trainings' ? { ...a, levelName: 'Fuego' } : a));
    const msg = buildAchievementUnlockMessage(base, next);
    expect(msg).toEqual({ text1: '¡Fuego!', text2: 'Entrenamientos Consecutivos' });
  });

  test('un logro `counter` incrementa (sin levelName ni unlockedAt nuevo) -> no hay mensaje', () => {
    const next = base.map((a) => (a.id === 'total_trainings' ? { ...a, count: 8 } : a));
    expect(buildAchievementUnlockMessage(base, next)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest achievement-unlock-message --verbose`
Expected: FAIL with "Cannot find module '../utils/achievement-unlock-message.js'"

- [ ] **Step 3: Write the implementation**

```js
// utils/achievement-unlock-message.js
// Detecta el primer logro que cambió de estado entre dos snapshots (subida
// de nivel, o desbloqueo por primera vez de un `once`) y arma el mensaje
// del toast. Un incremento de `counter` NO dispara toast a propósito --
// cada ocurrencia ya se refleja como una estampa nueva en la vitrina, no
// amerita un aviso por cada una (fuera de alcance de esta spec).
export function buildAchievementUnlockMessage(previousList, nextList) {
  if (!previousList) return null;

  for (const next of nextList) {
    const prev = previousList.find((p) => p.id === next.id);
    const unlockedNow = !prev?.unlockedAt && next.unlockedAt;
    const leveledUp = next.levelName && (prev?.levelName ?? null) !== next.levelName;

    if (unlockedNow || leveledUp) {
      return {
        text1: next.levelName ? `¡${next.levelName}!` : '¡Logro desbloqueado!',
        text2: next.name,
      };
    }
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest achievement-unlock-message --verbose`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add utils/achievement-unlock-message.js __tests__/achievement-unlock-message.test.js
git commit -m "feat(achievements): pure unlock-detection -> toast message"
```

---

### Task 4: `achievement-level-meta` util + `ProgressBar` component

**Files:**
- Create: `utils/achievement-level-meta.js`
- Create: `components/shared/progress-bar.jsx`

**Interfaces:**
- Produces: `levelMeta(level)` → `{icon, color, glow?}`. `<ProgressBar percent nativeID testID />`.
  Used by Task 7 (`achievements-tab.jsx`) and Task 8 (`achievement-highlight-card.jsx`).

- [ ] **Step 1: Write the level-meta util**

```js
// utils/achievement-level-meta.js
// Identidad visual de los 5 niveles de logro (Gap 31, doc fuente de
// gamificación 2026-10-12) -- mismo patrón que EXERCISE_KIND_META
// (components/plans/exercise-kind-meta.js): cada nivel tiene su propio
// ícono/color. El NOMBRE visible de un nivel siempre sale de
// `levels[].name` del catálogo (ver utils/achievement-progress.js) --
// este objeto solo mapea número de nivel a apariencia, nunca a texto.
export const ACHIEVEMENT_LEVEL_META = {
  1: { icon: 'circle-outline', color: '#94a3b8' },
  2: { icon: 'fire', color: '#fb923c' },
  3: { icon: 'fire', color: '#ea580c' },
  4: { icon: 'fire', color: '#dc2626' },
  5: { icon: 'fire', color: '#eab308', glow: true },
};

export function levelMeta(level) {
  return ACHIEVEMENT_LEVEL_META[level] ?? ACHIEVEMENT_LEVEL_META[1];
}
```

- [ ] **Step 2: Write the progress bar component (no dedicated test — pure render, repo convention)**

```jsx
// components/shared/progress-bar.jsx
import { View } from 'react-native';

// Barra de progreso simple, sin librería -- `View` con ancho proporcional.
// Compartida por achievements-tab.jsx y achievement-highlight-card.jsx.
export function ProgressBar({ percent, nativeID, testID }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" nativeID={nativeID} testID={testID}>
      <View className="h-1.5 rounded-full bg-primary" nativeID={`${nativeID}-fill`} style={{ width: `${clamped}%` }} testID={`${nativeID}-fill`} />
    </View>
  );
}
```

- [ ] **Step 3: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add utils/achievement-level-meta.js components/shared/progress-bar.jsx
git commit -m "feat(achievements): level visual identity + shared ProgressBar"
```

---

### Task 5: `use-achievements` + `use-stamps` hooks

**Files:**
- Create: `hooks/use-achievements.js`
- Create: `hooks/use-stamps.js`

**Interfaces:**
- Consumes: `getAchievementsCatalog`/`getUserAchievements`/`getStamps` + normalizers (Task 1),
  `computeLevelProgress` (Task 2), `buildAchievementUnlockMessage` (Task 3).
- Produces: `useAchievements()` → `{achievements: [{id, family, name, description, iconKey,
  count, currentLevel, levelName, nextLevelName, progressPercent, unlockedAt, lastUnlockedAt,
  hasUnseen}], hasUnseen, loading, error}`. `useStamps()` → `{counters, competitions, loading,
  error}`. Used by Task 6 (badge hook), Task 7 (tabs), Task 8 (home card + screen).

- [ ] **Step 1: Write `use-achievements.js` (no dedicated test — thin wiring over Tasks 2/3's already-tested logic, same convention as `use-streaks.js`)**

```js
// hooks/use-achievements.js
import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/auth-store.js';
import { getAchievementsCatalog, getUserAchievements } from '../services/achievements.js';
import { toAchievementCatalogItemModel, toUserAchievementModel } from '../services/normalizers.js';
import { computeLevelProgress } from '../utils/achievement-progress.js';
import { buildAchievementUnlockMessage } from '../utils/achievement-unlock-message.js';
import { notifySuccess } from '../utils/haptics.js';

function joinAchievements(catalog, progressList) {
  const progressById = new Map(progressList.map((p) => [p.achievementId, p]));
  return catalog.map((item) => {
    const progress = progressById.get(item.id) ?? null;
    const levelProgress = computeLevelProgress(item, progress);
    const currentLevel = progress?.currentLevel ?? 0;
    const currentLevelDef = currentLevel ? item.levels?.find((l) => l.level === currentLevel) : null;

    return {
      id: item.id,
      family: item.family,
      name: item.name,
      description: item.description,
      iconKey: item.iconKey,
      count: progress?.count ?? null,
      currentLevel,
      levelName: currentLevelDef?.name ?? null,
      nextLevelName: levelProgress?.nextLevelName ?? null,
      progressPercent: levelProgress?.percent ?? null,
      unlockedAt: progress?.unlockedAt ?? null,
      lastUnlockedAt: progress?.lastUnlockedAt ?? null,
      hasUnseen: Boolean(progress?.hasUnseen),
    };
  });
}

// Logros del usuario (Gap 31) -- une catálogo (estático, cacheado
// indefinidamente) con progreso real (por usuario, TanStack Query normal)
// en una sola lista lista para renderizar. Mismo patrón de toast de
// desbloqueo que hooks/use-streaks.js de Spec 1: useRef con el snapshot
// anterior, useEffect comparando, delega el armado del mensaje a una
// función pura.
export function useAchievements() {
  const userId = useAuthStore((s) => s.userId);

  const catalogQuery = useQuery({
    queryKey: ['achievements-catalog'],
    queryFn: () => getAchievementsCatalog().then((dtos) => dtos.map(toAchievementCatalogItemModel)),
    staleTime: Infinity,
  });

  const progressQuery = useQuery({
    queryKey: ['achievements', userId],
    queryFn: () => getUserAchievements(userId).then((dtos) => dtos.map(toUserAchievementModel)),
    enabled: Boolean(userId),
  });

  const achievements = useMemo(() => {
    if (!catalogQuery.data || !progressQuery.data) return [];
    return joinAchievements(catalogQuery.data, progressQuery.data);
  }, [catalogQuery.data, progressQuery.data]);

  const previousAchievements = useRef(null);

  useEffect(() => {
    if (!achievements.length) return;
    const message = buildAchievementUnlockMessage(previousAchievements.current, achievements);
    if (message) {
      notifySuccess();
      Toast.show({ type: 'success', ...message });
    }
    previousAchievements.current = achievements;
  }, [achievements]);

  return {
    achievements,
    hasUnseen: achievements.some((a) => a.hasUnseen),
    loading: catalogQuery.isLoading || progressQuery.isLoading,
    error: catalogQuery.error ?? progressQuery.error ?? null,
  };
}
```

- [ ] **Step 2: Write `use-stamps.js` (no dedicated test — thin wiring, same convention)**

```js
// hooks/use-stamps.js
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth-store.js';
import { getStamps } from '../services/achievements.js';
import { toStampModel } from '../services/normalizers.js';

// Estampas de logros contador + post-Leyenda conviven en una sub-sección
// (doc fuente: "los trofeos post-Leyenda tienen su propia sub-sección O
// destacado dentro de estampas" -- se elige "dentro de estampas" acá);
// los trofeos de competencia van en la otra.
const COUNTER_TYPES = ['achievement_counter', 'post_legend'];

export function useStamps() {
  const userId = useAuthStore((s) => s.userId);
  const query = useQuery({
    queryKey: ['stamps', userId],
    queryFn: () => getStamps(userId).then((dtos) => dtos.map(toStampModel)),
    enabled: Boolean(userId),
  });

  const stamps = query.data ?? [];

  return {
    counters: stamps.filter((s) => COUNTER_TYPES.includes(s.type)),
    competitions: stamps.filter((s) => s.type === 'competition'),
    loading: query.isLoading,
    error: query.error ?? null,
  };
}
```

- [ ] **Step 3: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-achievements.js hooks/use-stamps.js
git commit -m "feat(achievements): use-achievements + use-stamps hooks with unlock toast"
```

---

### Task 6: Extend the shared badge hook

**Files:**
- Modify: `hooks/use-gamification-badge.js`

**Interfaces:**
- Consumes: `useAchievements()` (Task 5).
- Produces: same public shape as before (`{hasUnseen, ackSection}`) — Spec 4 will do the same
  kind of one-line OR addition for competitions, not a new hook.

- [ ] **Step 1: Update the hook**

```diff
 import { useQueryClient } from '@tanstack/react-query';
 import { useAuthStore } from '../store/auth-store.js';
 import { useStreaks } from './use-streaks.js';
+import { useAchievements } from './use-achievements.js';
 import { ackGamificationSeen } from '../services/gamification.js';

 // Punto rojo compartido del header/sidebar/home (Gap 34). Por ahora el
-// único input es el `hasUnseen` de rachas -- Spec 2 (logros) y Spec 4
-// (competencias) suman su propio OR acá cuando existan, sin tocar la firma
-// pública de este hook (los 3 shells y el hub ya lo consumen tal cual).
+// input es el OR de rachas + logros -- Spec 4 (competencias) suma su
+// propio término acá cuando exista, sin tocar la firma pública de este
+// hook (los 3 shells y el hub ya lo consumen tal cual).
 export function useGamificationBadge() {
   const userId = useAuthStore((s) => s.userId);
   const queryClient = useQueryClient();
   const { streaks } = useStreaks();
+  const { hasUnseen: achievementsHasUnseen } = useAchievements();

-  const hasUnseen = Boolean(streaks?.hasUnseen);
+  const hasUnseen = Boolean(streaks?.hasUnseen) || achievementsHasUnseen;

   const ackSection = async (section) => {
     if (!userId) return;
     await ackGamificationSeen(userId, section);
     queryClient.invalidateQueries({ queryKey: ['streaks', userId] });
+    queryClient.invalidateQueries({ queryKey: ['achievements', userId] });
   };

   return { hasUnseen, ackSection };
 }
```

- [ ] **Step 2: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-gamification-badge.js
git commit -m "feat(achievements): OR achievements into the shared unseen badge"
```

---

### Task 7: `AchievementsTab` + `TrophyCaseTab` components

**Files:**
- Create: `components/achievements/achievements-tab.jsx`
- Create: `components/achievements/trophy-case-tab.jsx`

**Interfaces:**
- Consumes: `useAchievements()`, `useStamps()` (Task 5), `levelMeta()` (Task 4), `<ProgressBar>`
  (Task 4), `useIsNarrowWeb()` (`hooks/use-is-narrow-web.js`, existing).

- [ ] **Step 1: Write `achievements-tab.jsx`**

```jsx
// components/achievements/achievements-tab.jsx
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAchievements } from '../../hooks/use-achievements.js';
import { levelMeta } from '../../utils/achievement-level-meta.js';
import { ProgressBar } from '../shared/progress-bar.jsx';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';

function AchievementCard({ achievement, columnClass }) {
  const meta = levelMeta(achievement.currentLevel || 1);
  const idPrefix = `achievements-tab-card-${achievement.id}`;

  return (
    <View className={`${columnClass} rounded-2xl bg-white p-3 shadow-sm dark:bg-surface`} nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <MaterialCommunityIcons color={meta.color} name={meta.icon} size={22} />
        <Text className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-name`} numberOfLines={1} testID={`${idPrefix}-name`}>
          {achievement.name}
        </Text>
      </View>
      {achievement.levelName && (
        <Text className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-level`} testID={`${idPrefix}-level`}>
          {achievement.levelName}
        </Text>
      )}
      {achievement.progressPercent != null && (
        <View className="mt-2" nativeID={`${idPrefix}-progress`} testID={`${idPrefix}-progress`}>
          <ProgressBar nativeID={`${idPrefix}-progress-bar`} percent={achievement.progressPercent} testID={`${idPrefix}-progress-bar`} />
          <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-next-level`} testID={`${idPrefix}-next-level`}>
            Próximo: {achievement.nextLevelName}
          </Text>
        </View>
      )}
      {achievement.family === 'counter' && (
        <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-count`} testID={`${idPrefix}-count`}>
          {achievement.count ?? 0} veces
        </Text>
      )}
      {achievement.unlockedAt && (
        <Text className="mt-2 text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-unlocked`} testID={`${idPrefix}-unlocked`}>
          Desbloqueado {achievement.unlockedAt.slice(0, 10)}
        </Text>
      )}
    </View>
  );
}

export function AchievementsTab() {
  const { achievements, loading, error } = useAchievements();
  const isNarrowWeb = useIsNarrowWeb();
  const columnClass = !isWeb || isNarrowWeb ? 'w-[48%]' : 'w-[31%]';

  if (loading) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="achievements-tab-loading" testID="achievements-tab-loading">Cargando…</Text>;
  }

  if (error) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="achievements-tab-error" testID="achievements-tab-error">No pudimos cargar tus logros.</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-3" nativeID="achievements-tab-root" testID="achievements-tab-root">
      {achievements.map((achievement) => (
        <AchievementCard achievement={achievement} columnClass={columnClass} key={achievement.id} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Write `trophy-case-tab.jsx`**

```jsx
// components/achievements/trophy-case-tab.jsx
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useStamps } from '../../hooks/use-stamps.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';
import { isWeb } from '../../utils/platform.js';

function StampGrid({ items, idPrefix, columnClass, large = false }) {
  if (!items.length) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>Todavía no hay nada acá.</Text>;
  }

  return (
    <View className="flex-row flex-wrap gap-3" nativeID={idPrefix} testID={idPrefix}>
      {items.map((stamp) => {
        const itemPrefix = `${idPrefix}-item-${stamp.id}`;
        return (
          <View className={`${columnClass} items-center rounded-2xl bg-white p-3 shadow-sm dark:bg-surface ${large ? 'py-5' : ''}`} key={stamp.id} nativeID={itemPrefix} testID={itemPrefix}>
            <MaterialCommunityIcons color="#ca8a04" name={stamp.iconKey} size={large ? 32 : 22} />
            <Text className="mt-1 text-center text-xs font-medium text-slate-700 dark:text-slate-200" nativeID={`${itemPrefix}-name`} numberOfLines={2} testID={`${itemPrefix}-name`}>
              {stamp.sourceName}
            </Text>
            {stamp.count > 1 && (
              <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${itemPrefix}-count`} testID={`${itemPrefix}-count`}>
                x{stamp.count}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function TrophyCaseTab() {
  const { counters, competitions, loading, error } = useStamps();
  const isNarrowWeb = useIsNarrowWeb();
  const columnClass = !isWeb || isNarrowWeb ? 'w-[30%]' : 'w-[22%]';

  if (loading) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="trophy-case-tab-loading" testID="trophy-case-tab-loading">Cargando…</Text>;
  }

  if (error) {
    return <Text className="text-sm text-slate-400 dark:text-slate-500" nativeID="trophy-case-tab-error" testID="trophy-case-tab-error">No pudimos cargar tu vitrina.</Text>;
  }

  return (
    <View nativeID="trophy-case-tab-root" testID="trophy-case-tab-root">
      <Text className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trophy-case-tab-counters-title" testID="trophy-case-tab-counters-title">
        Estampas
      </Text>
      <StampGrid columnClass={columnClass} idPrefix="trophy-case-tab-counters" items={counters} />
      <Text className="mb-2 mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="trophy-case-tab-competitions-title" testID="trophy-case-tab-competitions-title">
        Trofeos de competencias
      </Text>
      <StampGrid columnClass={columnClass} idPrefix="trophy-case-tab-competitions" items={competitions} large />
    </View>
  );
}
```

- [ ] **Step 3: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green. Pay attention to `nativeID`/`testID` pairing in both new files.

- [ ] **Step 4: Commit**

```bash
git add components/achievements/achievements-tab.jsx components/achievements/trophy-case-tab.jsx
git commit -m "feat(achievements): Logros + Vitrina tabs"
```

---

### Task 8: Wire into the hub, the Home, and the ack logic

**Files:**
- Modify: `components/achievements/achievements-screen.jsx`
- Create: `components/home/achievement-highlight-card.jsx`
- Modify: `components/home/authenticated-home-screen.jsx`

**Interfaces:**
- Consumes: `AchievementsTab`/`TrophyCaseTab` (Task 7), `useAchievements()` (Task 5),
  `levelMeta()`/`<ProgressBar>` (Task 4).

- [ ] **Step 1: Update `achievements-screen.jsx`**

Current content (written in Spec 1):

```jsx
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { StreaksTab } from './streaks-tab.jsx';
import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
import { isWeb } from '../../utils/platform.js';

const TABS = [{ id: 'streaks', label: 'Rachas', icon: 'fire' }];

export function AchievementsScreen() {
  const [activeTab, setActiveTab] = useState('streaks');
  const { ackSection } = useGamificationBadge();

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

Replace the whole file with:

```jsx
// components/achievements/achievements-screen.jsx
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { TabBar } from '../shared/tab-bar.jsx';
import { StreaksTab } from './streaks-tab.jsx';
import { AchievementsTab } from './achievements-tab.jsx';
import { TrophyCaseTab } from './trophy-case-tab.jsx';
import { useGamificationBadge } from '../../hooks/use-gamification-badge.js';
import { isWeb } from '../../utils/platform.js';

// Hub de gamificación con pestañas. 'achievements'/'trophies' comparten la
// misma `section` de Gap 34 ('achievements') -- logros y vitrina son una
// sola sección a efectos del punto rojo, aunque sean 2 pestañas.
const TABS = [
  { id: 'streaks', label: 'Rachas', icon: 'fire' },
  { id: 'achievements', label: 'Logros', icon: 'medal-outline' },
  { id: 'trophies', label: 'Vitrina', icon: 'trophy' },
];

export function AchievementsScreen() {
  const [activeTab, setActiveTab] = useState('streaks');
  const { ackSection } = useGamificationBadge();
  const ackedSections = useRef(new Set());

  // Marca la sección correspondiente como vista la primera vez que se
  // entra a cada pestaña en esta sesión de pantalla (un Set, no un boolean
  // -- hay 2 secciones distintas: 'streaks' y 'achievements'). Como
  // `activeTab` arranca en 'streaks', el ack de rachas sigue disparando
  // al montar, igual que en Spec 1.
  useEffect(() => {
    if (ackedSections.current.has(activeTab)) return;
    ackedSections.current.add(activeTab);
    const section = activeTab === 'streaks' ? 'streaks' : 'achievements';
    ackSection(section);
  }, [activeTab]);

  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="achievements-screen-root" testID="achievements-screen-root">
      <View className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`} nativeID="achievements-screen-container" testID="achievements-screen-container">
        <Text className="mb-6 text-2xl text-slate-900 dark:text-white" nativeID="achievements-screen-title" testID="achievements-screen-title">
          Logros
        </Text>
        <TabBar active={activeTab} onChange={setActiveTab} scope="achievements-tab-bar" tabs={TABS} />
        {activeTab === 'streaks' && <StreaksTab />}
        {activeTab === 'achievements' && <AchievementsTab />}
        {activeTab === 'trophies' && <TrophyCaseTab />}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Write the Home highlight card**

```jsx
// components/home/achievement-highlight-card.jsx
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAchievements } from '../../hooks/use-achievements.js';
import { levelMeta } from '../../utils/achievement-level-meta.js';
import { ProgressBar } from '../shared/progress-bar.jsx';

// El logro con más progreso pendiente (más cerca de subir de nivel), o si
// ninguno tiene progreso fraccional, el desbloqueado más recientemente.
function pickHighlight(achievements) {
  const withProgress = achievements.filter((a) => a.progressPercent != null && a.progressPercent < 100);
  if (withProgress.length) {
    return withProgress.reduce((best, a) => (a.progressPercent > best.progressPercent ? a : best));
  }

  const unlocked = achievements.filter((a) => a.unlockedAt);
  if (!unlocked.length) return null;
  return unlocked.reduce((latest, a) => ((a.lastUnlockedAt ?? '') > (latest.lastUnlockedAt ?? '') ? a : latest));
}

export function AchievementHighlightCard() {
  const { achievements, loading, error } = useAchievements();

  if (loading || error || !achievements.length) return null;

  const highlight = pickHighlight(achievements);
  if (!highlight) return null;

  const meta = levelMeta(highlight.currentLevel || 1);

  return (
    <View className="mb-6 rounded-2xl bg-white p-4 shadow-sm dark:bg-surface" nativeID="achievement-highlight-card-root" testID="achievement-highlight-card-root">
      <View className="flex-row items-center gap-3" nativeID="achievement-highlight-card-header" testID="achievement-highlight-card-header">
        <MaterialCommunityIcons color={meta.color} name={meta.icon} size={26} />
        <Text className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="achievement-highlight-card-name" testID="achievement-highlight-card-name">
          {highlight.name}
        </Text>
      </View>
      {highlight.progressPercent != null ? (
        <View className="mt-3" nativeID="achievement-highlight-card-progress" testID="achievement-highlight-card-progress">
          <ProgressBar nativeID="achievement-highlight-card-progress-bar" percent={highlight.progressPercent} testID="achievement-highlight-card-progress-bar" />
          <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500" nativeID="achievement-highlight-card-next-level" testID="achievement-highlight-card-next-level">
            Próximo: {highlight.nextLevelName}
          </Text>
        </View>
      ) : (
        <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400" nativeID="achievement-highlight-card-unlocked" testID="achievement-highlight-card-unlocked">
          Desbloqueado
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Wire it into the Home screen**

In `components/home/authenticated-home-screen.jsx`:

```diff
 import { NextTrainingBanner } from './next-training-banner.jsx';
 import { StreakBanner } from './streak-banner.jsx';
+import { AchievementHighlightCard } from './achievement-highlight-card.jsx';
```

```diff
         <NextTrainingBanner />
         <StreakBanner />
+        <AchievementHighlightCard />
       </View>
```

- [ ] **Step 4: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add components/achievements/achievements-screen.jsx components/home/achievement-highlight-card.jsx components/home/authenticated-home-screen.jsx
git commit -m "feat(achievements): wire hub tabs, Home highlight card, per-tab ack"
```

---

### Task 9: Final verification + manual test script

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including every new test file from Tasks 1/2/3.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Grep-check `nativeID`/`testID` balance on every new/modified file**

```bash
for f in services/achievements.js services/__mocks__/achievements-mock.js utils/achievement-progress.js utils/achievement-unlock-message.js utils/achievement-level-meta.js components/shared/progress-bar.jsx hooks/use-achievements.js hooks/use-stamps.js hooks/use-gamification-badge.js components/achievements/achievements-tab.jsx components/achievements/trophy-case-tab.jsx components/achievements/achievements-screen.jsx components/home/achievement-highlight-card.jsx components/home/authenticated-home-screen.jsx; do
  n=$(grep -o 'nativeID=' "$f" | wc -l); t=$(grep -o 'testID=' "$f" | wc -l)
  result="OK"; [ "$n" != "$t" ] && result="MISMATCH"
  echo "$f: nativeID=$n testID=$t $result"
done
```

Expected: `nativeID` count equals `testID` count on every line (files with 0/0 are fine — pure
logic files have none).

- [ ] **Step 4: Output the manual test script (paste verbatim in the final chat reply — do not skip)**

```
Manual test script — Gamificación Spec 2 (Logros y trofeos)

Setup: EXPO_PUBLIC_USE_MOCKS=true, reiniciar el dev server tras cualquier cambio de env.

1. Login como corredor. En el Home, confirmar que aparece una tercera card debajo de la de
   Racha, con el logro "Entrenamientos Consecutivos" (está al 50% de progreso en el mock) y una
   barra de progreso hacia "Imparable".
2. Ir a /achievements, pestaña "Logros" (ahora hay 3 pestañas: Rachas/Logros/Vitrina) — confirmar
   3 cards: "Primera vez" (desbloqueado, sin barra), "Entrenamientos Consecutivos" (nivel Fuego,
   barra al 50%, "Próximo: Imparable"), "Entrenamientos totales" ("7 veces").
3. Confirmar que el punto rojo del ícono "Logros" del header/drawer estaba prendido ANTES de
   entrar a la pestaña Logros (el mock trae `has_unseen: true` para el logro de racha
   consecutiva) y se apaga después de visitar esa pestaña.
4. Pestaña "Vitrina": confirmar 2 secciones — "Estampas" (ícono medalla, "Entrenamientos
   totales", y el trofeo post-Leyenda "más allá de Leyenda" con ícono corona) y "Trofeos de
   competencias" (1 trofeo "Desafío de octubre", card más grande que las estampas).
5. Confirmar responsive: angostar el viewport web progresivamente desde ancho completo hasta
   mobile — ni la grilla de Logros ni la de Vitrina deben romperse ni amontonarse mal en ningún
   punto intermedio (2 columnas en mobile/narrow, 3 en web ancho para Logros).
6. (Opcional, si hay forma de forzar refetch) Editar services/__mocks__/achievements-mock.js para
   subir `current_level` de `consecutive_trainings` de 2 a 3, recargar — confirmar que aparece un
   toast "¡Imparable!" con el nombre del logro, y (mobile real) una vibración de éxito.
```

- [ ] **Step 5: Confirm clean working tree**

```bash
git status --porcelain
```

Expected: clean. If not, something from an earlier task wasn't committed — fix before considering
this plan done.
