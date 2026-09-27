# Historial de entrenamientos (piezas 2/3) — design

**Status:** aprobado, pendiente de plan de implementación.

**Contexto:** piezas 2 y 3 del sub-proyecto "calendario/entrenamientos" (ver
`docs/superpowers/specs/2026-09-26-trainings-tabs-shell-design.md`, que dejó
la pestaña "Historial" en stub — `components/calendar/trainings-history-tab.jsx`).
Backend resuelto en `docs/BACKEND_API_GAPS.md` Gap 13 (endpoints, `session_instance_id`,
`DELETE /workout-feedback/{id}`). Una adenda de Gap 13 sigue **EN CURSO** del lado backend
(rango de fechas con un solo extremo) — este documento contempla ambos casos, ver §3.

## 1. Alcance

Un único componente compartido, parametrizado por rol, usado en las dos pantallas
que ya tienen la pestaña "Historial" cableada:

- `my-calendar-screen.jsx` → `<TrainingsHistoryTab role="runner" />`
- `administered-calendar-screen.jsx` → `<TrainingsHistoryTab role="trainer" />`

Sumarización real (agregados) queda explícitamente fuera — decisión ya tomada, anotada
como mejora futura en Gap 13. Tampoco hay agrupación visual sin agregar (se evaluó y
se descartó para esta pieza, ver brainstorming). Sin componente de render tests (convención
del proyecto) — solo Jest sobre lógica pura (normalizers, selectores de filtros).

## 2. Data layer

**`services/trainingsHistory.js`** (nuevo):

```js
import api from './api.js';

function buildParams(filters) {
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
  return await api.get(`/users/${userId}/workout-feedback-history?${buildParams(filters).toString()}`);
}

export async function getAdministeredWorkoutFeedbackHistory(userId, filters) {
  return await api.get(`/users/${userId}/administered-workout-feedback-history?${buildParams(filters).toString()}`);
}
```

**`services/normalizers.js`** (agrega):

```js
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

**`hooks/use-trainings-history.js`** (nuevo) — mismo patrón "Cargar más" que
`hooks/use-team-search.js` (único precedente de paginación del repo), adaptado a que
acá los filtros viven en el componente llamador y se recalculan cada render (no hay
una acción explícita de "buscar"):

```js
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorkoutFeedbackHistory, getAdministeredWorkoutFeedbackHistory } from '../services/trainingsHistory.js';
import { toWorkoutFeedbackHistoryResponseModel } from '../services/normalizers.js';

