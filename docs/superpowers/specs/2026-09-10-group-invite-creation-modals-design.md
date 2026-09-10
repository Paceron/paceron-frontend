# Alta de grupos e invitaciones vía modal — diseño

## Contexto

Hoy hay dos formularios de alta que se repiten, casi idénticos, en más de un lugar:

- **Alta de grupo**: `components/team/group-list-editor.jsx` (usado en el paso 2 del wizard de `create-team-screen.jsx`, sobre datos en borrador — el equipo todavía no existe) tiene un form inline siempre visible (nombre, plan, descripción) seguido de la lista de grupos. `components/team/team-detail-screen.jsx` (equipo ya real) tiene su **propio** form inline casi idéntico, alternado por un botón "+" (`team-detail-add-group-button`) que hoy solo togglea visibilidad (`addGroupVisible`) — no abre un modal.
- **Alta de invitación**: `EmailInviteForm` (`components/forms/fields.jsx`) es una fila compacta (email + picker de grupo + botón "+" inline) siempre visible, reusada tal cual en el paso 3 del wizard y en `components/team/invite-team-members-screen.jsx` (pantalla dedicada para invitar a un equipo ya existente, alcanzada desde el botón "Invitar" de `team-detail-screen.jsx` — ese botón navega a la pantalla, no abre nada inline en el propio detalle).

**Objetivo:** reemplazar los 4 puntos de alta por dos componentes de modal compartidos (`CreateGroupModal`, `InviteMemberModal`), siguiendo el mismo patrón ya establecido por `CreateExerciseModal`/`CreateSessionModal` (`components/plans/`) — modal con guard de cambios sin guardar, backdrop-close (regla obligatoria de `CLAUDE.md`), y un botón "+" circular (mismo estilo ya usado para "Crear equipo" en `teams-list-screen.jsx` y para el propio botón de grupo en `team-detail-screen.jsx`) que lo dispara, en vez de un form siempre visible.

**Decisiones ya tomadas con el usuario:**
- Unificar el form de alta de grupo en un solo componente compartido por los 2 contextos (wizard y team-detail), no dos modales separados.
- Los modales nuevos llevan el mismo guard de "cambios sin guardar" que ya usan `CreateExerciseModal`/`CreateSessionModal`.

## Diseño

### `CreateGroupModal.jsx` (nuevo, `components/team/`)

Mismo patrón visual/estructural que `CreateExerciseModal` (`Modal` transparente, backdrop `Pressable` con `onPress={guardedClose(onClose)}`, card interna `Pressable` no-op, `useFormDirty`/`useUnsavedChangesGuard`, `notifySuccess`/`notifyError` + `Toast.show`).

**Props:**
- `visible`, `onClose` — igual que el resto de los modales del proyecto.
- `onSubmit({ name, description, trainingPlanId }) → Promise<{ success, error? }>` — el modal no sabe si el submit crea de verdad contra el backend o solo agrega a un array local en memoria. Llama a `onSubmit`, y si devuelve `{ success: true }` cierra el modal (mismo ciclo que ya usan los modales de ejercicios/sesiones); si devuelve `{ success: false, error }`, muestra el error inline y no cierra.
- `existingNames` (array de strings, nombres ya usados en minúscula) — para el chequeo de "ya existe un grupo con ese nombre" antes de llamar a `onSubmit` (validación que hoy vive duplicada en `GroupListEditor`/`team-detail-screen.jsx`, se centraliza acá).
- `planOptions` — mismas opciones que ya recibe `GroupListEditor`/el form inline de `team-detail-screen.jsx` (`TRAINING_PLAN_OPTIONS` de `store/team-store.js`).

**Campos:** nombre (`InputField`, requerido), plan de entrenamiento (`ResponsiveSelectField`, opcional), descripción (`InputField multiline`, opcional) — mismos 3 campos que hoy, pero en un layout propio del modal (no hace falta calcar el `Row`/`Col` de 2 columnas que usa el form inline actual — el modal es más angosto, un layout de una sola columna es más natural ahí, mismo criterio que `CreateExerciseModal`).

