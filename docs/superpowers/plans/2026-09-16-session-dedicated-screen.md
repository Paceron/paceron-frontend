# Sesiones: pantalla dedicada en mobile/nativo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover la creación/edición de sesiones de un `Modal` a una pantalla dedicada en mobile/nativo (mismo patrón que planes de entrenamiento), sin tocar el código de gestos (`session-drag-and-drop.jsx`), para aislar si el `Modal` + `ScrollView`s anidados era la causa del bug de scroll/touch documentado en `docs/2026-09-16-session-modal-drag-scroll-investigation.md`.

**Architecture:** Se extrae la lógica de formulario (hoy inline en `create-session-modal.jsx`) a un hook `useSessionForm`, y el JSX del layout angosto a un componente presentacional `SessionFormBody` — ambos compartidos entre el `Modal` (web, sin cambios de comportamiento) y dos pantallas nuevas (`CreateSessionScreen`/`EditSessionScreen`, native). Rutas nuevas bajo `training-plans/sessions/`. Ningún cambio en `session-drag-and-drop.jsx`.

**Tech Stack:** Expo Router (rutas), TanStack Query (`useSession` nuevo, mismo patrón que `useTrainingPlan`), hooks ya existentes del proyecto (`useFormDirty`, `useUnsavedChangesGuard`, `usePullToRefresh` no aplica acá).

**Spec:** `docs/superpowers/specs/2026-09-16-session-dedicated-screen-design.md`

## Global Constraints

- Todo `View`/`Text`/`Pressable`/`TextInput`/etc. lleva `nativeID` + `testID` únicos (ESLint `local/require-native-id` rompe el build si falta).
- Ningún componente nuevo importa `SelectField`/`PickerField` directo — solo `ResponsiveSelectField` (ESLint `local/no-direct-select-field`).
- Forms de alta/edición de un recurso real usan `useFormDirty` + `useUnsavedChangesGuard`; navegar tras un submit exitoso usa `bypassGuard(() => ...)`, nunca navegación directa.
- `autoFocus` (primer campo) solo en pantallas de ALTA, gateado `!isWeb`. Nunca en edición.
- Haptics (`notifySuccess`/`notifyError` de `utils/haptics.js`) antes del `Toast` correspondiente en cada submit.
- Sin comentarios explicativos de "qué hace" el código — solo si hay una razón no obvia (convención del proyecto + pedido explícito del usuario en esta tarea).
- Sin tests de render de componentes (convención del proyecto) — `npm test`/`npm run lint` en verde es el criterio de cada task.
- No se modifica `components/plans/session-drag-and-drop.jsx` en ningún task de este plan.

---

### Task 1: `hooks/use-session-form.js`

**Files:**
- Create: `hooks/use-session-form.js`
- Modify: `components/plans/exercise-kind-meta.js` (agregar `WARMCOOL_KINDS`)

**Interfaces:**
- Consumes: `SESSION_ROLE_ORDER`, `SESSION_ROLE_META` (ya existen en `exercise-kind-meta.js`), `reorderList` (ya existe en `session-drag-and-drop.jsx`).
- Produces: `useSessionForm({ initial, ownerId, catalogExercises })` → `{ name, setName, description, setDescription, exercises, onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped, error, validate, getValues }`. `validate()` retorna `boolean` y setea `error` (string) si falla. `getValues()` retorna `{ ownerId, name, description, exercises }`.

- [ ] **Step 1: Mover `WARMCOOL_KINDS` a `exercise-kind-meta.js`**

Agregar en `components/plans/exercise-kind-meta.js`, junto a `SESSION_ROLE_ORDER`:

```js
export const WARMCOOL_KINDS = ['walking', 'jogging', 'elongation'];
```

- [ ] **Step 2: Crear el hook**

