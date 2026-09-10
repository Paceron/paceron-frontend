# Landing sin header/sidebar — Design

## Contexto

La landing pública (`/` sin sesión) hoy se renderiza envuelta en el shell
completo de la app (`AppWebShell`/`AppWebShellNarrow` en web,
`AppMobileShell` en mobile nativo) — el mismo header/sidebar de navegación
que usa un usuario autenticado, con tabs de "Inicio/Equipos/Mis planes",
menú de usuario, etc. Eso no tiene sentido en una landing pública: no hay
nada para navegar todavía, y visualmente compite con el propio contenido de
venta de la landing (hero, features, CTAs).

Idea original y detalle de alcance: `demo-day-frontend-backlog.md`
(memoria de sesión), sección "Landing sin header/sidebar" — este spec la
formaliza y la extiende (agrega el toggle de tema a las pantallas de auth,
detectado como gap relacionado durante el diseño).

Trabajo previo que este spec ya puede dar por hecho: `PaceronBrand`
(`components/brand/paceron-brand.jsx`) ya renderiza el logo completo
(ícono+texto, versión light/dark) como imagen — ver PR de
`feature/brand-lockup-image`. Este spec no toca ese componente, solo lo
usa.

## Alcance

**Adentro:**
- `/` sin sesión (web ancho, web angosto, mobile nativo) deja de montar el
  shell de navegación.
- Agregar `PaceronBrand` al contenido de la landing en las 2 variantes que
  hoy no lo tienen (web angosto, mobile) y arriba del hero en las 3.
- Agregar un `ThemeToggle` flotante, transparente, arriba a la derecha,
  tanto en la landing (reemplazando al que vivía en el shell) como en las 4
  pantallas de auth (`login`, `register`, `forgot-password`,
  `reset-password`), que hoy no tienen ninguno.

**Afuera (explícitamente, no hacer en este trabajo):**
- `/` **con** sesión (el dashboard autenticado) no cambia — sigue con el
  shell completo.
- `login`/`register`/`forgot-password`/`reset-password` ya viven fuera del
  grupo de rutas `(tabs)` (no pasan por `app/(tabs)/_layout.jsx`) — no
  necesitan el cambio de layout de la landing, solo el toggle (sección
  aparte más abajo).
- Vectorizar la marca a SVG — ver memoria `brand-svg-followup-idea`, sin
  fecha.
- El botón "Ingresar" del estado invitado dentro del shell
  (`app-web-shell.jsx`/mobile) — memoria
  `header-ingresar-button-removal-candidate` queda de hecho resuelta por
  este cambio (la landing ya no monta ese shell), pero no se toca el shell
  en sí por si se llega a él por otra vía (URL directa a una ruta protegida
  estando deslogueado, etc. — comportamiento actual, sin cambios).

## Mecanismo: `app/(tabs)/_layout.jsx`

Hoy:

