# UX Form & Interaction Polish (Subproyecto B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar confirmación al descartar cambios sin guardar, haptics en acciones clave, y auto-focus de campo en mobile, a todos los forms de edición/creación reales del repo (excluyendo pantallas de autenticación).

**Architecture:** Dos hooks genéricos nuevos (`useFormDirty` para detectar cambios, `useUnsavedChangesGuard` para interceptar la salida vía `usePreventRemove` de React Navigation + un `guardedClose` explícito) y un modal de confirmación compartido, cableados pantalla por pantalla. Haptics vía un wrapper fino sobre `expo-haptics`, no-op fuera de mobile. Auto-focus vía la prop nativa `autoFocus` de `TextInput`, agregada como passthrough a `InputField`.

**Tech Stack:** Expo Router / `@react-navigation/core@7.21.5` (`usePreventRemove`, ya presente en `node_modules` vía `expo-router`, sin dependencia nueva), `expo-haptics` (dependencia nueva), React Native `TextInput.autoFocus`.

**Spec:** `docs/superpowers/specs/2026-09-05-ux-form-interaction-polish-design.md`

## Global Constraints

- **Excluidas del guard de cambios sin guardar:** `login-screen.jsx`, `register-screen.jsx`, `forgot-password-screen.jsx`, `reset-password-screen.jsx` (auth, misma categoría que ya se excluyó de pull-to-refresh en Subproyecto A). También excluida la pestaña "Contraseña" de `edit-profile-screen.jsx` (`ChangePasswordSection`) — es una acción de seguridad puntual, no "datos" que valga la pena proteger de perder.
- **Sin librería de forms nueva.** Detección de `isDirty` vía comparación de snapshot JSON (`hooks/use-form-dirty.js`), no `react-hook-form` ni similar.
- **`usePreventRemove`/`useNavigation` se importan de `@react-navigation/native`** (re-exporta `@react-navigation/core` completo — confirmado en `node_modules/@react-navigation/native/lib/module/index.js:20`). No agregar `@react-navigation/core` como dependencia directa — ya es transitiva de `expo-router`.
- **Haptics gateado a `isMobile`** (no `isWeb`) — mismo criterio que `usePullToRefresh`/`RefreshControl`, la API nativa no existe en React Native Web.
- **Auto-focus gateado a `!isWeb`** — autofocus en web es anti-patrón de accesibilidad conocido.
- **Auto-focus solo en forms de alta**, nunca en edición (forzar foco en una pantalla que abre con datos ya cargados saca al usuario de donde estaba mirando).
- **Sin tests de render** (convención del proyecto). Los hooks puros (`useFormDirty`, `utils/haptics.js`) sí llevan test en `__tests__/`, siguiendo el patrón plano existente (`__tests__/<nombre-del-archivo>.test.js`, ver `__tests__/build-photo-form-data.test.js`).
- `npm test` y `npm run lint` deben quedar en verde en cada tarea.

---

### Task 1: Primitivas compartidas — `useFormDirty`, `useUnsavedChangesGuard`, `DiscardChangesModal`, `autoFocus` en `InputField`

**Files:**
- Create: `hooks/use-form-dirty.js`
- Create: `__tests__/use-form-dirty.test.js`
- Create: `hooks/use-unsaved-changes-guard.js`
- Create: `components/shared/discard-changes-modal.jsx`
- Modify: `components/forms/fields.jsx:269` (agregar prop `autoFocus` a `InputField`, passthrough a `TextInput`)

**Interfaces:**
- Produces: `useFormDirty(values, resetKey?)` → `boolean`. `values` es cualquier objeto plano serializable; `resetKey` (opcional) re-captura el snapshot base cuando cambia — sin `resetKey`, el snapshot se toma una sola vez en el primer render.
- Produces: `useUnsavedChangesGuard(isDirty)` → `{ confirmVisible: boolean, guardedClose: (closeFn: () => void) => void, confirmDiscard: () => void, cancelDiscard: () => void }`.
- Produces: `<DiscardChangesModal visible confirmVisible onCancel={cancelDiscard} onConfirm={confirmDiscard} />` — sin prop `loading`.
- Produces: `InputField` acepta ahora `autoFocus` (bool, default `undefined`/falsy, sin cambio de comportamiento para callers existentes).

- [ ] **Step 1: Escribir el test de `useFormDirty`**

```js
// __tests__/use-form-dirty.test.js
import { renderHook, act } from '@testing-library/react-native';
import { useState } from 'react';
import { useFormDirty } from '../hooks/use-form-dirty.js';

function useDirtyHarness(initialValues, initialResetKey) {
  const [values, setValues] = useState(initialValues);
  const [resetKey, setResetKey] = useState(initialResetKey);
  const isDirty = useFormDirty(values, resetKey);
  return { values, setValues, resetKey, setResetKey, isDirty };
}

test('no está dirty si los valores no cambiaron desde el primer render', () => {
  const { result } = renderHook(() => useDirtyHarness({ name: 'Ana' }));
  expect(result.current.isDirty).toBe(false);
});

test('queda dirty cuando los valores cambian', () => {
  const { result } = renderHook(() => useDirtyHarness({ name: 'Ana' }));
  act(() => { result.current.setValues({ name: 'Ana María' }); });
  expect(result.current.isDirty).toBe(true);
});

test('vuelve a false si los valores vuelven al snapshot original', () => {
  const { result } = renderHook(() => useDirtyHarness({ name: 'Ana' }));
  act(() => { result.current.setValues({ name: 'Ana María' }); });
  act(() => { result.current.setValues({ name: 'Ana' }); });
  expect(result.current.isDirty).toBe(false);
});

test('resetKey re-captura el snapshot base (caso modal reabierto)', () => {
  const { result } = renderHook(() => useDirtyHarness({ name: 'Ana' }, 'session-1'));
  act(() => { result.current.setValues({ name: 'Ana María' }); });
  expect(result.current.isDirty).toBe(true);

  // Reabrir el modal con otro registro: cambia resetKey y los valores
  // precargados a la vez, como hace CreateSessionModal al abrir.
  act(() => {
    result.current.setValues({ name: 'Otro' });
    result.current.setResetKey('session-2');
  });
  expect(result.current.isDirty).toBe(false);
});
```

