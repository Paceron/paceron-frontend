# Landing sin header/sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La landing pública (`/` sin sesión) deja de montar el shell de navegación completo (header/sidebar de usuario autenticado) en web ancho, web angosto y mobile nativo; en su lugar muestra solo su contenido de venta con un toggle de tema propio y la marca completa (ícono+texto) arriba del hero. Las 4 pantallas de auth (login/register/forgot-password/reset-password) ganan el mismo toggle de tema, que hoy no tienen.

**Architecture:** Un único `if` nuevo en `app/(tabs)/_layout.jsx`, evaluado antes de las ramas de shell existentes, detecta "landing sin sesión" (`pathname === '/' && !userId`) y devuelve un wrapper mínimo (`SafeAreaView` + `ThemeToggle` flotante + `Slot`) en vez de `AppWebShell`/`AppWebShellNarrow`/`AppMobileShell`. Las 3 pantallas de contenido de la landing suman `PaceronBrand` arriba del hero. `AuthCardShell` (wrapper ya compartido por las 4 pantallas de auth) suma el mismo `ThemeToggle` flotante.

**Tech Stack:** React Native + React Native Web, Expo Router, NativeWind, `react-native-safe-area-context`.

**Spec:** `docs/superpowers/specs/2026-09-10-landing-without-shell-design.md`

## Global Constraints

- Solo `/` **sin sesión** pierde el shell — `/` con sesión y cualquier otra ruta no cambian.
- `login`/`register`/`forgot-password`/`reset-password` ya viven fuera de `(tabs)` — no tocar su routing, solo `auth-card-shell.jsx`.
- Todo elemento visual nuevo (`View`, `Pressable`, etc.) lleva `nativeID` y `testID` únicos (regla `local/require-native-id`, CLAUDE.md).
- Sin tests de componente (convención del repo) — verificación manual en preview.
- `npm test` y `npm run lint` en verde antes de cada commit.

---

### Task 1: Landing sin shell en `(tabs)/_layout.jsx`

**Files:**
- Modify: `app/(tabs)/_layout.jsx`

**Interfaces:**
- Consumes: `useAuthStore((s) => s.userId)` (ya existe en `store/auth-store.js`, mismo store que ya usa este archivo para `hydrated`), `ThemeToggle` de `components/theme/theme-toggle.jsx` (sin props), `SafeAreaView` de `react-native-safe-area-context`.
- Produces: nada que otro task consuma — es la única modificación de este archivo en todo el plan.

- [ ] **Step 1: Agregar el chequeo de landing sin sesión**

Reemplazar el contenido completo de `app/(tabs)/_layout.jsx` por:

```jsx
import { Slot, usePathname } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppWebShell } from '../../components/shell/app-web-shell.jsx';
import { AppWebShellNarrow } from '../../components/shell/app-web-shell-narrow.jsx';
import { AppMobileShell } from '../../components/shell/app-mobile-shell.jsx';
import { AppLoadingScreen } from '../../components/shell/app-loading-screen.jsx';
import { ThemeToggle } from '../../components/theme/theme-toggle.jsx';
import { isWeb } from '../../utils/platform.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useIsNarrowWeb } from '../../hooks/use-is-narrow-web.js';

export default function TabsLayout() {
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const userId = useAuthStore((s) => s.userId);
  const isNarrowWeb = useIsNarrowWeb();

  if (!hydrated) return <AppLoadingScreen />;

  // Landing pública (sin sesión): sin shell de navegación de usuario
  // autenticado — solo el toggle de tema, flotante y transparente, arriba
  // de lo que sea que renderice HomeLandingScreen/HomeWebNarrowScreen/
  // HomeMobileScreen (decidido por app/(tabs)/index.jsx / index.web.jsx).
  // Ver docs/superpowers/specs/2026-09-10-landing-without-shell-design.md.
  if (pathname === '/' && !userId) {
    return (
      <SafeAreaView className="flex-1" edges={['top']} nativeID="landing-bare-shell" testID="landing-bare-shell">
        <View className="absolute right-4 top-4 z-10" nativeID="landing-bare-shell-theme-toggle" testID="landing-bare-shell-theme-toggle">
          <ThemeToggle />
        </View>
        <Slot />
      </SafeAreaView>
    );
  }

  if (isWeb) {
    const WebShell = isNarrowWeb ? AppWebShellNarrow : AppWebShell;
    return (
      <WebShell pathname={pathname}>
        <Slot />
      </WebShell>
    );
  }

  return (
    <AppMobileShell pathname={pathname}>
      <Slot />
    </AppMobileShell>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint "app/(tabs)/_layout.jsx"`
Expected: sin errores.

- [ ] **Step 3: Verificar en preview — landing sin sesión, web ancho**

Con el dev server corriendo y sesión deslogueada, navegar a `/` en un
viewport ancho (>1024px). Confirmar con `preview_snapshot`/`preview_eval`:
- No aparece ningún elemento con `nativeID` de `web-shell-topbar-*` (el
  header autenticado).