```js
import { useRef, useState } from 'react';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META, WARMCOOL_KINDS } from '../components/plans/exercise-kind-meta.js';
import { reorderList } from '../components/plans/session-drag-and-drop.jsx';

export function useSessionForm({ initial, ownerId, catalogExercises } = {}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [exercises, setExercises] = useState(
    initial?.exercises?.length ? initial.exercises.map((e) => ({ ...e })) : []
  );
  const [error, setError] = useState(null);
  const draftSeq = useRef(0);

  const makeBlankRow = (role) => ({
    localKey: `session-exercise-draft-${Date.now()}-${draftSeq.current++}`,
    exerciseId: '',
    role,
    repeatCount: 1,
    restMinutes: 0,
  });

  const onChangeExercise = (localKey, patch) => {
    setExercises((rows) => rows.map((r) => (r.localKey === localKey ? { ...r, ...patch } : r)));
  };

  const onChangeRole = (localKey, role) => {
    setExercises((rows) => rows.map((r) => {
      if (r.localKey !== localKey) return r;
      if (role !== 'main' && r.exerciseId) {
        const chosen = catalogExercises.find((e) => e.id === r.exerciseId);
        if (chosen && !WARMCOOL_KINDS.includes(chosen.kind)) return { ...r, role, exerciseId: '' };
      }
      return { ...r, role };
    }));
  };

  const onRemove = (localKey) => setExercises((rows) => rows.filter((r) => r.localKey !== localKey));

  const onReorder = (fromIndex, toIndex) => {
    setExercises((rows) => reorderList(rows, fromIndex, toIndex));
  };

  const onExerciseDropped = (exercise, insertIndex) => setExercises((rows) => {
    const next = [...rows];
    next.splice(Math.min(insertIndex, next.length), 0, { ...makeBlankRow('main'), exerciseId: exercise.id });
    return next;
  });

  const validate = () => {
    if (!name.trim() || exercises.length === 0) {
      setError('Completá el nombre y agregá al menos un ejercicio de cada tipo (entrada en calor, principal, vuelta a la calma).');
      return false;
    }
    if (exercises.some((e) => !e.exerciseId)) {
      setError('Completá o quitá los ejercicios sin seleccionar.');
      return false;
    }
    const missingRoles = SESSION_ROLE_ORDER.filter((role) => !exercises.some((e) => e.role === role));
    if (missingRoles.length > 0) {
      setError(`Falta al menos un ejercicio de: ${missingRoles.map((r) => SESSION_ROLE_META[r].label).join(', ')}.`);
      return false;
    }
    return true;
  };

  const getValues = () => ({
    ownerId,
    name: name.trim(),
    description: description.trim(),
    exercises,
  });

  return {
    name, setName,
    description, setDescription,
    exercises, onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped,
    error, validate, getValues,
  };
}
```

- [ ] **Step 3: Lint**

Run: `npx eslint hooks/use-session-form.js components/plans/exercise-kind-meta.js`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-session-form.js components/plans/exercise-kind-meta.js
git commit -m "feat(sessions): add useSessionForm hook"
```

---

### Task 2: `useSession(sessionId)` en `hooks/use-sessions.js`

**Files:**
- Modify: `hooks/use-sessions.js`

**Interfaces:**
- Consumes: `getSession` de `services/sessions.js` (ya existe, sin consumidor previo), `toSessionModel` de `services/normalizers.js` (ya importado en el archivo).
- Produces: `useSession(sessionId)` → `{ session: Session|null, loading: boolean, error }`.

- [ ] **Step 1: Agregar el import de `getSession` y `useQueryClient`**

En `hooks/use-sessions.js`, el import de servicios pasa de:

```js
import {
  listSessions as listSessionsService,
  createSession as createSessionService,
  updateSession as updateSessionService,
  deleteSession as deleteSessionService,
  cloneSession as cloneSessionService,
} from '../services/sessions.js';
```

a:

```js
import {
  listSessions as listSessionsService,
  getSession as getSessionService,
  createSession as createSessionService,
  updateSession as updateSessionService,
  deleteSession as deleteSessionService,
  cloneSession as cloneSessionService,
} from '../services/sessions.js';
```

`useQueryClient` ya está importado en la línea 1 del archivo (junto a `useMutation`/`useQuery`).

- [ ] **Step 2: Agregar `useSession`, después de `useSessions`**

```js
export function useSession(sessionId) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSessionService(sessionId).then(toSessionModel),
    enabled: Boolean(sessionId),
    initialData: () => {
      const cachedLists = queryClient.getQueriesData({ queryKey: ['sessions'] });
      for (const [, sessions] of cachedLists) {
        const found = sessions?.find((s) => s.id === sessionId);
        if (found) return found;
      }
      return undefined;
    },
  });
  return { session: query.data ?? null, loading: query.isLoading, error: query.error };
}
```

- [ ] **Step 3: Lint**

Run: `npx eslint hooks/use-sessions.js`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-sessions.js
git commit -m "feat(sessions): add useSession(sessionId) query hook"
```

---

### Task 3: `components/plans/session-form-body.jsx` (extracción) + actualizar `create-session-modal.jsx`