- [ ] **Step 2: Correr el test, debe fallar (módulo no existe)**

Run: `npm test -- use-form-dirty`
Expected: FAIL con "Cannot find module '../hooks/use-form-dirty.js'"

- [ ] **Step 3: Implementar `useFormDirty`**

```js
// hooks/use-form-dirty.js
import { useEffect, useRef } from 'react';

// Detección genérica de "cambios sin guardar" sin librería de forms: cada
// pantalla arma su propio objeto plano con los campos que le importan y lo
// pasa acá en cada render — se compara contra un snapshot JSON tomado la
// primera vez (alta: vacío: edición: los valores ya cargados).
//
// `resetKey` es para forms que vuelven a "arrancar de cero" sin
// desmontarse — los modales de catálogo (CreateSessionModal,
// CreateExerciseModal) siguen montados con `visible=false` entre usos y
// recargan sus campos vía un efecto propio cuando se reabren; pasarles
// `session?.id ?? 'new'` (o equivalente) como resetKey hace que el
// snapshot base se recapture en ese momento, no solo en el mount inicial.
export function useFormDirty(values, resetKey) {
  const snapshot = JSON.stringify(values);
  const baselineRef = useRef(snapshot);

  useEffect(() => {
    baselineRef.current = JSON.stringify(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return snapshot !== baselineRef.current;
}
```

- [ ] **Step 4: Correr el test, debe pasar**

Run: `npm test -- use-form-dirty`
Expected: PASS (4/4)

- [ ] **Step 5: Crear `useUnsavedChangesGuard`**

```js
// hooks/use-unsaved-changes-guard.js
import { useEffect, useRef, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { isWeb } from '../utils/platform.js';

// Intercepta la salida de un form con cambios sin guardar: back
// nativo/gesto/header (usePreventRemove, cubre remoción de ruta real) y
// cierre explícito vía `guardedClose` (para botones de back propios que
// llaman router.back()/router.replace() a mano, y para modales de RN que
// no son rutas — ver components/shared/discard-changes-modal.jsx).
export function useUnsavedChangesGuard(isDirty) {
  const navigation = useNavigation();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const pendingActionRef = useRef(null);

  usePreventRemove(isDirty, (e) => {
    pendingActionRef.current = () => navigation.dispatch(e.data.action);
    setConfirmVisible(true);
  });

  useEffect(() => {
    if (!isWeb) return undefined;
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const guardedClose = (closeFn) => {
    if (!isDirty) {
      closeFn();
      return;
    }
    pendingActionRef.current = closeFn;
    setConfirmVisible(true);
  };

  const confirmDiscard = () => {
    setConfirmVisible(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  };

  const cancelDiscard = () => setConfirmVisible(false);

  return { confirmVisible, guardedClose, confirmDiscard, cancelDiscard };
}
```

- [ ] **Step 6: Crear `DiscardChangesModal`**