**No maneja loading/submitting externo** — el `isPending`/`isCreating` de la mutación real (cuando corresponda) lo resuelve el `onSubmit` del caller, el modal solo necesita saber si terminó (`success`/`error`), igual que hoy hace `CreateExerciseModal` con `useExerciseMutations()`.

### Consumidores de `CreateGroupModal`

**`GroupListEditor.jsx` (wizard, `create-team-screen.jsx` paso 2) — se recorta a solo lista + botón:**

Se elimina el form inline completo (`draftName`/`draftDescription`/`draftPlan`/`draftError`, el `View` de `group-list-editor-form`). Queda: la fila fija "Grupo principal" (sin cambios) + el `.map` de `groups` (sin cambios) + un botón "+" circular arriba de la lista (mismo estilo que `teams-list-create-button`: `rounded-full p-2 hover:bg-slate-100`, solo ícono `plus`, sin label) que abre `CreateGroupModal`.

`onSubmit` para este contexto agrega al array local, igual que hoy hace `handleAdd` (sin llamar a ningún servicio — el equipo no existe todavía):
```js
onSubmit={async ({ name, description, trainingPlanId }) => {
  onChange([...groups, { id: `group-draft-${Date.now()}`, name, description, trainingPlanId }]);
  return { success: true };
}}
existingNames={groups.map((g) => g.name.toLowerCase())}
```

**`team-detail-screen.jsx` (equipo real) — el botón "+" que ya existe cambia de comportamiento:**

`team-detail-add-group-button` deja de hacer `setAddGroupVisible((v) => !v)` y pasa a `setCreateGroupModalVisible(true)`. Se elimina el bloque `{addGroupVisible && (...)}` completo (~60 líneas, `newGroupName`/`newGroupDescription`/`newGroupPlan`/`newGroupError`/`addingGroup` — todos esos 5 `useState` se eliminan, el modal maneja su propio estado de formulario) y se elimina `handleAddGroup` (su lógica pasa a vivir en el `onSubmit` inline del modal, montado junto a los demás modales de la pantalla — `DeleteTeamModal`, etc.):
```js
onSubmit={async ({ name, description, trainingPlanId }) => {
  const result = await createGroupInTeam({ name, description, trainingPlanId });
  if (result.success) Toast.show({ type: 'success', text1: 'Grupo creado' });
  return result;
}}
existingNames={groups.map((g) => g.name.toLowerCase())}
```
(`createGroupInTeam` ya viene de `useGroupMutations(teamId)`, sin cambios en `hooks/use-groups.js` — solo cambia quién lo llama.)

### `InviteMemberModal.jsx` (nuevo, `components/team/`)

Mismo patrón que `CreateGroupModal`, con una diferencia técnica importante: **es autocontenido respecto al autocompletado de email**, no recibe `emailSearch` como prop.

**Por qué:** `EmailInviteForm` hoy depende de `useEmailSuggestions(containerRef)`, donde `containerRef` apunta a la raíz de toda la pantalla (`create-team-screen.jsx`/`invite-team-members-screen.jsx`) — el panel de sugerencias (`AnimatedDropdown`) se monta como hermano del contenido principal, no hijo del form, porque `measureLayout` necesita medir contra un ancestro compartido (ver el comentario ya existente en `hooks/use-email-suggestions.js` sobre por qué no puede ser un `Modal` propio ni un hijo directo). Si el form se mueve adentro de un `<Modal>` de React Native pero el dropdown de sugerencias se sigue anclando a la raíz de la pantalla (fuera del modal), el dropdown queda visualmente atrapado detrás del backdrop del modal — no es solo un detalle visual, es información inutilizable mientras el modal está abierto.

**Solución:** `InviteMemberModal` monta su propio `useEmailSuggestions(cardRef)` y su propio `AnimatedDropdown`, ambos anclados a la card del modal (un `ref` propio sobre el `Pressable` de la card, mismo patrón que ya usa cada pantalla hoy pero con el modal como ancestro en vez de la pantalla completa). Esto es autocontenido — el modal no necesita que el caller le pase nada de autocompletado.

