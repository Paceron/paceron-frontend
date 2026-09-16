# Sesiones: pantalla dedicada en mobile/nativo (alta y edición)

**Fecha:** 2026-09-16
**Rama:** `feature/catalog-redesign`
**Contexto:** `docs/2026-09-16-session-modal-drag-scroll-investigation.md` (dossier del problema de drag-and-drop/scroll que motiva este cambio)

## Motivación

La creación/edición de sesiones vive hoy en `components/plans/create-session-modal.jsx`, un `Modal` con dos layouts internos (`SessionModalWideBody` para desktop, `SessionModalNarrowBody` para mobile/narrow). Tras ~10 rondas de ajuste de gestos (`activateAfterLongPress`, `failOffset*`, `simultaneousWithExternalGesture`, memoización) documentadas en el dossier de investigación, el scroll (vertical de la lista de ejercicios, horizontal de la tira de catálogo) y el reordenamiento por hold-and-drag siguen sin funcionar de forma confiable en mobile nativo (Expo Go, dispositivo Android real). El dato más reciente — un sonido de "click" de Android en el `ACTION_UP` de cualquier touch dentro del modal, incluso tras scrollear — apunta a un problema de arbitraje de touch más profundo que la configuración de gestos: `ScrollView`s anidados de la misma orientación (el scroll general del modal → el scroll de la lista de ejercicios) dentro de la superficie nativa separada que `Modal` monta en Android.

**Decisión (ya tomada, no depende de la confirmación en dispositivo real, que sigue pendiente):** migrar la creación/edición de sesiones de `Modal` a pantalla dedicada, en mobile/nativo — mismo patrón ya usado para planes de entrenamiento (`create-training-plan-screen.jsx`/`edit-training-plan-screen.jsx`). Web sigue usando el `Modal` sin cambios; una interfaz dedicada para web es una decisión futura, separada de este spec.

**Alcance de esta migración: alta y edición juntas** — dos rutas nuevas, no solo alta, porque comparten casi todo el formulario (mismo criterio que `training-plans/[planId]/edit.jsx` vs `create.jsx`).

**Gestos: sin cambios en `session-drag-and-drop.jsx`.** Se reusan `SessionDragProvider`/`DraggableExerciseCard`/`ReorderProvider`/`ReorderableRow`/etc. tal cual están hoy (post-fix de memoización `useSharedValue`+`useMemo` de 2026-09-16). El objetivo es aislar UNA variable a la vez: si el problema de touch desaparece solo por sacar el `Modal` y el `ScrollView` anidado, queda confirmado sin mezclar con otro cambio de gestos en la misma prueba. Si el problema persiste en la pantalla nueva, recién ahí se vuelve a tocar el código de gestos, con el dato de que el `Modal` no era (o no era todo) el problema.

## Arquitectura de archivos

### Nuevo: `hooks/use-session-form.js`

Mismo patrón que `hooks/use-training-plan-form.js` — estado + validación + `getValues()`, consumido por las dos pantallas nuevas (create/edit). **No** lo consume `create-session-modal.jsx` — ver "Por qué el modal no se toca" más abajo.

