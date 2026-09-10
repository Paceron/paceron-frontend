# Migración de exercise-store/session-store a TanStack Query — Plan de implementación

> **Para agentes:** REQUIRED SUB-SKILL: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Objetivo:** Migrar `store/exercise-store.js` y `store/session-store.js` (Zustand, CRUD simple) a TanStack Query, eliminando ambos stores por completo y moviendo sus 2 constantes puras a los nuevos hooks.

**Arquitectura:** Dos hooks nuevos y simétricos (`hooks/use-exercises.js`, `hooks/use-sessions.js`), mismo patrón exacto que `hooks/use-teams.js` — `useExercises(ownerId)`/`useSessions(ownerId)` para lectura, `useExerciseMutations()`/`useSessionMutations()` para create/update/delete, invalidando el query key correspondiente en cada `onSuccess`. 8 archivos consumidores migran mecánicamente; algunos además dejan de necesitar `useUser()` (solo usaban `user.userId`, ahora se lee `userId` directo del store de sesión — más rápido, sin esperar a que el perfil resuelva).

**Tech Stack:** `@tanstack/react-query` (ya instalado), mismos servicios/mocks existentes (`services/exercises.js`, `services/sessions.js`, sin cambios).

**Spec:** `docs/superpowers/specs/2026-09-09-exercise-session-store-tanstack-query-migration-design.md`

## Global Constraints

- Sin backend real todavía para ninguno de los dos dominios — `FORCE_MOCKS = true` en `services/exercises.js`/`services/sessions.js` (gap 4 de `docs/BACKEND_API_GAPS.md`). Esta migración no toca la capa de servicio/mock, solo el estado que la envuelve.
- Las mutationFn de los hooks nunca lanzan — siempre `try/catch` interno devolviendo `{ success, error? }` (y el dato creado/actualizado en éxito), igual que el resto de hooks ya migrados.
- `useExercises`/`useSessions` devuelven `{ exercises/sessions, loading }` (no el objeto crudo de Query).
- No tocar `store/training-plan-store.js` ni sus consumidores más allá de las líneas puntuales que leen `useExerciseStore`/`useSessionStore` — el resto de ese store es alcance de un sub-proyecto futuro y separado.
- Sin tests de render de componentes (convención del proyecto, ver `CLAUDE.md`) — `__tests__/exercise-store.test.js`/`session-store.test.js` se eliminan sin reemplazo.

---

### Task 1: `hooks/use-exercises.js`

**Files:**
- Create: `hooks/use-exercises.js`

**Interfaces:**
- Consumes: `listExercises`/`createExercise`/`updateExercise`/`deleteExercise` de `services/exercises.js` (ya existen, sin cambios); `toExerciseModel`/`toCreateExercisePayload` de `services/normalizers.js` (ya existen).
- Produces: `useExercises(ownerId)` → `{ exercises: Array, loading: boolean, error }`. `useExerciseMutations()` → `{ createExercise({ownerId, form}), isCreating, updateExercise({ownerId, exerciseId, form}), isUpdating, deleteExercise({ownerId, exerciseId}), isDeleting }`. `EXERCISE_KIND_OPTIONS`, `MUSCLE_GROUP_OPTIONS` (constantes, mismo contenido que hoy en `store/exercise-store.js`).

- [ ] **Step 1: Crear el archivo completo**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listExercises as listExercisesService,
  createExercise as createExerciseService,
  updateExercise as updateExerciseService,
  deleteExercise as deleteExerciseService,
} from '../services/exercises.js';
import { toExerciseModel, toCreateExercisePayload } from '../services/normalizers.js';

// Catálogo de ejercicios del entrenador — TanStack Query, no Zustand (ver
// CLAUDE.md). Sin backend real todavía (services/exercises.js tiene
// FORCE_MOCKS=true, ver docs/BACKEND_API_GAPS.md gap 4) — esta migración
// no cambia esa capa, solo el estado que la envuelve.
export const EXERCISE_KIND_OPTIONS = [
  { id: 'walking', name: 'Caminata' },
  { id: 'jogging', name: 'Trote' },
  { id: 'elongation', name: 'Elongación' },
  { id: 'cruising', name: 'Ritmo continuo' },
  { id: 'running', name: 'Corrida' },
];

