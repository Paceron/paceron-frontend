# Subproyecto A — Loading & refresh UX

## Contexto

Batch de mejoras de calidad de vida/UX detectadas en sesión de revisión del
estado actual del frontend (mobile + web), sin pedido funcional puntual
detrás — mejoras de percepción de velocidad, consistencia visual y
conveniencia. El batch completo se dividió en 3 sub-proyectos independientes
más una tanda de fixes bounded (sin spec):

- **Tanda de fixes** (sin spec, bounded): expo-notifications en Expo Go,
  bug de `nativeID` duplicado en `SectionCard` (`task_055878b2`), rename
  "Settings" → "Ajustes", consistencia de selects (`ResponsiveSelectField`
  + guarda ESLint), grid de cards en resultados de búsqueda de equipos.
- **Subproyecto A — Loading & refresh UX** (este documento): pull-to-refresh,
  skeleton loaders coherentes, manejo de imágenes (cache + placeholders).
- **Subproyecto B — Form & interaction polish** (spec separada, pendiente):
  auto-focus de campos al abrir teclado, confirmación al descartar cambios
  sin guardar, haptics en acciones clave.
- **Subproyecto C — Control de errores y red** (spec separada, pendiente):
  `ErrorBoundary`, timeout/`AbortController` en `services/api.js`, mapeo de
  mensajes de error.

Cada sub-proyecto es su propia rama `feature/*`, con su propio plan y
ejecución vía `subagent-driven-development` — no es un plan único gigante.

## Objetivo

Que cargar contenido en la app (listas, imágenes) se sienta rápido y
consistente entre pantallas y entre plataformas, y que el usuario tenga una
forma nativa de forzar un refresh de datos en mobile sin tener que salir y
reentrar a la pantalla.

## Pull-to-refresh

**Alcance — pantallas con pull-to-refresh:**

- `components/team/teams-list-screen.jsx`
- `components/team/team-search-screen.jsx` (lista de resultados)
- `components/notifications/notifications-screen.jsx`
- `components/team/team-detail-screen.jsx` (tabs Roster/Grupos/Solicitudes)
- `components/plans/training-plans-screen.jsx`
- `components/plans/my-plans-screen.jsx`
- `components/profile/profile-screen.jsx`

**Fuera de alcance:** cualquier drawer/sidebar (`app-mobile-shell.jsx`,
`app-web-shell-narrow.jsx`), pantallas de formulario (create/edit),
modales. No hay contenido "para refrescar" ahí — son formularios o
navegación, no listas de datos de servidor.

**Mobile-only, no web.** `RefreshControl` de React Native no tiene gesto
real equivalente en React Native Web (no existe un "swipe" táctil estándar
con mouse) — en la práctica no aporta nada ahí, y en web ya existe recargar
la página como mecanismo equivalente. Se gatea por `isMobile`
(`utils/platform.js`), no se agrega nada nuevo en la rama web de ninguna de
estas pantallas.

**Hook compartido — `hooks/use-pull-to-refresh.js` (nuevo):**

```js
import { useState, useCallback } from 'react';

// Envuelve cualquier función de refetch (Zustand fetch action o `refetch`/
// `invalidateQueries` de TanStack Query) en el contrato que espera
// `RefreshControl` de React Native: un booleano `refreshing` y un callback
// `onRefresh` sin argumentos. Silencioso ante error — el fetch ya dispara
// su propio Toast de error si falla, este hook no duplica feedback.
export function usePullToRefresh(refreshFn) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFn();
    } catch {
      // el propio refreshFn (store action / TanStack) ya maneja su error
    } finally {
      setRefreshing(false);
    }
  }, [refreshFn]);

  return { refreshing, onRefresh };
}
```

**Uso por pantalla** — cada caller pasa su propia función de refetch y
conecta el resultado al `ScrollView`/`FlatList` existente:

```jsx
// teams-list-screen.jsx (Zustand)
const { refreshing, onRefresh } = usePullToRefresh(fetchTeams);
// ...
<ScrollView refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} />} ...>
```

