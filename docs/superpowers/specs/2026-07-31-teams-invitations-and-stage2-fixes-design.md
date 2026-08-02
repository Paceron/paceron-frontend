# Equipos: invitaciones reales (Etapa 3) + fixes de QA de Etapa 2

## Contexto

Etapas 1 (Equipos) y 2 (Grupos) ya están mergeadas a `develop`. El usuario probó Etapa 2 manualmente y reportó una tanda de bugs/ideas de diseño (`teams-groups-stage2-qa-feedback` en memoria). Se decidió resolver ambas cosas — Etapa 3 (Invitaciones) y los fixes de QA — en un solo ciclo spec→plan→implementación, ya que varios fixes tocan pantallas que Etapa 3 también toca (la pantalla de invitar, el menú de equipos).

Backend confirmado por swagger (2026-07-30): `GET /teams/{id}/invitations` (listar pendientes, lado dueño), `POST /invitations/{id}/accept`/`reject` (responder, body `{user_id}`) — gaps 5 y 6 de `docs/BACKEND_API_GAPS.md`, ya resueltos.

## Decisión: invitaciones recibidas por el invitado — diferida

El backend no tiene `GET /invitations?user_id=` ni `GET /invitations/{id}` (fetch individual). Sin ninguno de los dos no se puede armar una pantalla de "mis invitaciones pendientes" para quien es invitado (ni un listado, ni un deep-link a una invitación puntual con datos reales). **Se documenta como gap nuevo en `docs/BACKEND_API_GAPS.md` y se difiere** — esta etapa solo cubre el lado del dueño del equipo (listar pendientes reales, enviar invitación real). Los servicios `acceptInvitation`/`rejectInvitation` se agregan igual (mismo criterio que Etapa 1/2 con `addTeamUser`/`getGroupUsers`: mirror barato del contrato documentado, sin consumidor en la UI todavía) para no tener que retocar la capa de servicio cuando el gap se cierre.

## Decisión: se saca la selección de grupo al invitar

Hoy el flujo de invitar (wizard de creación y pantalla dedicada) deja elegir un grupo por invitación, incluyendo una opción "Sin grupo". Revisando el contrato real:

- `POST /teams/{id}/invite` (`InviteRunnerRequest`) solo acepta `email` — nunca hubo forma de mandar el grupo elegido al backend.
- `GET /teams/{id}/invitations` (`InvitationResponse`) tampoco devuelve `group_id` — ni siquiera se puede mostrar a qué grupo iba dirigida una invitación ya real.

O sea: la selección de grupo al invitar es pura decoración de UI que nunca se persiste ni se refleja en ningún lado una vez que la lista de invitaciones pasa a ser real (a diferencia de `trainingPlanId`/`showGroupsToRunners` en su momento, que si bien no persistían, al menos se reflejaban correctamente en la sesión local). Mantenerla sería UI engañosa — mismo criterio ya aplicado en Etapa 1 cuando se decidió no wirear "Sacar del equipo"/"Mover de grupo" con roster sintético.

**Se saca el selector de grupo del flujo de invitar por completo** (wizard paso 3 y pantalla dedicada) — invitar pasa a ser solo email. Se documenta como gap nuevo (`POST /teams/{id}/invite` no soporta asignar grupo) para si el backend lo suma más adelante. Esto también resuelve de raíz el ítem de QA "sacar 'Sin grupo' del picker" — no sobrevive ningún picker de grupo en este flujo.

`GroupListEditor`/`EmailListField` quedan intactos como componentes (siguen usados donde corresponde: `GroupListEditor` arma grupos en el wizard, `EmailListField` se simplifica para no recibir más `groups` — o se reemplaza por un campo de lista de emails más simple si `EmailListField` sin la parte de grupo no amerita mantener el nombre/abstracción; decisión de implementación, no de diseño).

## Servicios

`services/invitations.js` (nuevo), mismo patrón `USE_MOCKS` que `services/teams.js`/`services/groups.js`:

```
inviteToTeam(teamId, email)              // POST /teams/{id}/invite
listTeamInvitations(teamId)              // GET /teams/{id}/invitations
acceptInvitation(invitationId, userId)   // POST /invitations/{id}/accept
rejectInvitation(invitationId, userId)   // POST /invitations/{id}/reject
```