export const MUSCLE_GROUP_OPTIONS = [
  { id: 'cuadriceps', name: 'Cuádriceps' },
  { id: 'isquiotibiales', name: 'Isquiotibiales' },
  { id: 'gemelos', name: 'Gemelos (pantorrillas)' },
  { id: 'gluteos', name: 'Glúteos' },
  { id: 'aductores', name: 'Aductores' },
  { id: 'psoas', name: 'Psoas / flexores de cadera' },
  { id: 'lumbares', name: 'Zona lumbar / cadena posterior' },
  { id: 'core', name: 'Core / abdominales' },
];

export function useExercises(ownerId) {
  const query = useQuery({
    queryKey: ['exercises', ownerId],
    queryFn: () => listExercisesService({ ownerId }).then((dtos) => dtos.map(toExerciseModel)),
    enabled: Boolean(ownerId),
  });
  return { exercises: query.data ?? [], loading: query.isLoading, error: query.error };
}

export function useExerciseMutations() {
  const queryClient = useQueryClient();

  const createExerciseMutation = useMutation({
    mutationFn: async ({ form }) => {
      try {
        const created = await createExerciseService(toCreateExercisePayload(form));
        return { success: true, exercise: toExerciseModel(created) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['exercises', variables.ownerId] });
    },
  });

  const updateExerciseMutation = useMutation({
    mutationFn: async ({ exerciseId, form }) => {
      try {
        const updated = await updateExerciseService(exerciseId, toCreateExercisePayload(form));
        return { success: true, exercise: toExerciseModel(updated) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['exercises', variables.ownerId] });
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async ({ exerciseId }) => {
      try {
        await deleteExerciseService(exerciseId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['exercises', variables.ownerId] });
    },
  });

  return {
    createExercise: createExerciseMutation.mutateAsync,
    isCreating: createExerciseMutation.isPending,
    updateExercise: updateExerciseMutation.mutateAsync,
    isUpdating: updateExerciseMutation.isPending,
    deleteExercise: deleteExerciseMutation.mutateAsync,
    isDeleting: deleteExerciseMutation.isPending,
  };
}
```

- [ ] **Step 2: Verificar**

Run: `npx eslint hooks/use-exercises.js`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-exercises.js
git commit -m "feat(exercises): add hooks/use-exercises.js (TanStack Query)"
```

---

### Task 2: `hooks/use-sessions.js`

**Files:**
- Create: `hooks/use-sessions.js`

**Interfaces:**
- Consumes: `listSessions`/`createSession`/`updateSession`/`deleteSession` de `services/sessions.js`; `toSessionModel`/`toCreateSessionPayload` de `services/normalizers.js`.
- Produces: `useSessions(ownerId)` → `{ sessions: Array, loading: boolean, error }`. `useSessionMutations()` → `{ createSession({ownerId, form}), isCreating, updateSession({ownerId, sessionId, form}), isUpdating, deleteSession({ownerId, sessionId}), isDeleting }`.

- [ ] **Step 1: Crear el archivo completo**

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSessions as listSessionsService,
  createSession as createSessionService,
  updateSession as updateSessionService,
  deleteSession as deleteSessionService,
} from '../services/sessions.js';
import { toSessionModel, toCreateSessionPayload } from '../services/normalizers.js';

// Catálogo de sesiones del entrenador — mismo criterio que
// hooks/use-exercises.js (ver ese archivo para el comentario completo
// sobre FORCE_MOCKS/gap 4).
export function useSessions(ownerId) {
  const query = useQuery({
    queryKey: ['sessions', ownerId],
    queryFn: () => listSessionsService({ ownerId }).then((dtos) => dtos.map(toSessionModel)),
    enabled: Boolean(ownerId),
  });
  return { sessions: query.data ?? [], loading: query.isLoading, error: query.error };
}

