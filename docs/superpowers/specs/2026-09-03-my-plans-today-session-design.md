# "Mis planes" — plan actual y sesión de hoy

## Contexto

Pedido del usuario, verbatim: *"Vamos a incorporar una nueva
funcionalidad, marcar un plan como actual. Solo dos planes pueden ser
marcados como actuales. Si un plan esta marcado como actual la sesión
del dia de hoy aparece en la parte superior de la sección mis planes.
Hacelo muy atractivo, es lo primero que tiene que ver una persona
cuando entre a 'Mis planes'. En mobile podes scrollear horizontalmente
para moverte entre sesiones del dia de hoy para los dos planes, en web
es con flechas. Bajo de todo eso, deberias poder ver todos los planes
asignados a vos, cuanto le queda de vigencia, y al hacer
click/presionar deberias poder visualizar detalles del plan."*

`MyPlansScreen` (`components/plans/my-plans-screen.jsx`) hoy es solo
una lista plana de planes asignados. Esta spec la reordena en dos
secciones: el hero de "sesión de hoy" arriba, la lista completa abajo
(ya existía, se le suma la vigencia).

## "Plan actual" — modelo de datos

Concepto 100% nuevo, sin equivalente en el schema SQL de referencia ni
en el backend (mismo estado que el resto del dominio de planes — ver
`docs/BACKEND_API_GAPS.md` gap 4, esto entra ahí también). Es una
preferencia del corredor sobre CUÁLES de sus planes ya asignados
destacar, no cambia la asignación en sí.

- Relación nueva `(userId, planId)`, análoga a
  `mockRunnerPlanAssignments` en `services/__mocks__/training-plans-mock.js`
  (mismo archivo, mismo criterio) — `mockCurrentPlanMarks`.
- Tope de 2 por corredor. Se hace cumplir en el mock
  (`mockMarkPlanAsCurrent` tira si ya hay 2 y no está marcando uno que
  ya estaba) — no solo en la UI, mismo criterio defensivo que
  `validatePlanDays`.
- Servicios nuevos en `services/trainingPlans.js`:
  `listCurrentPlanMarks({ userId })`, `markPlanAsCurrent(userId, planId)`,
  `unmarkPlanAsCurrent(userId, planId)` — mismo patrón `USE_MOCKS`.
- Store: `training-plan-store.js` suma `myCurrentPlanIds: []`,
  poblado dentro de `fetchMyPlans` (mismo fetch, no uno aparte — ya
  trae `userId` y ya se llama al entrar a la pantalla), más
  `markCurrentPlan(userId, planId)` / `unmarkCurrentPlan(userId, planId)`.

