# Privacidad de corredores en la pantalla de equipo — Design

**Fecha:** 2026-07-28
**Estado:** Aprobado, implementado (requisitos charlados y aprobados en el chat, sin plan formal separado)

## Contexto

Hasta ahora, cualquiera que viera el detalle de un equipo veía lo mismo:
roster completo (nombre, email, grupo, estado de suscripción) y la
pestaña Grupos entera. Eso incluía a un corredor común viendo el equipo
del que forma parte — un compañero de equipo no debería poder ver el
email o el estado de suscripción de los demás, ni necesariamente a qué
grupo pertenece cada uno.

## Alcance de esta spec

`store/team-store.js` (`showGroupsToRunners` en cada equipo),
`components/team/team-detail-screen.jsx` (vista reducida de
`RunnerRow`, pestaña Grupos oculta, filtros condicionados),
`components/team/edit-team-screen.jsx` (checkbox nuevo),
`components/forms/section-card.jsx` (`headerRight`, ver spec de
invitaciones para el detalle de ese cambio puntual).

## Decisiones

### Qué ve un corredor común vs. quien gestiona el equipo

`isTrainerView = activeRole === 'trainer'` (mismo criterio que
`canManageTeam` en el resto de la pantalla, pero sin el `hasTrainerRole`
extra — lo que importa acá es cómo se está viendo la app *ahora*, no si
el usuario tiene el rol en algún lado). Cuando `isTrainerView` es falso:

- **Pestaña/sección Grupos**: oculta por completo, sin excepción — se
  saca del array de tabs (`visibleTabs`) y del stack de mobile. No hay
  toggle que la vuelva a mostrar para corredores.
- **Fila de corredor (`RunnerRow`)**: layout distinto y mucho más chico
  — solo avatar, nombre y antigüedad (`SeniorityLine`, factorizado como
  componente aparte porque ahora lo usan las dos variantes de
  `RunnerRow`). Sin email, sin tag de suscripción. El tag de grupo
  aparece **solo si** `team.showGroupsToRunners` está prendido (ver
  abajo). Al ser tan poco contenido, esta variante no tiene card
  expandible en mobile — un layout único alcanza en las dos plataformas,
  a diferencia de la vista completa (`RunnerRow` no-restringida), que
  sigue expandible en mobile como ya estaba.
- **Filtro "Buscar corredor"**: solo matchea contra nombre, no contra
  email (el email ya no es visible, no tiene sentido poder buscar por
  algo que no se ve). Placeholder cambia de "Nombre o email del
  corredor" a "Nombre del corredor".
- **Filtro "Grupo"**: se oculta junto con el tag de grupo (mismo
  criterio `canSeeGroups`, ver abajo) — dejar filtrar por grupo sin
  poder ver el grupo de cada corredor sería una fuga de la misma
  información por otra vía.

### `showGroupsToRunners`: toggle nuevo, vive en "Editar equipo"

Campo booleano por equipo, default `false` (privado por default — el
entrenador tiene que habilitarlo explícitamente). Controla **solo** el
tag de grupo en la fila de corredor para la vista de corredor común — no
la pestaña Grupos completa, que sigue oculta pase lo que pase.

Se agregó como checkbox (`Pressable` + cuadradito + check, no hay
componente de checkbox reusable en el repo todavía — se armó inline en
`EditTeamScreen`, no ameritaba extraerlo para un solo uso) dentro de una
card nueva "Privacidad" en `EditTeamScreen`, **no** en el wizard de
creación (`CreateTeamScreen`) — pedido explícito del usuario, y además
`useTeamGeneralInfoForm`/`TeamGeneralInfoFields` son compartidos por
ambas pantallas, así que meterlo ahí lo hubiera expuesto también al
crear. `createTeam` lo inicializa en `false` para equipos nuevos;
`team-1` (mock) lo tiene en `true` para poder probar las dos variantes
del tag de grupo sin tocar nada a mano.

### `canSeeGroups`, no solo `isTrainerView`

`canSeeGroups = isTrainerView || team.showGroupsToRunners` — separado de
`isTrainerView` porque tiene una fuente extra (el toggle). Se usa para
el tag de grupo en `RunnerRow` restringido y para mostrar/ocultar el
filtro "Grupo". Quien gestiona el equipo (`isTrainerView`) siempre ve
todo, con o sin el toggle — el toggle solo amplía lo que ve un corredor
común, nunca restringe al entrenador.

## Fuera de alcance

Un componente `Checkbox` reusable (se armó inline, un solo uso hoy no
justifica extraerlo — ver comentario en `EditTeamScreen`), permisos más
finos que "ve todo" / "ve nombre y antigüedad nada más" (ej. mostrar
suscripción pero no email), ocultar información en la pestaña
Información general (estadísticas agregadas siguen visibles para
cualquiera).

## Verificación

`EXPO_PUBLIC_USE_MOCKS=true`, loguearse, activar rol entrenador y
switchear a corredor (o loguearse con un usuario sin rol entrenador) →
abrir el detalle de "Corredores del Sur" (`team-1`, `showGroupsToRunners:
true`): no aparece la pestaña/sección Grupos; en Corredores, cada fila
muestra nombre + antigüedad + tag de grupo (por el toggle prendido en
este equipo), sin email ni suscripción; el filtro sigue teniendo
"Grupo" visible. En "Running Cordoba Norte" (`team-2`,
`showGroupsToRunners: false`) la misma vista de corredor no muestra el
tag de grupo ni el filtro "Grupo". Volviendo a entrenador activo,
`/equipos/team-1/editar` muestra la card "Privacidad" con el checkbox
prendido — destildarlo y guardar hace que el tag de grupo desaparezca
de la vista de corredor en `team-1` también.

`npm test` → 54/54. `npm run lint` → limpio.