export function useSessionMutations() {
  const queryClient = useQueryClient();

  const createSessionMutation = useMutation({
    mutationFn: async ({ form }) => {
      try {
        const created = await createSessionService(toCreateSessionPayload(form));
        return { success: true, session: toSessionModel(created) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['sessions', variables.ownerId] });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, form }) => {
      try {
        const updated = await updateSessionService(sessionId, toCreateSessionPayload(form));
        return { success: true, session: toSessionModel(updated) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['sessions', variables.ownerId] });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async ({ sessionId }) => {
      try {
        await deleteSessionService(sessionId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    onSuccess: (result, variables) => {
      if (result.success) queryClient.invalidateQueries({ queryKey: ['sessions', variables.ownerId] });
    },
  });

  return {
    createSession: createSessionMutation.mutateAsync,
    isCreating: createSessionMutation.isPending,
    updateSession: updateSessionMutation.mutateAsync,
    isUpdating: updateSessionMutation.isPending,
    deleteSession: deleteSessionMutation.mutateAsync,
    isDeleting: deleteSessionMutation.isPending,
  };
}
```

- [ ] **Step 2: Verificar**

Run: `npx eslint hooks/use-sessions.js`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-sessions.js
git commit -m "feat(sessions): add hooks/use-sessions.js (TanStack Query)"
```

---

### Task 3: Migrar `session-exercises-preview.jsx` + `create-exercise-modal.jsx`

**Files:**
- Modify: `components/plans/session-exercises-preview.jsx`
- Modify: `components/plans/create-exercise-modal.jsx`

**Interfaces:**
- Consumes: `useExercises`, `useExerciseMutations`, `EXERCISE_KIND_OPTIONS`, `MUSCLE_GROUP_OPTIONS` de `hooks/use-exercises.js` (Task 1). `useAuthStore((s) => s.userId)`.

- [ ] **Step 1: `session-exercises-preview.jsx` — reemplazar el store por el hook**

Reemplazar:
```js
import { useExerciseStore } from '../../store/exercise-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
```

Reemplazar:
```js
export function SessionExercisesPreview({ session }) {
  const exercises = useExerciseStore((s) => s.exercises);
  if (!session) return null;
```
por:
```js
export function SessionExercisesPreview({ session }) {
  const userId = useAuthStore((s) => s.userId);
  const { exercises } = useExercises(userId);
  if (!session) return null;
```

(Es una pantalla exclusiva del catálogo del entrenador autenticado — no hace falta recibir `ownerId` como prop, se resuelve directo del store de sesión.)

- [ ] **Step 2: `create-exercise-modal.jsx` — reemplazar store por hook, sin `useUser` (solo usaba `.userId`)**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useExerciseStore, MUSCLE_GROUP_OPTIONS } from '../../store/exercise-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useExerciseMutations, MUSCLE_GROUP_OPTIONS } from '../../hooks/use-exercises.js';
```

Reemplazar:
```js
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const createExercise = useExerciseStore((s) => s.createExercise);
  const updateExercise = useExerciseStore((s) => s.updateExercise);
  const isEditing = Boolean(exercise);
```
por:
```js
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { createExercise, updateExercise } = useExerciseMutations();
  const isEditing = Boolean(exercise);
```

Reemplazar (dentro de `handleSubmit`):
```js
    const form = {
      ownerId: user?.userId,
      name: name.trim(),
      description: description.trim(),
      kind,
      intensity,
      minutes: minutes ? Number(minutes) : null,
      distanceM: distanceM ? Number(distanceM) : null,
      speedKph: speedKph ? Number(speedKph) : null,
      muscleGroup: muscleGroup || null,
    };
    const result = isEditing ? await updateExercise(exercise.id, form) : await createExercise(form);
```
por:
```js
    const form = {
      ownerId: userId,
      name: name.trim(),
      description: description.trim(),
      kind,
      intensity,
      minutes: minutes ? Number(minutes) : null,
      distanceM: distanceM ? Number(distanceM) : null,
      speedKph: speedKph ? Number(speedKph) : null,
      muscleGroup: muscleGroup || null,
    };
    const result = isEditing
      ? await updateExercise({ ownerId: userId, exerciseId: exercise.id, form })
      : await createExercise({ ownerId: userId, form });
```

- [ ] **Step 3: Verificar**

Run: `npx eslint components/plans/session-exercises-preview.jsx components/plans/create-exercise-modal.jsx`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/plans/session-exercises-preview.jsx components/plans/create-exercise-modal.jsx
git commit -m "feat(exercises): migrate session-exercises-preview + create-exercise-modal to use-exercises.js"
```

---

### Task 4: Migrar `create-session-modal.jsx`

**Files:**
- Modify: `components/plans/create-session-modal.jsx`

**Interfaces:**
- Consumes: `useExercises` (Task 1), `useSessionMutations` (Task 2).

- [ ] **Step 1: Reemplazar imports**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { useSessionStore } from '../../store/session-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises } from '../../hooks/use-exercises.js';
import { useSessionMutations } from '../../hooks/use-sessions.js';
```

- [ ] **Step 2: Reemplazar la resolución de estado del componente**

Reemplazar:
```js
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const catalogExercises = useExerciseStore((s) => s.exercises);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const createSession = useSessionStore((s) => s.createSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const isEditing = Boolean(session);
```
por:
```js
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises: catalogExercises } = useExercises(userId);
  const { createSession, updateSession } = useSessionMutations();
  const isEditing = Boolean(session);
```

(`useExercises(userId)` ya trae la lista automáticamente en cuanto hay `userId` — comparte cache con `exercises-catalog-tab.jsx`, que probablemente ya la pidió antes, así que no suma un request extra en la práctica. No hace falta gatear la carga por `visible` como hacía el `fetchExercises` manual de antes.)

- [ ] **Step 3: Eliminar el `useEffect` que disparaba el fetch manual**

Eliminar por completo:
```js
  useEffect(() => {
    if (visible && user?.userId) fetchExercises(user.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.userId]);
```

`useEffect` sigue haciendo falta en el archivo (lo usa `import { useEffect, useRef, useState } from 'react';` para otra cosa — de hecho, revisando el archivo, este era el único uso de `useEffect`, así que el import pasa a ser solo `useRef, useState`). Cambiar:
```js
import { useEffect, useRef, useState } from 'react';
```
por:
```js
import { useRef, useState } from 'react';
```

- [ ] **Step 4: Actualizar `handleSubmit`**

Reemplazar:
```js
    const form = {
      ownerId: user?.userId,
      name: name.trim(),
      description: description.trim(),
      exercises,
    };
    const result = isEditing ? await updateSession(session.id, form) : await createSession(form);
```
por:
```js
    const form = {
      ownerId: userId,
      name: name.trim(),
      description: description.trim(),
      exercises,
    };
    const result = isEditing
      ? await updateSession({ ownerId: userId, sessionId: session.id, form })
      : await createSession({ ownerId: userId, form });
```

- [ ] **Step 5: Verificar**

Run: `npx eslint components/plans/create-session-modal.jsx`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add components/plans/create-session-modal.jsx
git commit -m "feat(sessions): migrate create-session-modal.jsx to use-exercises/use-sessions"
```

---

### Task 5: Migrar `exercises-catalog-tab.jsx`

**Files:**
- Modify: `components/plans/exercises-catalog-tab.jsx`

**Interfaces:**
- Consumes: `useExercises`, `useExerciseMutations` (Task 1); `useSessions` (Task 2).

- [ ] **Step 1: Reemplazar imports**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { useSessionStore } from '../../store/session-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useExercises, useExerciseMutations } from '../../hooks/use-exercises.js';
import { useSessions } from '../../hooks/use-sessions.js';
```

- [ ] **Step 2: Reemplazar la resolución de estado y el `useEffect` de carga**

Reemplazar:
```js
export function ExercisesCatalogTab() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const exercises = useExerciseStore((s) => s.exercises);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const deleteExercise = useExerciseStore((s) => s.deleteExercise);
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalExercise, setModalExercise] = useState(undefined); // undefined = cerrado, null = alta, objeto = edición
  const [deleteTarget, setDeleteTarget] = useState(null); // { exercise, usedIn }
  const [usageTarget, setUsageTarget] = useState(null); // { exercise, usedIn }

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchExercises(user.userId), fetchSessions(user.userId)]).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const handleDelete = async () => {
    const result = await deleteExercise(deleteTarget.exercise.id);
    setDeleteTarget(null);
```
por:
```js
export function ExercisesCatalogTab() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { exercises, loading } = useExercises(userId);
  const { deleteExercise } = useExerciseMutations();
  const { sessions } = useSessions(userId);

  const [search, setSearch] = useState('');
  const [modalExercise, setModalExercise] = useState(undefined); // undefined = cerrado, null = alta, objeto = edición
  const [deleteTarget, setDeleteTarget] = useState(null); // { exercise, usedIn }
  const [usageTarget, setUsageTarget] = useState(null); // { exercise, usedIn }

  const handleDelete = async () => {
    const result = await deleteExercise({ ownerId: userId, exerciseId: deleteTarget.exercise.id });
    setDeleteTarget(null);
```

(`loading` ahora viene directo de `useExercises` — se elimina el `useState(true)`/`useEffect` manual. También se elimina el import de `useEffect` de `'react'` si no queda usado en otro lado del archivo — confirmar con el linter en el Step 3, ya que este archivo no tiene otro `useEffect`.)

Si el linter marca `useEffect` importado sin uso, la línea 1 pasa de:
```js
import { useEffect, useState } from 'react';
```
a:
```js
import { useState } from 'react';
```

- [ ] **Step 3: Verificar**

Run: `npx eslint components/plans/exercises-catalog-tab.jsx`
Expected: sin errores (ajustar el import de `react` según el resultado del Step 2 si hace falta).

- [ ] **Step 4: Commit**

```bash
git add components/plans/exercises-catalog-tab.jsx
git commit -m "feat(exercises): migrate exercises-catalog-tab.jsx to use-exercises/use-sessions"
```

---

### Task 6: Migrar `sessions-catalog-tab.jsx`

**Files:**
- Modify: `components/plans/sessions-catalog-tab.jsx`

**Interfaces:**
- Consumes: `useSessions`, `useSessionMutations` (Task 2); `useExercises` (Task 1).

- [ ] **Step 1: Reemplazar imports**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useSessionStore } from '../../store/session-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useSessions, useSessionMutations } from '../../hooks/use-sessions.js';
import { useExercises } from '../../hooks/use-exercises.js';
```

- [ ] **Step 2: Reemplazar la resolución de estado y el `useEffect` de carga**

Reemplazar:
```js
export function SessionsCatalogTab() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const plans = useTrainingPlanStore((s) => s.plans);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);

  const [loading, setLoading] = useState(true);
  const [modalSession, setModalSession] = useState(undefined); // undefined = cerrado, null = alta, objeto = edición
  const [deleteTarget, setDeleteTarget] = useState(null); // { session, usedIn }
  const [usageTarget, setUsageTarget] = useState(null); // { session, usedIn }

  useEffect(() => {
    if (!user?.userId) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchSessions(user.userId), fetchExercises(user.userId), fetchPlans(user.userId)]).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  const handleDelete = async () => {
    const result = await deleteSession(deleteTarget.session.id);
    setDeleteTarget(null);
```
por:
```js
export function SessionsCatalogTab() {
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const { sessions, loading: sessionsLoading } = useSessions(userId);
  const { deleteSession } = useSessionMutations();
  useExercises(userId); // solo para precargar el cache que usa SessionExercisesPreview de cada fila
  const plans = useTrainingPlanStore((s) => s.plans);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);

  const [plansLoading, setPlansLoading] = useState(true);
  const [modalSession, setModalSession] = useState(undefined); // undefined = cerrado, null = alta, objeto = edición
  const [deleteTarget, setDeleteTarget] = useState(null); // { session, usedIn }
  const [usageTarget, setUsageTarget] = useState(null); // { session, usedIn }
  const loading = sessionsLoading || plansLoading;

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setPlansLoading(true);
    fetchPlans(userId).finally(() => { if (!cancelled) setPlansLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleDelete = async () => {
    const result = await deleteSession({ ownerId: userId, sessionId: deleteTarget.session.id });
    setDeleteTarget(null);
```

(`fetchPlans` es de `training-plan-store.js`, fuera de alcance de esta migración — se mantiene el `useEffect` manual solo para esa parte, separado del loading combinado de `sessions`/`plans`. `useExercises(userId)` se llama sin desestructurar nada porque acá solo hace falta que el cache quede poblado para que `SessionExercisesPreview`, montado más abajo por cada fila, lo lea ya resuelto — mismo mecanismo de cache compartido explicado en la Task 4.)

- [ ] **Step 3: Verificar**

Run: `npx eslint components/plans/sessions-catalog-tab.jsx`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/plans/sessions-catalog-tab.jsx
git commit -m "feat(sessions): migrate sessions-catalog-tab.jsx to use-sessions/use-exercises"
```

---

### Task 7: Migrar `training-plan-form-fields.jsx`

**Files:**
- Modify: `components/plans/training-plan-form-fields.jsx`

**Interfaces:**
- Consumes: `useSessions` (Task 2), `useExercises` (Task 1).

- [ ] **Step 1: Reemplazar imports**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useSessionStore } from '../../store/session-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useExercises } from '../../hooks/use-exercises.js';
```

- [ ] **Step 2: Reemplazar la resolución de estado**

Reemplazar:
```js
export function TrainingPlanFormFields({ form, durationOptions, autoFocusName = false }) {
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);

  useEffect(() => {
    if (!user?.userId) return;
    fetchSessions(user.userId).then((result) => {
      if (!result.success) Toast.show({ type: 'error', text1: 'No pudimos cargar las sesiones', text2: result.error });
    });
    fetchExercises(user.userId).then((result) => {
      if (!result.success) Toast.show({ type: 'error', text1: 'No pudimos cargar los ejercicios', text2: result.error });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  return (
```
por:
```js
export function TrainingPlanFormFields({ form, durationOptions, autoFocusName = false }) {
  const userId = useAuthStore((s) => s.userId);
  const { sessions } = useSessions(userId);
  useExercises(userId); // precarga el cache que usa SessionExercisesPreview del picker de sesión

  return (
```

(Se elimina el manejo manual de error por Toast del fetch — ningún otro hook ya migrado en el proyecto muestra un toast cuando falla un fetch de lectura, ver `hooks/use-teams.js`/`use-groups.js`, que exponen `error` pero ningún consumidor lo usa para eso; los toasts quedan reservados para fallos de mutación. Si el linter marca `Toast`/`useEffect` sin uso tras este cambio, quitar esos imports también — revisar el resto del archivo primero, `useEffect` puede seguir usándose en `DayRow`/`DaySegmentedPicker` si algún otro efecto vive ahí (no es el caso hoy, pero confirmar antes de borrar el import).)

- [ ] **Step 3: Ajustar imports de React/Toast si quedaron sin uso**

Revisar el resto del archivo: si `useEffect` y `Toast` ya no se usan en ningún otro lugar, la línea:
```js
import { useEffect, useState } from 'react';
```
pasa a:
```js
import { useState } from 'react';
```
y la línea:
```js
import Toast from 'react-native-toast-message';
```
se elimina.

- [ ] **Step 4: Verificar**

Run: `npx eslint components/plans/training-plan-form-fields.jsx`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/plans/training-plan-form-fields.jsx
git commit -m "feat(plans): migrate training-plan-form-fields.jsx to use-sessions/use-exercises"
```

---

### Task 8: Migrar `training-plan-detail-screen.jsx`

**Files:**
- Modify: `components/plans/training-plan-detail-screen.jsx`

**Interfaces:**
- Consumes: `useSessions`, `useExercises`.

**Nota importante:** esta pantalla puede mostrar el plan de OTRO usuario (un corredor viendo un plan asignado por su entrenador) — las sesiones/ejercicios que resuelve son del catálogo de `plan.ownerId` (quien creó el plan), no del usuario que está mirando la pantalla. El query key usa `plan.ownerId`, no `userId` de sesión.

- [ ] **Step 1: Reemplazar imports**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useTrainingPlanStore, getPlanStatus, dayLabel } from '../../store/training-plan-store.js';
import { useSessionStore } from '../../store/session-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
```
por:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useTrainingPlanStore, getPlanStatus, dayLabel } from '../../store/training-plan-store.js';
import { useSessions } from '../../hooks/use-sessions.js';
import { useExercises } from '../../hooks/use-exercises.js';
```

- [ ] **Step 2: Reemplazar la resolución de estado**

Reemplazar:
```js
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const plan = useTrainingPlanStore((s) => s.plans.find((p) => p.id === planId) ?? s.myPlans.find((p) => p.id === planId));
  const fetchPlan = useTrainingPlanStore((s) => s.fetchPlan);
  const deletePlan = useTrainingPlanStore((s) => s.deletePlan);
  const clonePlan = useTrainingPlanStore((s) => s.clonePlan);
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const exercises = useExerciseStore((s) => s.exercises);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);

  const [loading, setLoading] = useState(!plan);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Sesiones/ejercicios son del catálogo de QUIEN CREÓ el plan
  // (plan.ownerId) — no del usuario que está mirando la pantalla, que
  // puede ser un corredor viendo un plan que no es suyo.
  useEffect(() => {
    if (!plan?.ownerId) return;
    fetchSessions(plan.ownerId);
    fetchExercises(plan.ownerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.ownerId]);

  useEffect(() => {
    if (plan) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchPlan(planId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    fetchPlan(planId),
    plan?.ownerId ? Promise.all([fetchSessions(plan.ownerId), fetchExercises(plan.ownerId)]) : Promise.resolve(),
  ]));
```
por:
```js
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const plan = useTrainingPlanStore((s) => s.plans.find((p) => p.id === planId) ?? s.myPlans.find((p) => p.id === planId));
  const fetchPlan = useTrainingPlanStore((s) => s.fetchPlan);
  const deletePlan = useTrainingPlanStore((s) => s.deletePlan);
  const clonePlan = useTrainingPlanStore((s) => s.clonePlan);
  // Sesiones/ejercicios son del catálogo de QUIEN CREÓ el plan
  // (plan.ownerId) — no del usuario que está mirando la pantalla, que
  // puede ser un corredor viendo un plan que no es suyo.
  const { sessions } = useSessions(plan?.ownerId);
  const { exercises } = useExercises(plan?.ownerId);

  const [loading, setLoading] = useState(!plan);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    if (plan) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchPlan(planId).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([
    fetchPlan(planId),
    plan?.ownerId ? Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sessions', plan.ownerId] }),
      queryClient.invalidateQueries({ queryKey: ['exercises', plan.ownerId] }),
    ]) : Promise.resolve(),
  ]));
