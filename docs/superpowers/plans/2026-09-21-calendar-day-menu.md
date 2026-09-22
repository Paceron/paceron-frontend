# Calendario de asignaciones — Menú de acciones por día Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution note:** el usuario de este proyecto pidió explícitamente el método de ejecución más barato en tokens en toda esta serie de piezas ("quiero realmente el mas barato, no me importa que sea el mas lento"). Salvo instrucción nueva en contrario, preferir `superpowers:executing-plans` (inline, misma sesión) sobre `subagent-driven-development`, igual que las piezas 1 y 2.

**Goal:** reemplazar la navegación directa al tocar un día del calendario mensual por un menú contextual (Asignar/Editar, Vaciar día, Cancelar sesión) calculado a partir de datos que la pantalla ya tiene.

**Architecture:** un componente presentacional puro (`CalendarDayMenu`) con la lista de ítems condicional, montado una sola vez vía `AnimatedDropdown` en `group-calendar-screen.jsx` — mismo patrón ya usado en `exercises-catalog-tab.jsx` (medir la celda tocada contra un contenedor de referencia estable, restar coordenadas, sin `measureInWindow` crudo por celda). "Vaciar" se resuelve directo desde el menú (reusa `deleteDay` ya existente); "Cancelar" navega a la pantalla de día con un query param que la abre directo en el prompt de cancelación que ya existe ahí.

**Tech Stack:** React Native + Expo Router, componente compartido `AnimatedDropdown` (ya existente, sin cambios).

**Spec:** `docs/superpowers/specs/2026-09-21-calendar-day-menu-design.md`

## Global Constraints

- Todo `View`/`Text`/`Pressable`/etc necesita `nativeID`+`testID` únicos en su contexto (regla ESLint `local/require-native-id`).
- `npm test` y `npm run lint` deben quedar en verde antes de cada commit.
- Ningún cambio de backend/servicios/normalizers en esta pieza — es interacción/UI pura sobre datos que ya existen.
- "Seleccionar" (modo multi-selección) queda explícitamente fuera de esta pieza — no agregar ningún ítem ni estado para eso acá.

---

### Task 1: `CalendarDayMenu` (panel presentacional)

**Files:**
- Create: `components/team/calendar-day-menu.jsx`

**Interfaces:**
- Consumes: nada de tasks anteriores (primer task).
- Produces: `CalendarDayMenu({ hasContent, closed, isTraining, onAssignOrEdit, onClear, onCancel })` — componente presentacional puro, sin estado propio, sin `AnimatedDropdown` adentro (lo monta el caller en el Task 2). Consumido tal cual por Task 2.
  - `hasContent: boolean` — si el día tiene una fila guardada (`Boolean(marking)` en el caller).
  - `closed: boolean` — si el día está cerrado (`isCalendarDayClosed(...)` ya calculado por el caller).
  - `isTraining: boolean` — si `marking?.kind === 'training'`.
  - `onAssignOrEdit: () => void`, `onClear: () => void`, `onCancel: () => void` — el caller ya tiene el `date` en un closure, este componente no lo necesita.

- [ ] **Step 1: Crear el archivo**

```jsx
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Panel del menú contextual de un día del calendario — ver
// docs/superpowers/specs/2026-09-21-calendar-day-menu-design.md §2 para
// la tabla de qué ítem se muestra cuándo. Sin estado propio: el caller
// (group-calendar-screen.jsx) decide qué mostrar y qué pasa al tocar
// cada ítem, esto solo dibuja el panel. El AnimatedDropdown que lo
// posiciona y le da el backdrop-para-cerrar vive en el caller, no acá.
export function CalendarDayMenu({ hasContent, closed, isTraining, onAssignOrEdit, onClear, onCancel }) {
  return (
    <View
      className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2"
      nativeID="calendar-day-menu-panel"
      testID="calendar-day-menu-panel"
    >
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="calendar-day-menu-assign-or-edit"
        onPress={onAssignOrEdit}
        testID="calendar-day-menu-assign-or-edit"
      >
        <MaterialCommunityIcons color="#64748b" name="pencil-outline" size={16} />
        <Text
          className="text-sm text-slate-700 dark:text-slate-200"
          nativeID="calendar-day-menu-assign-or-edit-label"
          testID="calendar-day-menu-assign-or-edit-label"
        >
          {hasContent ? 'Editar' : 'Asignar'}
        </Text>
      </Pressable>

      {hasContent && !closed && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="calendar-day-menu-clear"
          onPress={onClear}
          testID="calendar-day-menu-clear"
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
          <Text className="text-sm text-red-600 dark:text-red-400" nativeID="calendar-day-menu-clear-label" testID="calendar-day-menu-clear-label">
            Vaciar día
          </Text>
        </Pressable>
      )}

      {isTraining && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="calendar-day-menu-cancel"
          onPress={onCancel}
          testID="calendar-day-menu-cancel"
        >
          <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
          <Text className="text-sm text-amber-700 dark:text-amber-400" nativeID="calendar-day-menu-cancel-label" testID="calendar-day-menu-cancel-label">
            Cancelar sesión
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npm run lint`
Expected: PASS (0 errores) — sin test de render, este componente no tiene lógica pura que testear con Jest (convención del proyecto).

