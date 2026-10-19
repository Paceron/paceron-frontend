# Gamificación — Spec 4a: Competencias (CRUD, moderación, sin progreso en vivo)

> Cuarta de 4 specs del módulo de gamificación (feature/gamification), dividida en 4a/4b tras
> descubrir que la integración con session-runtime (necesaria para que CUALQUIER tipo de
> competencia sume progreso) es una pieza propia — ver `docs/BACKEND_API_GAPS.md` Gap 33,
> "Actualización 2026-10-14 (2)", puntos 17-22. Esta spec (4a) cubre CRUD, aprobación,
> cancelación, cierre y listado. **Deliberadamente sin progreso en vivo ni integración con
> session-runtime** — eso es 4b, junto con el tipo `route` (trayectoria en mapa).

## Alcance

Incluye: crear competencia (solo `type='metric'`, `type='route'` queda para 4b), aprobación
(entrenador), propuesta de corredor con flujo de aprobación, cancelación (solo corredor
proponente, solo `pending_approval`), cierre (solo entrenador, solo `active` con `end_at` vencido),
listado con filtro de estado, participantes resueltos contra el roster ya cargado del equipo,
ganadores (`winner_user_ids`, plural) mostrados cuando `finished`, punto rojo de la pestaña dentro
del equipo (no el punto rojo global — ver "Alcance del punto rojo" abajo).

Fuera de alcance (Spec 4b, misma rama): `type='route'`, dibujo de ruta en mapa, integración
`competition_id` en el arranque de sesión (por eso ninguna competencia de esta spec va a mostrar
progreso real — queda en cero hasta que 4b cablee el intake), vista de "progreso en vivo" por
participante (el campo `progress` del detalle, cuyo shape exacto todavía no está confirmado por
backend).

## Backend

- `POST /teams/{id}/competitions` → `{name, type: 'metric', metric, start_at, end_at,
  participant_user_ids, group_id?}`. `created_by_role='trainer'` → `status='active'` directo;
  `'runner'` → `'pending_approval'`. Validación 400: `end_at > start_at`, mínimo 2 participantes,
  todos miembros del team, **nunca el entrenador** (el backend lo rechaza si aparece en la lista
  — el frontend ni se lo ofrece como opción seleccionable).
- `PATCH /competitions/{id}/approve` — solo entrenador creador u owner, solo `pending_approval`.
- `PATCH /competitions/{id}/reject` — body `{reason?}`, mismo guard de rol/estado.
- `DELETE /competitions/{id}/cancel` — **solo el corredor que propuso**, **solo
  `pending_approval`** (confirmado real, Gap 33 punto 17 — no existe cancelación para `active`,
  para ningún rol). Borrado físico.
- `PATCH /competitions/{id}/close` — solo entrenador creador u owner, solo `active`, **solo si
  `end_at` ya pasó** (400 si no). Único mecanismo de cierre (sin job automático). Calcula
  `winner_user_ids` (array, vacío si nadie completó un intento).
- `GET /teams/{id}/competitions?status=&group_id=` → lista liviana (todos los campos del modelo,
  sin progreso), con `has_unseen` para ese equipo (Gap 34).
- Modelo real (snake_case): `{id, name, team_id, group_id, type, metric, start_at, end_at, route,
  acceptance_radius_meters, participant_user_ids, created_by_user_id, created_by_role, status:
  'pending_approval'|'active'|'finished'|'rejected', approved_by_user_id, rejection_reason,
  winner_user_ids: [], finished_at}`. **Sin `'cancelled'`** en el enum (al cancelarse, la fila
  desaparece — no queda con ese status).

## Alcance del punto rojo