```

Agregar el import de `useQueryClient` junto a los demás imports de React Query — este archivo no importaba nada de `@tanstack/react-query` todavía, agregar:
```js
import { useQueryClient } from '@tanstack/react-query';
```
(como primera línea del archivo, junto al resto de imports externos).

- [ ] **Step 3: Actualizar `canManage`, que usaba `user?.userId`**

Reemplazar:
```js
  const canManage = activeRole === 'trainer' && plan.ownerId === user?.userId;
```
por:
```js
  const canManage = activeRole === 'trainer' && plan.ownerId === userId;
```

- [ ] **Step 4: Verificar**

Run: `npx eslint components/plans/training-plan-detail-screen.jsx`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add components/plans/training-plan-detail-screen.jsx
git commit -m "feat(plans): migrate training-plan-detail-screen.jsx to use-sessions/use-exercises"
```

---

### Task 9: Migrar `training-plans-screen.jsx` (solo la parte de exercises/sessions)

**Files:**
- Modify: `components/plans/training-plans-screen.jsx`

**Interfaces:**
- Consumes: `useQueryClient` de `@tanstack/react-query`.

**Nota:** `PlansTab` de este archivo usa `useUser`/`fetchPlans` para el dominio de `training-plan-store.js`, fuera de alcance de esta migración — no se toca. Solo cambia `TrainingPlansScreenContent`, que dispara `fetchExercises`/`fetchSessions` en el pull-to-refresh.