**Files:**
- Create: `components/plans/session-form-body.jsx`
- Modify: `components/plans/create-session-modal.jsx:1-328` (quitar `CompactNumberPill`, `SessionExerciseRow`, `SessionModalNarrowBody`, `WARMCOOL_KINDS`, `SESSION_ROLE_OPTIONS`; importar desde el archivo nuevo)

**Interfaces:**
- Produces: `SessionFormBody({ name, onSetName, description, onSetDescription, exercises, catalogExercises, onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped, error, visible })`, `SessionExerciseRow({ idPrefix, entry, index, catalogExercises, onChangeExercise, onChangeRole, onRemove })` (re-exportado, lo sigue usando `SessionModalWideBody` en `create-session-modal.jsx`).
- Consumes: `useSessionDropTarget`, `useSessionAutoScrollTarget`, `SessionDropIndicator`, `ReorderProvider`, `ReorderableRow`, `ReorderDropIndicator` (todos de `session-drag-and-drop.jsx`, sin cambios), `SessionExercisePanel` (de `session-exercise-panel.jsx`), `ResponsiveSelectField`, `InputField`/`FIELD_LABEL`, `SESSION_ROLE_ORDER`/`SESSION_ROLE_META`/`WARMCOOL_KINDS` (de `exercise-kind-meta.js`, `WARMCOOL_KINDS` ya movido en Task 1).

- [ ] **Step 1: Crear `session-form-body.jsx` con el contenido movido**

Contenido íntegro (copiado de `create-session-modal.jsx`, sin cambios de comportamiento — `CompactNumberPill` líneas 45-61 actuales, `SessionExerciseRow` líneas 83-172, `SessionModalNarrowBody` líneas 266-328 renombrado a `SessionFormBody`):

```js
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isWeb } from '../../utils/platform.js';
import { InputField, FIELD_LABEL } from '../forms/fields.jsx';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { SESSION_ROLE_ORDER, SESSION_ROLE_META, WARMCOOL_KINDS } from './exercise-kind-meta.js';
import {
  useSessionDropTarget, useSessionAutoScrollTarget, SessionDropIndicator,
  ReorderProvider, ReorderableRow, ReorderDropIndicator,
} from './session-drag-and-drop.jsx';
import { SessionExercisePanel } from './session-exercise-panel.jsx';

const SESSION_ROLE_OPTIONS = SESSION_ROLE_ORDER.map((role) => ({ id: role, name: SESSION_ROLE_META[role].label }));

function CompactNumberPill({ idPrefix, icon, suffix, value, onChange, accessibilityLabel }) {
  return (
    <View className="h-8 flex-row items-center gap-1 rounded-full bg-slate-100 px-2 dark:bg-slate-800" nativeID={idPrefix} testID={idPrefix}>
      <MaterialCommunityIcons color="#94a3b8" name={icon} size={14} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        className="w-6 text-xs text-slate-900 outline-none dark:text-white"
        keyboardType="number-pad"
        nativeID={`${idPrefix}-input`}
        onChangeText={onChange}
        testID={`${idPrefix}-input`}
        value={value}
      />
      <Text className="text-xs text-slate-400 dark:text-slate-500" nativeID={`${idPrefix}-suffix`} testID={`${idPrefix}-suffix`}>{suffix}</Text>
    </View>
  );
}

export function SessionExerciseRow({ idPrefix, entry, index, catalogExercises, onChangeExercise, onChangeRole, onRemove }) {
  const [isSeries, setIsSeries] = useState(entry.repeatCount > 1);
  const roleOptions = entry.role === 'main' ? catalogExercises : catalogExercises.filter((e) => WARMCOOL_KINDS.includes(e.kind));

  const handleToggleSeries = () => {
    const next = !isSeries;
    setIsSeries(next);
    if (!next) onChangeExercise(entry.localKey, { repeatCount: 1, restMinutes: 0 });
  };

  return (
    <View className="gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900" nativeID={idPrefix} testID={idPrefix}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-fields`} testID={`${idPrefix}-fields`}>
        <View className="w-36" nativeID={`${idPrefix}-role-select-wrapper`} testID={`${idPrefix}-role-select-wrapper`}>
          <ResponsiveSelectField
            className="mb-0"
            dense
            hideErrorRow
            hideLabel
            label="Rol"
            onChange={(role) => onChangeRole(entry.localKey, role)}
            options={SESSION_ROLE_OPTIONS}
            value={entry.role}
          />
        </View>
        <View className="flex-1" nativeID={`${idPrefix}-select-wrapper`} testID={`${idPrefix}-select-wrapper`}>
          <ResponsiveSelectField
            className="mb-0"
            dense
            hideErrorRow
            hideLabel
            label={`Ejercicio ${index + 1}`}
            onChange={(exerciseId) => onChangeExercise(entry.localKey, { exerciseId })}
            options={roleOptions.map((e) => ({ id: e.id, name: e.name }))}
            placeholder={roleOptions.length ? 'Elegí un ejercicio' : 'Todavía no hay ejercicios de este tipo'}
            required
            value={entry.exerciseId}
          />
        </View>
        <Pressable
          accessibilityLabel="Quitar ejercicio"
          className="h-12 w-12 items-center justify-center rounded-xl border border-slate-200 hover:bg-red-50 active:opacity-70 dark:border-slate-700 dark:hover:bg-red-900/20"
          nativeID={`${idPrefix}-remove-button`}
          onPress={() => onRemove(entry.localKey)}
          testID={`${idPrefix}-remove-button`}
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={18} />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap items-center gap-2" nativeID={`${idPrefix}-series-row`} testID={`${idPrefix}-series-row`}>
        <Pressable
          accessibilityLabel="Marcar como serie repetida"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSeries }}
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
          nativeID={`${idPrefix}-series-toggle`}
          onPress={handleToggleSeries}
          testID={`${idPrefix}-series-toggle`}
        >
          <MaterialCommunityIcons color={isSeries ? '#8cc63e' : '#94a3b8'} name="repeat-variant" size={16} />
          <Text className={`text-xs font-semibold ${isSeries ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${idPrefix}-series-toggle-label`} testID={`${idPrefix}-series-toggle-label`}>
            Serie repetida
          </Text>
        </Pressable>

        {isSeries && (
          <>
            <CompactNumberPill
              accessibilityLabel="Repeticiones"
              icon="repeat-variant"
              idPrefix={`${idPrefix}-repeat-count`}
              onChange={(v) => onChangeExercise(entry.localKey, { repeatCount: Number(v) || 1 })}
              suffix="×"
              value={String(entry.repeatCount)}
            />
            <CompactNumberPill
              accessibilityLabel="Descanso en minutos"
              icon="timer-outline"
              idPrefix={`${idPrefix}-rest-minutes`}
              onChange={(v) => onChangeExercise(entry.localKey, { restMinutes: Number(v) || 0 })}
              suffix="min"
              value={String(entry.restMinutes)}
            />
          </>
        )}
      </View>
    </View>
  );
}