El punto rojo GLOBAL (header/sidebar) se queda, por ahora, solo con el OR de rachas + logros
(Spec 1/2) — extenderlo a competencias exigiría pedir `GET /teams/{id}/competitions` de **cada**
equipo del usuario solo para prender un ícono, un costo que no se justifica todavía con 0 equipos
reales usando competencias. En su lugar, esta spec agrega el punto rojo **a nivel de pestaña**:
un punto en la pestaña "Competencias" dentro de CADA equipo, usando el `has_unseen` que ya trae
su propio `GET /teams/{id}/competitions`. Decisión documentada, no un olvido — revisar si algún
día se justifica el agregado cross-equipo.

## Archivos

**Nuevos:**
- `services/competitions.js` — `createCompetition(teamId, payload)`,
  `listCompetitions(teamId, {status, groupId})`, `approveCompetition(id)`,
  `rejectCompetition(id, reason)`, `cancelCompetition(id)`, `closeCompetition(id)`.
- `services/__mocks__/competitions-mock.js` — array mutable en memoria (mismo patrón que
  `services/__mocks__/team-subscriptions-mock.js`: `__resetMockCompetitions()` para tests), para
  poder probar el ciclo completo (crear→aprobar/rechazar→cancelar→cerrar) contra mocks sin
  backend. 2-3 competencias seed con distintos estados.
- `services/normalizers.js` — agrega `toCompetitionModel(dto)` (snake→camel,
  `winnerUserIds` siempre array) y `toCreateCompetitionPayload(form)` (camel→snake).
- `utils/gamification-metric-options.js` — extrae `METRIC_OPTIONS` (hoy duplicado en
  `components/team/leaderboard-tab.jsx`, Spec 3) a un archivo compartido — misma lista de 6
  métricas, reusada acá para el selector de métrica de la competencia. `leaderboard-tab.jsx`
  pasa a importar de acá en vez de definir su propia constante.
- `hooks/use-competitions.js` — `useCompetitions(teamId, {status, groupId})` → `{competitions,
  hasUnseen, loading, error}`. `useCompetitionMutations(teamId)` → `{createCompetition,
  approveCompetition, rejectCompetition, cancelCompetition, closeCompetition, isCreating, ...}`
  — cada mutación invalida `['competitions', teamId]` al resolver.
- `components/team/competitions-tab.jsx` — lista con filtro de estado (`ResponsiveSelectField`),
  cada fila expandible (tap) mostrando participantes (nombre resuelto contra el roster ya cargado
  del equipo, pasado como prop) y acciones contextuales por rol/estado (ver "Reglas de UI" abajo).
  Dispara `ackSection('competitions', teamId)` al montar (mismo mecanismo de Spec 1/2, con el
  `teamId` que el backend real exige para esta sección — Gap 34).