```jsx
// notifications-screen.jsx (TanStack Query — usa refetch de cada hook
// involucrado; combinar en un solo refreshFn con Promise.all)
const { refetch: refetchMine } = useMyJoinRequests();
const { refetch: refetchPending } = useTeamJoinRequests(teamId);
const { refreshing, onRefresh } = usePullToRefresh(() => Promise.all([refetchMine(), refetchPending()]));
```

El detalle exacto de qué refetch(s) combinar por pantalla queda para el
plan de implementación (cada pantalla ya sabe qué hooks/store actions usa
hoy) — la interfaz del hook es el contrato fijo.

## Skeleton loaders

**Primitivas nuevas — `components/shared/skeleton.jsx`:**

```jsx
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

function useShimmer() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

export function SkeletonBlock({ width, height, rounded = 'rounded-lg', className = '', nativeID, testID }) {
  const shimmerStyle = useShimmer();
  return (
    <Animated.View
      className={`bg-slate-200 dark:bg-slate-700 ${rounded} ${className}`}
      nativeID={nativeID}
      style={[{ width, height }, shimmerStyle]}
      testID={testID}
    />
  );
}

export function SkeletonCircle({ size, className = '', nativeID, testID }) {
  return <SkeletonBlock className={className} height={size} nativeID={nativeID} rounded="rounded-full" testID={testID} width={size} />;
}
```

Shimmer vía `react-native-reanimated` (ya dependencia del repo, cross-platform
— mismo mecanismo que `theme-toggle.jsx`/`section-card.jsx`), no CSS-only:
así el mismo componente anima igual en web y nativo, cumpliendo el pedido de
loaders coherentes entre plataformas.

**Uso — cada pantalla arma su "esqueleto compuesto"** combinando
`SkeletonBlock`/`SkeletonCircle` con el mismo alto/ancho que el contenido
real, para no generar salto de layout al llegar los datos. Ejemplo para una
fila de `teams-list-screen.jsx` (fila real: avatar 36px + nombre + meta):

```jsx
function TeamRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3" nativeID="teams-list-skeleton-row" testID="teams-list-skeleton-row">
      <SkeletonCircle nativeID="teams-list-skeleton-avatar" size={36} testID="teams-list-skeleton-avatar" />
      <View className="flex-1 gap-2" nativeID="teams-list-skeleton-info" testID="teams-list-skeleton-info">
        <SkeletonBlock height={14} nativeID="teams-list-skeleton-name" testID="teams-list-skeleton-name" width="60%" />
        <SkeletonBlock height={11} nativeID="teams-list-skeleton-meta" testID="teams-list-skeleton-meta" width="40%" />
      </View>
    </View>
  );
}
```

Reemplaza el `ActivityIndicator` centrado de carga inicial en: teams-list,
resultados de team-search, notifications (3 secciones), roster de equipo,
training-plans/my-plans. Se renderizan 3-4 filas de skeleton apiladas
mientras `loading` es true (no una sola).

**Fuera de alcance:** el `ActivityIndicator` de botones de submit (una
acción puntual corta: guardar, enviar solicitud) se queda como está — el
skeleton es solo para "cargando una lista/pantalla completa", no para
loading de acción.

## Imágenes — cache y placeholders

**`expo-image` (nueva dependencia)** reemplaza `Image` de `react-native` en
`components/shared/avatar-picker.jsx` (único lugar del repo con imágenes
remotas de usuario/equipo hoy). Trae cache en disco automático (evita
re-descargar el mismo avatar/ícono cada vez que se remonta la pantalla) y
prop `placeholder` nativa mientras carga — sin código manual de "loading"
propio. Cambio puntual: `import { Image } from 'react-native'` →
`import { Image } from 'expo-image'`, ajustar prop `source={{ uri }}` (ya
compatible, `expo-image` acepta el mismo shape) y agregar
`placeholder={{ color: colors.surfaceVariant }}` (o el blurhash por defecto
del paquete si el color plano no convence al implementar).

**Placeholder de equipo sin ícono subido — `TeamPlaceholderArt` (nuevo,
`components/shared/team-placeholder-art.jsx`):**