`services/__mocks__/invitations-mock.js`, mismo patrón stateful que `groups-mock.js`.

`services/normalizers.js` suma `toInvitationModel(dto)` — `id` (string), `teamId` (string), `email` (de `invitee_email`), `inviteeName`, `inviteeId`, `status`, `expiresAt`, `createdAt`. Sin campo de grupo (no existe en el backend, ver arriba).

## `store/team-store.js`

- **Se elimina** `addInvitedEmails` (acción local-only) y el campo `team.invitedEmails` sintético — reemplazados por:
  - `fetchInvitations(teamId)` — `GET /teams/{id}/invitations`, guarda en `team.invitations` (real, normalizado). Mismo patrón que `fetchGroups`.
  - `sendInvite(teamId, email)` — `POST /teams/{id}/invite`, en éxito re-fetchea `fetchInvitations` para reflejar la lista real (la respuesta del POST no trae el id de la invitación creada, no hay nada que insertar localmente sin el refetch).
- `decorateTeam`/`createTeam`/`buildInvitedEmail`/`isRegisteredMockEmail` pierden toda la lógica de invitaciones sintéticas (esa simulación de "email registrado/no registrado" ya no aplica — el estado real es simplemente `status` de la invitación).
- `createTeam` deja de aceptar `payload.invitedEmails` — invitar pasa a ser una acción separada, posterior a la creación del equipo (mismo motivo por el que ya no tiene sentido mandarlas en el mismo paso: sin grupo que remapear, no hay necesidad de la orquestación que hoy tiene `createTeam` para eso). El wizard de creación de equipo pierde el paso de invitar corredores en el mismo flujo, o lo mantiene pero llamando `sendInvite` recién cuando el equipo ya tiene id real — a definir en el plan (impacto acotado a `create-team-screen.jsx`).

## Pantallas

- **`invite-team-members-screen.jsx`**: reescritura — `fetchInvitations`-on-mount (mismo patrón que `fetchGroups`), lista "Solicitudes pendientes" lee `team.invitations` real (`status`, tiempo relativo desde `createdAt`), formulario de invitar es solo email (sin selector de grupo), `handleSendInvites` llama `sendInvite` async con toast de éxito/error real (ya no el texto de "se van a mandar cuando el backend esté disponible").
- **`create-team-screen.jsx`**: paso 3 ("Invitar corredores") se simplifica a una lista de emails sin grupo; el envío real ocurre después de crear el equipo (ver arriba).

## Fixes de QA (Etapa 2)

### 1. `ResponsiveSelectField` — componente genérico para selects de layout "campo completo"

Nuevo `components/forms/responsive-select-field.jsx`:

```js
export function ResponsiveSelectField(props) {
  return isWeb ? <SelectField {...props} /> : <PickerField {...props} />;
}
```

(`SelectField`/`PickerField` en `components/forms/fields.jsx` ya tienen exactamente la misma firma de props — confirmado leyendo ambas — el wrapper no necesita mapear nada). Reemplaza los 3 ternarios `isWeb ? <SelectField> : <PickerField>` existentes: `components/team/team-general-info-fields.jsx` (nivel de equipo), `components/team/group-list-editor.jsx` y `components/team/edit-group-screen.jsx` (plan de entrenamiento).

### 2. `InlinePicker` — rama web propia

`components/forms/fields.jsx#InlinePicker` (usado hoy solo por el selector de grupo al invitar — que este mismo plan elimina, ver arriba) se vuelve responsive igual, porque es un componente compartido reutilizable a futuro para cualquier selector compacto en fila. Mismo patrón que `DateField` ya usa en este archivo (`if (isWeb) { return <select> compacto } // resto: modal actual`) — un `<select>` nativo angosto (`widthClass`) en vez de siempre el modal mobile.

*Nota:* como este plan saca el único consumidor actual de `InlinePicker` (el picker de grupo al invitar), este fix queda como mejora del componente compartido en sí (para el próximo caso que lo use), no resuelve nada visible en esta pasada — cubierto igual porque es barato y evita que quede la misma trampa para el próximo consumidor.

### 3. Redirect global al perder sesión en pantalla protegida