- El elemento `#landing-bare-shell-theme-toggle` existe y su `<Pressable
  nativeID="theme-toggle">` interno responde al click (alterna
  `accessibilityState.checked`).
- El contenido de `home-landing-screen-root` sigue renderizando (hero,
  features, etc.) — este task no lo modifica, solo confirma que sigue
  montado sin el shell alrededor.

- [ ] **Step 4: Verificar en preview — landing sin sesión, web angosto**

Redimensionar el viewport a <1024px (`preview_resize`), recargar `/`
deslogueado. Mismo chequeo del Step 3, pero confirmando ausencia de
`web-narrow-topbar-*` y presencia de `home-web-narrow-screen` como
contenido.

- [ ] **Step 5: Verificar regresión — `/` con sesión**

Loguearse (o usar una sesión ya autenticada en el preview), navegar a `/`.
Confirmar que el shell autenticado sigue apareciendo sin cambios
(`web-shell-topbar-brand` o `web-narrow-topbar-brand` presentes, según el
ancho) — este es el chequeo de que el `if` nuevo no atrapa por error rutas
autenticadas.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/_layout.jsx"
git commit -m "feat(landing): skip authenticated shell on unauthenticated home route"
```

---

### Task 2: Brand arriba del hero en las 3 variantes de landing

**Files:**
- Modify: `components/home/home-landing-screen.jsx`
- Modify: `components/home/home-web-narrow-screen.jsx`
- Modify: `components/home/home-mobile-screen.jsx`

**Interfaces:**
- Consumes: `PaceronBrand` de `../brand/paceron-brand.jsx` (prop `size`, número — ya existe, sin cambios de este plan).
- Produces: nada que otro task consuma.

- [ ] **Step 1: `home-landing-screen.jsx` — agregar brand arriba del hero**

Este archivo ya importa `PaceronBrand` (línea 2). Ubicar el bloque del
hero:

```jsx
        <View
          className="mb-16 items-center"
          nativeID="home-landing-screen-hero"
          testID="home-landing-screen-hero"
        >
          <View
            className="mb-6 flex-row items-center gap-2 self-center rounded-full bg-primary-tint dark:bg-primary/20 px-4 py-2"
            nativeID="home-landing-screen-hero-badge"
            testID="home-landing-screen-hero-badge"
          >
```

Insertar, inmediatamente después de la apertura de
`home-landing-screen-hero` y antes de `home-landing-screen-hero-badge`:

```jsx
          <View
            className="mb-6 items-center"
            nativeID="home-landing-screen-hero-brand"
            testID="home-landing-screen-hero-brand"
          >
            <PaceronBrand size={28} />
          </View>

```

(el footer ya tiene su propia `PaceronBrand size={16}` — no tocar esa
parte del archivo.)

- [ ] **Step 2: `home-web-narrow-screen.jsx` — importar `PaceronBrand` y agregarla**

Agregar el import (después del import de `react-native`):

```jsx
import { PaceronBrand } from '../brand/paceron-brand.jsx';
```

Ubicar el bloque del hero:

```jsx
      <View
        className="items-center py-16"
        nativeID="home-web-narrow-screen-hero"
        testID="home-web-narrow-screen-hero"
      >
        <View
          className="mb-6 flex-row items-center gap-2 rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5"
          nativeID="home-web-narrow-screen-hero-badge"
          testID="home-web-narrow-screen-hero-badge"
        >
```

Insertar, inmediatamente después de la apertura de
`home-web-narrow-screen-hero` y antes de
`home-web-narrow-screen-hero-badge`:

```jsx
        <View
          className="mb-6 items-center"
          nativeID="home-web-narrow-screen-hero-brand"
          testID="home-web-narrow-screen-hero-brand"
        >
          <PaceronBrand size={22} />
        </View>

```

- [ ] **Step 3: `home-mobile-screen.jsx` — importar `PaceronBrand` y agregarla**

Agregar el import (después del import de `react-native`):

```jsx
import { PaceronBrand } from '../brand/paceron-brand.jsx';
```

Ubicar el bloque del hero:

```jsx
      <View
        className="items-center py-16"
        nativeID="home-mobile-hero"
        testID="home-mobile-hero"
      >
        <View
          className="mb-6 flex-row items-center gap-2 rounded-full bg-primary-tint dark:bg-primary/20 px-3 py-1.5"
          nativeID="home-mobile-hero-badge"
          testID="home-mobile-hero-badge"
        >
```

Insertar, inmediatamente después de la apertura de `home-mobile-hero` y
antes de `home-mobile-hero-badge`:

```jsx
        <View
          className="mb-6 items-center"
          nativeID="home-mobile-hero-brand"
          testID="home-mobile-hero-brand"
        >
          <PaceronBrand size={22} />
        </View>