export function useTrainingsHistory(role, userId, filters) {
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState({ filtersKey: null, pageKey: null, items: [] });

  const filtersKey = JSON.stringify({ ...filters, page: undefined });
  if (accumulated.filtersKey !== null && accumulated.filtersKey !== filtersKey && page !== 1) {
    setPage(1);
  }

  const fetcher = role === 'trainer' ? getAdministeredWorkoutFeedbackHistory : getWorkoutFeedbackHistory;
  const query = useQuery({
    queryKey: ['trainings-history', role, userId, filtersKey, page],
    queryFn: () => fetcher(userId, { ...filters, page }).then(toWorkoutFeedbackHistoryResponseModel),
    enabled: Boolean(userId && (role !== 'trainer' || filters.teamId)),
  });

  const currentKey = `${filtersKey}:${page}`;
  if (query.isSuccess && accumulated.pageKey !== currentKey) {
    setAccumulated({
      filtersKey,
      pageKey: currentKey,
      items: page === 1 ? query.data.items : [...accumulated.items, ...query.data.items],
    });
  }

  return {
    items: accumulated.filtersKey === filtersKey ? accumulated.items : [],
    total: query.data?.total ?? 0,
    hasMore: query.data ? (page * (query.data.pageSize ?? 20)) < query.data.total : false,
    availableAthletes: query.data?.availableAthletes ?? [],
    availableExercises: query.data?.availableExercises ?? [],
    loading: query.isLoading,
    isFetching: query.isFetching,
    loadMore: () => setPage((p) => p + 1),
  };
}
```

Nota de implementación: el reset de página en el mismo render (`setPage` dentro del cuerpo
de la función, guardado por la comparación de `filtersKey`) sigue el mismo patrón ya usado
en `use-team-search.js` (actualizar estado derivado durante el render, no en un `useEffect`
posterior) — el plan de implementación debe escribir el test que cubre el caso "cambiar de
equipo reinicia a página 1 y descarta el acumulado anterior".

## 3. Filtros — primer nivel

Reusan `components/shared/filter-panel.jsx` ya existente (mismo show/hide, "Limpiar").

- **Corredor:** un solo select, Equipo (`useMyMemberTeams(userId)`, opcional — sin filtro
  trae los N más recientes de todos los equipos). Sin control de grupo: el corredor está en
  un único grupo por equipo, no aporta nada que `team_id` no resuelva ya.
- **Entrenador:** Equipo **obligatorio** (`selectAdministeredTeams(useTeams().teams, userId)`
  — sin equipo elegido, no se dispara ningún fetch, mismo criterio que el `enabled` del hook
  de arriba) + Grupo opcional dependiente (`useGroups(filterTeamId, userId)`, default "todos
  los grupos", disabled hasta elegir equipo — mismo patrón ya usado en el filtro de Calendario).
- **Rango de fechas:** dos `DateField` (`components/forms/fields.jsx`), independientes.
  - Si el backend ya resolvió la adenda de fechas abiertas (Gap 13, EN CURSO al escribir esto):
    cualquiera de los dos solo, o ambos, se manda tal cual — sin restricción del lado frontend.
  - Si NO la resolvió: el frontend solo envía `date_from`/`date_to` cuando **ambos** están
    completos (mismo criterio que ya evita pisar el 400 actual) — un campo cargado solo se
    guarda en estado pero no viaja en la query hasta completar el par. Cuál de los dos casos
    aplica se resuelve en el plan de implementación, contra el estado real del backend en ese
    momento (revisar `docs/BACKEND_API_GAPS.md` Gap 13 antes de escribir esta parte).
  - Validación simple client-side: si ambos están cargados y `dateFrom > dateTo`, no se
    dispara el fetch y se muestra un error inline en vez de dejar que el backend devuelva 400.
- **Orden:** un `ResponsiveSelectField` chico (Fecha / Serie / Ejercicio, mapea a
  `feedback_date`/`set_number`/`exercise_name`) + un ícono toggle asc/desc
  (`sort-ascending`/`sort-descending`) — viven como children más del mismo `FilterPanel`.

## 4. Filtros — segundo nivel

Aparecen dentro del **mismo** `FilterPanel`, solo una vez que `items.length > 0` (antes de
la primera carga no hay pool para poblar los selects):

- **Ejercicio:** `ResponsiveSelectField` con `availableExercises` (ya deduplicado por familia
  de catálogo del lado backend — ver Gap 13).
- **Serie (`set_number`):** input numérico simple (`InputField`, `keyboardType="numeric"`),
  habilitado solo con un ejercicio elegido (sin ejercicio, filtrar por número de serie a solas
  no tiene un pool claro contra el cual validar).
- **Corredor (solo entrenador):** `ResponsiveSelectField` con `availableAthletes`.

`availableAthletes`/`availableExercises` no se recortan por estos mismos filtros ni por
paginación (contrato de Gap 13) — el pool no se achica al elegir una opción.

## 5. Card de fila — `components/calendar/trainings-history-row.jsx` (nuevo, compartida)

Una card compacta por ítem, mismos formatters ya existentes (`formatClock`,
`formatMeters`, `formatDisplayDate` de `utils/time.js`/`utils/distance.js`/
`utils/format-date-display.js`). Contenido (3-4 líneas, sin scroll horizontal):

- **Corredor:** fecha + badge de estado + ícono `dots-vertical` (fila 1) · nombre de sesión
  · nombre de ejercicio (fila 2) · "Serie N" · duración · distancia (fila 3) · chip
  equipo/grupo, texto muted (fila 4 — spanea varios equipos, vale la pena mostrarlo).
- **Entrenador:** nombre del atleta + badge de estado + `dots-vertical` (fila 1) · fecha
  (fila 2) · nombre de sesión · nombre de ejercicio (fila 3) · "Serie N" · duración ·
  distancia · chip de grupo (fila 4 — el equipo ya está fijado por el filtro obligatorio,
  no hace falta repetirlo).

En modo selección (ver §6), un checkbox reemplaza/acompaña el espacio del `dots-vertical`
y tocar la card entera alterna su selección.

## 6. Menú de fila + selección múltiple + borrado en lote

Mismo espíritu que el menú de día del calendario
(`docs/superpowers/specs/2026-09-21-calendar-multi-select-design.md`), adaptado a filas:

- `AnimatedDropdown` (`components/shared/animated-dropdown.jsx`) montado **una sola vez**
  en `trainings-history-tab.jsx` — nunca por fila (regla ya escrita en `CLAUDE.md`, sección
  "Selects"/patrón de dropdowns anidados). Cada card mide su ancla contra un contenedor de
  referencia y reporta hacia arriba, mismo patrón que `SessionRoleClosedSelect`.
- Ítems del menú (dos): **"Seleccionar"** (entra a modo selección con esa fila ya marcada) y
  **"Ver/editar registro"** (arma el `reviewSlot` y navega, ver §7).
- En modo selección: header propio arriba de la lista de cards — "`N` seleccionados" + ícono
  **Eliminar** (`trash-can-outline`, rojo `#ef4444`, mismo tono que el calendario) + ícono
  **Salir** (`close`). Tocar cualquier card alterna su selección; el menú `dots-vertical`
  queda inalcanzable mientras el modo está activo.