- [ ] **Step 3: Commit**

```bash
git add components/team/calendar-day-menu.jsx
git commit -m "feat(calendar): add CalendarDayMenu presentational panel"
```

---

### Task 2: Wirear el menú en `group-calendar-screen.jsx`

**Files:**
- Modify: `components/team/group-calendar-screen.jsx`

**Interfaces:**
- Consumes: `CalendarDayMenu` (Task 1, contrato de props exacto arriba), `AnimatedDropdown` (ya existe, `components/shared/animated-dropdown.jsx`, `{ open, onClose, anchorStyle, children }`), `deleteDay`/`isDeleting` de `useGroupCalendarMutations(groupId)` (ya existe, pieza 1, sin cambios — `deleteDay({ date }) -> Promise<{ success: boolean, error?: string }>`).
- Produces: nada consumido por tasks posteriores — este es el punto final de la UI de esta pieza (Task 3 es independiente, toca otro archivo).

- [ ] **Step 1: Editar imports**

Ubicar:
```js
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
```
Reemplazar por:
```js
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
```

Ubicar:
```js
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { StampPlanModal } from './stamp-plan-modal.jsx';
```
Reemplazar por:
```js
import { isCalendarDayClosed } from '../../utils/calendar-day-closed.js';
import { StampPlanModal } from './stamp-plan-modal.jsx';
import { CalendarDayMenu } from './calendar-day-menu.jsx';
import { AnimatedDropdown } from '../shared/animated-dropdown.jsx';
import { notifySuccess, notifyError } from '../../utils/haptics.js';
import Toast from 'react-native-toast-message';
```

- [ ] **Step 2: Modificar `CalendarDayCell` — de navegar a reportar posición**

Ubicar el componente completo:
```jsx
function CalendarDayCell({ date, state, marking, onPress }) {
  const colors = useThemeColors();
  const isOtherMonth = state === 'disabled';
  const closed = marking ? isCalendarDayClosed(date.dateString, marking) : false;
  const tintAlpha = closed ? '14' : '26';
  const tintColor = marking ? `${KIND_DOT_COLORS[marking.kind]}${tintAlpha}` : 'transparent';
  return (
    <Pressable
      className="h-14 w-full items-center justify-start gap-1 rounded-md pt-1"
      nativeID={`group-calendar-day-${date.dateString}`}
      onPress={() => onPress(date)}
      style={{ backgroundColor: tintColor }}
      testID={`group-calendar-day-${date.dateString}`}
    >
```
Reemplazar la firma y el `onPress` por:
```jsx
function CalendarDayCell({ date, state, marking, containerRef, onOpenMenu }) {
  const colors = useThemeColors();
  const cellRef = useRef(null);
  const isOtherMonth = state === 'disabled';
  const closed = marking ? isCalendarDayClosed(date.dateString, marking) : false;
  const tintAlpha = closed ? '14' : '26';
  const tintColor = marking ? `${KIND_DOT_COLORS[marking.kind]}${tintAlpha}` : 'transparent';

  const handlePress = () => {
    if (!containerRef.current || !cellRef.current) return;
    containerRef.current.measureInWindow((containerX, containerY) => {
      cellRef.current?.measureInWindow((x, y, width, height) => {
        onOpenMenu(date.dateString, { x: x - containerX, y: y - containerY, width, height });
      });
    });
  };

  return (
    <Pressable
      ref={cellRef}
      className="h-14 w-full items-center justify-start gap-1 rounded-md pt-1"
      nativeID={`group-calendar-day-${date.dateString}`}
      onPress={handlePress}
      style={{ backgroundColor: tintColor }}
      testID={`group-calendar-day-${date.dateString}`}
    >
```
El resto del cuerpo de `CalendarDayCell` (el `<Text>` del número, el bloque `{marking && (...)}`) queda exactamente igual — no tocarlo.

