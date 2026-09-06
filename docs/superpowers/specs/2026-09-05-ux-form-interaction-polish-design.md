# UX Form & Interaction Polish — Subproyecto B (diseño)

> Segunda tanda del batch de mejoras UX/calidad de vida. Subproyecto A
> (pull-to-refresh + skeleton loaders + placeholder de equipo) ya shippeado
> como PR #107, merged a `develop`. Este documento cubre el Subproyecto B:
> confirmación al descartar cambios sin guardar, haptics en acciones clave,
> y auto-focus de campo en mobile.

## Alcance

Tres mejoras independientes entre sí mismas, pero que comparten superficie
de archivos (forms de edición/creación) y por eso se abordan juntas:

1. **Confirmación al descartar cambios sin guardar** — en todos los forms
   de edición y creación de un recurso real (equipo, grupo, plan de
   entrenamiento, perfil, sesión/ejercicio del catálogo, invitaciones en
   curso).
2. **Haptics** (`expo-haptics`, nueva dependencia) en acciones clave:
   confirmar una acción destructiva, éxito de un submit, error de un submit.
3. **Auto-focus** del primer campo en mobile, en los forms donde tiene
   sentido (alta de un recurso, no edición — ver justificación abajo).

## Fuera de alcance (exclusión deliberada)