export function SessionFormBody({ name, onSetName, description, onSetDescription, exercises, catalogExercises, onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped, error, visible }) {
  const dropTargetRef = useSessionDropTarget();
  const { autoScrollRef, onListScroll } = useSessionAutoScrollTarget();

  return (
    <ScrollView className="flex-1" nativeID="session-form-body-scroll" showsVerticalScrollIndicator={false} testID="session-form-body-scroll">
      <InputField autoFocus={!isWeb && visible} dense hideErrorRow label="Nombre" onChange={onSetName} placeholder="Ej. Series de velocidad" value={name} />
      <InputField dense hideErrorRow label="Descripción (opcional)" onChange={onSetDescription} value={description} />

      <SessionExercisePanel horizontal onExerciseAdded={onExerciseDropped} />

      <Text className={`${FIELD_LABEL} mb-1 mt-3`} nativeID="session-form-body-exercises-header-label" testID="session-form-body-exercises-header-label">Ejercicios</Text>
      <Text className="mb-2 text-xs text-slate-500 dark:text-slate-400" nativeID="session-form-body-drop-hint" testID="session-form-body-drop-hint">
        Mantené presionado un ejercicio del catálogo para sumarlo, o una fila para reordenarla.
      </Text>

      <View className="h-[320px] rounded-xl border border-dashed border-slate-300 dark:border-slate-600" nativeID="session-form-body-exercises-list" ref={dropTargetRef} testID="session-form-body-exercises-list">
        <ReorderProvider>
          <GestureScrollView
            contentContainerClassName="gap-2 p-2 pb-4"
            nativeID="session-form-body-exercises-scroll"
            onScroll={onListScroll}
            ref={autoScrollRef}
            scrollEventThrottle={16}
            testID="session-form-body-exercises-scroll"
          >
            {exercises.length === 0 ? (
              <Text className="p-2 text-xs text-slate-400 dark:text-slate-500" nativeID="session-form-body-exercises-empty" testID="session-form-body-exercises-empty">
                Todavía no agregaste ejercicios.
              </Text>
            ) : exercises.map((entry, index) => (
              <ReorderableRow index={index} itemCount={exercises.length} key={entry.localKey} onReorder={onReorder}>
                <SessionExerciseRow
                  catalogExercises={catalogExercises}
                  entry={entry}
                  idPrefix={`session-form-body-exercise-row-${entry.localKey}`}
                  index={index}
                  onChangeExercise={onChangeExercise}
                  onChangeRole={onChangeRole}
                  onRemove={onRemove}
                />
              </ReorderableRow>
            ))}
          </GestureScrollView>
          <SessionDropIndicator />
          <ReorderDropIndicator />
        </ReorderProvider>
      </View>

      {error && (
        <Text className="mb-3 mt-2 text-xs text-red-500 dark:text-red-400" nativeID="session-form-body-error" testID="session-form-body-error">{error}</Text>
      )}
    </ScrollView>
  );
}
```

`nativeID`/`testID` cambiaron de `create-session-modal-*` a `session-form-body-*` (el componente ya no es parte del modal) — sin impacto funcional, son solo identificadores.

- [ ] **Step 2: Actualizar `create-session-modal.jsx`**

Quitar de `create-session-modal.jsx`: la constante `WARMCOOL_KINDS` (línea 32 actual, ahora vive en `exercise-kind-meta.js`), la constante `SESSION_ROLE_OPTIONS` (línea 38, ahora vive en `session-form-body.jsx`), la función `CompactNumberPill` (líneas 45-61), la función `SessionExerciseRow` (líneas 83-172), y la función `SessionModalNarrowBody` (líneas 266-328).

Agregar el import:

```js
import { SessionExerciseRow, SessionFormBody } from './session-form-body.jsx';
```

En el `import { SESSION_ROLE_ORDER, SESSION_ROLE_META } from './exercise-kind-meta.js';` ya existente, no hace falta ningún cambio — `SessionModalWideBody` no usa `WARMCOOL_KINDS` directamente, y `CreateSessionModal.handleChangeRole` sí lo necesita: agregar `WARMCOOL_KINDS` a ese mismo import:

```js
import { SESSION_ROLE_ORDER, SESSION_ROLE_META, WARMCOOL_KINDS } from './exercise-kind-meta.js';
```

En el JSX de `CreateSessionModal`, donde hoy dice `<SessionModalNarrowBody ... />` (línea ~557), cambiar a `<SessionFormBody ... />` con exactamente las mismas props (mismo nombre en todas, no requiere ningún cambio de props, solo el nombre del componente).

- [ ] **Step 3: Lint + test**

Run: `npx eslint components/plans/create-session-modal.jsx components/plans/session-form-body.jsx`
Expected: sin errores.

Run: `npm test`
Expected: 296/296 (sin regresión — este task no toca lógica pura).

- [ ] **Step 4: Commit**

```bash
git add components/plans/session-form-body.jsx components/plans/create-session-modal.jsx components/plans/exercise-kind-meta.js
git commit -m "refactor(sessions): extract SessionFormBody from create-session-modal"
```

---

### Task 4: `create-session-screen.jsx` + ruta de alta

**Files:**
- Create: `components/plans/create-session-screen.jsx`
- Create: `app/(tabs)/training-plans/sessions/create.jsx`

**Interfaces:**
- Consumes: `useSessionForm` (Task 1), `SessionFormBody` (Task 3), `SessionDragProvider`/`DragGhost` (de `session-drag-and-drop.jsx`, sin cambios), `useSessionMutations` (de `use-sessions.js`, sin cambios), `RequireAuth` (de `components/guards/require-auth.jsx`).
- Produces: `CreateSessionScreen` (componente, sin props).

- [ ] **Step 1: Crear `create-session-screen.jsx`**

```js
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { useSessionMutations } from '../../hooks/use-sessions.js';
import { useSessionForm } from '../../hooks/use-session-form.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { SessionDragProvider, DragGhost } from './session-drag-and-drop.jsx';
import { SessionFormBody } from './session-form-body.jsx';

function CreateSessionScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises: catalogExercises } = useExercises(userId);
  const { createSession } = useSessionMutations();
  const [submitting, setSubmitting] = useState(false);

  const form = useSessionForm({ ownerId: userId, catalogExercises });

  const isDirty = useFormDirty({ name: form.name, description: form.description, exercises: form.exercises });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.validate()) return;
    setSubmitting(true);
    const result = await createSession({ ownerId: userId, form: form.getValues() });
    setSubmitting(false);

    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos crear la sesión', text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: 'Sesión creada' });
    bypassGuard(() => router.back());
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionDragProvider>
        <View className="flex-1 bg-paper px-4 pt-8 dark:bg-ink" nativeID="create-session-screen-container" testID="create-session-screen-container">
          <View className="mb-4 flex-row items-center gap-2" nativeID="create-session-screen-header" testID="create-session-screen-header">
            <Pressable
              className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
              nativeID="create-session-screen-back-button"
              onPress={() => guardedClose(() => router.back())}
              testID="create-session-screen-back-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            </Pressable>
            <Text className="text-xl text-slate-900 dark:text-white" nativeID="create-session-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="create-session-screen-title">
              Nueva sesión
            </Text>
          </View>

          <SessionFormBody
            catalogExercises={catalogExercises}
            description={form.description}
            error={form.error}
            exercises={form.exercises}
            name={form.name}
            onChangeExercise={form.onChangeExercise}
            onChangeRole={form.onChangeRole}
            onExerciseDropped={form.onExerciseDropped}
            onRemove={form.onRemove}
            onReorder={form.onReorder}
            onSetDescription={form.setDescription}
            onSetName={form.setName}
            visible
          />

          <Pressable
            className={`mb-4 mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
            disabled={submitting}
            nativeID="create-session-screen-save-button"
            onPress={handleSubmit}
            testID="create-session-screen-save-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="create-session-screen-save-button-label" testID="create-session-screen-save-button-label">
                  Crear sesión
                </Text>
              </>
            )}
          </Pressable>
        </View>
        <DragGhost />
      </SessionDragProvider>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </GestureHandlerRootView>
  );
}

export function CreateSessionScreen() {
  return (
    <RequireAuth>
      <CreateSessionScreenContent />
    </RequireAuth>
  );
}
```

- [ ] **Step 2: Crear la ruta**

```js
import { CreateSessionScreen } from '../../../../components/plans/create-session-screen.jsx';

export default function SessionsCreate() {
  return <CreateSessionScreen />;
}
```

Guardar en `app/(tabs)/training-plans/sessions/create.jsx`.

- [ ] **Step 3: Lint**

Run: `npx eslint components/plans/create-session-screen.jsx "app/(tabs)/training-plans/sessions/create.jsx"`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/plans/create-session-screen.jsx "app/(tabs)/training-plans/sessions/create.jsx"
git commit -m "feat(sessions): add dedicated create-session screen (native)"
```

---

### Task 5: `edit-session-screen.jsx` + ruta de edición

**Files:**
- Create: `components/plans/edit-session-screen.jsx`
- Create: `app/(tabs)/training-plans/sessions/[sessionId]/edit.jsx`

**Interfaces:**
- Consumes: `useSession` (Task 2), `useSessionForm` (Task 1), `SessionFormBody` (Task 3).
- Produces: `EditSessionScreen({ sessionId })`.

- [ ] **Step 1: Crear `edit-session-screen.jsx`**

```js
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { useSession, useSessionMutations } from '../../hooks/use-sessions.js';
import { useSessionForm } from '../../hooks/use-session-form.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { RequireAuth } from '../guards/require-auth.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import { SessionDragProvider, DragGhost } from './session-drag-and-drop.jsx';
import { SessionFormBody } from './session-form-body.jsx';

function EditSessionScreenContent({ sessionId }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, loading } = useSession(sessionId);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper dark:bg-ink" nativeID="edit-session-loading" testID="edit-session-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6 dark:bg-ink" nativeID="edit-session-not-found" testID="edit-session-not-found">
        <Text className="mb-4 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="edit-session-not-found-label" testID="edit-session-not-found-label">
          No encontramos esta sesión.
        </Text>
        <Pressable
          className="h-11 flex-row items-center gap-2 rounded-full bg-primary px-6 active:opacity-80"
          nativeID="edit-session-not-found-back-button"
          onPress={() => router.back()}
          testID="edit-session-not-found-back-button"
        >
          <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-session-not-found-back-button-label" testID="edit-session-not-found-back-button-label">
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  return <EditSessionForm session={session} />;
}