- [ ] **Step 3: Agregar el `useGroupCalendarMutations` que faltaba, el `monthViewRef`, y el estado del menú**

Ubicar:
```js
  const { days, loading: loadingDays, isFetching } = useGroupCalendar(groupId, from, to);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;
```
Reemplazar por:
```js
  const { days, loading: loadingDays, isFetching } = useGroupCalendar(groupId, from, to);
  const { deleteDay } = useGroupCalendarMutations(groupId);
  const currentMonthISO = `${visibleYear}-${pad2(visibleMonth)}-01`;
  const monthViewRef = useRef(null);
  const [openDayMenu, setOpenDayMenu] = useState(null);
```

(`useGroupCalendar, useGroupCalendarMutations` ya vienen del mismo import existente — `useGroupCalendarMutations` ya está en esa línea de import, solo no se llamaba todavía en este archivo.)

- [ ] **Step 4: Reemplazar `handleDayPress` por los handlers del menú**

Ubicar:
```js
  const handleDayPress = (date) => {
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date.dateString}`);
  };
```
Reemplazar por:
```js
  const handleOpenDayMenu = (dateString, anchor) => {
    setOpenDayMenu({ date: dateString, anchor });
  };

  const handleCloseDayMenu = () => setOpenDayMenu(null);

  const handleAssignOrEdit = () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date}`);
  };

  const handleClearDay = async () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    const result = await deleteDay({ date });
    if (!result.success) {
      notifyError();
      Toast.show({ type: 'error', text1: 'No pudimos vaciar el día', text2: result.error });
      return;
    }
    notifySuccess();
    Toast.show({ type: 'success', text1: 'Día vaciado' });
  };

  const handleCancelSession = () => {
    const date = openDayMenu.date;
    handleCloseDayMenu();
    router.push(`/teams/${teamId}/groups/${groupId}/calendar/${date}?action=cancel`);
  };

  const openMarking = openDayMenu ? markingsByDate[openDayMenu.date] : null;
  const openClosed = openDayMenu && openMarking ? isCalendarDayClosed(openDayMenu.date, openMarking) : false;
```

Nota: `handleAssignOrEdit`/`handleClearDay`/`handleCancelSession` leen `openDayMenu.date` ANTES de cerrar el menú (`handleCloseDayMenu()` pone `openDayMenu` en `null`) — por eso cada uno guarda `date` en una variable local al principio, no accede a `openDayMenu.date` después de cerrarlo.

- [ ] **Step 5: Actualizar el `dayComponent` del `<Calendar>` y el contenedor del mes**

Ubicar:
```jsx
        <View
          className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-surface"
          nativeID="group-calendar-month-view"
          testID="group-calendar-month-view"
        >
          <Calendar
            current={currentMonthISO}
            dayComponent={({ date, state }) => (
              <CalendarDayCell date={date} marking={markingsByDate[date.dateString]} onPress={handleDayPress} state={state} />
            )}
```
Reemplazar por:
```jsx
        <View
          className="relative rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-surface"
          nativeID="group-calendar-month-view"
          ref={monthViewRef}
          testID="group-calendar-month-view"
        >
          <Calendar
            current={currentMonthISO}
            dayComponent={({ date, state }) => (
              <CalendarDayCell containerRef={monthViewRef} date={date} marking={markingsByDate[date.dateString]} onOpenMenu={handleOpenDayMenu} state={state} />
            )}
```

- [ ] **Step 6: Montar el `AnimatedDropdown` con `CalendarDayMenu`**