**Pantallas de autenticación** (`login-screen.jsx`, `register-screen.jsx`,
`forgot-password-screen.jsx`, `reset-password-screen.jsx`) quedan **fuera**
del guard de "cambios sin guardar" — es la misma categoría que ya se
excluyó de pull-to-refresh en el Subproyecto A (ver PR #107): no son
"edición de un recurso propio", son flujos de una sola pasada donde
interrumpir con una confirmación es fricción, no protección. Si accedés a
`login-screen.jsx` de vuelta después de escribir un email a medio
completar, no hay nada real que "perdiste".

`create-team-screen.jsx` (wizard 3 pasos) sí entra: perder un wizard a
mitad de camino (equipo + grupos + invitaciones ya cargados) sí es una
pérdida real de trabajo.

## 1. Confirmación al descartar cambios

### Mecanismo de intercepción

`usePreventRemove` de `@react-navigation/core` (confirmado disponible vía
`expo-router` → `@react-navigation/native@7.3.7` → `@react-navigation/core@7.21.5`,
ya en `node_modules`, sin dependencia nueva). Intercepta la remoción de la
ruta actual del stack — back nativo (hardware, gesture, botón de header) y
navegación in-app — antes de que ocurra, entregando un evento con
`e.data.action` para poder re-despacharla si el usuario confirma.

**Botones de back explícitos**: casi todas las pantallas de este repo usan
un `Pressable` propio con `onPress={() => router.back()}` en vez de
depender solo del header nativo — `usePreventRemove` no cubre esto (es un
`router.back()` imperativo, no una remoción de ruta por gesto/hardware).
Cada pantalla reemplaza esa llamada directa por `guardedClose(() => router.back())`
(ver hook abajo).

**Modales de RN (`Modal` + `visible`/`onClose`)**: `create-session-modal.jsx`
y `create-exercise-modal.jsx` no son rutas — cerrarlos no dispara
`usePreventRemove`. Su botón de cancelar / `onRequestClose` (back físico
en Android mientras el modal está abierto) también se envuelve con
`guardedClose(realOnClose)`, mismo mecanismo genérico.

**Web — cierre de pestaña/recarga**: `usePreventRemove` cubre navegación
in-app (Expo Router sincroniza con el history del browser), pero no
cierre de pestaña ni recarga manual. El hook agrega un listener de
`beforeunload` gateado a `isWeb`, activo solo mientras `isDirty` es true.

### Detección de "cambios sin guardar" (`isDirty`)

Sin librería de forms nueva — el patrón ya existente en el repo es
`useState` individual por campo (a veces agrupado en un hook compartido
con `getValues()`, ver `hooks/use-team-general-info-form.js` y
`hooks/use-training-plan-form.js`). Nuevo hook chico y genérico:

```js
// hooks/use-form-dirty.js
import { useRef } from 'react';

export function useFormDirty(values) {
  const snapshot = JSON.stringify(values);
  const initialRef = useRef(snapshot);
  return snapshot !== initialRef.current;
}
```

Cada pantalla arma su propio `values` (objeto plano con los campos que
importan) y se lo pasa en cada render — la comparación es contra el
snapshot tomado en el primer render, sin importar si esos valores llegan
vacíos (alta) o precargados (edición, una vez resuelto el fetch).

**Pantallas con `getValues()` ya existente** (`useTeamGeneralInfoForm`,
`useTrainingPlanForm`): se les pasa directo `useFormDirty(getValues())`.

**Pantallas ad hoc** (arman el objeto a mano): `edit-group-screen.jsx` →
`{ name, description, trainingPlanId }`; `edit-profile-screen.jsx` →
`{ firstName, lastName, dni, birthDate, email, phone, phoneContact, trainerAlias }`
(se excluye `currentPassword` — es una acción aparte de cambio de
contraseña, no "datos de perfil"); `invite-team-members-screen.jsx` →
`draftInvites.length > 0` (cualquier invitación cargada sin enviar);
`assign-training-plan-screen.jsx` → `{ teamId, groupId, runnerId }`;
`create-session-modal.jsx` / `create-exercise-modal.jsx` → sus propios
campos de formulario.

### Bug bloqueante encontrado — `edit-group-screen.jsx`

Ya documentado en el Subproyecto A (por eso se excluyó ahí de
pull-to-refresh): el `useEffect(() => { if (group) {...} }, [group])`
resincroniza el estado local cada vez que cambia la referencia de `group`,
no solo una vez. Con `isDirty` esto produce falsos negativos (o falsos
positivos) porque el snapshot "inicial" puede pisarse después del primer
render. Se arregla acá, como parte de esta tarea, con guarda de una sola
vez:

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

Esto además destrabá poder sumar pull-to-refresh a `edit-group-screen.jsx`
en el futuro (no es parte de este subproyecto, pero queda registrado como
consecuencia positiva).

### Hook compartido

```js
// hooks/use-unsaved-changes-guard.js
import { useRef, useState, useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/core';
import { isWeb } from '../utils/platform.js';

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
    if (!isDirty) { closeFn(); return; }
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

Verificar en la implementación real si `useNavigation` se importa desde
`expo-router` o desde `@react-navigation/native` en este repo (ambos
re-exportan) — seguir el import que ya use el archivo, si alguno lo usa;
si no hay precedente, `@react-navigation/native` es el más directo.

### Componente de confirmación

`components/shared/discard-changes-modal.jsx` — mismo patrón visual que
`components/team/delete-team-modal.jsx` (no destructivo en el sentido de
"borra datos del servidor", pero sí "perdés tu trabajo", mismo peso
visual de alerta ámbar/no roja):

- Título: "Salir sin guardar"
- Descripción: "Tenés cambios sin guardar. Si salís ahora, se van a perder."
- Botones: "Seguir editando" (cancelar) / "Salir sin guardar" (confirmar)

Props: `visible`, `onCancel`, `onConfirm` — sin `loading` (a diferencia de
`DeleteTeamModal`, esto no dispara ninguna request, es instantáneo).

## 2. Haptics

Nueva dependencia: `expo-haptics` (instalar vía `npx expo install
expo-haptics`, resuelve versión compatible SDK 54).

```js
// utils/haptics.js
import * as Haptics from 'expo-haptics';
import { isMobile } from './platform.js';

export const notifySuccess = () => { if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
export const notifyError = () => { if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); };
export const notifyWarning = () => { if (isMobile) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); };
```

Gateado a `isMobile` (no `isWeb`) porque RNW no implementa la API nativa
— mismo criterio que ya usa `usePullToRefresh`/`RefreshControl`.

**Dónde se dispara** (acciones clave, no todo click):

- `notifyWarning()`: al abrir cualquier modal de confirmación destructiva
  (`DeleteTeamModal`, `ExpelRunnerModal`, `LeaveGroupModal`,
  `DeactivateAccountModal`, `DeactivateTrainerModal`) — en el momento en
  que se muestra el modal, no al confirmar (el confirm ya dispara la
  request real, avisar antes de que decida es más útil).
- `notifySuccess()`: al mostrar el `Toast` de éxito en los submits de los
  mismos forms tocados por la Parte 1 (crear/editar equipo, grupo, plan,
  perfil, invitación enviada).
- `notifyError()`: al mostrar el `Toast` de error en esos mismos submits.

Pull-to-refresh nativo (`RefreshControl`) ya dispara su propio haptic del
sistema operativo — no se toca.

## 3. Auto-focus en mobile

`autoFocus` (prop nativa de `TextInput`, cero infraestructura nueva) en el
primer campo de texto de los forms de **alta** (no edición — editar abre
con datos ya cargados, forzar el foco ahí saca al usuario de donde estaba
mirando; alta siempre arranca en blanco, foco inmediato ahorra un tap):

- `create-team-screen.jsx` — paso 1, campo "Nombre del equipo".
- `create-training-plan-screen.jsx` — campo "Nombre del plan".
- `create-session-modal.jsx` / `create-exercise-modal.jsx` — campo
  "Nombre" de cada uno.

Gateado `!isWeb` — autofocus en web es un anti-patrón de accesibilidad
conocido (roba el foco sin gesto del usuario) y el pedido original ya lo
acotaba a mobile.

## Testing

Sin tests de render (convención del proyecto, ver `CLAUDE.md`). Cubrir con
test puro: `hooks/use-form-dirty.js` (comparación de snapshot) y
`utils/haptics.js` (que sea no-op fuera de `isMobile`) en `__tests__/`.
`useUnsavedChangesGuard` depende de contexto de navegación real — no se
testea de forma aislada, se verifica manualmente en preview (multi-paso:
escribir en un campo, intentar salir, confirmar que aparece el modal, y
que "seguir editando" cancela la salida).

## Archivos nuevos

- `hooks/use-form-dirty.js`
- `hooks/use-unsaved-changes-guard.js`
- `components/shared/discard-changes-modal.jsx`
- `utils/haptics.js`

## Archivos modificados

- `components/team/edit-group-screen.jsx` (fix bug de resync + guard + haptics)
- `components/team/create-team-screen.jsx` (guard + autofocus paso 1)
- `components/team/edit-team-screen.jsx` (guard + haptics)
- `components/team/invite-team-members-screen.jsx` (guard + haptics)
- `components/plans/create-training-plan-screen.jsx` (guard + autofocus + haptics)
- `components/plans/edit-training-plan-screen.jsx` (guard + haptics)
- `components/plans/assign-training-plan-screen.jsx` (guard + haptics)
- `components/plans/create-session-modal.jsx` (guard + autofocus + haptics)
- `components/plans/create-exercise-modal.jsx` (guard + autofocus + haptics)
- `components/profile/edit-profile-screen.jsx` (guard + haptics)
- `components/team/delete-team-modal.jsx`, `expel-runner-modal.jsx`,
  `leave-group-modal.jsx`, `components/profile/deactivate-account-modal.jsx`,
  `deactivate-trainer-modal.jsx` (haptic warning al mostrarse)
- `package.json` / `package-lock.json` (nueva dependencia + bump de versión)