```jsx
export default function TabsLayout() {
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isNarrowWeb = useIsNarrowWeb();

  if (!hydrated) return <AppLoadingScreen />;

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

Nuevo: agregar el chequeo `pathname === '/' && !userId` (necesita leer
`userId` de `useAuthStore`, no solo `hydrated`) ANTES de la rama
`isWeb`/mobile, devolviendo un wrapper mínimo en vez de cualquiera de los 3
shells:

```jsx
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
```

- `SafeAreaView` (de `react-native-safe-area-context`, ya usado en
  `AppMobileShell`/`AuthCardShell`) cubre lo que `AppMobileShell` daba
  gratis (evitar que el toggle quede debajo de la status bar en nativo) —
  sin esto, el toggle podría quedar parcialmente tapado en dispositivos con
  notch/status bar.
- `right-4 top-4 z-10`: mismo patrón de posicionamiento absoluto ya
  usado en el repo para elementos flotantes sobre contenido con scroll —
  el toggle no se mueve al scrollear el contenido de la landing por debajo.
- Sin fondo (transparente): el `ThemeToggle` ya tiene su propio fondo
  (track del switch), no necesita una barra contenedora — flota
  directamente sobre lo que sea que haya en esa esquina del contenido
  (normalmente el fondo `bg-paper`/`dark:bg-ink` de la landing).
- Import nuevos en este archivo: `SafeAreaView` de
  `react-native-safe-area-context`, `View` de `react-native` (si no está
  ya), `ThemeToggle` de `../../components/theme/theme-toggle.jsx`.
- El resto del componente (`isWeb`/mobile con sus shells respectivos) no
  cambia — este `if` nuevo es estrictamente anterior a esas ramas y
  retorna antes de llegar a ellas.

## Contenido de la landing: brand arriba del hero

En las 3 variantes (`components/home/home-landing-screen.jsx`,
`home-web-narrow-screen.jsx`, `home-mobile-screen.jsx`), agregar
`<PaceronBrand size={XX} />` como primer hijo dentro del wrapper del hero
(`home-landing-screen-hero`/`home-web-narrow-screen-hero`/
`home-mobile-hero`), antes del badge existente ("Entrenamiento con
IA"/lo que sea que diga `HERO_CONTENT.badge`). Envolver en una `View`
simple con `className="mb-6 items-center"` (mismo espaciado que ya usa el
badge debajo) para separarlo del badge.

`size` sugerido: `28` en `home-landing-screen.jsx` (hero grande, web
ancho), `22` en las otras dos (hero más compacto). Esto es una sugerencia
de partida, no un valor cerrado — ajustar en preview si se ve
desproporcionado contra el resto del hero.

`home-landing-screen.jsx` mantiene además la `PaceronBrand` que ya tiene en
el footer (`size={16}`, sin cambios) — quedan las dos, una arriba (grande,
parte del hero) y una abajo (chica, firma del footer), consistente con el
resto de sitios que repiten el logo grande arriba/chico abajo.

## Toggle de tema en pantallas de auth

`components/auth/auth-card-shell.jsx` es el único archivo a tocar — las 4
pantallas (`login-screen.jsx`, `register-screen.jsx`,
`forgot-password-screen.jsx`, `reset-password-screen.jsx`) ya lo usan como
wrapper compartido, ninguna necesita cambio propio.

Agregar `<ThemeToggle/>` flotante arriba a la derecha del
`SafeAreaView` raíz del shell (mismo patrón que la landing: absoluto,
transparente, fuera de la card del form — no adentro del
`auth-card-shell-card`):

```jsx
return (
  <SafeAreaView className="flex-1 bg-paper dark:bg-ink" edges={['top', 'bottom']} nativeID="auth-card-shell-safe-area" testID="auth-card-shell-safe-area">
    <View className="absolute right-4 top-4 z-10" nativeID="auth-card-shell-theme-toggle" testID="auth-card-shell-theme-toggle">
      <ThemeToggle />
    </View>
    <KeyboardAwareScrollView ...>
      {/* sin cambios */}
    </KeyboardAwareScrollView>
  </SafeAreaView>
);
```

Import nuevo: `ThemeToggle` de `../theme/theme-toggle.jsx`. `View` ya está
importado en este archivo.

## Testing / verificación

Sin tests de componente (convención del repo, ver CLAUDE.md sección
Testing) — verificación manual en preview:

1. `/` sin sesión, ancho de escritorio: sin shell, brand arriba del hero,
   toggle arriba a la derecha funcionando, CTAs (`Registrarse`/`Ingresar`)
   navegan bien.
2. `/` sin sesión, ancho angosto (`<1024px`, variante narrow): mismo
   chequeo con `home-web-narrow-screen.jsx`.
3. `/` **con** sesión: shell completo sin cambios (regresión).
4. `login`/`register`/`forgot-password`/`reset-password`: toggle visible y
   funcional arriba a la derecha, sin interferir con el back-button ni con
   el card del form.
5. Mobile nativo: no verificable en el preview web de esta sesión (mismo
   límite ya documentado en CLAUDE.md sobre `Platform.OS !== 'web'`) — la
   variante narrow del web sirve de proxy razonable para el layout, pero el
   `SafeAreaView`/status-bar real solo se confirma en dispositivo o
   emulador Android.

`npm test` y `npm run lint` deben seguir en verde (ningún cambio en este
spec toca lógica pura testeada — es composición de layout).