function EditSessionForm({ session }) {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises: catalogExercises } = useExercises(userId);
  const { updateSession } = useSessionMutations();
  const [submitting, setSubmitting] = useState(false);

  const form = useSessionForm({ initial: session, ownerId: session.ownerId, catalogExercises });

  const isDirty = useFormDirty({ name: form.name, description: form.description, exercises: form.exercises });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard, bypassGuard } = useUnsavedChangesGuard(isDirty);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.validate()) return;
    setSubmitting(true);
    const result = await updateSession({ ownerId: session.ownerId, sessionId: session.id, form: form.getValues() });
    setSubmitting(false);

    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos guardar los cambios', text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: 'Sesión actualizada' });
    bypassGuard(() => router.back());
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionDragProvider>
        <View className="flex-1 bg-paper px-4 pt-8 dark:bg-ink" nativeID="edit-session-screen-container" testID="edit-session-screen-container">
          <View className="mb-4 flex-row items-center gap-2" nativeID="edit-session-screen-header" testID="edit-session-screen-header">
            <Pressable
              className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
              nativeID="edit-session-screen-back-button"
              onPress={() => guardedClose(() => router.back())}
              testID="edit-session-screen-back-button"
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
            </Pressable>
            <Text className="text-xl text-slate-900 dark:text-white" nativeID="edit-session-screen-title" style={{ fontFamily: 'Orbitron_700Bold' }} testID="edit-session-screen-title">
              Editar sesión
            </Text>
          </View>

          <SessionFormBody
            catalogExercises={catalogExercises}
            description={form.description}
            error={form.error}
            exercises={form.exercises}
            name={form.name}
            onChangeExercise={form.onChangeExercise}
            onChangeRole={form.onChangeRole}
            onExerciseDropped={form.onExerciseDropped}
            onRemove={form.onRemove}
            onReorder={form.onReorder}
            onSetDescription={form.setDescription}
            onSetName={form.setName}
            visible={false}
          />

          <Pressable
            className={`mb-4 mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary hover:opacity-90 active:opacity-80 ${submitting ? 'opacity-60' : ''}`}
            disabled={submitting}
            nativeID="edit-session-screen-save-button"
            onPress={handleSubmit}
            testID="edit-session-screen-save-button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons color={colors.onPrimary} name="check" size={18} />
                <Text className="text-sm font-semibold uppercase tracking-wide text-[#111518]" nativeID="edit-session-screen-save-button-label" testID="edit-session-screen-save-button-label">
                  Guardar cambios
                </Text>
              </>
            )}
          </Pressable>
        </View>
        <DragGhost />
      </SessionDragProvider>
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </GestureHandlerRootView>
  );
}