Ubicar:
```jsx
      <StampPlanModal groupId={groupId} onClose={() => setStampModalVisible(false)} ownerId={userId} visible={stampModalVisible} />
    </View>
  );
}
```
Reemplazar por:
```jsx
      <StampPlanModal groupId={groupId} onClose={() => setStampModalVisible(false)} ownerId={userId} visible={stampModalVisible} />

      <AnimatedDropdown
        anchorStyle={openDayMenu ? { left: openDayMenu.anchor.x, top: openDayMenu.anchor.y + openDayMenu.anchor.height + 4 } : {}}
        onClose={handleCloseDayMenu}
        open={Boolean(openDayMenu)}
      >
        {openDayMenu && (
          <CalendarDayMenu
            closed={openClosed}
            hasContent={Boolean(openMarking)}
            isTraining={openMarking?.kind === 'training'}
            onAssignOrEdit={handleAssignOrEdit}
            onCancel={handleCancelSession}
            onClear={handleClearDay}
          />
        )}
      </AnimatedDropdown>
    </View>
  );
}
```

- [ ] **Step 7: Verificar**

Run: `npm test && npm run lint`
Expected: PASS — sin tests nuevos (convención del proyecto, sin lógica pura nueva), pero confirma que no se rompió nada existente y que el lint (nativeID/testID, imports sin usar) está limpio.

- [ ] **Step 8: Commit**

```bash
git add components/team/group-calendar-screen.jsx
git commit -m "feat(calendar): wire day action menu into month view"
```

---

### Task 3: `?action=cancel` abre el prompt de cancelación automático

**Files:**
- Modify: `app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/[date].jsx`
- Modify: `components/team/group-calendar-day-screen.jsx`

**Interfaces:**
- Consumes: nada de tasks anteriores (independiente de Task 2, distinto archivo/flujo).
- Produces: nada consumido después — última pieza de código de este plan.

- [ ] **Step 1: Extraer `action` en el archivo de ruta**

Archivo completo actual:
```jsx
import { useLocalSearchParams } from 'expo-router';
import { GroupCalendarDayScreen } from '../../../../../../../components/team/group-calendar-day-screen.jsx';

export default function TeamGroupCalendarDay() {
  const { teamId, groupId, date } = useLocalSearchParams();
  return <GroupCalendarDayScreen date={date} groupId={groupId} teamId={teamId} />;
}
```
Reemplazar por:
```jsx
import { useLocalSearchParams } from 'expo-router';
import { GroupCalendarDayScreen } from '../../../../../../../components/team/group-calendar-day-screen.jsx';

export default function TeamGroupCalendarDay() {
  const { teamId, groupId, date, action } = useLocalSearchParams();
  return <GroupCalendarDayScreen action={action} date={date} groupId={groupId} teamId={teamId} />;
}
```

- [ ] **Step 2: Propagar `action` hasta el componente de contenido**

Ubicar, al final de `components/team/group-calendar-day-screen.jsx`:
```jsx
export function GroupCalendarDayScreen({ teamId, groupId, date }) {
  return (
    <RequireAuth>
      <GroupCalendarDayScreenContent date={date} groupId={groupId} teamId={teamId} />
    </RequireAuth>
  );
}
```
Reemplazar por:
```jsx
export function GroupCalendarDayScreen({ teamId, groupId, date, action }) {
  return (
    <RequireAuth>
      <GroupCalendarDayScreenContent action={action} date={date} groupId={groupId} teamId={teamId} />
    </RequireAuth>
  );
}
```

Ubicar, al principio del archivo:
```jsx
function GroupCalendarDayScreenContent({ teamId, groupId, date }) {
```
Reemplazar por:
```jsx
function GroupCalendarDayScreenContent({ teamId, groupId, date, action }) {
```

- [ ] **Step 3: Extender la semilla existente para abrir el prompt de cancelación**

