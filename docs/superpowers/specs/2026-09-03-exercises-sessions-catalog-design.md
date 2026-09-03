# Catálogo de sesiones y ejercicios — ABM completo

## Contexto

La enmienda 2026-08-26 de `docs/superpowers/specs/2026-08-26-training-plans-design.md`
convirtió ejercicios y sesiones en entidades de catálogo reusables
(`Exercise`, `Session`), pero dejó explícitamente fuera de alcance su
ABM completo: "el catálogo completo (editar/borrar ejercicios sueltos)
es 'otro menú' a futuro". Esta spec es ese menú.

Pedido del usuario, verbatim: *"Nueva feature, en la sección de Planes
de Entrenamiento, similar a lo que tenemos en la sección de
visualización de equipos que tenemos pestañas, tenemos que tener tres
pestañas: Planes, Sesiones y Ejercicios. Y poner los ABMs de sesión de
ejercicios ahí, como también poder visualizar sesiones y ejercicios
existentes."*

## Decisiones (confirmadas con el usuario)

**Pestañas en ambas plataformas.** A diferencia de `TeamDetailScreen`
(pestañas solo en web, mobile apila las 3 secciones), acá Planes/
Sesiones/Ejercicios son catálogos independientes que pueden crecer —
apilar los 3 en mobile sería un scroll larguísimo para llegar a
"Ejercicios". Se extrae el componente `TabBar` de
`team-detail-screen.jsx` a `components/shared/tab-bar.jsx` (ya no es
exclusivo de una pantalla) y se usa en ambas pantallas — en equipos
sigue solo-web (sin cambios de comportamiento ahí), acá siempre visible.

**Borrado de un ejercicio/sesión en uso**: no se bloquea, pero tampoco
es silencioso. Verbatim del usuario: *"Quiero que se le avise al
entrenador que si borra la sesión/ejercicio todas las sesiones/planes
(según corresponda) en los que se encuentre ese elemento, ese elemento
va a dejar de existir. Y que tenga que marcar una casilla confirmando
que entienden."* Si el elemento no está en uso, confirmación simple
(mismo patrón que `DeleteTrainingPlanModal`); si está en uso, el modal
lista dónde y exige un checkbox tildado antes de habilitar "Eliminar".

**Contador de uso en la fila + detalle al click**: cada fila de
ejercicio/sesión en el catálogo muestra "Usado en N sesiones/planes"
(0 se muestra sin remarcar, no como alerta). Click en el número abre
un modal con la lista de nombres. Sin navegación a esos planes/sesiones
en esta entrega — ver "Fuera de alcance".

**Alcance de "uso"**: directo, no transitivo. Un ejercicio se cuenta
por las sesiones que lo referencian (`warmupExerciseId`/
`mainExerciseId`/`cooldownExerciseId`), no por los planes que a su vez
usan esas sesiones. Una sesión se cuenta por los planes que la
referencian en algún día (`some(d => d.sessionId === id)`, deduplicado
por plan — si un plan la usa en 2 días cuenta como 1 plan). Ambos
catálogos son siempre del mismo `ownerId` (el entrenador logueado), así
que la cuenta es sobre `useExerciseStore`/`useSessionStore`/
`useTrainingPlanStore` ya cargados, sin fetch adicional.

## Modelo de datos y capa de servicio — sin cambios

`services/exercises.js` y `services/sessions.js` ya exponen
`get/create/update/delete` (real + mock, `USE_MOCKS`) desde que se
armó el catálogo — nunca tuvieron consumidor de update/delete hasta
ahora. `toExerciseModel`/`toCreateExercisePayload` y
`toSessionModel`/`toCreateSessionPayload` (`services/normalizers.js`)
se reusan tal cual para el payload de update (el PUT es parcial del
lado mock, pero mandar el form completo no rompe nada — mismo criterio
que el resto del proyecto, no hace falta un `toUpdateXPayload`
separado).

Lo que falta es pura capa de store + UI:

- `store/exercise-store.js`: agrega `updateExercise(exerciseId, form)`,
  `deleteExercise(exerciseId)`.
- `store/session-store.js`: agrega `updateSession(sessionId, form)`,
  `deleteSession(sessionId)`.

Mismo patrón `{ success, error }` que el resto de los stores.

## Componentes nuevos

- **`components/shared/tab-bar.jsx`**: `TabBar` extraído de
  `team-detail-screen.jsx`, sin cambios de estilo/comportamiento.
- **`components/plans/sessions-catalog-tab.jsx`**: lista de sesiones
  del entrenador. Cada fila: nombre, preview de ejercicios (warmup/
  main/cooldown, chips de color por tipo — mismo componente que ya
  usa `training-plan-form-fields.jsx`, se extrae a
  `components/plans/session-exercises-preview.jsx` para no duplicarlo),
  "Usado en N planes" clickeable, botones Editar/Borrar. Header con
  botón "Crear sesión" (mismo `CreateSessionModal`, ahora también con
  modo edición).
- **`components/plans/exercises-catalog-tab.jsx`**: análogo para
  ejercicios — ícono/color por `kind` (`EXERCISE_KIND_META`), nombre,
  stat (minutos/distancia/velocidad), "Usado en N sesiones"
  clickeable, Editar/Borrar, botón "Crear ejercicio".
- **`components/plans/usage-list-modal.jsx`**: modal genérico,
  `{ visible, title, items /* [{id, name}] */, onClose }` — lista de
  nombres, sin navegación (ver Fuera de alcance).
- **`components/plans/delete-catalog-item-modal.jsx`**: modal genérico
  de borrado reusado por ambos catálogos —
  `{ visible, itemKind /* 'ejercicio'|'sesión' */, itemName, usageLabel /* 'sesiones'|'planes' */, usedIn /* [{id, name}] */, onCancel, onConfirm }`.
  `usedIn.length === 0` → confirmación simple. `usedIn.length > 0` →
  lista los nombres afectados + checkbox obligatorio antes de habilitar
  "Eliminar".

## Componentes modificados

- **`components/plans/training-plans-screen.jsx`**: pasa a ser el hub
  con `TabBar` (Planes/Sesiones/Ejercicios) + `activeTab` state. El
  contenido de "Planes" es el `PlanRow`/lista que ya existía, movido
  sin cambios de lógica a una función de contenido de esta misma
  pantalla (no se crea un archivo aparte para eso, ya vivía acá).
- **`components/plans/create-exercise-modal.jsx`**: prop opcional
  `exercise` — si viene, el modal arranca precargado con sus valores,
  título "Editar ejercicio", botón "Guardar cambios", y el submit llama
  `updateExercise(exercise.id, form)` en vez de `createExercise(form)`.
  Sin `exercise`, comportamiento idéntico al actual (modo alta).
- **`components/plans/create-session-modal.jsx`**: mismo patrón con
  prop opcional `session`.

## Fuera de alcance (esta entrega)

- Navegar desde el modal de "usado en" hacia el plan/sesión puntual —
  solo se listan los nombres, no son links. Si hace falta a futuro es
  una mejora chica y aislada (agregar `onPress` por item).
- Buscador/filtro dentro de los catálogos de sesiones/ejercicios (el
  de equipos tiene uno, pero el volumen esperado de ejercicios/sesiones
  por entrenador es bajo — se agrega si en la práctica hace falta).
- Video por ejercicio (`videoUrl` sigue siempre `null`, ya documentado
  como fuera de alcance en la spec original).
