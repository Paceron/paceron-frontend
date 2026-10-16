# Gamificación — Spec 1: Rachas (streaks)

> Primera de 4 specs del módulo de gamificación (rachas, logros/trofeos, leaderboards,
> competencias), todas sobre una sola rama `feature/gamification`. Fuente: doc maestro de
> gamificación (usuario, 2026-10-12) + `docs/BACKEND_API_GAPS.md` Gap 30 (consenso con backend,
> 2026-10-13). Esta spec construye además el **shell de pestañas del hub de Logros**
> (`achievements-screen.jsx`) y el **mecanismo compartido de punto rojo**, que las specs 2 y 4
> extienden sin rediseñarlos.

## Alcance

Incluye: las dos rachas (A estricta, B flexible), card de vista rápida en el Home, pantalla hub
con pestañas (arranca con una sola pestaña "Rachas"), grilla de días, mejor racha, ícono de
entrada "Logros" en header/sidebar/drawer con punto rojo, mecanismo de punto rojo reutilizable.

Fuera de alcance (specs futuras en la misma rama): pestañas Logros/Vitrina (Spec 2), pestaña
Leaderboard en team-detail (Spec 3), pestaña Competencias + reuse de session-runtime (Spec 4).

## Backend

`GET /users/{id}/streaks?days=42` → `{strict: {current, best}, flexible: {current, best}, days:
[{date, strict_status, flexible_status}]}`. Estados: `completed`/`failed`/`skipped`/`pending`
(hoy = `pending` hasta que termine el día, cálculo corre hasta ayer — Gap 30, confirmado
2026-10-13). Cálculo 100% server-side bajo demanda, sin tabla de rachas, sin recálculo por
mutación — cada `GET` es exacto por construcción.

## Archivos

**Nuevos:**
- `services/streaks.js` — `getStreaks(userId, days = 42)`.
- `hooks/use-streaks.js` — `useStreaks()`: TanStack Query sobre `services/streaks.js`,
  `queryKey: ['streaks', userId]`, lee `userId` de `useAuthStore`. Normaliza con
  `toStreaksModel(dto)` en `services/normalizers.js` (snake→camel, igual que el resto del repo).
- `hooks/use-gamification-badge.js` — mecanismo compartido de punto rojo. `useGamificationBadge()`
  devuelve `{hasUnseen, ackSection(section)}`. Internamente, por ahora, `hasUnseen =
  streaksQuery.data?.hasUnseen ?? false` (el único input cableado en esta spec); Specs 2 y 4 le
  agregan `achievements`/`competitions` al OR sin cambiar la firma pública. `ackSection('streaks')`
  llama `POST /users/{id}/gamification/seen {section: 'streaks'}` (Gap 34) e invalida la query de
  streaks para que `hasUnseen` baje sin esperar el próximo refetch natural.
- `utils/streak-day-status.js` — función pura `streakDayVisual(status)` → `{color, label}` para
  los 4 estados (`completed`=verde, `failed`=rojo, `skipped`=gris, `pending`=outline/neutro). Test
  en `__tests__/streak-day-status.test.js`.
- `components/home/streak-banner.jsx` — card del Home. Usa `useStreaks()`. Muestra racha A actual
  (número grande + "días", ícono `fire`), mejor racha debajo en texto chico, y una fila de puntos
  de los últimos 14 días (`days.slice(-14)`) usando `streakDayVisual`. Estados: loading (skeleton
  simple), error (texto corto + reintentar), vacío (nunca "vacío" per se — si `current=0` se
  muestra igual, es un valor válido, no un estado vacío).
- `app/(tabs)/achievements.jsx` — ruta, mismo patrón trivial que `app/(tabs)/notifications.jsx`
  (un solo `export default` delegando al componente).
- `components/achievements/achievements-screen.jsx` — shell del hub: header de pantalla + barra de
  pestañas (`useState` local para la pestaña activa, sin persistencia entre sesiones — no lo pide
  esta spec) + render de la pestaña activa. Arranca con un array `TABS` de un solo elemento
  (`{id: 'streaks', label: 'Rachas', icon: 'fire'}`); Spec 2 agrega los otros dos ítems al mismo
  array, sin tocar la mecánica del shell.
