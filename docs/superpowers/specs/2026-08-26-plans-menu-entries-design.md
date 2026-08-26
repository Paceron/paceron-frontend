# Entradas de menú "Mis planes" / "Planes de entrenamiento" — Design

**Fecha:** 2026-08-26
**Estado:** Aprobado, implementado (pedido corto en el chat, sin plan formal separado)

## Contexto

Pedido: dos entradas de menú nuevas — "Mis planes" para corredor,
"Planes de entrenamiento" para entrenador. El dominio de planes de
entrenamiento sigue siendo un módulo reservado (`FUNCTIONAL_PROPOSE.md`),
así que las pantallas de destino son "Próximamente", mismo patrón que ya
usa `TierUpgradeScreen`.

## Alcance de esta spec

`routes/catalog.js` (dos rutas nuevas + filtro real por rol),
`components/shell/app-web-shell.jsx`, `app-web-shell-narrow.jsx`,
`app-mobile-shell.jsx` (pasan `activeRole` en vez de un `user.role`
muerto), `components/plans/my-plans-screen.jsx`,
`components/plans/training-plans-screen.jsx` (nuevos),
`app/(tabs)/plans/index.jsx`, `app/(tabs)/training-plans/index.jsx`
(nuevos), `__tests__/routes.catalog.test.js`.

## Decisiones

### `getRoutesByRole` pasa a filtrar de verdad — bug de paso encontrado y arreglado

`getRoutesByRole(role)` existía desde el principio del catálogo de rutas
pero era un no-op (`return navigationRoutes` sin usar `role`, con un
comentario "a medida que se agreguen módulos, filtrar por rol acá").
Los 3 shells ya le pasaban `user?.role ?? null` — pero `user.role` nunca
se seteó en ningún lado (`toUserModel` en `services/normalizers.js` no
tiene ese campo), así que siempre era `undefined`. Al necesitar filtrar
de verdad por primera vez, esto salió a la luz. Se corrigió pasando
`activeRole` (de `useAuthStore`, el rol que se está viendo *ahora*, no
un rol "del usuario" estático) — mismo criterio que ya usan
`canManageTeam`/`isTrainerView` en el resto de la app. Cada `route`
ahora puede declarar un `role: 'runner' | 'trainer'` opcional; sin ese
campo, la ruta se muestra siempre (home, equipos, invitaciones no
cambian). Con `role`, solo se muestra cuando coincide con el
`activeRole` actual — así las dos entradas nuevas cambian solas al
switchear de rol con `RoleSwitchToggle`, sin lógica extra en los shells
(el `.filter()` genérico ya alcanza, no hizo falta tocar el loop de
renderizado de ninguno de los 3 — ambas caen en el mismo camino
genérico que ya usa "Invitaciones", no en el branch especial que tiene
"Equipos" para su submenú).

### Pantallas "Próximamente", mismo patrón que `TierUpgradeScreen`

Sin dominio de planes de entrenamiento implementado todavía. En vez de
un toast o dejar el link roto, cada ruta apunta a una pantalla real con
header (volver + título), un `SectionCard` con una descripción corta de
qué va a hacer, y el mismo pill "Próximamente" (`clock-outline`,
`bg-slate-100`) que ya usa `TierUpgradeScreen` para "Mejorar tier".

### Dos pantallas separadas, no una sola parametrizada

"Mis planes" (corredor, ve lo que le asignó su entrenador) y "Planes de
entrenamiento" (entrenador, arma/gestiona planes para sus equipos) son
conceptos distintos aunque hoy muestren el mismo placeholder — se
separaron en dos componentes (`MyPlansScreen`/`TrainingPlansScreen`) en
vez de una sola pantalla con el texto condicional por rol, para no tener
que deshacer esa fusión el día que cada una tenga contenido real
(seguramente muy distinto entre sí).

## Fuera de alcance

Contenido real de planes de entrenamiento (crear, asignar, ver
detalle — todo el dominio sigue reservado), cualquier lógica de
negocio en las pantallas nuevas más allá del placeholder.

## Verificación

Loguearse como corredor (rol activo `runner`) → el menú (web ancho, web
angosto, mobile) muestra "Mis planes", no "Planes de entrenamiento";
tocarlo lleva a `/plans` con la pantalla "Próximamente". Activar
entrenador y switchear a `trainer` → el menú cambia solo a "Planes de
entrenamiento" (`/training-plans`), "Mis planes" desaparece. Sin rol
activo definido, ninguna de las dos aparece; Inicio/Equipos/Invitaciones
siguen mostrándose siempre.

`npm test` → 201/201. `npm run lint` → limpio (1 warning preexistente
sin relación).