**Marcado/desmarcado**: un ícono de estrella en cada fila de
`MyPlanRow` (lista de abajo, ver más adelante) — tildada si está
marcado. Al tope (2 marcados) las no-marcadas se deshabilitan
visualmente (opacity), tocar una deshabilitada no hace nada silencioso
— explica por qué con un `Toast` ("Ya tenés 2 planes marcados como
actuales — desmarcá uno primero"). Desmarcar siempre está habilitado.

## Resolver "la sesión de hoy" de un plan

Un plan no sabe de antemano cuál de sus 7 días es "hoy" — se resuelve
en el momento contra `new Date()`. Hook nuevo
`hooks/use-today-plan-session.js`:

1. Mapea `new Date().getDay()` (0=domingo) al `dayOfWeek` del dominio
   (`monday`..`sunday`).
2. Busca `plan.days.find(d => d.dayOfWeek === today)`.
3. Si `day.kind === 'training'`: pide `getSession(day.sessionId)` y
   los 3 `getExercise(...)` de warmup/main/cooldown — **por id
   puntual**, no vía `useSessionStore`/`useExerciseStore` (esos stores
   guardan un solo array plano por owner y lo pisan en cada fetch; acá
   puede haber dos planes de **dos entrenadores distintos** a la vez —
   traer de a uno por id evita ese choque sin tener que rediseñar los
   stores compartidos para soportar multi-owner).
4. Si `day.kind !== 'training'` (rest/marathon/other): no hay nada que
   pedir, se devuelve el día tal cual para que el hero muestre la
   variante temática (ver abajo) — un plan marcado como actual sigue
   apareciendo en el hero aunque hoy le toque descanso, no desaparece.

Devuelve `{ loading, day, session, warmupExercise, mainExercise,
cooldownExercise }`. Un hook por plan actual (hasta 2 instancias
viven en paralelo en el hero, una por card).

## El hero — `TodaySessionHero`

`components/plans/today-session-hero.jsx`, montado arriba de todo en
`MyPlansScreen`, antes de la lista completa. Tres estados según
`myCurrentPlanIds.length`:

- **0 marcados**: card de invitación — ilustra el feature ("Marcá
  hasta 2 planes como actuales para ver acá la sesión de hoy apenas
  entrás") con una flecha hacia la lista de abajo. No se oculta del
  todo — es la primera vez que alguien entra y hoy no hay nada
  marcado, tiene que enterarse de que existe.
- **1 marcado**: una sola card, sin controles de navegación (nada que
  navegar).
- **2 marcados**: carrusel de 2 cards.
  - **Mobile (`!isWeb`)**: `ScrollView horizontal` con
    `pagingEnabled`/snap, gesto táctil nativo — pedido explícito.
  - **Web (`isWeb`, cualquier ancho)**: una card a la vez + flechas
    prev/next a los costados — pedido explícito ("en web es con
    flechas"), más puntos indicadores debajo (común a las dos
    plataformas, útil para saber en cuál de las 2 se está parado).

**`TodaySessionCard`** (`components/plans/today-session-card.jsx`,
sub-componente del hero) — "muy atractivo" se traduce en: fondo con
gradiente en el verde primario de marca, tipografía Orbitron para el
título (mismo criterio que headers de pantalla), ícono/color por tipo
de día (`DAY_KIND_META`) o por ejercicio (`EXERCISE_KIND_META`) igual
que el resto del módulo — no una paleta nueva, la personalidad "estilo
gimnasio" que ya tiene `training-plan-detail-screen.jsx` se reusa acá,
más grande y como protagonista en vez de una fila más en una lista.
Header: nombre del plan + "Hoy, {día}". Cuerpo: si es día de
entrenamiento, entrada en calor / principal / vuelta a la calma como
filas grandes con ícono de color (repeat count del bloque principal
incluido); si es descanso/maratón/otra actividad, un estado temático
simple (ícono + label grande, `DAY_KIND_META`). Footer: CTA "Ver plan
completo" → `/plans/{id}`.

## Lista completa — vigencia

`getPlanDaysRemaining(plan)` nuevo en `training-plan-store.js`, mismo
criterio de cálculo que `getPlanStatus` (createdAt + durationDays)
pero devolviendo días enteros restantes (0 si ya venció, no negativo).
`MyPlanRow` suma esto al texto ya existente: "Activo · quedan 4 días"
en vez de solo "Activo". Sin cambios al comportamiento de click
(sigue yendo a `/plans/{id}`) — se le suma la estrella de marcar/
desmarcar actual, descripta arriba.

## Datos de ejemplo

El seed de `training-plans-mock.js` solo tenía 1 plan, y ninguno
asignado al corredor demo (`user_id: 1`) — el hero quedaría vacío en
un demo fresco. Se agrega un 2do plan sembrado ("Series y velocidad —
nivel intermedio", reusando sesiones existentes) y se asigna el
**primero** al usuario demo vía asignación individual, marcado como
actual por default — así el hero se ve poblado (card sola, sin
carrusel) desde el primer `npm run web`, sin marcar nada a mano.

**El 2do plan queda sembrado pero sin asignar al demo.** Se evaluó
asignárselo también (para que el demo arranque mostrando el carrusel
de 2 completo) pero no hay forma honesta de lograrlo con los datos
sembrados hoy: una 2da asignación individual violaría la regla real
del dominio ("un corredor tiene una sola asignación individual activa
a la vez"), y la vía de grupo no sirve porque
`fetchMyMemberTeams` excluye explícitamente los equipos que el usuario
administra (`team.ownerId !== userId`) — el demo no puede ser
"miembro" de un equipo propio a los efectos de este fetch, y no
administra ningún otro equipo con un plan propio para asignar. Probar
el carrusel de 2 cards queda documentado como paso manual: crear un
2do corredor de prueba, agregarlo como miembro real de un equipo
ajeno, y asignarle ambos planes (uno individual, uno de grupo) desde
ahí — o, más simple, marcar dos plans_id a mano contra
`mockCurrentPlanMarks` en una sesión de test.

## Fuera de alcance (esta entrega)

- Notificaciones/recordatorios de la sesión de hoy.
- Marcar como completada una sesión del día (checkbox de progreso) —
  dominio de "registro y seguimiento de actividades" todavía no
  arrancado (`FUNCTIONAL_PROPOSE.md`).
- Que el entrenador vea qué corredores marcaron su plan como actual.
