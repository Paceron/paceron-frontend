# Lavado de cara visual (paleta + contenedores + tabs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar la paleta de la app (clara/oscura) sobre la escala slate, generalizar
el patrón de contenedor de `team-detail-screen.jsx` a toda pantalla, y hacer que tabs y
subtabs se noten pressables en reposo — sin sombras, sin bordes salvo donde hacen falta.

**Architecture:** Fundación de 3 piezas (redefinición de tokens de color existentes,
componente nuevo `ScreenCard`, ajuste de `TabBar`) que cascadea sola a casi toda la app
vía los tokens ya usados en ~50 pantallas. Encima, un rollout pantalla por pantalla
(agrupado por área) que aplica `ScreenCard` donde haga falta, siguiendo un procedimiento
de clasificación fijo (definido en la Tarea 4) porque no todas las pantallas parten del
mismo estado hoy.

**Tech Stack:** React Native + NativeWind (Tailwind), sin librerías nuevas.

**Spec:** `docs/superpowers/specs/2026-10-31-visual-design-refresh-design.md`

## Global Constraints

- Sin `shadow-*` en ningún archivo tocado por este plan.
- Bordes solo donde la diferencia de fondo sola no alcanza para leerse como separado
  (regla general del spec, aplicada caso por caso, no una lista cerrada).
- Todo nodo nuevo (`View`/`Pressable`/etc.) lleva `nativeID`+`testID` únicos
  (`local/require-native-id`, `npm run lint` debe quedar en verde).
- `npm test` en verde después de cada tarea (este repo no testea render de componentes
  — nada en este plan debería romper un test existente; si algo lo hace, es señal de
  haber tocado algo fuera de alcance).
- Verificación visual manual en preview (claro/oscuro, ancho/angosto en web) — sin
  excepción, es la única verificación real posible para cambios puramente visuales.
- El fondo de página (`bg-paper dark:bg-ink`) lo sigue poniendo cada pantalla como
  hoy — `ScreenCard` nunca lo toca, es siempre el nivel de adentro.

---

### Task 1: Redefinir los tokens de color existentes

**Files:**
- Modify: `tailwind.config.js`
- Modify: `theme/colors.js`

**Interfaces:**
- Produces: mismos nombres de token (`paper`, `ink`, `surface`, `surface-2`,
  `surface-3`), valores nuevos — ningún call site cambia, cascada automática.

- [ ] **Step 1: Cambiar los 5 valores en `tailwind.config.js`**

En el bloque `theme.extend.colors`, reemplazar:

```js
ink: '#0d1013',
surface: '#111518',
'surface-2': '#1d2125',
'surface-3': '#282d31',
paper: '#f3efe4',
```

por:

```js
ink: '#020617',
surface: '#0f172a',
'surface-2': '#1e293b',
'surface-3': '#334155',
paper: '#cbd5e1',
```

(El resto del bloque —`primary`, `primary-tint`, `primary-tint-subtle`,
`on-primary-tint`— no cambia.)

- [ ] **Step 2: Alinear `theme/colors.js` — solo el lado oscuro**

`darkColors.background` y `darkColors.surface` valen hoy `'#111518'` los dos
(mismo valor, sin distinguir página de superficie a este nivel). Cambiar a:

```js
export const darkColors = {
  background: '#020617',
  onBackground: '#ffffff',
  surface: '#0f172a',
  onSurface: '#ffffff',
  onSurfaceVariant: '#c0c8cd',
  outlineVariant: '#40484c',
  surfaceContainerHigh: '#282d31',
  primary: '#8cc63e',
  onPrimary: '#111518',
  primaryContainer: '#075318',
  error: '#ffb4ab',
};
```

(Solo `background` y `surface` cambian — confirmado por lectura de código que
`colors.surface` se usa como `backgroundColor` real en
`components/plans/session-drag-and-drop.jsx` y como `stroke` de gráficos en
`components/dashboard/session-comparison-chart.jsx`; sin este cambio esos dos
quedarían con el tono viejo mientras el resto de la app ya tiene el nuevo.
`lightColors` no se toca — ya representaba blanco puro, independiente del
`paper` cálido que cambia acá, esa relación no cambia con este plan.)

- [ ] **Step 3: Verificar en preview**

Levantar el dev server web, entrar a cualquier pantalla (ej. `/calendar`),
confirmar visualmente: modo claro con fondo gris notorio (no el crema de
antes), modo oscuro con fondo casi negro. Alternar el tema con el switch del
shell y confirmar que las dos puntas cambian.

- [ ] **Step 4: Lint + test**

