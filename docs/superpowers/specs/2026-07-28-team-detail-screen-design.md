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
en los equipos mock, exporta `TRAINING_PLAN_OPTIONS`),
`components/team/create-team-screen.jsx` (importa `TRAINING_PLAN_OPTIONS`
del store en vez de definirlo localmente), los tres shells
(`handleSelectTeam` navega en vez de mostrar toast),
`__tests__/team-store.test.js`.

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

### Estructura: 3 pestañas en web, todo apilado en mobile

La pantalla se organiza en 3 secciones — **Información general y
estadísticas**, **Corredores**, **Grupos** — y en web (`isWeb`) se
navegan como pestañas (mismo tratamiento visual que los tabs del header
web: `bg-primary-tint-subtle` + texto `primary` cuando está activa). En
mobile no hay pestañas — las 3 secciones van apiladas en la misma
pantalla, en el mismo orden, sin navegación extra (una pantalla larga se
scrollea bien en mobile; en web separarlas evita un scroll gigante).
Header (foto, nombre, estado, ubicación) queda siempre visible arriba de
las pestañas/secciones, no es parte de ninguna.

### Filtros viven en la sección/pestaña "Corredores", no aparte

Los 3 filtros (buscar corredor, grupo, período) se movieron adentro de la
card "Corredores" — no tienen su propia sección — porque conceptualmente
existen para acotar lo que se ve ahí. Efecto real de cada uno:

- **Corredor** (buscador por nombre) y **grupo** (combobox) filtran de
  verdad la lista de corredores mostrada y el conteo de "Corredores" en
  las estadísticas — filtrado client-side sobre el roster mock.
- **Período** (semana/mes/todo) solo afecta "Entrenamientos realizados" y
  "Objetivos cumplidos", que viven en la pestaña "Información general y
  estadísticas" — no hay un modelo de actividades con fecha real
  (`FUNCTIONAL_PROPOSE.md`: "Registro y seguimiento de actividades"
  reservado todavía), así que esas dos métricas son una tabla mock fija
  por período (`MOCK_METRICS_BY_PERIOD`), no un cálculo real. Queda en el
  filtro de Corredores en vez de en Información general porque así lo
  pidió el usuario — el estado del filtro persiste al cambiar de pestaña
  (vive en `TeamDetailScreen`, no en cada pestaña), así que cambiarlo y
  volver a "Información general" sí se ve reflejado ahí.

### Pestaña "Grupos"

Lista cada grupo del equipo (incluido "Sin grupo") con cantidad de
corredores asignados (calculada del roster mock) y el plan de
entrenamiento asignado, si tiene. `TRAINING_PLAN_OPTIONS` se movió de
`create-team-screen.jsx` a `store/team-store.js` (exportado) para que
esta pestaña pueda resolver el nombre del plan sin duplicar el catálogo
mock en dos archivos — `create-team-screen.jsx` ahora lo importa desde
ahí en vez de tener su propia copia.

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
invitación y pasar a formar parte del roster), crear/editar grupos desde
la pestaña Grupos (por ahora es de solo lectura).

## Verificación

`EXPO_PUBLIC_USE_MOCKS=true`, loguearse, abrir "Equipos" y elegir
cualquiera de los 3 equipos mock (o uno creado con el wizard) → navega a
`/equipos/[teamId]` con header (foto, nombre, estado, ubicación) fijo
arriba de 3 pestañas en web (apiladas en mobile): Información general y
estadísticas, Corredores, Grupos. En "Corredores": buscar por nombre y
filtrar por grupo actualiza la lista y el conteo de "Corredores" en la
otra pestaña; cambiar el período solo cambia las otras dos métricas ahí.
"Grupos" muestra cada grupo con su cantidad de corredores y plan
asignado (o "Sin plan asignado"). Un `teamId` inexistente muestra el
estado "No encontramos este equipo" con botón de volver.

`npm test` → 47/47. `npm run lint` → limpio.
