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

Los filtros (buscar corredor, grupo) se movieron adentro de la card
"Corredores" — no tienen su propia sección — porque conceptualmente
existen para acotar lo que se ve ahí. **Corredor** (buscador por nombre)
y **grupo** (combobox) filtran de verdad la lista de corredores mostrada
y el conteo de "Corredores" en las estadísticas — filtrado client-side
sobre el roster mock.

El filtro de **período** que existió en una primera versión se sacó por
completo — no había un modelo de actividades con fecha real detrás
(`FUNCTIONAL_PROPOSE.md`: "Registro y seguimiento de actividades" sigue
reservado), así que era un selector sin efecto real más allá de swapear
una tabla mock fija. "Entrenamientos realizados" y "Objetivos cumplidos"
(pestaña "Información general y estadísticas") quedan como valores mock
fijos (`MOCK_TEAM_METRICS`) hasta que exista ese dominio.

### Pestaña "Grupos"

Lista cada grupo del equipo (incluido "Sin grupo") con cantidad de
corredores asignados (calculada del roster mock) y el plan de
entrenamiento asignado, si tiene. `TRAINING_PLAN_OPTIONS` se movió de
`create-team-screen.jsx` a `store/team-store.js` (exportado) para que
esta pestaña pueda resolver el nombre del plan sin duplicar el catálogo
mock en dos archivos — `create-team-screen.jsx` ahora lo importa desde
ahí en vez de tener su propia copia.

### Tags por corredor: grupo y estado de suscripción (no nivel)

Cada fila de corredor muestra 2 tags: grupo asignado y estado de
suscripción. El nivel (amateur/semi-profesional/profesional) es un
atributo del **equipo**, no de cada corredor individualmente — una
primera versión lo mostraba también por corredor (mock round-robin
sobre `RUNNER_LEVELS`), pero no tenía sentido de dominio, así que se
sacó por completo: `RUNNER_LEVELS` se borró de `store/team-store.js` y
`generateMockMembers` ya no genera ese campo en los miembros mock. Grupo
usa un tratamiento neutro (gris) — es una etiqueta categórica, ni buena
ni mala. Solo el estado de suscripción usa semáforo de color
(verde/rojo/ámbar), porque es el único con urgencia real (un corredor
vencido es un problema a resolver).

### Fila de corredor en mobile: card expandible

En web los tags (grupo, suscripción) entran cómodos al lado del nombre.
En mobile, con menos ancho disponible, llegaban a tapar el nombre del
corredor en algunas filas. `RunnerRow` pasa a tener dos variantes
(`isWeb`): en web se mantiene igual (fila fija, todo
visible); en mobile es una card colapsada por default que solo muestra
nombre + tag de suscripción (el único con urgencia real) + chevron —
tocarla expande una fila con el grupo debajo. El estado de expandido es
local a cada fila (no vive en `TeamDetailScreen`), así que expandir un
corredor no afecta a los demás.

### Email del corredor: debajo del nombre, y también se busca por él

`generateMockMembers` (`store/team-store.js`) suma `email` a cada
corredor mock (`nombre.apellido@mail.com`, sin tildes —
`slugifyForEmail` hace el reemplazo a mano en vez de depender de
`String.prototype.normalize`, para no asumir soporte Unicode completo
en todos los motores JS de las plataformas del proyecto). `RunnerRow`
muestra el email en una segunda línea chica debajo del nombre, en las
dos variantes (web y mobile). El filtro "Buscar corredor" en la pestaña
Corredores ahora matchea contra nombre **o** email (antes solo nombre).

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
otra pestaña. "Grupos" muestra cada grupo con su cantidad de corredores
y plan asignado (o "Sin plan asignado"). Un `teamId` inexistente muestra
el estado "No encontramos este equipo" con botón de volver. En mobile,
cada fila de corredor arranca colapsada (nombre + suscripción) y se
expande al tocarla mostrando el grupo.

`npm test` → 49/49. `npm run lint` → limpio.