```js
export function useSessionForm({ initial, ownerId } = {}) {
  // name, description: useState seedeados de `initial` una sola vez
  // (igual que useTrainingPlanForm) — la pantalla de edición ya espera
  // a que `session` esté cargado antes de montar el form (mismo split
  // loading/not-found que EditTrainingPlanScreen), así que no hace
  // falta ningún mecanismo de "reset on reopen": la pantalla se monta
  // una vez por navegación, con el valor inicial correcto desde el
  // primer render.
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [exercises, setExercises] = useState(
    initial?.exercises?.length ? initial.exercises.map((e) => ({ ...e })) : []
  );
  const [error, setError] = useState(null);
  const draftSeq = useRef(0);

  const makeBlankRow = (role) => ({ /* igual que create-session-modal.jsx hoy */ });
  const handleChangeExercise = (localKey, patch) => { /* igual */ };
  const handleChangeRole = (localKey, role) => { /* igual, necesita catalogExercises — se pasa como argumento de la función, no del hook, ver abajo */ };
  const handleRemoveExercise = (localKey) => { /* igual */ };
  const handleReorderExercises = (fromIndex, toIndex) => { /* igual, usa reorderList de session-drag-and-drop.js */ };
  const handleExerciseDropped = (exercise, insertIndex) => { /* igual */ };

  const validate = () => { /* mismas 3 validaciones y mismos mensajes que handleSubmit en create-session-modal.jsx hoy: nombre+≥1 ejercicio, ningún exerciseId vacío, al menos un ejercicio de cada rol */ };

  const getValues = () => ({ ownerId, name: name.trim(), description: description.trim(), exercises });

  return {
    name, setName, description, setDescription,
    exercises, onChangeExercise: handleChangeExercise, onChangeRole: handleChangeRole,
    onRemove: handleRemoveExercise, onReorder: handleReorderExercises, onExerciseDropped: handleExerciseDropped,
    error, validate, getValues,
  };
}
```

`handleChangeRole` necesita `catalogExercises` (para saber si el ejercicio ya elegido sigue siendo válido en el nuevo rol) — se resuelve pasando `catalogExercises` como parámetro de `useSessionForm({ initial, ownerId, catalogExercises })`, igual que hoy lo tiene disponible `create-session-modal.jsx` vía `useExercises(userId)`.

### Nuevo: `components/plans/session-form-body.jsx`

Extraído literal de `SessionModalNarrowBody` (líneas 266-328 de `create-session-modal.jsx` hoy) — mismo JSX, mismas props, sin ningún cambio de comportamiento ni de estilos. Renombrado de `SessionModalNarrowBody` a `SessionFormBody` (ya no es "del modal", es genérico). `SessionExerciseRow` y `CompactNumberPill` (hoy definidos arriba de `SessionModalNarrowBody` en el mismo archivo) se mudan junto con él a este archivo nuevo, ya que solo los usa este componente.

Props (idénticas a las que ya recibe `SessionModalNarrowBody` hoy, sin agregar ni quitar ninguna):
```
{ name, onSetName, description, onSetDescription, exercises, catalogExercises,
  onChangeExercise, onChangeRole, onRemove, onReorder, onExerciseDropped, error, visible }
```
`visible` se mantiene como prop (controla el `autoFocus` del campo Nombre) — en las pantallas nuevas se pasa `true` siempre en alta (autoFocus real, `!isWeb`) y `false` en edición (nunca autofocus, per convención ya documentada en CLAUDE.md sobre auto-focus solo en altas).

`create-session-modal.jsx` importa `SessionFormBody` desde este archivo nuevo en vez de tener `SessionModalNarrowBody` definida inline — mismo call site, mismas props, cero cambio de comportamiento en la rama angosta del modal web. `SessionModalWideBody` (desktop-only, sin este problema de gestos) **no se toca ni se extrae** — sigue definida inline en `create-session-modal.jsx`, fuera de alcance de este spec (YAGNI: no hay necesidad de tocarla).

### Nuevo: `components/plans/create-session-screen.jsx`

Mismo patrón que `create-training-plan-screen.jsx`:
- Header con ícono + título + botón de volver (`router.back()`, guardado por `guardedClose` si hay cambios sin guardar).
- `RequireAuth` envolviendo el contenido.
- `useSessionForm({ ownerId: userId, catalogExercises })` (sin `initial` — alta).
- `useFormDirty`/`useUnsavedChangesGuard` sobre los valores del hook, igual criterio que cualquier otro form de alta (ver CLAUDE.md, sección "Forms de edición/creación").
- Al submit exitoso: `bypassGuard(() => router.back())` (no `router.replace` — se vuelve al catálogo de sesiones de donde se navegó, mismo criterio que "atrás" en vez de una ruta fija).
- Monta `GestureHandlerRootView` + `SessionDragProvider` + `DragGhost` envolviendo el contenido — mismo motivo que hoy en el `Modal` (gesture-handler necesita su propio root; en una pantalla normal de Expo Router esto YA está cubierto por el `GestureHandlerRootView` de `app/_layout.jsx`, pero se mantiene uno local iguals que **no hace falta** — ver nota de riesgo más abajo).
- `<SessionFormBody />` con los valores/handlers del hook, más los botones de acción (Cancelar/Crear) que hoy vive en el `Modal`, adaptados a pantalla (mismo texto y estilo, sin el `ActivityIndicator` inline moviéndose — se mantiene igual).