Ubicar (el `useEffect` de seed ya existente):
```jsx
  const seededRef = useRef(false);
  useEffect(() => {
    if (loadingDay || seededRef.current) return;
    seededRef.current = true;
    if (existingDay) {
      setKind(existingDay.kind === 'cancelled' ? 'training' : existingDay.kind);
      setOtherName(existingDay.otherName ?? '');
      setSessionId(existingDay.sessionInstance ? KEEP_CURRENT_SESSION : '');
      setIsPresencial(existingDay.isPresencial);
      setPresencialTimeFrom(existingDay.presencialTimeFrom ?? '');
      setPresencialTimeTo(existingDay.presencialTimeTo ?? '');
      setPresencialLocation(existingDay.presencialLocation ?? null);
    }
  }, [loadingDay, existingDay]);
```
Reemplazar por (agrega la apertura del prompt al final del `if (existingDay)`, condicionada a que el día sea `training` — la misma condición que ya define `canCancelSession` más abajo en el archivo, repetida acá porque `canCancelSession` todavía no existe en este punto del componente):
```jsx
  const seededRef = useRef(false);
  useEffect(() => {
    if (loadingDay || seededRef.current) return;
    seededRef.current = true;
    if (existingDay) {
      setKind(existingDay.kind === 'cancelled' ? 'training' : existingDay.kind);
      setOtherName(existingDay.otherName ?? '');
      setSessionId(existingDay.sessionInstance ? KEEP_CURRENT_SESSION : '');
      setIsPresencial(existingDay.isPresencial);
      setPresencialTimeFrom(existingDay.presencialTimeFrom ?? '');
      setPresencialTimeTo(existingDay.presencialTimeTo ?? '');
      setPresencialLocation(existingDay.presencialLocation ?? null);
      if (action === 'cancel' && existingDay.kind === 'training') {
        setCancelPromptVisible(true);
      }
    }
  }, [loadingDay, existingDay, action]);
```

- [ ] **Step 4: Verificar**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/teams/[teamId]/groups/[groupId]/calendar/[date].jsx" components/team/group-calendar-day-screen.jsx
git commit -m "feat(calendar): open cancel prompt automatically via ?action=cancel"
```

---

### Task 4: Verificación final + script de test manual

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Correr la suite completa**

Run: `npm test && npm run lint`
Expected: PASS — 0 fallos, 0 errores de lint.

- [ ] **Step 2: Entregar el script de test manual**

En la respuesta final de esta tarea, mostrar el siguiente script de test manual verbatim en el chat (convención ya usada en las piezas 1 y 2 — el usuario prueba manualmente, no hay tests de render de componentes para este tipo de cambio):

```
## Script de test manual — menú de acciones por día

### 1. Día vacío
1. Ir al calendario de un grupo, tocar un día futuro sin nada asignado.
2. El menú debe mostrar SOLO "Asignar".
3. Tocar "Asignar" → navega a la pantalla de día, vacía.

### 2. Día con entrenamiento (no presencial, no cerrado)
1. Asignar una sesión a un día futuro (sin presencial).
2. Volver al mes, tocar ese día.
3. El menú debe mostrar "Editar", "Vaciar día" y "Cancelar sesión" (los 3).
4. Tocar "Vaciar día" → el día se vacía sin navegar, toast de éxito, el
   punto de color desaparece del mes.

### 3. Cancelar desde el menú
1. Asignar de nuevo una sesión a un día futuro.
2. Tocar el día, tocar "Cancelar sesión".
3. Debe navegar a la pantalla de día Y abrir automáticamente el prompt
   de "Cancelar sesión" (motivo + confirmar), sin tocar nada más ahí.
4. Confirmar la cancelación, volver al mes → el día debe verse como
   cancelado.

### 4. Día cerrado (pasado)
1. Tocar un día del mes anterior que tenga contenido.
2. El menú NO debe mostrar "Vaciar día" (está cerrado).
3. Si ese día era de entrenamiento, "Cancelar sesión" SÍ debe seguir
   apareciendo (excepción ya vigente).

### 5. Cierre del menú
1. Tocar un día para abrir el menú, tocar afuera (backdrop) → el menú
   se cierra sin hacer nada.
2. Repetir, esta vez tocando "Asignar"/"Editar"/"Vaciar"/"Cancelar" →
   el menú debe cerrarse solo en cada caso (no queda abierto de fondo).

### 6. No regresión de la navegación de meses
1. Con el menú cerrado, navegar varios meses hacia adelante y atrás con
   las flechas del calendario.
2. Confirmar que sigue sin resetear al mes actual (bug ya arreglado en
   la pieza 1) y que abrir el menú en un mes no visible originalmente
   también funciona bien.

Probar en web alcanza para todo lo de arriba — no hay comportamiento
específico de plataforma nuevo en esta pieza.
```

- [ ] **Step 3: Marcar el plan como completo**

No hay commit en este task — es solo verificación y entrega del script. Si `npm test`/`npm run lint` fallaran, volver al task correspondiente y corregir antes de considerar el plan terminado.