```bash
npm run lint
npm test
```

Ambos deben quedar en verde (cambio de solo valores, no debería romper nada).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js theme/colors.js
git commit -m "feat(theme): move page/surface tokens onto the slate scale"
```

---

### Task 2: Crear `ScreenCard` y migrar `team-detail-screen.jsx`

**Files:**
- Create: `components/shared/screen-card.jsx`
- Modify: `components/team/team-detail-screen.jsx:1046`

**Interfaces:**
- Produces: `ScreenCard({ children, padded = true, nativeID, testID })` — React
  component, default export nombrado (`export function ScreenCard`). `padded`
  controla si agrega `p-4` (ver Tarea 4, caso 2, para cuándo pasar `false`).
- Consumes (Tarea 1): nada directo — los tokens que usa (`surface`,
  `surface-2`) ya están redefinidos.

- [ ] **Step 1: Crear el componente**

```jsx
import { View } from 'react-native';
import { isWeb } from '../../utils/platform.js';

// Card de contenido genérica para toda pantalla -- ver docs/superpowers/specs/
// 2026-10-31-visual-design-refresh-design.md. Resuelve SOLO el nivel de
// adentro (bg/borde/redondeo/padding/ancho máximo en web ancho); el fondo de
// página (bg-paper dark:bg-ink) lo sigue poniendo cada pantalla como hoy.
//
// Claro: sin borde (blanco sobre el nuevo fondo gris ya se distingue solo).
// Oscuro: borde mínimo (`surface-2`) -- el salto `ink`->`surface` es más
// sutil, necesita el borde para leerse como superficie separada.
export function ScreenCard({ children, padded = true, nativeID, testID }) {
  return (
    <View
      className={`w-full self-center rounded-2xl bg-white dark:border dark:border-surface-2 dark:bg-surface ${padded ? 'p-4' : ''} ${isWeb ? 'max-w-3xl' : ''}`}
      nativeID={nativeID}
      testID={testID}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 2: Migrar `team-detail-screen.jsx`**

En `components/team/team-detail-screen.jsx:1046`, reemplazar:

```jsx
<View className={`w-full self-center border border-slate-200 dark:border-slate-800 p-4 rounded-2xl bg-white dark:bg-surface ${isWeb ? 'max-w-3xl' : ''}`} nativeID="team-detail-screen-container" testID="team-detail-screen-container">
```

por:

```jsx
<ScreenCard nativeID="team-detail-screen-container" testID="team-detail-screen-container">
```

(y su cierre `</View>` correspondiente más abajo pasa a `</ScreenCard>`).
Agregar el import: `import { ScreenCard } from '../shared/screen-card.jsx';`

- [ ] **Step 3: Verificar en preview**

`/teams/{id}` (cualquier equipo), claro y oscuro: confirmar que la card se ve
igual o mejor que antes (sin borde en claro, borde mínimo en oscuro), que el
contenido interno (tabs, corredores, etc.) no se movió de lugar.

- [ ] **Step 4: Lint + test**

```bash
npm run lint
npm test
```

- [ ] **Step 5: Commit**

```bash
git add components/shared/screen-card.jsx components/team/team-detail-screen.jsx
git commit -m "feat(shared): add ScreenCard, migrate team-detail-screen onto it"
```

---

### Task 3: `TabBar` — estado de reposo visible + marco en subtabs

**Files:**
- Modify: `components/shared/tab-bar.jsx`

**Interfaces:**
- Consumes (Tarea 2): nada directo (no usa `ScreenCard`, es un componente
  hermano usado DENTRO de pantallas que sí lo usan).

- [ ] **Step 1: Tabs de primer nivel — fondo en reposo, no solo hover**

En el objeto `VARIANT.default`, reemplazar:

```js
inactiveClassName: 'hover:bg-slate-100 dark:hover:bg-slate-800',
```

por:

```js
inactiveClassName: 'bg-slate-100 hover:bg-slate-200 dark:bg-surface-2 dark:hover:bg-surface-3',
```

- [ ] **Step 2: Subtabs — marco único para el grupo, no por ítem**

En el objeto `VARIANT.compact`, reemplazar:

```js
wrapClassName: 'mb-4 flex-row gap-4 border-b border-slate-200 dark:border-slate-800',
```

por:

```js
wrapClassName: 'mb-4 flex-row gap-4 rounded-xl border border-slate-200 px-3 py-1.5 dark:border-surface-2',
```

(El resto de `compact` —`tabClassName`, `activeClassName`,
`inactiveClassName`, los dos `labelClassName`— no cambia: el mecanismo de
subrayado en el activo sigue igual, confirmado con el usuario que NO quería
que cada subtab se vuelva su propia pill.)

- [ ] **Step 3: Verificar en preview**

Tabs de primer nivel: `/teams/{id}` (de la Tarea 2) — confirmar que las tabs
inactivas ahora tienen fondo propio sin necesidad de hover, en claro y
oscuro. Subtabs: entrar a la pestaña Competencias del mismo equipo (usa
`variant="compact"` en sus subtabs internas) — confirmar el marco liviano
alrededor del grupo.

- [ ] **Step 4: Lint + test**

```bash
npm run lint
npm test
```

- [ ] **Step 5: Commit**

```bash
git add components/shared/tab-bar.jsx
git commit -m "fix(shared): tabs show pressable state at rest, subtabs get a group frame"
```

---

### Task 4: Procedimiento de rollout + área Equipos

**Files:**
- Modify: `components/team/create-team-screen.jsx`
- Modify: `components/team/edit-group-screen.jsx`
- Modify: `components/team/edit-team-screen.jsx`
- Modify: `components/team/group-calendar-day-screen.jsx`
- Modify: `components/team/group-calendar-screen.jsx`
- Modify: `components/team/invite-team-members-screen.jsx`
- Modify: `components/team/team-search-screen.jsx`
- Modify: `components/team/teams-list-screen.jsx`
- Modify: `components/team/team-subscription-screen.jsx`

**Interfaces:**
- Consumes (Tarea 2): `ScreenCard({ children, padded, nativeID, testID })`.

**Procedimiento (vale para esta tarea y las Tareas 5-11 — no se repite el
texto completo en cada una, cada una linkea acá):**

1. Leer el archivo completo. Ubicar el root `bg-paper dark:bg-ink` y
   cualquier wrapper interior que ya exista alrededor del contenido
   principal.
2. Clasificar (ver spec, sección Rollout):
   - **Caso 1 — sin wrapper propio:** envolver el contenido en
     `<ScreenCard nativeID="{prefijo}-container" testID="{prefijo}-container">`
     fresco, `padded` default (`true`).
   - **Caso 2 — ya tiene un wrapper con padding propio** (ej. ya usa
     `SectionCard` u otro contenedor con `p-4` alrededor de TODO el
     contenido): reemplazar ese wrapper por `<ScreenCard padded={false}
     nativeID="..." testID="...">`, el padding que tenía el wrapper viejo
     se conserva donde ya estaba (en el contenido interno), no se duplica.
3. Si la pantalla tiene badges/pills de estado (success/warning/danger) con
   tonos distintos a los del spec (`bg-{color}-50 text-{color}-700` en claro,
   `bg-{color}-900/20 text-{color}-400` en oscuro), alinearlos de paso — ya
   se está tocando el archivo.
4. Si la pantalla tiene un botón secundario con fondo sólido propio (en vez
   de outline/ghost), pasarlo a borde `slate-300`/`dark:border-surface-2` +
   texto `slate-700`/`dark:text-slate-200`, sin relleno — mismo criterio que
   el badge: de paso, no una pasada aparte. El botón primario (`bg-primary`)
   no cambia en ningún caso.
5. Confirmar `nativeID`/`testID` únicos en cualquier nodo nuevo.
6. `npm run lint` limpio.
7. Verificar en preview: claro y oscuro; ancho y angosto si la pantalla
   tiene lógica propia de web (la mayoría la hereda del shell, no hace falta
   probar las dos si no cambia layout, solo el color/contenedor).
8. `npm test` en verde.
9. Commit — por archivo o por lote chico, no juntar los 9 de esta tarea en
   un commit gigante.

- [ ] **Step 1: Aplicar el procedimiento a los 9 archivos de Equipos listados arriba**

- [ ] **Step 2: Commit(s)**

```bash
git commit -m "style(team): wrap remaining team screens in ScreenCard"
```

(uno o varios commits, ver punto 8 del procedimiento)

---

### Task 5: Área Entrenamiento en vivo (`session-runtime/`)

**Files:**
- Modify: `components/session-runtime/route-attempt-detail-screen.jsx`
- Modify: `components/session-runtime/route-attempt-live-screen.jsx`
- Modify: `components/session-runtime/route-attempt-pre-start-screen.jsx`
- Modify: `components/session-runtime/session-pre-start-screen.jsx`
- Modify: `components/session-runtime/session-review-screen.jsx`
- Modify: `components/session-runtime/trainer-session-live-screen.jsx`
- Modify: `components/session-runtime/trainer-session-pre-start-screen.jsx`
- Modify: `components/session-runtime/trainer-session-review-screen.jsx`
- Modify: `components/session-runtime/training-session-active-screen.jsx`
- Modify: `components/session-runtime/training-session-live-screen.jsx`

**Interfaces:**
- Consumes: mismo `ScreenCard` de la Tarea 2.

- [ ] **Step 1: Aplicar el procedimiento de la Tarea 4 a los 10 archivos listados arriba**

Nota: varias de estas pantallas (`route-attempt-live-screen.jsx`,
`route-attempt-pre-start-screen.jsx`, `training-session-active-screen.jsx`,
`training-session-live-screen.jsx`, `trainer-session-live-screen.jsx`) son
`MobileOnlyRoute` — no se pueden verificar en el preview web (confirmado
varias veces esta misma rama). Verificar las que sí abren en web
normalmente; las mobile-only quedan pendientes de confirmación en
dispositivo real, igual que el resto del trabajo mobile-only de esta rama.

- [ ] **Step 2: Commit(s)**

```bash
git commit -m "style(session-runtime): wrap live-session screens in ScreenCard"
```

---

### Task 6: Área Planes (`plans/`)

**Files:**
- Modify: `components/plans/create-session-screen.jsx`
- Modify: `components/plans/create-training-plan-screen.jsx`
- Modify: `components/plans/edit-session-screen.jsx`
- Modify: `components/plans/edit-training-plan-screen.jsx`
- Modify: `components/plans/training-plan-detail-screen.jsx`
- Modify: `components/plans/training-plans-screen.jsx`

**Interfaces:**
- Consumes: mismo `ScreenCard` de la Tarea 2.

- [ ] **Step 1: Aplicar el procedimiento de la Tarea 4 a los 6 archivos listados arriba**

Nota: `training-plans-screen.jsx` y `create-session-screen.jsx`/
`edit-session-screen.jsx` ya tienen un `*-screen-container`/similar que HOY
es solo ancho (`w-full self-center max-w-3xl`, sin bg/borde propio) — es
Caso 1 igual (agregar `ScreenCard` fresco), no Caso 2 (no tienen padding
propio que evitar duplicar) — confirmar leyendo cada uno, no asumir por el
nombre parecido a los que sí son Caso 2.

- [ ] **Step 2: Commit(s)**

```bash
git commit -m "style(plans): wrap plan screens in ScreenCard"
```

---

### Task 7: Área Perfil (`profile/`)

**Files:**
- Modify: `components/profile/activate-trainer-screen.jsx`
- Modify: `components/profile/edit-profile-screen.jsx`
- Modify: `components/profile/payments-screen.jsx`
- Modify: `components/profile/profile-screen.jsx`
- Modify: `components/profile/tier-upgrade-screen.jsx`

**Interfaces:**
- Consumes: mismo `ScreenCard` de la Tarea 2.

- [ ] **Step 1: Aplicar el procedimiento de la Tarea 4 a los 5 archivos listados arriba**

- [ ] **Step 2: Commit(s)**

```bash
git commit -m "style(profile): wrap profile screens in ScreenCard"
```

---

### Task 8: Área Pagos (`payments/`, sin el testbed)

**Files:**
- Modify: `components/payments/checkout-flow.jsx`
- Modify: `components/payments/checkout-web-page.jsx`
- Modify: `components/payments/mp-connect-callback-page.jsx`

**Interfaces:**
- Consumes: mismo `ScreenCard` de la Tarea 2.

**Fuera de esta tarea a propósito:** `payments/payments-testbed-screen.jsx`
(herramienta de desarrollo, no pantalla real de usuario — no forma parte del
pulido visual).

- [ ] **Step 1: Aplicar el procedimiento de la Tarea 4 a los 3 archivos listados arriba**

Nota: `checkout-flow.jsx` es la ÚNICA pantalla de la app exenta de la regla
de "todo modal cierra al tocar afuera" (CLAUDE.md, sección Modales) — no es
relevante para ESTE cambio (contenedor/color, no comportamiento de cierre),
no tocar esa excepción de paso.

- [ ] **Step 2: Commit(s)**

```bash
git commit -m "style(payments): wrap checkout screens in ScreenCard"
```

---

### Task 9: Calendario + comparación + logros + asistencia

**Files:**
- Modify: `components/calendar/administered-calendar-screen.jsx`
- Modify: `components/calendar/my-calendar-screen.jsx`
- Modify: `components/comparison/session-comparison-screen.jsx`
- Modify: `components/comparison/training-comparison-screen.jsx`
- Modify: `components/achievements/achievements-screen.jsx`
- Modify: `components/attendance/attendance-screen.jsx`

**Interfaces:**
- Consumes: mismo `ScreenCard` de la Tarea 2.

- [ ] **Step 1: Aplicar el procedimiento de la Tarea 4 a los 6 archivos listados arriba**

Nota: `attendance-screen.jsx` hoy arma varias cards sueltas (`session-card`,
`no-session`) en vez de un wrapper único (confirmado por lectura de código
durante el brainstorming de este plan) — Caso 1: agregar `ScreenCard`
fresco envolviendo ese contenido, las cards internas quedan como contenido
anidado dentro (mismo criterio que el nivel "anidado" del spec).

- [ ] **Step 2: Commit(s)**

```bash
git commit -m "style(calendar): wrap calendar/comparison/achievements/attendance screens in ScreenCard"
```

---

### Task 10: Checkin + notificaciones + ajustes

**Files:**
- Modify: `components/checkin/checkin-scanner.jsx`
- Modify: `components/checkin/checkin-screen.jsx`
- Modify: `components/notifications/notifications-screen.jsx`
- Modify: `components/settings/settings-screen.jsx`

**Interfaces:**
- Consumes: mismo `ScreenCard` de la Tarea 2.

- [ ] **Step 1: Aplicar el procedimiento de la Tarea 4 a los 4 archivos listados arriba**

Nota: `checkin-scanner.jsx` usa la cámara nativa como contenido principal en
mobile — confirmar en preview que `ScreenCard` no reduce el área útil del
visor de la cámara; si lo hace, documentarlo y dejar esa pantalla puntual
sin `ScreenCard` (excepción, no forzar el patrón donde rompe la función real
de la pantalla).

- [ ] **Step 2: Commit(s)**

```bash
git commit -m "style(misc): wrap checkin/notifications/settings screens in ScreenCard"
```

---

### Task 11: Auth + home — evaluar caso por caso

**Files:**
- Modify (si corresponde): `components/auth/auth-card-shell.jsx`
- Modify (si corresponde): `components/home/authenticated-home-screen.jsx`
- Modify (si corresponde): `components/home/home-landing-screen.jsx`
- Modify (si corresponde): `components/home/home-mobile-screen.jsx`
- Modify (si corresponde): `components/home/home-web-narrow-screen.jsx`

**Interfaces:**
- Consumes: mismo `ScreenCard` de la Tarea 2.

**Por qué esta tarea es distinta a las demás:** `auth-card-shell.jsx` ya es
un shell compartido pensado específicamente para encuadrar un form de
auth (login/register/forgot-password/reset-password) — puede que YA
resuelva el "nada flotando" a su manera, sin necesitar `ScreenCard` encima.
`home-landing-screen.jsx` es contenido de marketing (hero, features) — forzar
una card blanca alrededor de todo puede no tener sentido visualmente ahí.
No asumir que las 5 pantallas de esta tarea necesitan el mismo tratamiento
que una pantalla de contenido común.

- [ ] **Step 1: Leer los 5 archivos, decidir para cada uno: aplica `ScreenCard` (Caso 1 o 2, procedimiento de la Tarea 4), o queda afuera con una nota de por qué**

- [ ] **Step 2: Aplicar donde corresponda, siguiendo el procedimiento de la Tarea 4**

- [ ] **Step 3: Commit(s)**

```bash
git commit -m "style(auth,home): apply ScreenCard where it fits"
```

---

### Task 12: Regresión final

**Files:** Ninguno nuevo — verificación de todo lo anterior.

- [ ] **Step 1: Suite completa**

```bash
npm test
npm run lint
```

Ambos en verde.

- [ ] **Step 2: Barrido visual manual**

Recorrer en preview web (claro + oscuro, ancho + angosto) al menos una
pantalla de cada área tocada (Tareas 4-11) — confirmar que no quedó ninguna
con doble padding (el riesgo que motivó el procedimiento de la Tarea 4), ni
ningún `shadow-*` colado, ni contenido flotando sin `ScreenCard` en las que
sí correspondía.

- [ ] **Step 3: Confirmar con el usuario las pantallas mobile-only que no se pudieron verificar en preview** (listadas en la Tarea 5) — pendiente de dispositivo real, igual que el resto del trabajo mobile-only de ramas anteriores.

- [ ] **Step 4: Avisar que el plan está completo**

No se commitea nada en este paso — es el punto donde se decide, junto con el
usuario, si la rama está lista para `finishing-a-development-branch`.