**Nota de riesgo a resolver durante la implementación, no en este spec:** `app/_layout.jsx` ya envuelve TODA la app en un `GestureHandlerRootView` — un segundo `GestureHandlerRootView` anidado no debería romper nada (gesture-handler tolera roots anidados, el interior gana), pero como parte de la motivación de este cambio es justamente sacar el gesto de una superficie nativa separada (la del `Modal`), la pantalla nueva probablemente **no necesita su propio `GestureHandlerRootView`** — se decide en la implementación, con el criterio de "si ya funciona sin él, no agregarlo" (menos anidamiento, no más).

### Nuevo (chico): `useSession(sessionId)` en `hooks/use-sessions.js`

Hoy `use-sessions.js` solo tiene `useSessions(ownerId)` (lista) y `useSessionMutations()` — no existe un hook singular por id, a diferencia de `use-training-plans.js` (`useTrainingPlan(planId)`, que sí lo tiene). El service ya expone `getSession(sessionId)` (`services/sessions.js:31`), sin consumidor todavía. Se agrega `useSession(sessionId)` **calcado de `useTrainingPlan(planId)`** (mismo `queryKey` de a un elemento, mismo `initialData` que busca primero en cualquier lista `['sessions', *]` ya cacheada antes de pedir de nuevo — deep-link directo a `/training-plans/sessions/:id/edit` sin haber pasado por la lista se resuelve igual, sin loading extra si la sesión ya estaba en caché).

### Nuevo: `components/plans/edit-session-screen.jsx`

Mismo split loading/not-found que `edit-training-plan-screen.jsx`: un componente externo usa `useSession(sessionId)` (de arriba) y muestra loading/not-found; un componente interno (`EditSessionScreenContent`) se monta recién con la sesión ya garantizada, igual que `EditTrainingPlanScreenContent`. Mismo `useSessionForm({ initial: session, ownerId: userId, catalogExercises })`, sin autoFocus, **sin pull-to-refresh** (mismo criterio ya documentado en CLAUDE.md: formularios de edición no llevan pull-to-refresh).

## Rutas nuevas

- `app/(tabs)/training-plans/sessions/create.jsx` — mismo patrón fino que `training-plans/create.jsx`:
  ```js
  import { CreateSessionScreen } from '../../../../components/plans/create-session-screen.jsx';
  export default function SessionsCreate() {
    return <CreateSessionScreen />;
  }
  ```
- `app/(tabs)/training-plans/sessions/[sessionId]/edit.jsx` — mismo patrón fino que `[planId]/edit.jsx`:
  ```js
  import { useLocalSearchParams } from 'expo-router';
  import { EditSessionScreen } from '../../../../../components/plans/edit-session-screen.jsx';
  export default function SessionEdit() {
    const { sessionId } = useLocalSearchParams();
    return <EditSessionScreen sessionId={sessionId} />;
  }
  ```
Ninguna ruta necesita registro especial en ningún `_layout.jsx` (confirmado: `training-plans/create.jsx` tampoco lo tiene, push normal dentro del stack por default).

## Navegación desde `sessions-catalog-tab.jsx`

