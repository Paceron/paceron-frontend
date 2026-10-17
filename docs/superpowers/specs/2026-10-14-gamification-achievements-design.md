# Gamificación — Spec 2: Logros y trofeos (vitrina)

> Segunda de 4 specs del módulo de gamificación, sobre la misma rama `feature/gamification`
> (Spec 1 — Rachas — ya mergeada en esa rama). Fuente: doc maestro de gamificación (usuario,
> 2026-10-12) + `docs/BACKEND_API_GAPS.md` Gap 31 (consenso con backend, 2026-10-13, con una
> corrección de contrato aplicada 2026-10-14: `count` siempre viaja, también para logros con
> nivel). Extiende el hub `achievements-screen.jsx` y el mecanismo de punto rojo construidos en
> Spec 1, sin rediseñarlos.

## Alcance

Incluye: las 3 familias de logros (únicos, con niveles, contador), identidad visual de los 5
niveles (Chispa→Leyenda), trofeo post-Leyenda por acumulación, pestaña "Logros" (grilla con
progreso), pestaña "Vitrina" (estampas + trofeos de competencia, 2 sub-secciones), feedback de
desbloqueo (toast + haptics), card de vista rápida en el Home, y la extensión del punto rojo
compartido para esta sección.

Fuera de alcance (specs futuras en la misma rama): leaderboards (Spec 3), competencias (Spec 4,
que es quien emitirá los trofeos `type='competition'` que esta spec solo RENDERIZA en la vitrina
— el emisor real llega después, acá se construye el consumidor).

## Backend

- `GET /achievements/catalog` → `[{id, family: 'once'|'leveled'|'counter', name, description,
  icon_key, once_threshold?, levels?: [{level, name, threshold}], counter_trophy_every?}]`. Config
  estática, sin cambios por usuario.
- `GET /users/{id}/achievements` → `[{achievement_id, current_level?, count, unlocked_at,
  last_unlocked_at, has_unseen}]`. **`count` siempre presente** (corrección del 2026-10-14) — si
  llega `null`/ausente para un logro `leveled` (backend todavía sin el fix), el frontend oculta
  la barra de progreso de ESE ítem puntual y muestra solo el nivel, sin romper el resto de la
  pantalla.
- `GET /users/{id}/stamps` → `[{id, type: 'achievement_counter'|'post_legend'|'competition',
  source_id, source_name, icon_key, granted_at, count}]`.
- `POST /users/{id}/gamification/seen {section: 'achievements'}` — mismo endpoint de Spec 1
  (Gap 34), ya existe (`services/gamification.js`).

## Archivos

**Nuevos:**
- `services/achievements.js` — `getAchievementsCatalog()`, `getUserAchievements(userId)`,
  `getStamps(userId)`.
- `services/__mocks__/achievements-mock.js` — catálogo fijo con al menos un logro de cada familia
  (incluido uno `leveled` ya en nivel 3 con `count` entre el umbral de nivel 3 y 4, para poder ver
  la barra de progreso en desarrollo), y stamps mixtas (`achievement_counter` + `competition`).
- `services/normalizers.js` — agrega `toAchievementCatalogItemModel`, `toUserAchievementModel`,
  `toStampModel` (snake→camel).