Nuevo `components/guards/require-auth.jsx`, mismo patrón que el ya existente `components/guards/platform-gate.jsx#MobileOnlyRoute`:

```js
export function RequireAuth({ children, redirectHref = '/' }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href={redirectHref} />;
  return <>{children}</>;
}
```

Envuelve el contenido de las pantallas de equipos que lo necesitan: `create-team-screen.jsx`, `edit-team-screen.jsx`, `team-detail-screen.jsx`, `invite-team-members-screen.jsx`, `edit-group-screen.jsx`, y la nueva pantalla de listado (`/teams`, ver abajo). No se toca ninguna pantalla fuera del dominio de equipos (perfil, activación de entrenador, etc.) — mismo bug ahí probablemente, pero no fue reportado y es un scope aparte.

### 4. Pantalla `/teams` (listado) + separar click de flechita vs. botón

Nueva ruta `app/(tabs)/teams/index.jsx` → `components/team/teams-list-screen.jsx`: lista los equipos administrados (`selectAdministeredTeams`) con el mismo tratamiento visual que ya usa `TeamsMenu`/`TeamsAccordion` (card por equipo, link a su detalle) más un botón "Crear equipo" — envuelta en `RequireAuth`.

- **`app-web-shell.jsx` (shell ancho)**: `TeamsTab` se separa en dos `Pressable` adyacentes — uno con ícono+label que navega a `/teams` (`router.push`), otro solo con la flechita que sigue abriendo/cerrando el `TeamsMenu` dropdown (comportamiento actual, sin cambios).
- **`app-web-shell-narrow.jsx`/`app-mobile-shell.jsx` (shells angostos)**: no se separa el tap-target del acordeón (touch, no hover — dividir ahí es más frágil). En cambio, `teams-accordion.jsx` suma una fila más "Ver todos los equipos" al lado de la fila "Crear equipo" ya existente, que navega a `/teams`.

### 5. Menú de equipos (shell ancho) — sacar el parpadeo vacío

`app-web-shell.jsx#TeamsMenu` hace `fetchTeams()` en su propio mount — pero `TeamsMenu` solo se monta cuando se abre el dropdown (`teamsMenuOpen`), a diferencia de `app-web-shell-narrow.jsx`/`app-mobile-shell.jsx`, que YA hacen `fetchTeams()` al montar el shell entero (nivel más alto, `AppWebShellNarrow`/`AppMobileShell`), no el submenu — confirmado leyendo los 3 archivos, el shell ancho es el único inconsistente. Se mueve el `fetchTeams()` de `TeamsMenu` a `AppWebShell` (incondicional, mismo lugar/momento que los otros dos shells) — con eso alcanza para eliminar el parpadeo en la enorme mayoría de los casos (ya cargado para cuando se abre el menú por primera vez). Se suma además un estado de loading sutil (spinner chico) dentro de `TeamsMenu` para el caso residual (red lenta, primera apertura antes de que resuelva) en vez de mostrar "Todavía no tenés equipos." mientras carga.

## Tests

- `__tests__/normalizers.test.js`: `toInvitationModel`.
- `__tests__/invitations-mock.test.js` (nuevo): mismo estilo que `groups-mock.test.js`.
- `__tests__/team-store.test.js`: reescribir tests de invitaciones (`addInvitedEmails` → `fetchInvitations`/`sendInvite`), actualizar tests de `createTeam` que ya no reciben `invitedEmails`.
- `npm run lint`/`npm test` en verde en todo momento.

## Verificación

Por decisión explícita del usuario (2026-07-31, ver memoria `ask-before-browser-verification`), **esta etapa NO incluye verificación en browser por parte de los subagentes** — código + tests unitarios + lint alcanza como criterio de "listo" por tarea. Al terminar el plan completo, se entrega al usuario un script de prueba manual escrito (pasos concretos) para que lo corra él mismo en web y en la app nativa.

## Después de esta etapa

Gaps nuevos a documentar en `docs/BACKEND_API_GAPS.md`: (a) sin forma de listar/consultar invitaciones del lado del invitado, (b) `POST /teams/{id}/invite` no acepta grupo. Con esto, "Invitaciones" queda funcionalmente cerrada del lado del dueño de equipo — la vista del invitado y la asignación de grupo al invitar dependen de que backend sume soporte.