- **Eliminar en lote:** no existe un endpoint bulk — se resuelve con un
  `DELETE /workout-feedback/{id}` por fila seleccionada (`Promise.all`). Antes de ejecutar,
  modal de confirmación simple (texto: "¿Eliminar N registro(s)? Esta acción no se puede
  deshacer.", inline en `trainings-history-tab.jsx`, sin componente compartido nuevo — no
  hay otro modal de confirmación destructiva reutilizable hoy en el repo para este caso).
  Si alguna request falla (404 = ya borrado, 403 = sin permiso), se seguí con el resto y al
  final se informa cuántas se borraron y cuántas fallaron por toast — no se aborta todo el
  lote por un solo error. Éxito total o parcial: toast + salir de selección + invalidar
  `['trainings-history', ...]`.

**`services/trainingsHistory.js`** suma `deleteWorkoutFeedback(feedbackId)` (`DELETE
/workout-feedback/{feedbackId}`).

## 7. Navegar a "Ver/editar registro"

Reusa la pantalla de revisión ya construida por el compañero
(`components/session-runtime/session-review-screen.jsx`, `store/session-review-store.js`).
Al elegir el ítem del menú:

```js
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
```

`mode: 'review'` fijo, sin consultar `getRunnerSession` — el ítem del historial ya es un
feedback existente, no hace falta la resolución de estado que sí necesita `StartSessionButton`
(ese caso no sabe de antemano si hay datos; acá sí). Si la instancia de sesión fue borrada
físicamente después (día reasignado), `GET /session-instances/:id/feedback` da `404` dentro
de la pantalla de revisión — comportamiento esperado según el propio backend, no requiere
manejo especial nuevo acá (la pantalla ya maneja sus propios estados de carga/error).

## 8. Archivos

- **Nuevo:** `services/trainingsHistory.js`, `hooks/use-trainings-history.js`,
  `components/calendar/trainings-history-row.jsx`.
- **Modificado:** `services/normalizers.js` (dos funciones nuevas),
  `components/calendar/trainings-history-tab.jsx` (reemplaza el stub por la implementación
  completa: filtros, lista, selección, menú, paginación), `my-calendar-screen.jsx`/
  `administered-calendar-screen.jsx` (pasan `role` al tab, sin más cambios — ya tienen la
  pestaña cableada desde la pieza anterior).
- **Testing (Jest, lógica pura):** `toWorkoutFeedbackHistoryItemModel`/
  `toWorkoutFeedbackHistoryResponseModel` (normalizers), el reset de página por cambio de
  filtros en `use-trainings-history.js`, la validación `dateFrom > dateTo`.