El botón "+" (hoy `onPress={() => setModalSession(null)}`, línea ~165) y la acción "Editar" del menú (hoy `onEdit={(s) => { handleCloseMenu(); setModalSession(s); }}`, línea ~217) se bifurcan por plataforma:

```js
import { useRouter } from 'expo-router';
import { isWeb } from '../../utils/platform.js';
// ...
const router = useRouter();

// botón "+"
onPress={() => (isWeb ? setModalSession(null) : router.push('/training-plans/sessions/create'))}

// acción "Editar" del menú
onEdit={(s) => {
  handleCloseMenu();
  if (isWeb) setModalSession(s);
  else router.push(`/training-plans/sessions/${s.id}/edit`);
}}
```
En native, `<CreateSessionModal>` sigue montado en el árbol (por si `modalSession` se setea desde algún otro lado que no se haya migrado — no debería pasar tras este cambio, pero no se retira el componente en este spec, YAGNI: no hay necesidad de un cambio adicional solo para eliminarlo si nunca se invoca en native).

## Por qué el modal (`create-session-modal.jsx`) no se toca en su lógica interna

El modal sigue usándose en web, tal cual funciona hoy — mismo estado inline (`name`/`description`/`exercises`/`error`), mismo mecanismo de reset-on-reopen (`resetKey`/`isResetting`, necesario porque el modal se queda montado y reabre con distintas sesiones sin desmontarse — un componente de pantalla en cambio se monta una vez por navegación, por eso `useSessionForm` no necesita ese mecanismo). Migrar el modal a usar el hook nuevo sería una limpieza válida pero fuera de alcance: arriesgaría romper el comportamiento del modal web (que hoy funciona) por una ganancia de deduplicación de ~40 líneas de handlers, sin ningún beneficio para el problema que motiva este spec (el modal en web nunca tuvo el bug de touch). Único cambio en `create-session-modal.jsx`: reemplazar la definición inline de `SessionModalNarrowBody` (y `SessionExerciseRow`/`CompactNumberPill`) por el import de `SessionFormBody` desde el archivo nuevo, pasando las mismas props que ya arma hoy.

## Datos

Sin cambios en `hooks/use-sessions.js` — `useSessionMutations` (`createSession`/`updateSession`) ya invalida la query de sesiones en su propio `onSuccess` (confirmado leyendo el hook), así que no hace falta ningún callback tipo `onCreated` en las pantallas nuevas: al hacer `router.back()` tras un submit exitoso, `sessions-catalog-tab.jsx` ya va a re-renderizar con la lista actualizada por TanStack Query, sin ningún cableado adicional.

## Testing

- `npm test`/`npm run lint` en verde (convención del repo — no hay tests de render de componentes).
- Verificación manual: **queda pendiente hasta que el usuario pueda probar en un teléfono real** (bloqueado hoy por red restrictiva en el trabajo; el emulador Android no fue concluyente para el bug de sonido/touch que motiva este cambio). El plan de implementación debe incluir, al final, un script de pasos concretos para esa prueba (crear sesión desde cero en la pantalla nueva, arrastrar del catálogo, reordenar, scrollear ambas listas, guardar, editar una existente, cancelar con cambios sin guardar).
- Tras esa prueba, si el problema de touch/scroll desaparece → confirma la hipótesis de este spec (Modal + ScrollViews anidados era la causa), no hace falta tocar gestos. Si persiste → se retoma `docs/2026-09-16-session-modal-drag-scroll-investigation.md` con este dato nuevo (ya no es el Modal) antes de seguir.

## Fuera de alcance de este spec

- Interfaz dedicada para web (Modal → pantalla también en web) — decisión futura, separada.
- Cualquier cambio a `session-drag-and-drop.jsx` — explícitamente diferido hasta confirmar si esta migración alcanza por sí sola.
- Migrar `create-session-modal.jsx` a usar `useSessionForm` internamente — ver "Por qué el modal no se toca" arriba.
- `SessionModalWideBody` (layout desktop) — sin cambios, no tiene el bug que motiva esto.