```jsx
// components/shared/discard-changes-modal.jsx
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Mismo patrón visual que components/team/delete-team-modal.jsx, sin
// `loading` (esto no dispara ninguna request, es instantáneo) y con
// paleta ámbar en vez de roja — perdés tu trabajo, no se borra nada del
// servidor.
export function DiscardChangesModal({ visible, onCancel, onConfirm }) {
  return (
    <Modal nativeID="discard-changes-modal" testID="discard-changes-modal" animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View nativeID="discard-changes-modal-backdrop" testID="discard-changes-modal-backdrop" className="flex-1 items-center justify-center bg-black/50 px-4">
        <View nativeID="discard-changes-modal-card" testID="discard-changes-modal-card" className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl dark:border-amber-900/50 dark:bg-surface">
          <View nativeID="discard-changes-modal-header" testID="discard-changes-modal-header" className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons color="#d97706" name="alert-outline" size={20} />
            <Text nativeID="discard-changes-modal-title" testID="discard-changes-modal-title" className="text-lg font-bold text-amber-700 dark:text-amber-400">Salir sin guardar</Text>
          </View>

          <Text nativeID="discard-changes-modal-description" testID="discard-changes-modal-description" className="mb-5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Tenés cambios sin guardar. Si salís ahora, se van a perder.
          </Text>

          <View nativeID="discard-changes-modal-actions" testID="discard-changes-modal-actions" className="flex-row gap-3">
            <Pressable
              nativeID="discard-changes-modal-cancel-button"
              testID="discard-changes-modal-cancel-button"
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              onPress={onCancel}
            >
              <Text nativeID="discard-changes-modal-cancel-label" testID="discard-changes-modal-cancel-label" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Seguir editando</Text>
            </Pressable>
            <Pressable
              nativeID="discard-changes-modal-confirm-button"
              testID="discard-changes-modal-confirm-button"
              className="h-11 flex-1 items-center justify-center rounded-full bg-amber-600 hover:opacity-90 active:opacity-80"
              onPress={onConfirm}
            >
              <Text nativeID="discard-changes-modal-confirm-label" testID="discard-changes-modal-confirm-label" className="text-sm font-semibold uppercase tracking-wide text-white">Salir sin guardar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 7: Agregar `autoFocus` a `InputField`**

En `components/forms/fields.jsx:269`, agregar `autoFocus` a la firma de props:

```js
export function InputField({ label, value, onChange, onBlur, error, hint, touched, placeholder, secureTextEntry, keyboardType, autoComplete, textContentType, autoCapitalize, onSubmitEditing, returnKeyType, onToggleSecure, showSecure, disabled, multiline, numberOfLines, dense, className, hideErrorRow, autoFocus }) {
```

Y pasarlo al `TextInput` (línea ~291, junto a `autoCapitalize`):

```js
        <TextInput
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={INPUT_CLASS}
```

- [ ] **Step 8: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todos los tests pasan (incluyendo los 4 nuevos), 0 errores de lint.

- [ ] **Step 9: Commit**

```bash
git add hooks/use-form-dirty.js __tests__/use-form-dirty.test.js hooks/use-unsaved-changes-guard.js components/shared/discard-changes-modal.jsx components/forms/fields.jsx
git commit -m "feat(ux): add unsaved-changes guard primitives and autoFocus passthrough"
```

---

### Task 2: `expo-haptics` — dependencia + wrapper `utils/haptics.js`

**Files:**
- Modify: `package.json`, `package-lock.json` (nueva dependencia, vía `npx expo install`)
- Create: `utils/haptics.js`
- Create: `__tests__/haptics.test.js`

**Interfaces:**
- Consumes: `isMobile` de `utils/platform.js` (ya existe).
- Produces: `notifySuccess()`, `notifyError()`, `notifyWarning()` — funciones sin argumentos, side-effect only, no-op fuera de `isMobile`.

- [ ] **Step 1: Instalar la dependencia**

Run: `npx expo install expo-haptics`
Expected: agrega `expo-haptics` a `dependencies` en `package.json` con una versión resuelta para SDK 54 (mismo mecanismo que la instalación de `expo-image` en Subproyecto A — Expo resuelve la versión compatible automáticamente, no fijar una a mano).

- [ ] **Step 2: Escribir el test de `utils/haptics.js`**

```js
// __tests__/haptics.test.js
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

describe('en mobile', () => {
  jest.mock('../utils/platform.js', () => ({ isMobile: true }));

  test('notifySuccess dispara notificationAsync con Success', async () => {
    const Haptics = require('expo-haptics');
    const { notifySuccess } = require('../utils/haptics.js');
    notifySuccess();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });
});

describe('fuera de mobile (web)', () => {
  jest.resetModules();
  jest.mock('expo-haptics', () => ({
    notificationAsync: jest.fn(),
    NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  }));
  jest.mock('../utils/platform.js', () => ({ isMobile: false }));

  test('notifySuccess no llama a Haptics', () => {
    const Haptics = require('expo-haptics');
    const { notifySuccess } = require('../utils/haptics.js');
    notifySuccess();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Correr el test, debe fallar (módulo no existe)**

Run: `npm test -- haptics`
Expected: FAIL con "Cannot find module '../utils/haptics.js'"

- [ ] **Step 4: Implementar `utils/haptics.js`**

```js
// utils/haptics.js
import * as Haptics from 'expo-haptics';
import { isMobile } from './platform.js';

// No-op fuera de mobile — RNW no implementa la API nativa de haptics,
// mismo criterio que usePullToRefresh/RefreshControl.
export const notifySuccess = () => {
  if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export const notifyError = () => {
  if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};

export const notifyWarning = () => {
  if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};
```

- [ ] **Step 5: Correr el test, debe pasar**

Run: `npm test -- haptics`
Expected: PASS (2/2)

- [ ] **Step 6: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json utils/haptics.js __tests__/haptics.test.js
git commit -m "feat(ux): add expo-haptics dependency and haptics wrapper"
```

---

### Task 3: Fix bug de resync en `edit-group-screen.jsx` + guard + haptics

**Files:**
- Modify: `components/team/edit-group-screen.jsx`

**Interfaces:**
- Consumes: `useFormDirty` (Task 1), `useUnsavedChangesGuard` (Task 1), `DiscardChangesModal` (Task 1), `notifySuccess`/`notifyError` (Task 2).

- [ ] **Step 1: Arreglar el bug de resync (líneas 69-75)**

El `useEffect` actual resincroniza el estado local cada vez que cambia la referencia de `group`, no solo la primera vez — esto ya se documentó como bug bloqueante en el Subproyecto A (por eso se excluyó ahí de pull-to-refresh). Reemplazar:

```js
  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
      setTrainingPlanId(group.trainingPlanId ?? '');
    }
  }, [group]);
```

por:

```js
  const seededRef = useRef(false);
  useEffect(() => {
    if (group && !seededRef.current) {
      seededRef.current = true;
      setName(group.name);
      setDescription(group.description ?? '');
      setTrainingPlanId(group.trainingPlanId ?? '');
    }
  }, [group]);
```

Agregar `useRef` al import de React en la línea 1: `import { useEffect, useRef, useState } from 'react';`.

- [ ] **Step 2: Agregar el guard**

Importar en la parte superior del archivo:

```js
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
```

Después de las declaraciones de `useState` (después de la línea `const [loadingGroups, setLoadingGroups] = useState(true);`), agregar:

```js
  const isDirty = useFormDirty({ name, description, trainingPlanId });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

- [ ] **Step 3: Reemplazar los 2 back buttons por `guardedClose`**

Línea 94 (rama "not found" — acá no hay datos que perder, pero es igual de simple dejarlo consistente; `isDirty` va a ser `false` en esa rama porque el form nunca se completó, así que `guardedClose` cierra directo sin preguntar):

```js
          onPress={() => guardedClose(() => router.back())}
```

Línea 141 (header de la pantalla, mismo cambio):

```js
          onPress={() => guardedClose(() => router.back())}
```

- [ ] **Step 4: Haptics en el submit y el modal de confirmación**

En `handleSubmit`, después de `Toast.show({ type: 'error', ... })` agregar `notifyError();` antes del `return`, y después de `Toast.show({ type: 'success', text1: 'Grupo actualizado' });` agregar `notifySuccess();`:

```js
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos actualizar el grupo', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Grupo actualizado' });
    router.back();
```

El `return` de `EditGroupScreenContent` (línea 128) es un único `ScrollView` raíz — envolver en fragment:

```jsx
  return (
    <>
    <ScrollView
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      nativeID="edit-group-screen-scroll"
      showsVerticalScrollIndicator={false}
      testID="edit-group-screen-scroll"
    >
      {/* ... contenido existente sin cambios ... */}
    </ScrollView>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
}
```

- [ ] **Step 5: Verificar manualmente en preview**

No hay test de render (convención del proyecto). Verificar en el preview web: entrar a editar un grupo, cambiar el nombre, intentar volver (botón de header) → debe aparecer el modal; "Seguir editando" cancela la salida; "Salir sin guardar" navega atrás.

- [ ] **Step 6: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add components/team/edit-group-screen.jsx
git commit -m "fix(teams): stop group edit form from resyncing on every refetch

Sums the unsaved-changes guard now that the seed bug (which made isDirty
unreliable) is fixed."
```

---

### Task 4: Guard + autofocus en `create-team-screen.jsx` (wizard)

**Files:**
- Modify: `components/team/create-team-screen.jsx`

**Interfaces:**
- Consumes: `useFormDirty`, `useUnsavedChangesGuard`, `DiscardChangesModal` (Task 1); `generalForm.getValues()` de `useTeamGeneralInfoForm` (ya existe).

- [ ] **Step 1: Autofocus en el campo "Nombre del equipo" (paso 1)**

`TeamGeneralInfoFields` (`components/team/team-general-info-fields.jsx`) renderiza el campo nombre vía `InputField` — pasarle `autoFocus={!isWeb}` solo quiere aplicar en el paso 1 de este wizard, no en `EditTeamScreen` (que reusa el mismo componente). Como `TeamGeneralInfoFields` es compartido, agregarle una prop opcional `autoFocusName`:

En `components/team/team-general-info-fields.jsx`, ubicar el `InputField` del campo "Nombre" (label "Nombre del equipo" o similar, primer campo del form) y:
1. Agregar `autoFocusName = false` a la firma de props del componente exportado.
2. Pasar `autoFocus={autoFocusName}` a ese `InputField`.

En `create-team-screen.jsx:202`, cambiar:

```jsx
            <TeamGeneralInfoFields form={generalForm} idPrefix="create-team" maxAllowed={maxAllowed} />
```

por:

```jsx
            <TeamGeneralInfoFields autoFocusName={!isWeb} form={generalForm} idPrefix="create-team" maxAllowed={maxAllowed} />
```

`isWeb` ya está importado en este archivo (línea 7).

- [ ] **Step 2: Agregar el guard**

Importar:

```js
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
```

Después de la declaración de `invitedEmails` (línea 100), agregar:

```js
  const isDirty = useFormDirty({ general: generalForm.getValues(), groups, invitedEmails });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

- [ ] **Step 3: Reemplazar el back button del header (línea 181)**

```jsx
            onPress={() => guardedClose(() => router.back())}
```

(Los botones "Atrás" de `StepNav` entre pasos NO se tocan — son navegación interna del wizard, no salida de la pantalla.)

- [ ] **Step 4: Agregar el modal al JSX**

El `return` de este componente ya envuelve todo en un `<View>` raíz (línea 167) con `ScrollView` y `AnimatedDropdown` como hijos — agregar `<DiscardChangesModal>` como tercer hijo de ese `View`, después del `AnimatedDropdown` (antes del `</View>` de cierre en la línea 242):

```jsx
    </AnimatedDropdown>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </View>
```

- [ ] **Step 5: Verificar manualmente en preview**

Web: entrar a crear equipo, escribir un nombre, click en back del header → aparece el modal. Confirmar que en mobile el campo "Nombre del equipo" recibe foco automático al entrar al paso 1 (revisar con `preview_resize` a un viewport angosto si el preview no corre nativo — el autofocus en sí solo es observable en build nativo real o Expo Go, dejar constancia en el reporte si no se pudo verificar directo).

- [ ] **Step 6: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add components/team/create-team-screen.jsx components/team/team-general-info-fields.jsx
git commit -m "feat(teams): discard-changes guard and autofocus on create-team wizard"
```

---

### Task 5: Guard en `edit-team-screen.jsx` + `edit-training-plan-screen.jsx` (batch, mismo shape)

**Files:**
- Modify: `components/team/edit-team-screen.jsx`
- Modify: `components/plans/edit-training-plan-screen.jsx`

**Interfaces:**
- Consumes: `useFormDirty`, `useUnsavedChangesGuard`, `DiscardChangesModal` (Task 1), `notifySuccess`/`notifyError` (Task 2).

Ambos archivos comparten la misma forma: componente `*ScreenContent` que resuelve loading/not-found, y un componente `*Form` interno (`EditTeamForm`, `EditTrainingPlanForm`) que ya recibe el recurso garantizado y usa un hook con `getValues()`. El guard se cablea en el componente `*Form`, no en el `*ScreenContent`.

- [ ] **Step 1: `edit-team-screen.jsx` — imports**

```js
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
```

- [ ] **Step 2: `edit-team-screen.jsx` — dentro de `EditTeamForm`, después de `const [submitting, setSubmitting] = useState(false);` (línea 94)**

```js
  const isDirty = useFormDirty({ general: generalForm.getValues(), showGroupsToRunners, visible, isPublic });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

- [ ] **Step 3: `edit-team-screen.jsx` — back button (línea 130) y haptics en `handleSubmit`**

```jsx
          onPress={() => guardedClose(() => router.back())}
```

En `handleSubmit`:

```js
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos guardar los cambios', text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({
```

- [ ] **Step 4: `edit-team-screen.jsx` — agregar el modal**

El `return` de `EditTeamForm` es un único `ScrollView` (sin fragment) — envolver en fragment:

```jsx
  return (
    <>
    <ScrollView
      ...
    >
      ...
    </ScrollView>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
```

- [ ] **Step 5: `edit-training-plan-screen.jsx` — mismos imports que Step 1**

- [ ] **Step 6: `edit-training-plan-screen.jsx` — dentro de `EditTrainingPlanForm`, después de `const [submitting, setSubmitting] = useState(false);` (línea 77)**

```js
  const isDirty = useFormDirty({ name: form.name, description: form.description, durationDays: form.durationDays, days: form.days });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

(Se arma el objeto a mano en vez de `form.getValues()` porque `getValues()` de `useTrainingPlanForm` incluye `ownerId`, que nunca cambia y solo agregaría ruido a la comparación.)

- [ ] **Step 7: `edit-training-plan-screen.jsx` — back button (línea 111) y haptics en `handleSubmit`**

```jsx
          onPress={() => guardedClose(() => router.back())}
```

```js
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos guardar los cambios', text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: 'Plan actualizado' });
```

- [ ] **Step 8: `edit-training-plan-screen.jsx` — agregar el modal**

Mismo tratamiento que Step 4: envolver el `return` de `EditTrainingPlanForm` en fragment y agregar `<DiscardChangesModal>` como hermano del `ScrollView`.

- [ ] **Step 9: Verificar manualmente en preview ambos flujos**

Editar equipo y editar plan: cambiar un campo, intentar salir por el back del header, confirmar que aparece el modal y que ambos botones (seguir editando / salir sin guardar) hacen lo esperado.

- [ ] **Step 10: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 11: Commit**

```bash
git add components/team/edit-team-screen.jsx components/plans/edit-training-plan-screen.jsx
git commit -m "feat(ux): discard-changes guard on edit-team and edit-training-plan screens"
```

---

### Task 6: Guard + autofocus en `create-training-plan-screen.jsx`

**Files:**
- Modify: `components/plans/create-training-plan-screen.jsx`
- Modify: `components/plans/training-plan-form-fields.jsx`

**Interfaces:**
- Consumes: `useFormDirty`, `useUnsavedChangesGuard`, `DiscardChangesModal` (Task 1), `notifySuccess`/`notifyError` (Task 2), `autoFocus` en `InputField` (Task 1).

- [ ] **Step 1: Autofocus en el campo "Nombre del plan"**

`TrainingPlanFormFields` (`components/plans/training-plan-form-fields.jsx`) es compartido entre crear y editar — igual que en Task 4, agregar una prop opcional. En la firma del componente exportado (línea 190):

```js
export function TrainingPlanFormFields({ form, durationOptions, autoFocusName = false }) {
```

Y en el `InputField` del nombre (línea 212):

```jsx
        <InputField autoFocus={autoFocusName} dense error={form.errors.name} label="Nombre del plan" onChange={form.setName} placeholder="Ej. Base 5K — nivel inicial" value={form.name} />
```

En `create-training-plan-screen.jsx:62`:

```jsx
        <TrainingPlanFormFields autoFocusName={!isWeb} durationOptions={PLAN_DURATION_OPTIONS} form={form} />
```

`isWeb` ya está importado (línea 7). En `edit-training-plan-screen.jsx` (Task 5) el call site NO se toca — se queda sin `autoFocusName`, por lo que sigue en `false` por default (edición no lleva autofocus).

- [ ] **Step 2: Agregar el guard en `create-training-plan-screen.jsx`**

Importar:

```js
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
```

Después de `const [submitting, setSubmitting] = useState(false);` (línea 21):

```js
  const isDirty = useFormDirty({ name: form.name, description: form.description, durationDays: form.durationDays, days: form.days });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

- [ ] **Step 3: Back button (línea 52) y haptics en `handleSubmit`**

```jsx
          onPress={() => guardedClose(() => router.back())}
```

```js
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos crear el plan', text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: 'Plan creado' });
```

- [ ] **Step 4: Agregar el modal**

Envolver el `return` en fragment (el `return` actual es un único `ScrollView`), agregar `<DiscardChangesModal>` como hermano.

- [ ] **Step 5: Verificar manualmente en preview**

Crear plan: escribir nombre, back del header → modal aparece. Autofocus: mismo criterio que Task 4 (solo observable en mobile real/Expo Go, dejar constancia si no se pudo verificar en el preview web).

- [ ] **Step 6: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add components/plans/create-training-plan-screen.jsx components/plans/training-plan-form-fields.jsx
git commit -m "feat(plans): discard-changes guard and autofocus on create-training-plan screen"
```

---

### Task 7: Guard en `invite-team-members-screen.jsx` + `assign-training-plan-screen.jsx` (batch)

**Files:**
- Modify: `components/team/invite-team-members-screen.jsx`
- Modify: `components/plans/assign-training-plan-screen.jsx`

**Interfaces:**
- Consumes: `useFormDirty`, `useUnsavedChangesGuard`, `DiscardChangesModal` (Task 1), `notifySuccess`/`notifyError` (Task 2).

- [ ] **Step 1: `invite-team-members-screen.jsx` — imports**

```js
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
```

- [ ] **Step 2: `invite-team-members-screen.jsx` — dentro de `InviteTeamMembersScreenContent`, después de `const [loadingGroups, setLoadingGroups] = useState(true);` (línea 62)**

```js
  const isDirty = useFormDirty({ hasDrafts: draftInvites.length > 0 });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

Nota: este `useUnsavedChangesGuard` (y por lo tanto su `usePreventRemove`) se llama incondicionalmente incluso durante el `if (loadingTeam || ...) return (...)` de las líneas 102-108 y el `if (!team) return (...)` de 110-128 — como las declaraciones van ANTES de esos returns tempranos, no violan las reglas de hooks (mismo orden en cada render). `isDirty` da `false` mientras `draftInvites` está vacío (siempre el caso en esas ramas tempranas), así que el guard es un no-op ahí.

- [ ] **Step 3: `invite-team-members-screen.jsx` — 2 back buttons (líneas 119 y 162) y haptics en `handleSendInvites`**

Línea 119 (rama "not found"):

```jsx
          onPress={() => guardedClose(() => router.back())}
```

Línea 162 (header):

```jsx
          onPress={() => guardedClose(() => router.back())}
```

En `handleSendInvites` (línea 130), después de `setSending(false); setDraftInvites([]);`:

```js
    if (failed > 0) {
      notifyError();
      Toast.show({ type: 'error', text1: 'Algunas invitaciones no se pudieron enviar', text2: `${failed} de ${draftInvites.length} fallaron.` });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Invitaciones enviadas' });
```

- [ ] **Step 4: `invite-team-members-screen.jsx` — agregar el modal**

El `return` principal ya es un `<View>` raíz con `ScrollView` y `AnimatedDropdown` como hijos (línea 148-221) — agregar `<DiscardChangesModal>` como tercer hijo, después del `AnimatedDropdown`:

```jsx
    </AnimatedDropdown>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </View>
```

- [ ] **Step 5: `assign-training-plan-screen.jsx` — imports**

Mismos 4 imports del Step 1 (ajustar la ruta relativa: `../../hooks/...`, `../shared/discard-changes-modal.jsx`, `../../utils/haptics.js` — igual profundidad de carpeta que `invite-team-members-screen.jsx`).

- [ ] **Step 6: `assign-training-plan-screen.jsx` — dentro de `AssignTrainingPlanScreenContent`, después de `const [assigning, setAssigning] = useState(false);` (línea 41)**

```js
  const isDirty = useFormDirty({ teamId, groupId, runnerId });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

- [ ] **Step 7: `assign-training-plan-screen.jsx` — back button (línea 121) y haptics en `handleAssign`**

```jsx
            onPress={() => guardedClose(() => router.back())}
```

En `handleAssign` (línea 81), después de las dos validaciones tempranas de "Elegí un grupo"/"Elegí un corredor":

```js
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos asignar el plan', text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: 'Plan asignado' });
```

- [ ] **Step 8: `assign-training-plan-screen.jsx` — agregar el modal**

Envolver el `return` (actualmente un único `ScrollView`) en fragment y agregar `<DiscardChangesModal>` como hermano.

- [ ] **Step 9: Verificar manualmente en preview ambos flujos**

Invitar corredores: agregar un email al borrador, back del header → modal aparece. Asignar plan: elegir equipo+grupo, back del header → modal aparece.

- [ ] **Step 10: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 11: Commit**

```bash
git add components/team/invite-team-members-screen.jsx components/plans/assign-training-plan-screen.jsx
git commit -m "feat(ux): discard-changes guard on invite-members and assign-training-plan screens"
```

---

### Task 8: Guard + autofocus en `create-session-modal.jsx` + `create-exercise-modal.jsx`

**Files:**
- Modify: `components/plans/create-session-modal.jsx`
- Modify: `components/plans/create-exercise-modal.jsx`

**Interfaces:**
- Consumes: `useFormDirty` con `resetKey` (Task 1), `useUnsavedChangesGuard`, `DiscardChangesModal` (Task 1), `notifySuccess`/`notifyError` (Task 2), `autoFocus` en `InputField` (Task 1).

Estos 2 modales no son rutas — siguen montados con `visible=false` entre usos, y recargan sus campos vía el efecto `reset()` cada vez que se abren (`visible` pasa a `true`) o cambia el registro que editan (`session?.id`/`exercise?.id`). Por eso `isDirty` debe:
1. Usar `resetKey` en `useFormDirty` para recapturar el snapshot en cada apertura (si no, el snapshot quedaría fijo en el primer montaje del árbol, con campos vacíos, y cualquier apertura posterior en modo edición marcaría dirty=true de entrada).
2. Estar gateado por `visible` — mientras el modal está cerrado, los campos quedan con el último valor que tenían (no se resetean hasta la próxima apertura), así que sin este gate `isDirty` seguiría en `true` después de cerrar y dispararía el guard de la pantalla padre sin motivo.

- [ ] **Step 1: `create-session-modal.jsx` — imports**

```js
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
```

- [ ] **Step 2: `create-session-modal.jsx` — después de `const [createExerciseTarget, setCreateExerciseTarget] = useState(null);` (línea 38)**

```js
  const dirtyValues = { name, description, warmupExerciseId, mainExerciseId, mainRepeatCount, mainRestMinutes, cooldownExerciseId };
  const isDirty = visible && useFormDirty(dirtyValues, session?.id ?? 'new');
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

- [ ] **Step 3: `create-session-modal.jsx` — envolver el cierre en `handleClose` (línea 65)**

```js
  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };
```

(`onRequestClose={handleClose}` del `Modal` y el botón "Cancelar" ya llaman `handleClose` — ambos quedan cubiertos con este único cambio.)

- [ ] **Step 4: `create-session-modal.jsx` — haptics en `handleSubmit` (línea 77)**

```js
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: `No pudimos ${isEditing ? 'guardar' : 'crear'} la sesión`, text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: isEditing ? 'Sesión actualizada' : 'Sesión creada' });
```

- [ ] **Step 5: `create-session-modal.jsx` — autofocus en el campo "Nombre" (línea 119)**

```jsx
              <InputField autoFocus={!isWeb && visible} dense hideErrorRow label="Nombre" onChange={setName} placeholder="Ej. Series de velocidad" value={name} />
```

`isWeb` no está importado en este archivo — agregar la línea `import { isWeb } from '../../utils/platform.js';` después de `import { useThemeColors } from '../../theme/colors.js';` (línea 5). El gate `&& visible` evita que el `autoFocus` de RN dispare foco en un `TextInput` que todavía no es visible/montado en pantalla.

- [ ] **Step 6: `create-session-modal.jsx` — agregar el modal**

El `return` ya es un fragment (`<>...</>`, líneas 106-200) que envuelve el `Modal` principal y `CreateExerciseModal`. Agregar `<DiscardChangesModal>` como tercer hijo:

```jsx
      <CreateExerciseModal
        onClose={() => setCreateExerciseTarget(null)}
        onCreated={handleExerciseCreated}
        visible={createExerciseTarget != null}
      />
      <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
```

- [ ] **Step 7: `create-exercise-modal.jsx` — mismo patrón (imports + hook + gate)**

Imports: mismos 4 del Step 1 + `import { isWeb } from '../../utils/platform.js';` (no está importado en este archivo — agregar después de `import { useThemeColors } from '../../theme/colors.js';`, línea 5).

Después de `const [submitting, setSubmitting] = useState(false);` (línea 33):

```js
  const dirtyValues = { name, kind, minutes, distanceM, speedKph, muscleGroup };
  const isDirty = visible && useFormDirty(dirtyValues, exercise?.id ?? 'new');
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

- [ ] **Step 8: `create-exercise-modal.jsx` — `handleClose` (línea 57)**

```js
  const handleClose = () => {
    if (submitting) return;
    guardedClose(onClose);
  };
```

- [ ] **Step 9: `create-exercise-modal.jsx` — haptics en `handleSubmit` (línea 62)**

```js
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: `No pudimos ${isEditing ? 'guardar' : 'crear'} el ejercicio`, text2: result.error });
      return;
    }

    notifySuccess();
    Toast.show({ type: 'success', text1: isEditing ? 'Ejercicio actualizado' : 'Ejercicio creado' });