- [ ] **Step 1: Reemplazar imports**

Reemplazar:
```js
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useTrainingPlanStore, getPlanStatus } from '../../store/training-plan-store.js';
import { useExerciseStore } from '../../store/exercise-store.js';
import { useSessionStore } from '../../store/session-store.js';
```
por:
```js
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { useTrainingPlanStore, getPlanStatus } from '../../store/training-plan-store.js';
```

- [ ] **Step 2: Reemplazar `fetchExercises`/`fetchSessions` en `TrainingPlansScreenContent`**

Reemplazar:
```js
function TrainingPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState('planes');
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);
  const fetchExercises = useExerciseStore((s) => s.fetchExercises);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    if (!user?.userId) return Promise.resolve();
    return Promise.all([fetchPlans(user.userId), fetchExercises(user.userId), fetchSessions(user.userId)]);
  });
```
por:
```js
function TrainingPlansScreenContent() {
  const router = useRouter();
  const colors = useThemeColors();
  const [activeTab, setActiveTab] = useState('planes');
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const fetchPlans = useTrainingPlanStore((s) => s.fetchPlans);
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(() => {
    if (!user?.userId) return Promise.resolve();
    return Promise.all([
      fetchPlans(user.userId),
      queryClient.invalidateQueries({ queryKey: ['exercises', user.userId] }),
      queryClient.invalidateQueries({ queryKey: ['sessions', user.userId] }),
    ]);
  });
```