**Consecuencia (limpieza adicional):** una vez que todo el flujo de "agregar un email" vive adentro del modal, `create-team-screen.jsx` e `invite-team-members-screen.jsx` ya no necesitan su propio `containerRef`/`useEmailSuggestions`/`AnimatedDropdown` a nivel de pantalla — se elimina esa plomería de las dos pantallas (~15-20 líneas cada una: el `ref` en el `View` raíz, el `useEmailSuggestions(containerRef)`, y el bloque `<AnimatedDropdown>...</AnimatedDropdown>` al final del JSX).

**Props:**
- `visible`, `onClose`.
- `onSubmit({ email, groupId }) → Promise<{ success, error? }>` — mismo contrato que `CreateGroupModal`. En los dos usos actuales, el submit real (POST) no pasa en este momento — ambas pantallas ya acumulan invitaciones en un array local (`invitedEmails`/`draftInvites`) y las mandan recién al crear el equipo / al tocar "Enviar invitaciones". `onSubmit` acá solo agrega al array local en los dos casos — se mantiene async por consistencia con `CreateGroupModal`, aunque hoy nunca falle.
- `groups` — mismas opciones que ya recibe `EmailInviteForm` (incluye el grupo principal/"Sin grupo" ya resuelto por cada caller, sin cambios en esa lógica).
- `existingEmails` — mismo propósito que hoy (chequeo de duplicado).

**Campos:** mismos que `EmailInviteForm` tiene hoy — email (con autocompletado) + picker de grupo (solo si `groups.length > 1`, igual que hoy) — layout propio del modal, no hace falta la fila horizontal compacta que tiene la versión inline.

`EmailInviteForm` (el componente actual en `components/forms/fields.jsx`) se **elimina** — su contenido se funde dentro de `InviteMemberModal` (ya no tiene sentido como pieza reusable aparte, dado que ahora solo se monta desde un solo lugar). `UserSuggestionsList` se mantiene (sigue haciendo falta como contenido del `AnimatedDropdown`, ahora montado desde `InviteMemberModal` en vez de desde cada pantalla).

### Consumidores de `InviteMemberModal`

**Wizard paso 3 (`create-team-screen.jsx`):** el `SectionCard` "Invitar corredores" (con `EmailInviteForm` adentro) se reemplaza por un botón "+" (mismo estilo) que abre el modal. `onSubmit`:
```js
onSubmit={async ({ email, groupId }) => {
  setInvitedEmails((prev) => [...prev, { email, groupId }]);
  return { success: true };
}}
```
El `SectionCard` "Corredores a invitar" (con `InvitedEmailsList`) no cambia — sigue mostrando lo ya agregado.

**`invite-team-members-screen.jsx`:** mismo reemplazo en el `SectionCard` "Invitar más corredores" — botón "+" en vez del form inline, mismo `onSubmit` agregando a `draftInvites`.

## Testing

Sin tests de render de componentes (convención del proyecto) — verificación manual en preview (web) para el flujo funcional, más **verificación en device real para el posicionamiento del dropdown de autocompletado**: `measureLayout` (que usa `useEmailSuggestions` para anclar el panel de sugerencias) es conocido no confiable en Android bajo New Architecture cuando mide contra un ancestro lejano a través de un `ScrollView` (ver "Quirks conocidos" de `CLAUDE.md`) — acá el ancestro (la card del modal) está más cerca que antes (ya no es toda la pantalla), pero es una configuración nueva (modal + autocompletado, combinación que no existía antes en el repo) y el preview web no puede confirmar el comportamiento nativo. Si el posicionamiento falla en Android, la alternativa ya documentada en el proyecto es `measureInWindow` con resta de coordenadas (mismo patrón que ya se usó para `RunnerMenu` en `team-detail-screen.jsx`) — no se aplica preventivamente, solo si se confirma el problema en device.

## Fuera de alcance

- Landing sin header/sidebar — explícitamente pausado por el usuario (van a resolver el rebranding del logo con otra herramienta primero).
- Cualquier cambio al contrato de `services/groups.js`/`services/invitations.js` — se consumen tal cual existen hoy.
- Cambiar el momento en que las invitaciones se mandan de verdad (sigue siendo al crear el equipo / al tocar "Enviar invitaciones", no inmediato por cada alta) — fuera de alcance, no fue parte de lo pedido.