- `components/achievements/streaks-tab.jsx` — detalle completo: 2 tarjetas (racha A "Entrenamientos
  consecutivos" ícono `fire`, racha B "Días entrenando" ícono `calendar-check`), cada una con
  actual + mejor; debajo, grilla de 42 días (6 filas × 7 columnas, lunes a domingo) pintada con
  `streakDayVisual`, separada en 2 sub-grillas (racha A / racha B) o superpuesta con 2 indicadores
  por celda — **decisión de diseño visual, resuelta en implementación, no bloquea la spec** (ambas
  cumplen el requisito "marcar cada día con su estado de la racha A y/o B" del doc fuente).

**Tocados — ícono de entrada "Logros" (mismo patrón que "Notificaciones", 3 shells):**
- `components/shell/app-web-shell.jsx` (~L204-217) — nuevo `IconTooltip` + botón en `TopBar`,
  entre Notificaciones y el menú de usuario, mismo estilo (`MaterialCommunityIcons`, tamaño 20,
  badge rojo absoluto si `hasUnseen`). Ícono: `trophy-outline` para el botón de entrada (la pestaña
  interna de racha usa `fire`/`calendar-check`, el ícono de entrada al hub es uno solo, distinto).
- `components/shell/app-web-shell-narrow.jsx` (~L169-180) — fila en el drawer narrow, debajo de
  "Notificaciones", mismo layout (ícono 18px + label + badge absoluto).
- `components/shell/app-mobile-shell.jsx` (~L188-199) — fila en el drawer mobile, misma posición
  relativa a "Notificaciones".

Los 3 usan `useGamificationBadge().hasUnseen` para el punto; `onPress`/`router.push('/achievements')`.

**Tocados — Home:**
- `components/home/authenticated-home-screen.jsx` — agrega `<StreakBanner />` debajo de
  `<NextTrainingBanner />`. Sin gating por rol (la racha es "a nivel usuario", no por rol activo —
  mismo criterio que el resto del módulo).

## Estilos

- Card del Home: `bg-white dark:bg-surface`, `rounded-2xl`, `shadow-sm` — mismas clases que
  `NextTrainingBanner`/cards existentes, no un patrón nuevo.
- Número de racha: color primario (`text-primary` o token equivalente), tamaño grande (`text-4xl`
  o similar).
- Días semáforo: verde `completed`, rojo `failed`, gris `skipped`, outline/neutro `pending`.
- `fire`: animación reanimated de pulso sutil de escala en loop, **solo mobile** (`!isWeb`,
  estático en web) — mismo criterio ya documentado en el doc fuente para evitar trabajo extra en
  web donde no aporta.

## Toast de racha rota

Al detectar (client-side, comparando el `current` anterior cacheado por React Query contra el
nuevo tras un refetch) que una racha bajó a 0 habiendo sido >0 antes, mostrar un toast no punitivo
+ `notifyWarning()` (no `notifyError()` — no es un error del usuario, es información). Copy sugerido, con la fecha del día que cortó (el `days` más reciente en `failed` — dato que el
backend ya devuelve, no hace falta pedir nada más): *"Tu racha de entrenamientos consecutivos se
reinició el {fecha}. ¡A por una nueva!"* — tono neutro, sin culpa. Implementación vive en
`use-streaks.js` (compara `previousData` vía `placeholderData`/`select` de TanStack Query, no un
`useEffect` con `useRef` manual si la API de la librería ya lo da más simple).

## Responsive / plataformas

Card de Home y hub con pestañas: responsive-first (regla obligatoria del repo) — el hub a
cualquier ancho de viewport, pestañas en fila horizontal con scroll si no entran en mobile angosto
(mismo patrón que cualquier `TabBar` ya existente en el repo, ej. `team-detail-screen.jsx`).

## Testing

- `__tests__/streak-day-status.test.js` — los 4 estados → color/label correctos.
- `__tests__/use-gamification-badge.test.js` (si la lógica de OR/ack tiene suficiente ramificación
  para justificarlo una vez escrita; si es trivial, se cubre con el test del hook de streaks y no
  hace falta uno aparte — decisión en implementación).
- Sin tests de render de componentes (convención del repo) — verificación visual manual
  (preview web + device) del card, el hub, la grilla y el punto rojo en los 3 shells.

## Identificadores

Todo componente visual nuevo lleva `nativeID`/`testID` kebab-case (regla obligatoria, enforced por
`local/require-native-id`).