Decisión: no usar iniciales (leería como avatar de persona, no de equipo) ni
un ícono de fuente genérico (`account-group` repetido sin distinción visual)
— tampoco un asset de imagen ilustrada nueva (no hay herramienta de
generación de imágenes disponible en este entorno, y sumaría una
dependencia de asset/diseño externo). Se arma una ilustración simple
compuesta con `View`s nativas: 3 formas redondeadas superpuestas en tonos
`primary` graduados, evocando "grupo/equipo" de forma abstracta — se ve como
una pieza gráfica, no como un glyph de ícono de una sola línea:

```jsx
import { View } from 'react-native';

// Ilustración abstracta para equipos sin ícono subido — 3 formas
// superpuestas en tonos `primary` graduados, en vez de un ícono de fuente
// genérico o iniciales (que leerían como avatar de persona). El padre
// (AvatarPicker) ya recorta a `rounded-full`, así que el overflow de las
// formas se clip automático sin lógica extra acá.
export function TeamPlaceholderArt({ size }) {
  return (
    <View nativeID="team-placeholder-art" style={{ height: size, width: size }} testID="team-placeholder-art">
      <View
        className="absolute rounded-full bg-primary/30 dark:bg-primary/20"
        style={{ height: size * 0.58, left: size * 0.02, top: size * 0.06, width: size * 0.58 }}
      />
      <View
        className="absolute rounded-full bg-primary/55 dark:bg-primary/40"
        style={{ height: size * 0.58, right: size * 0.02, top: size * 0.06, width: size * 0.58 }}
      />
      <View
        className="absolute self-center rounded-2xl bg-primary"
        style={{ bottom: size * 0.04, height: size * 0.5, width: size * 0.62 }}
      />
    </View>
  );
}
```

**Wiring en `AvatarPicker`** (`components/shared/avatar-picker.jsx`) — nueva
prop `placeholder` (valor `'team'` hoy, extensible a futuro), evaluada antes
del branch de ícono actual:

```jsx
export function AvatarPicker({ uri, onPick, onRemove, loading = false, size = 64, fallbackIcon, initials, placeholder, idPrefix, accessibilityLabel }) {
  // ...
  {showImage ? (
    <Image ... />
  ) : showInitials ? (
    <Text ...>{initials}</Text>
  ) : placeholder === 'team' ? (
    <TeamPlaceholderArt size={size} />
  ) : (
    <MaterialCommunityIcons color={colors.onSurfaceVariant} name={fallbackIcon} size={size * 0.5} />
  )}
}
```

**Call sites que pasan a usar `placeholder="team"`** en vez de
`fallbackIcon="account-group"` (se puede dejar `fallbackIcon` seteado igual
como fallback del fallback, sin costo, pero deja de leerse en la práctica
mientras `placeholder="team"` esté presente):

- `components/team/teams-list-screen.jsx:24`
- `components/team/team-search-screen.jsx:34`
- `components/team/team-detail-screen.jsx:1046`

Los avatares de usuario (`fallbackIcon="account"` + `initials`) no cambian
— siguen mostrando iniciales, que ahí sí tiene sentido.

## Fuera de alcance

- Sub-proyectos B y C (form/interaction polish, control de errores) —
  specs y ramas separadas.
- La tanda de fixes bounded (expo-notifications, `SectionCard`,
  "Ajustes", selects, grid de cards de búsqueda) — sin spec, ya
  diseñada/aprobada en chat, se ejecuta aparte.
- No se agrega pull-to-refresh en web bajo ninguna forma (ni con gesto de
  mouse simulado ni con un botón de refresh visible) — recargar la página
  ya cubre ese caso en esa plataforma.
- No se optimizan listas largas con `FlatList`/virtualización en esta
  spec — quedó anotado como hallazgo de optimización en la conversación,
  pero es un cambio de estructura de renderizado distinto al de esta spec
  (loading/refresh), no se mezcla acá.

## Testing

Sin tests de render de componentes (convención del repo). Verificación
manual en preview web (para skeletons e imágenes — pull-to-refresh no
aplica ahí) y en Expo Go/emulador Android (para pull-to-refresh real: swipe
hacia abajo en cada una de las 7 pantallas listadas, confirmar que dispara
el refetch correcto y que `refreshing` vuelve a `false` al terminar, éxito o
error). `npm test`/`npm run lint` en verde antes de mergear.