```

- [ ] **Step 10: `create-exercise-modal.jsx` — autofocus en el campo "Nombre" (línea 105)**

```jsx
          <InputField autoFocus={!isWeb && visible} dense error={error} label="Nombre" onChange={(text) => { setName(text); if (error) setError(null); }} placeholder="Ej. Series 400m fuertes" value={name} />
```

- [ ] **Step 11: `create-exercise-modal.jsx` — agregar el modal**

El `return` actual (línea 94) es un único `Modal`, no un fragment — envolver:

```jsx
  return (
    <>
    <Modal animationType="fade" nativeID="create-exercise-modal" onRequestClose={handleClose} testID="create-exercise-modal" transparent visible={visible}>
      ...
    </Modal>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
```

- [ ] **Step 12: Verificar manualmente en preview**

Desde crear/editar un plan de entrenamiento, abrir "Crear sesión", escribir un nombre, click en Cancelar → debe aparecer el modal de descarte (no cerrar directo). Confirmar "Salir sin guardar" cierra el modal de sesión. Repetir con "Crear ejercicio" (accesible desde adentro del modal de sesión). Confirmar que reabrir el modal para editar una sesión/ejercicio existente no dispara el modal de descarte de entrada (el `resetKey` debe evitar el falso positivo).

- [ ] **Step 13: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 14: Commit**

```bash
git add components/plans/create-session-modal.jsx components/plans/create-exercise-modal.jsx
git commit -m "feat(plans): discard-changes guard and autofocus on session/exercise modals"
```

---

### Task 9: Guard + haptics en `edit-profile-screen.jsx` (pestaña "Datos personales" solamente)

**Files:**
- Modify: `components/profile/edit-profile-screen.jsx`

**Interfaces:**
- Consumes: `useFormDirty`, `useUnsavedChangesGuard`, `DiscardChangesModal` (Task 1), `notifySuccess`/`notifyError` (Task 2).

La pestaña "Contraseña" (`ChangePasswordSection`, línea 414 en adelante) queda **fuera** de este guard — es una acción de seguridad puntual y transitoria, no "datos de perfil" (mismo criterio que ya excluye `currentPassword` del snapshot en el spec).

- [ ] **Step 1: Imports**

```js
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
```

- [ ] **Step 2: Dentro de `EditProfileForm`, después de `const touch = (field) => ...` (línea 105)**

```js
  const isDirty = useFormDirty({
    firstName, lastName, dni, birthDate, email, phone, phoneContact, trainerAlias,
    country: address.country, province: address.province, city: address.city, street: address.street, number: address.number,
  });
  const { confirmVisible, guardedClose, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
```

(`address` — el resultado de `useAddressCascade(...)`, línea 107 — ya está declarado antes de este punto en el componente; si el orden real de declaraciones lo pusiera después, mover esta línea a después de `const address = useAddressCascade(...)`.)

- [ ] **Step 3: Back button (línea 207) y haptics en `handleSubmit`**

```jsx
            onPress={() => guardedClose(() => router.replace('/profile'))}
```

En `handleSubmit` (líneas 141-188), el bloque `try/catch` actual es:

```js
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Datos actualizados', text2: 'Tu perfil se guardó correctamente.' });
        router.replace('/profile');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudieron guardar los cambios.' });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
```

Reemplazar por:

```js
      if (result.success) {
        notifySuccess();
        Toast.show({ type: 'success', text1: 'Datos actualizados', text2: 'Tu perfil se guardó correctamente.' });
        router.replace('/profile');
      } else {
        notifyError();
        Toast.show({ type: 'error', text1: 'Error', text2: result.error || 'No se pudieron guardar los cambios.' });
      }
    } catch {
      notifyError();
      Toast.show({ type: 'error', text1: 'Error de conexión', text2: 'Intentá de nuevo más tarde.' });
    } finally {
```

- [ ] **Step 4: Agregar el modal**

El `return` de `EditProfileForm` (línea 190) es un único `KeyboardAwareScrollView` raíz — envolver en fragment:

```jsx
  return (
    <>
    <KeyboardAwareScrollView
      nativeID="edit-profile-screen-scroll"
      testID="edit-profile-screen-scroll"
      className="flex-1 bg-paper dark:bg-ink"
      contentContainerClassName="px-4 py-8"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      extraScrollHeight={24}
    >
      <View nativeID="edit-profile-screen-container" testID="edit-profile-screen-container" className={`w-full self-center ${isWeb ? 'max-w-3xl' : ''}`}>
        {/* ... contenido existente sin cambios ... */}
      </View>
    </KeyboardAwareScrollView>
    <DiscardChangesModal onCancel={cancelDiscard} onConfirm={confirmDiscard} visible={confirmVisible} />
    </>
  );
```

- [ ] **Step 5: Verificar manualmente en preview**

Pestaña "Datos personales": cambiar el nombre, click en back del header → modal aparece. Cambiar a la pestaña "Contraseña" sin guardar los datos personales y volver: el guard debe seguir activo (el cambio de tab no resetea `isDirty`, solo cambia qué se renderiza). Pestaña "Contraseña" en sí: escribir algo y salir NO debe disparar ningún guard (no está cableado).

- [ ] **Step 6: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add components/profile/edit-profile-screen.jsx
git commit -m "feat(profile): discard-changes guard on personal-data tab"
```

---

### Task 10: Haptic warning en los 5 modales de confirmación destructiva (batch)

**Files:**
- Modify: `components/team/delete-team-modal.jsx`
- Modify: `components/team/expel-runner-modal.jsx`
- Modify: `components/team/leave-group-modal.jsx`
- Modify: `components/profile/deactivate-account-modal.jsx`
- Modify: `components/profile/deactivate-trainer-modal.jsx`

**Interfaces:**
- Consumes: `notifyWarning` (Task 2).

Los 5 archivos comparten firma `{ visible, onCancel, onConfirm, ...propsPropias }`. El cambio es idéntico en cada uno: agregar un `useEffect` que dispare `notifyWarning()` cuando `visible` pasa a `true`.

- [ ] **Step 1: Aplicar el mismo cambio en los 5 archivos**

Los 5 archivos importan React hoy con `import { useState } from 'react';` (confirmado: ninguno importa `useEffect` todavía) — cambiar esa línea en cada uno a:

```js
import { useEffect, useState } from 'react';
```

Y agregar, en cada archivo, después de `import { useState } from 'react';` original (ya reemplazada) y junto a los demás imports (después de `import { MaterialCommunityIcons } from '@expo/vector-icons';`):

```js
import { notifyWarning } from '../../utils/haptics.js';
```

Y, justo después de la declaración de props del componente (la firma `export function XxxModal({ visible, ... })` seguida del primer `useState`), agregar en los 5 archivos:

```js
  useEffect(() => {
    if (visible) notifyWarning();
  }, [visible]);
```

Ubicaciones exactas por archivo (después del `useState` que ahí se muestra):
- `components/team/delete-team-modal.jsx`: después de `const [loading, setLoading] = useState(false);`.
- `components/team/expel-runner-modal.jsx`: después de su primer `useState` local (mismo patrón que `delete-team-modal.jsx` — modal de confirmación con `loading`).
- `components/team/leave-group-modal.jsx`: ídem.
- `components/profile/deactivate-account-modal.jsx`: ídem (este archivo además importa `TextInput` en la línea de react-native — no tocar esa línea).
- `components/profile/deactivate-trainer-modal.jsx`: ídem.

- [ ] **Step 2: Verificar manualmente en preview (best-effort)**

Los haptics no son observables en el preview web (gateados a `isMobile`) — verificar únicamente que ninguno de los 5 modales rompió su render (abrir cada uno desde su flujo: eliminar equipo, expulsar corredor, salir de un grupo, desactivar cuenta, desactivar rol entrenador).

- [ ] **Step 3: Correr suite completa y lint**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 4: Commit**

```bash
git add components/team/delete-team-modal.jsx components/team/expel-runner-modal.jsx components/team/leave-group-modal.jsx components/profile/deactivate-account-modal.jsx components/profile/deactivate-trainer-modal.jsx
git commit -m "feat(ux): haptic warning when destructive confirm modals appear"
```

---

### Task 11: Version bump y cierre

**Files:**
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Ninguna — tarea de cierre.

- [ ] **Step 1: Evaluar el bump**

Alcance de esta rama: 1 dependencia nueva (`expo-haptics`), 2 hooks nuevos, 1 componente nuevo, ~13 archivos modificados con guard/haptics/autofocus, 1 bugfix real (resync de `edit-group-screen.jsx`). Comparable en volumen al Subproyecto A (que fue minor 0.12.0→0.13.0 con extensión). Bump **minor**: tomar la versión actual de `package.json` en el momento de ejecutar esta tarea (puede haber avanzado desde que se escribió este plan) e incrementar el segundo dígito.

- [ ] **Step 2: Aplicar el bump**

Editar `version` en `package.json` (raíz) y en `package-lock.json` (raíz `version` + `packages[""].version`) — **cuidado**: al buscar el string de versión anterior en `package-lock.json`, puede haber coincidencias de paquetes de terceros en `node_modules/...` con el mismo número de versión por coincidencia (pasó en Subproyecto A con `qrcode-terminal`) — confirmar contexto antes de reemplazar, editar solo las 2 líneas correctas.

- [ ] **Step 3: Correr suite completa y lint una última vez**

Run: `npm test && npm run lint`
Expected: todo verde.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version for form and interaction polish (Subproyecto B)"
```

- [ ] **Step 5: Final whole-branch review**

Dispatch del reviewer final de todo el branch (modelo más capaz disponible, per skill subagent-driven-development) antes de push/PR — cubre consistencia entre las 11 tareas (ej. que ningún `guardedClose` haya quedado sin cablear en algún back button, que el `resetKey` de los modales de catálogo esté bien aplicado, que no haya quedado ningún `router.back()`/`router.replace()` directo en un botón de back de las pantallas tocadas).