- [ ] **Step 3: Verificar**

Run: `npx eslint components/plans/training-plans-screen.jsx`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/plans/training-plans-screen.jsx
git commit -m "feat(plans): migrate training-plans-screen.jsx pull-to-refresh to invalidateQueries"
```

---

### Task 10: Limpieza final — eliminar stores viejos, tests, actualizar CLAUDE.md, versión

**Files:**
- Delete: `store/exercise-store.js`, `store/session-store.js`
- Delete: `__tests__/exercise-store.test.js`, `__tests__/session-store.test.js`
- Modify: `CLAUDE.md`
- Modify: `package.json` (versión)

- [ ] **Step 1: Confirmar que no queda ningún consumidor de los stores viejos**

Run:
```bash
grep -rn "useExerciseStore\|useSessionStore" components/ app/ hooks/ store/
```
Expected: sin resultados (fuera de los propios archivos de store, que se borran en el siguiente paso).

- [ ] **Step 2: Eliminar los stores y sus tests**

```bash
git rm store/exercise-store.js store/session-store.js
git rm __tests__/exercise-store.test.js __tests__/session-store.test.js
```

- [ ] **Step 3: Actualizar `CLAUDE.md` — sección "Estado de aplicación vs. estado de servidor"**

Localizar el párrafo (empieza con "**Estado de aplicación vs. estado de servidor:**") y agregar `hooks/use-exercises.js`/`hooks/use-sessions.js` a la lista de dominios migrados, junto con la fecha y rama de esta migración. Reemplazar la frase final:
```
Sub-proyecto futuro del mismo esfuerzo, sin fecha: migrar `exercise-store.js`/`session-store.js` primero, `training-plan-store.js` al final (su diseño todavía puede cambiar).
```
por:
```
Sub-proyecto futuro y último de este esfuerzo, sin fecha: migrar `training-plan-store.js` (su diseño todavía puede cambiar).
```

Y en el mismo párrafo, agregar antes de esa frase (después de mencionar `hooks/use-user.js`):
```
, y catálogo de ejercicios/sesiones del entrenador (`hooks/use-exercises.js`/`hooks/use-sessions.js`, desde <FECHA>, rama `feature/exercise-session-store-query-migration-spec` — ver `docs/superpowers/specs/2026-09-09-exercise-session-store-tanstack-query-migration-design.md`)
```
(reemplazar `<FECHA>` por la fecha real del día en que se ejecuta este step, formato `YYYY-MM-DD`).

- [ ] **Step 4: Bump de versión**

Run: `cat package.json | grep '"version"'` para ver la versión actual, bumpear el patch (`0.X.Y` → `0.X.(Y+1)`) — migración mecánica sin cambios de comportamiento visible para el usuario final, a diferencia de auth/team-store que sí cambiaron flujos reales.

- [ ] **Step 5: Suite completa**

Run: `npm run lint && npm test`
Expected: ambos en verde. El conteo de tests baja (se eliminaron 2 archivos de test) — confirmar que la baja coincide exactamente con los tests que tenían `exercise-store.test.js`/`session-store.test.js` (revisar el output de la corrida anterior a este step si hace falta comparar cuántos tests tenía cada uno).

- [ ] **Step 6: Verificar en preview**

Recorrer Planes de entrenamiento → pestañas Ejercicios y Sesiones (crear, editar, borrar un ejercicio; crear, editar, borrar una sesión; confirmar el contador "Usado en N sesiones/planes"), crear un plan nuevo (el picker de sesión por día debe mostrar el catálogo y el preview de ejercicios), y abrir el detalle de un plan ya asignado a un corredor (confirmar que carga sesiones/ejercicios del entrenador dueño del plan, no del corredor que mira).

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md package.json
git commit -m "$(cat <<'EOF'
refactor(exercises,sessions): migrate exercise/session stores to TanStack Query

exercise-store.js y session-store.js se eliminan enteros — el
catálogo de ejercicios/sesiones del entrenador migra a
hooks/use-exercises.js/hooks/use-sessions.js, mismo patrón que
equipos (PR #123) y perfil de usuario (PR #124). Sin cambios de
comportamiento visible ni de contrato de backend (sigue sobre mocks,
FORCE_MOCKS=true, gap 4 de docs/BACKEND_API_GAPS.md).
EOF
)"
```