- `components/team/create-competition-modal.jsx` — nombre, métrica (`METRIC_OPTIONS`
  compartido), ventana (2 `DateField`, "Desde"/"Hasta"), checklist de participantes (roster del
  equipo SIN el entrenador, filtro opcional por grupo arriba de la lista) — mismo patrón de modal
  que `create-group-modal.jsx` (`useFormDirty`/`useUnsavedChangesGuard`/`DiscardChangesModal`).
  El filtro de grupo no es solo conveniencia de UI: si queda un grupo seleccionado (no "Todos los
  grupos") al momento de crear, ese `groupId` se manda en el payload (`group_id`) — logra la
  misma capacidad que el doc fuente pide desde "las opciones de un grupo" (competencia acotada a
  ese grupo) sin necesitar un entry point separado. Validación cliente antes de submit: `end_at >
  start_at`, mínimo 2 participantes marcados (igual que el backend, para no depender solo del
  400).
- `components/team/reject-competition-modal.jsx` — modal chico, `TextInput` "Motivo (opcional)",
  Cancelar/Rechazar.

**Tocados:**
- `components/shared/tab-bar.jsx` — agrega prop opcional `badges` (`{[tabId]: boolean}`): si
  `badges[tab.id]` es `true`, un punto rojo absoluto chico sobre el ícono de esa pestaña (mismo
  estilo que los puntos de notificación ya existentes). Prop opcional — los 3 consumidores
  actuales (`TeamDetailScreen`, `TrainingPlansScreen`, `PaymentsScreen`) no se ven afectados si no
  la pasan.
- `components/team/team-detail-screen.jsx` — `TABS` suma `{id: 'competencias', label:
  'Competencias', icon: 'sword-cross'}` (visible para ambos roles, igual que `leaderboard`, sin
  entrar en el filtro de `visibleTabs`). `TabBar` recibe `badges={{ competencias: competitionsHasUnseen }}`
  (de un `useCompetitions(team?.id)` llamado en este nivel solo para leer `hasUnseen` — TanStack
  Query dedup por `queryKey`, no es una segunda request real si `CompetitionsTab` también la
  llama). El `usePullToRefresh` suma `queryClient.invalidateQueries({queryKey: ['competitions',
  teamId]})`.

## Reglas de UI (quién ve qué botón)

| Estado | Entrenador (`canDeleteTeam`) | Corredor proponente | Otro corredor |
|---|---|---|---|
| `pending_approval` | Aprobar / Rechazar | Cancelar (si él la propuso) | — |
| `active` | Cerrar (solo si `end_at` ya pasó) | — | — |
| `finished` | — (solo lectura, ganadores si hay) | — | — |
| `rejected` | — (solo lectura, con motivo si hay) | — | — |

Una competencia creada directo por el entrenador nace `active` — nunca pasa por
`pending_approval`, así que nunca tiene botón de Cancelar (ni para él: no existe esa acción en
`active`, confirmado Gap 33 punto 17).

## Participantes y ganadores

- Checklist de creación: roster del equipo (`members`, ya cargado en `team-detail-screen.jsx` vía
  `useTeamRoster`) filtrando afuera cualquier fila cuyo rol sea entrenador (el backend la rechaza
  igual, pero no se la ofrece desde el vamos). Sin toggle especial de "excluirme" — el creador
  corredor aparece como una fila más del checklist, destildarla a sí mismo ya logra lo mismo.
- Fila expandida: lista de `participant_user_ids` resueltos contra `members` por `userId` (si un
  participante ya no está en el roster — se fue del equipo —, se muestra igual con el nombre que
  tenía resuelto la última vez que el roster lo trajo, o "Corredor" si no se encuentra, nunca un
  hueco en blanco).
- `finished`: los ids en `winner_user_ids` se resaltan (ícono de trofeo chico) dentro de la misma
  lista de participantes — sin trofeo si el array viene vacío ("Sin ganador, nadie completó un
  intento").

## Estilos

- Fila de competencia: mismo patrón de card (`bg-white dark:bg-surface rounded-xl p-3`) que el
  resto del repo. Badge de estado con color por estado (`pending_approval` ámbar, `active` verde,
  `finished` azul, `rejected` gris) — mismo criterio de "semáforo con intención" que
  `EXERCISE_KIND_META`/`DAY_KIND_META`.
- Botones de acción: mismo estilo que `JoinRequestRow` (`team-requests-tab.jsx`) — Aprobar
  (primary), Rechazar/Cancelar (outline), Cerrar (outline, color ámbar para diferenciarlo de un
  rechazo).

## Responsive / plataformas

Checklist de participantes y selector de métrica/período: mismo patrón `Row`/`Col` que
`leaderboard-tab.jsx` (Spec 3) — apila en mobile, en fila en web ancho.

## Testing

- `__tests__/competitions-mock.test.js` — ciclo completo contra el mock: crear pendiente →
  aprobar → queda `active`; crear + rechazar → `rejected`; crear pendiente + cancelar → la fila
  desaparece (no queda ninguna con status `cancelled`, confirma que el mock refleja el borrado
  físico real).
- `__tests__/gamification-metric-options.test.js` (si aplica — probablemente la constante no
  necesite lógica más allá de su propia forma; si es solo un array estático, no hace falta test
  dedicado, se decide en implementación).
- Sin tests de render de componentes (convención del repo).

## Identificadores

Todo componente visual nuevo lleva `nativeID`/`testID` kebab-case (regla obligatoria).