```

- [ ] **Step 4: Lint**

Run: `npx eslint components/home/home-landing-screen.jsx components/home/home-web-narrow-screen.jsx components/home/home-mobile-screen.jsx`
Expected: sin errores.

- [ ] **Step 5: Verificar en preview**

Con `/` deslogueado:
- Web ancho: `#home-landing-screen-hero-brand` visible, arriba del badge,
  centrado, sin verse desproporcionado contra el título del hero debajo
  (juicio visual — si se ve muy grande/chico, ajustar el `size` de ese
  `PaceronBrand` específico, no el de otras variantes).
- Web angosto (`<1024px`): `#home-web-narrow-screen-hero-brand` visible,
  mismo chequeo.
- La variante mobile (`home-mobile-screen.jsx`) no es directamente
  verificable en el preview web de esta sesión (usa el bundle `.jsx`, no
  `.web.jsx` — Metro web nunca la carga, ver quirk de CLAUDE.md sobre
  split `.web.jsx`/`.jsx`) — confiar en que el mismo patrón que ya
  funcionó en las otras 2 variantes es correcto aquí, y dejar la
  verificación real para dispositivo/emulador Android cuando esté
  disponible.

- [ ] **Step 6: Commit**

```bash
git add components/home/home-landing-screen.jsx components/home/home-web-narrow-screen.jsx components/home/home-mobile-screen.jsx
git commit -m "feat(landing): show full brand lockup above the hero"
```

---

### Task 3: Toggle de tema en las pantallas de auth

**Files:**
- Modify: `components/auth/auth-card-shell.jsx`

**Interfaces:**
- Consumes: `ThemeToggle` de `../theme/theme-toggle.jsx` (mismo componente que Task 1, sin props).
- Produces: nada — las 4 pantallas de auth (`login-screen.jsx`,
  `register-screen.jsx`, `forgot-password-screen.jsx`,
  `reset-password-screen.jsx`) ya consumen `AuthCardShell` como children,
  no necesitan ningún cambio propio para heredar el toggle.

- [ ] **Step 1: Importar `ThemeToggle`**

Agregar, junto a los demás imports de `auth-card-shell.jsx`:

```jsx
import { ThemeToggle } from '../theme/theme-toggle.jsx';
```

- [ ] **Step 2: Agregar el toggle flotante dentro del `SafeAreaView` raíz**

Ubicar el `return` de `AuthCardShell`:

```jsx
  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="auth-card-shell-safe-area" testID="auth-card-shell-safe-area">
      <KeyboardAwareScrollView
```

Insertar, inmediatamente después de la apertura del `SafeAreaView` y antes
de `<KeyboardAwareScrollView`:

```jsx
      <View className="absolute right-4 top-4 z-10" nativeID="auth-card-shell-theme-toggle" testID="auth-card-shell-theme-toggle">
        <ThemeToggle />
      </View>

```

(`View` ya está importado en este archivo — no agregar el import de
nuevo.)

- [ ] **Step 3: Lint**

Run: `npx eslint components/auth/auth-card-shell.jsx`
Expected: sin errores.

- [ ] **Step 4: Verificar en preview**

Navegar deslogueado a `/login`, `/register`, `/forgot-password`. Para cada
una, confirmar con `preview_snapshot`/`preview_eval`:
- `#auth-card-shell-theme-toggle` presente, arriba a la derecha de la
  pantalla (no adentro de `#auth-card-shell-card`).
- El toggle responde al click (alterna tema, confirmar por ejemplo que
  `document.documentElement` o el `View` raíz cambia su clase/color de
  fondo tras el click).
- El botón "Volver" y el resto del form siguen funcionando sin
  superponerse visualmente con el toggle nuevo.

(`/reset-password` requiere un token válido en la URL para no redirigir —
si no es cómodo de armar en preview, alcanza con confirmar las otras 3;
las 4 comparten el mismo `AuthCardShell` sin lógica condicional sobre el
toggle, así que el riesgo de que falle solo en esa pantalla es mínimo.)

- [ ] **Step 5: Commit**

```bash
git add components/auth/auth-card-shell.jsx
git commit -m "feat(auth): add theme toggle to the shared auth card shell"
```

---

### Task 4: Bump de versión y barrido final

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada — último task del plan.

- [ ] **Step 1: Bump de versión**

En `package.json`, incrementar el campo `"version"` en un **minor**
(ej. `0.19.0` → `0.20.0` — feature visible en varias pantallas, no un
fix puntual; confirmar el valor actual de `"version"` antes de bumpear,
puede haber cambiado si se mergeó otro trabajo entre tanto).

- [ ] **Step 2: Suite completa**

Run: `npm test`
Expected: todos los tests pasan (ninguno de estos cambios toca lógica
cubierta por `__tests__/`, así que el conteo total no debería cambiar
respecto al último run conocido).

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Barrido de preview de los 3 escenarios completos**

Repetir, en una sola pasada final (no hace falta rehacer cada verificación
task-por-task, solo confirmar que nada se rompió por la suma de los 3
tasks juntos):
- `/` deslogueado, ancho y angosto: sin shell, brand arriba del hero,
  toggle funcionando.
- `/` logueado: shell completo sin cambios.
- `/login`: toggle arriba a la derecha, form funcionando.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: version bump for landing-without-shell"
```