- `hooks/use-achievements.js` — `useAchievements()`: combina catálogo + progreso en una sola lista
  lista para renderizar (join por `id`/`achievement_id`), con `progressPercent` ya calculado para
  `leveled` cuando `count` está disponible. Expone `hasUnseen` (OR de los `has_unseen` individuales
  — Gap 34 no define si el flag es por-logro o uno solo agregado; mientras no se aclare con
  backend, el frontend trata cualquier `has_unseen: true` en la lista como "la sección tiene
  novedades"). Dispara el toast de desbloqueo con el mismo patrón de `hooks/use-streaks.js` de
  Spec 1 (`useRef` guardando el estado anterior por logro, `useEffect` comparando contra el nuevo,
  delegando el armado del mensaje a `utils/achievement-unlock-message.js`).
- `utils/achievement-unlock-message.js` — función pura `buildAchievementUnlockMessage(previousList,
  nextList)` → `{text1, text2} | null` (el primer logro de la lista que subió de nivel o se
  desbloqueó por primera vez entre ambos snapshots; `null` si ninguno cambió).
- `hooks/use-stamps.js` — `useStamps()`: separa la lista de `GET /users/{id}/stamps` en
  `{counters, competitions}` (filtro por `type`), sin postear `has_unseen` propio (la vitrina no
  tiene su propio punto rojo — compañera de la pestaña Logros bajo la misma `section:
  'achievements'` de Gap 34).
- `utils/achievement-level-meta.js` — `ACHIEVEMENT_LEVEL_META` (objeto `{1: {...}, 2: {...}, ...,
  5: {...}}`, mismo patrón que `EXERCISE_KIND_META`): ícono + color por nivel.
- `utils/achievement-progress.js` — función pura `computeLevelProgress(catalogItem,
  userAchievement)` → `{levelName, nextLevelName, percent} | null` (null si no aplica — familia
  `once`/`counter`, o `leveled` sin `count` disponible, o ya en Leyenda con progreso post-máximo
  distinto). Testeada en `__tests__/achievement-progress.test.js`.
- `components/shared/progress-bar.jsx` — `<ProgressBar percent={0-100} />`, `View` con ancho
  proporcional (`style={{width: `${percent}%`}}`), sin librería.
- `components/achievements/achievements-tab.jsx` — grilla de logros: cada ítem con ícono/color del
  nivel actual (vía `ACHIEVEMENT_LEVEL_META`), nombre del logro, nombre del nivel (de
  `levels[].name`, no hardcodeado en frontend), `ProgressBar` cuando `computeLevelProgress`
  devuelve algo, cuenta acumulada si es `counter`, fecha de desbloqueo si corresponde.
- `components/achievements/trophy-case-tab.jsx` — vitrina: 2 sub-secciones ("Estampas",
  "Trofeos de competencias") desde `useStamps()`, grilla responsive (JS-driven: 2 columnas en
  mobile/web-narrow, 3 en web ancho — vía `useIsNarrowWeb()`, no clases `md:`/`lg:` de NativeWind,
  por la regla de "Responsive web" del repo).
- `components/home/achievement-highlight-card.jsx` — card de vista rápida en el Home: el logro con
  mayor `progressPercent` (el "más cerca de desbloquear"), o el más reciente desbloqueado si
  ninguno tiene progreso fraccional pendiente.

**Tocados:**
- `components/achievements/achievements-screen.jsx` — `TABS` suma `{id: 'achievements', label:
  'Logros', icon: 'medal-outline'}` y `{id: 'trophies', label: 'Vitrina', icon: 'trophy'}`. El
  `useEffect` de ack (de Spec 1, hoy dispara `ackSection('streaks')` al montar) se separa: cada vez
  que `activeTab` cambia a `'achievements'` o `'trophies'`, dispara `ackSection('achievements')`
  (una sola vez por sesión de pantalla — guard con un `useRef` de "ya lo hice", no repetir en cada
  cambio de pestaña).
- `hooks/use-gamification-badge.js` — suma `useAchievements()` al OR: `hasUnseen =
  Boolean(streaks?.hasUnseen) || Boolean(achievements?.hasUnseen)`.
- `components/home/authenticated-home-screen.jsx` — agrega `<AchievementHighlightCard />` después
  de `<StreakBanner />`.

## Identidad visual de niveles

| Nivel | Ícono (MaterialCommunityIcons) | Color |
|---|---|---|
| 1 Chispa | `circle-outline` | gris `#94a3b8` |
| 2 Fuego | `fire` | naranja tenue `#fb923c` |
| 3 Imparable | `fire` | naranja intenso `#ea580c` |
| 4 Máquina | `fire` | rojo/brasa `#dc2626` |
| 5 Leyenda | `fire` | dorado `#eab308`, con `shadow`/glow sutil (sombra de color en vez de
  gris, único nivel que la lleva) |

El nombre visible del nivel ("¡Imparable!" en el toast de desbloqueo, el nombre de la fila en la
grilla) sale siempre de `levels[].name` del catálogo — nunca hardcodeado en el frontend, aunque
esta tabla documenta los valores que el backend va a mandar (Chispa/Fuego/Imparable/Máquina/
Leyenda, confirmados en el doc fuente).

## Trofeo post-Leyenda

`counter_trophy_every` (catálogo) define cada cuántas ocurrencias por encima del umbral de nivel 5
se otorga un trofeo acumulable — ese trofeo YA llega como una fila más de `GET
/users/{id}/stamps` con `type: 'post_legend'`, el frontend no calcula nada: solo lo muestra en la
vitrina (sub-sección "Estampas", junto a los `achievement_counter`, distinguible por `source_name`
e `icon_key` propios que manda el backend).

## Feedback de desbloqueo

Al detectar (comparando el array de `useAchievements()` entre refetches, mismo patrón que el toast
de racha rota de Spec 1: guardar el `unlocked_at`/`current_level` anterior por logro en un
`useRef`) que un logro subió de nivel o se desbloqueó por primera vez, toast `notifySuccess()` +
`Toast.show({type: 'success', text1: <nombre del nivel o "¡Logro desbloqueado!">, text2: <nombre
del logro>})`. Lógica de detección extraída a función pura `utils/achievement-unlock-message.js`
(mismo criterio de testabilidad que `streak-break-message.js` de Spec 1), con test en
`__tests__/achievement-unlock-message.test.js`.

## Estilos

- Grilla de logros: `flex-row flex-wrap gap-3`, cada card `bg-white dark:bg-surface rounded-2xl
  p-3 shadow-sm`, ancho fijo por fila según plataforma (2 columnas mobile, responsive en web).
- `ProgressBar`: contenedor `h-1.5 rounded-full bg-slate-200 dark:bg-slate-700`, relleno `h-1.5
  rounded-full bg-primary` con `width` inline.
- Vitrina: estampas "chicas" (ícono + contador superpuesto, como un badge), trofeos "grandes"
  (card más alta, ícono más grande) — mismo contraste de tamaño que pide el doc fuente.

## Responsive / plataformas

Grilla de logros y vitrina responsive-first (regla obligatoria) — columnas decididas en JS
(`useIsNarrowWeb()`), nunca con clases `sm:`/`md:` de NativeWind (esas no sirven para decidir
estructura, solo para CSS puro — ver CLAUDE.md "Responsive web").

## Testing

- `__tests__/achievement-progress.test.js` — `computeLevelProgress` con los 4 casos: `once`/
  `counter` (null), `leveled` con `count` disponible (porcentaje correcto), `leveled` sin `count`
  (null, degradación), `leveled` ya en nivel 5 (null — no hay "siguiente nivel" que mostrar como
  barra; el post-Leyenda se muestra distinto, como trofeo acumulado en vitrina, no como barra).
- `__tests__/achievement-unlock-message.test.js` — subida de nivel, desbloqueo de `once`,
  incremento de `counter` (no dispara toast — un logro contador no "sube de nivel", cada ocurrencia
  ya se refleja como una estampa nueva en la vitrina, no amerita un toast por cada una salvo que se
  decida lo contrario más adelante; fuera de alcance de esta spec).
- `__tests__/achievements-mock.test.js` — forma del mock (al menos un ítem por familia, status
  shape correcto).
- Sin tests de render de componentes (convención del repo).

## Identificadores

Todo componente visual nuevo lleva `nativeID`/`testID` kebab-case (regla obligatoria).