export function EditSessionScreen({ sessionId }) {
  return (
    <RequireAuth>
      <EditSessionScreenContent sessionId={sessionId} />
    </RequireAuth>
  );
}
```

`visible={false}` en `SessionFormBody` acá: desactiva el `autoFocus` del campo Nombre (regla del proyecto — nunca autofocus en edición).

- [ ] **Step 2: Crear la ruta**

```js
import { useLocalSearchParams } from 'expo-router';
import { EditSessionScreen } from '../../../../../components/plans/edit-session-screen.jsx';

export default function SessionEdit() {
  const { sessionId } = useLocalSearchParams();
  return <EditSessionScreen sessionId={sessionId} />;
}
```

Guardar en `app/(tabs)/training-plans/sessions/[sessionId]/edit.jsx`.

- [ ] **Step 3: Lint**

Run: `npx eslint components/plans/edit-session-screen.jsx "app/(tabs)/training-plans/sessions/[sessionId]/edit.jsx"`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/plans/edit-session-screen.jsx "app/(tabs)/training-plans/sessions/[sessionId]/edit.jsx"
git commit -m "feat(sessions): add dedicated edit-session screen (native)"
```

---

### Task 6: Navegación en `sessions-catalog-tab.jsx`

**Files:**
- Modify: `components/plans/sessions-catalog-tab.jsx`

**Interfaces:**
- Consumes: rutas de Task 4/5 (`/training-plans/sessions/create`, `/training-plans/sessions/:sessionId/edit`).

- [ ] **Step 1: Agregar imports**

Agregar al inicio de `sessions-catalog-tab.jsx`:

```js
import { useRouter } from 'expo-router';
import { isWeb } from '../../utils/platform.js';
```

- [ ] **Step 2: Instanciar el router dentro del componente**

Dentro del componente que define `modalSession`/`setModalSession` (buscar `const [modalSession, setModalSession] = useState(undefined);`), agregar arriba:

```js
const router = useRouter();
```

- [ ] **Step 3: Bifurcar el botón "+"**

Donde hoy dice:

```js
onPress={() => setModalSession(null)}
```

cambiar a:

```js
onPress={() => (isWeb ? setModalSession(null) : router.push('/training-plans/sessions/create'))}
```

- [ ] **Step 4: Bifurcar la acción "Editar"**

