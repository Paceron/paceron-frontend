# Pantalla de detalle de equipo — Design

**Fecha:** 2026-07-28
**Estado:** Aprobado, implementado (sin plan formal separado — requisitos charlados y aprobados en el chat antes de escribir código)

## Contexto

Elegir un equipo desde el menú de Equipos (web ancho, web angosto y
mobile) mostraba un toast "en construcción". Pasa a navegar a una
pantalla real de detalle, `/equipos/[teamId]`.

## Alcance de esta spec

`app/(tabs)/equipos/[teamId].jsx` (nuevo, ruta dinámica),
`components/team/team-detail-screen.jsx` (nuevo), `store/team-store.js`
(agrega `status` a los equipos, roster mock de corredores, grupos reales
en los equipos mock), los tres shells (`handleSelectTeam` navega en vez
de mostrar toast), `__tests__/team-store.test.js`.

## Decisiones

### Roster de corredores: mock generado, no ligado a las invitaciones

No existe todavía el concepto de "corredor miembro de un equipo" más allá
de las invitaciones por email (que son una intención de invitar, no una
membresía confirmada — no hay flujo de aceptación). `store/team-store.js`
genera un roster mock determinista (`generateMockMembers`) para **todo**
equipo — los 3 mock existentes y cualquiera creado con el wizard —
repartido entre los grupos reales del equipo (incluido el grupo default
"Sin grupo"). Cada corredor mock tiene `id`, `name`, `level`,
`subscriptionStatus` y `groupId`.

### Estado de suscripción: mock, mismos 3 valores que la propuesta funcional

`SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba']` — no existe
el dominio de suscripciones/cobros (`FUNCTIONAL_PROPOSE.md` lo lista como
módulo reservado), pero ya define esos tres estados, así que se reusan en
vez de inventar otros. Los colores del tag (`SUBSCRIPTION_META` en la
pantalla) copian el patrón `STATUS_META` que ya usa `profile-screen.jsx`
para el estado de la cuenta — mismo criterio visual, no una paleta nueva.

### Estado del equipo (activo/inactivo)

Campo nuevo `team.status`. Todo equipo (mock o creado con el wizard)
arranca en `'activo'` — el wizard no expone un control para elegirlo
(no se pidió), así que hoy es siempre el valor por default.

### Header: ubicación real, no solo texto

Usa `getCountryName`/`getProvinceName` de `data/locations.js` (mismos
helpers que `profile-screen.jsx`) para mostrar la ubicación cargada en el
wizard (ver PR #57, cascada país/provincia/localidad) como una sola línea
legible ("La Plata, Buenos Aires, Argentina"), no los códigos crudos.

### Filtros: corredor y grupo filtran la lista real; período solo las métricas

- **Corredor** (buscador por nombre) y **grupo** (combobox) filtran de
  verdad la lista de corredores mostrada y el conteo de "Corredores" en
  las estadísticas — filtrado client-side sobre el roster mock.
- **Período** (semana/mes/todo) solo afecta "Entrenamientos realizados" y
  "Objetivos cumplidos" — no hay un modelo de actividades con fecha real
  (`FUNCTIONAL_PROPOSE.md`: "Registro y seguimiento de actividades"
  reservado todavía), así que esas dos métricas son una tabla mock fija
  por período (`MOCK_METRICS_BY_PERIOD`), no un cálculo real. No tiene
  sentido que el período filtre el roster (la membresía no es algo que
  "pasó en una fecha").

### Tags por corredor: nivel, grupo y estado de suscripción

Cada fila de corredor muestra 3 tags: nivel (mismo catálogo que el nivel
del equipo), grupo asignado, y estado de suscripción. Nivel y grupo usan
un tratamiento neutro (gris) — son etiquetas categóricas, no buenas ni
malas. Solo el estado de suscripción usa semáforo de color (verde/rojo/
ámbar), porque es el único de los tres con urgencia real (un corredor
vencido es un problema a resolver).

## Fuera de alcance

Edición del equipo desde esta pantalla, botones "Ver plan"/"Ver
estadísticas" por grupo y "mover de grupo" por corredor (eso viene del
diseño hecho con Stitch, todavía no implementado), backend real de
equipos/suscripciones/entrenamientos, alta real de miembros (aceptar una
invitación y pasar a formar parte del roster).

## Verificación

`EXPO_PUBLIC_USE_MOCKS=true`, loguearse, abrir "Equipos" y elegir
cualquiera de los 3 equipos mock (o uno creado con el wizard) → navega a
`/equipos/[teamId]` con header (foto, nombre, estado, ubicación),
sección "Sobre el equipo" (descripción, requisitos), filtros, 3 stat
tiles y la lista de corredores con sus 3 tags. Buscar por nombre y
filtrar por grupo actualiza la lista y el conteo de corredores; cambiar
el período solo cambia las otras dos métricas. Un `teamId` inexistente
muestra el estado "No encontramos este equipo" con botón de volver.

`npm test` → 47/47. `npm run lint` → limpio.