---

## Self-Review

**Cobertura de la spec:** hooks nuevos (Tasks 1-2), eliminación de los stores viejos sin remanente (Task 10), los 8 archivos consumidores reales listados en la spec (Tasks 3-9, agrupando `session-exercises-preview.jsx`+`create-exercise-modal.jsx` en la Task 3 por ser ambos exclusivamente del dominio de ejercicios y chicos), `use-today-plan-session.js` confirmado sin cambios (comentario, no llamada real — no tiene task propia), tests viejos eliminados (Task 10), nota de "tests de render a futuro" ya vive en la spec (no repetida acá, la spec es la fuente).

**Placeholder scan:** sin TBD/TODO. El único valor a completar en el momento de ejecutar es `<FECHA>` en el Step 3 de la Task 10 (fecha real del día), explícito como tal, no una instrucción vaga.

**Consistencia de tipos:** `useExercises(ownerId)`/`useSessions(ownerId)` se llaman con ese nombre de parámetro en las 8 tareas de consumidores, siempre pasando `userId` (de sesión) salvo en `training-plan-detail-screen.jsx` (Task 8), que pasa `plan?.ownerId` a propósito (documentado en esa misma task). Las mutations (`createExercise`/`updateExercise`/`deleteExercise`/`createSession`/`updateSession`/`deleteSession`) se llaman siempre con el shape `{ownerId, ...}` definido en Tasks 1-2, consistente en Tasks 3, 4, 5 y 6.