Donde hoy dice:

```js
onEdit={(s) => { handleCloseMenu(); setModalSession(s); }}
```

cambiar a:

```js
onEdit={(s) => {
  handleCloseMenu();
  if (isWeb) setModalSession(s);
  else router.push(`/training-plans/sessions/${s.id}/edit`);
}}
```

- [ ] **Step 5: Lint + test**

Run: `npx eslint components/plans/sessions-catalog-tab.jsx`
Expected: sin errores.

Run: `npm test`
Expected: 296/296.

- [ ] **Step 6: Commit**

```bash
git add components/plans/sessions-catalog-tab.jsx
git commit -m "feat(sessions): route to dedicated screens on native, keep modal on web"
```

---

### Task 7: Verificación final + script de prueba manual

**Files:** ninguno (task de verificación, sin código nuevo)

- [ ] **Step 1: Suite completa**

Run: `npm run lint && npm test`
Expected: ambos en verde (0 errores de lint, 296/296 tests — este plan no agrega funciones puras nuevas, así que el conteo de tests no cambia).

- [ ] **Step 2: Entregar el script de prueba manual**

Como cierre de este plan, entregar al usuario (en el chat, no como archivo) un script de pasos concretos para probar en Expo Go / dispositivo Android real — el único entorno donde el bug que motiva este cambio es reproducible (el preview web no ejercita rutas nativas ni el comportamiento de `Modal` en Android). Pasos mínimos a cubrir:
  1. Abrir la pestaña "Sesiones" del catálogo, tocar "+" → confirmar que abre la pantalla nueva (no el modal) y que el back nativo/gesto vuelve al catálogo.
  2. Cargar nombre, arrastrar 3 ejercicios (uno de cada rol) desde la tira horizontal del catálogo a la lista — confirmar que el cross-container funciona.
  3. Reordenar dos ejercicios de la lista por mantener-presionado — confirmar que el reordenamiento aplica.
  4. Scrollear la tira horizontal del catálogo y la lista vertical de ejercicios, con distintos puntos de toque (fondo de card, fondo de fila) — este es el punto crítico: confirmar si el sonido de "click" en cada `ACTION_UP` (reportado el 2026-09-16) sigue apareciendo o no.
  5. Guardar — confirmar Toast de éxito y vuelta al catálogo con la sesión nueva en la lista.
  6. Editar esa misma sesión desde el menú "⋮" — confirmar que precarga los valores correctos, sin autofocus en el campo Nombre.
  7. Modificar algo y tocar back sin guardar — confirmar que aparece el modal de "salir sin guardar".
  8. En web (browser normal), repetir alta y edición de una sesión — confirmar que el modal sigue funcionando exactamente igual que antes de este plan (cero regresión ahí).

Resultado de este paso 4 en particular decide el próximo paso fuera de este plan: si el sonido/bug de touch desaparece, la hipótesis del `Modal` queda confirmada (no hace falta tocar `session-drag-and-drop.jsx`); si persiste, se retoma `docs/2026-09-16-session-modal-drag-scroll-investigation.md` con este dato.

---

## Self-Review

**Cobertura del spec:** los 3 archivos nuevos (`use-session-form.js`, `session-form-body.jsx`, `create-session-screen.jsx`/`edit-session-screen.jsx`) y la ruta de `useSession` están cubiertos (Tasks 1-2-3-4-5). La bifurcación de navegación está en Task 6. El script de prueba manual final está en Task 7. `session-drag-and-drop.jsx` no aparece modificado en ningún task — correcto, así lo pide el spec. `SessionModalWideBody` no aparece modificado — correcto, fuera de alcance.

**Placeholders:** ninguno — cada step tiene código completo, sin "TBD"/"similar a Task N".

**Consistencia de tipos/nombres:** `useSessionForm` retorna `onChangeExercise`/`onChangeRole`/`onRemove`/`onReorder`/`onExerciseDropped` (Task 1) — mismos nombres consumidos en `SessionFormBody` (Task 3, ya los recibía así) y en las dos pantallas nuevas (Tasks 4-5, pasan `form.onChangeExercise` etc. 1 a 1). `useSession(sessionId)` (Task 2) retorna `{ session, loading, error }` — mismo shape consumido en Task 5 (`const { session, loading } = useSession(sessionId);`). `WARMCOOL_KINDS` se mueve una sola vez (Task 1) y se referencia desde `session-form-body.jsx` (Task 3) y `create-session-modal.jsx` (Task 3) sin quedar duplicado en ningún lado.
