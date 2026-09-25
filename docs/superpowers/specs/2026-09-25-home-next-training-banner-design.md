# Banner de próximo entrenamiento en el home

## Contexto

Pieza 4 del sub-proyecto "calendario/entrenamientos" (orden acordado: 1 grilla
—shippeada, PR #138—, 2 restructura corredor, 3 restructura entrenador, 4
este banner, 5 vista semanal). El usuario adelantó esta pieza antes que la 2
y la 3. Es el primer componente real del dashboard del home autenticado
(`components/home/authenticated-home-screen.jsx`), hoy un placeholder puro
("Tu panel está en construcción...").

## Alcance

**Sí:**
- Banner en el home mostrando el próximo entrenamiento (corredor: cualquiera;
  entrenador: solo presencial) y las sesiones canceladas entre hoy y esa
  fecha.
- Click inteligente: nativo + elegible para empezar → pre-start; si no
  (web, o no elegible todavía) → calendario agregado con el
  `DayDetailModal` abierto para ese día.
- Deep-link nuevo hacia `/calendar`/`/administered-calendar` con un
  parámetro de fecha, para poder abrir el modal de un día sin haber
  clickeado la celda del calendario.

**No** (fuera de esta spec):
- Vista semanal, restructura de secciones (piezas 2/3, pendientes).
- Otros widgets futuros del dashboard del home.
- Reanudar una sesión en curso, entrenamientos asíncronos del entrenador,
  asistencia/QR.

## Fuente de datos

**Decisión (reemplaza a los endpoints livianos de Gap 10):** reusar
`useMemberCalendar`/`useAdministeredCalendar` (`hooks/use-aggregated-calendar.js`)
con la misma ventana fija de 90 días ya definida en la pieza 1
(`upcomingTrainingsRange()`, `utils/upcoming-trainings.js`), derivando todo
del lado del cliente. Los endpoints `next-session`/`next-presencial-session`
(Gap 10, ya resueltos en el backend) NO se usan — solo dan el cancelado más
cercano (no la lista completa pedida) y no incluyen el detalle de ejercicios
que hace falta para pre-start. Reusar el calendario agregado da la lista
completa y el detalle completo en el mismo request, sin plomería nueva de
servicio/normalizer.

**`utils/next-training-banner.js`** (nuevo, puro, testeable):

```js
function toISODate(date) {
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function selectNextTraining(days, { presencialOnly = false } = {}, now = new Date()) {
  const todayISO = toISODate(now);
  const candidates = days
    .filter((day) => day.kind === 'training' && day.date >= todayISO && (!presencialOnly || day.isPresencial))
    .sort((a, b) => a.date.localeCompare(b.date));
  return candidates[0] ?? null;
}

export function selectCancelledBefore(days, beforeDate, now = new Date()) {
  const todayISO = toISODate(now);
  return days
    .filter((day) => day.kind === 'cancelled' && day.date >= todayISO && day.date < beforeDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

- `presencialOnly: true` para el entrenador (mismo criterio que
  `canStartPresencialSession`), `false` para el corredor (igual que hoy no
  filtra por `isPresencial` en `canStartAsyncSession` — el corredor ve
  cualquier tipo de entrenamiento como "el próximo", solo la elegibilidad de
  click cambia según sea presencial o no).
- `selectCancelledBefore` se llama con `beforeDate = nextTraining.date` — si
  no hay `nextTraining`, no se llama (ver componente).

**`hooks/use-next-training-banner.js`** (nuevo):

```js
import { useMemo } from 'react';
import { useMemberCalendar, useAdministeredCalendar } from './use-aggregated-calendar.js';
import { upcomingTrainingsRange } from '../utils/upcoming-trainings.js';
import { selectNextTraining, selectCancelledBefore } from '../utils/next-training-banner.js';

export function useNextTrainingBanner(role, userId) {
  const { from, to } = useMemo(() => upcomingTrainingsRange(), []);
  const memberQuery = useMemberCalendar(role === 'runner' ? userId : null, from, to);
  const administeredQuery = useAdministeredCalendar(role === 'trainer' ? userId : null, from, to);
  const { days, loading, isFetching } = role === 'trainer' ? administeredQuery : memberQuery;

  const nextTraining = useMemo(
    () => selectNextTraining(days, { presencialOnly: role === 'trainer' }),
    [days, role],
  );
  const cancelledSessions = useMemo(
    () => (nextTraining ? selectCancelledBefore(days, nextTraining.date) : []),
    [days, nextTraining],
  );

  return { nextTraining, cancelledSessions, loading, isFetching };
}
```

`useMemberCalendar(null, ...)`/`useAdministeredCalendar(null, ...)` ya
devuelven `enabled: false` (guard existente `Boolean(userId && from && to)`)
— pedir con `userId=null` para el rol que no aplica no dispara ningún
request de más, patrón ya usado en el resto del código.

## Componente: `components/home/next-training-banner.jsx`

```jsx
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { useNextTrainingBanner } from '../../hooks/use-next-training-banner.js';
import { useSessionRuntimeStore } from '../../store/session-runtime-store.js';
import { canStartAsyncSession, canStartPresencialSession } from '../../utils/session-start-window.js';
import { isWeb } from '../../utils/platform.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';

function CancelledChip({ session, onPress }) {
  const colors = useThemeColors();
  const idPrefix = `next-training-banner-cancelled-${session.id}`;

  return (
    <Pressable
      className="mb-2 flex-row items-center gap-2 rounded-xl bg-red-50 px-3 py-2 dark:bg-red-900/20"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <MaterialCommunityIcons color="#ef4444" name="calendar-remove-outline" size={16} />
      <Text className="flex-1 text-xs font-medium text-red-700 dark:text-red-400" nativeID={`${idPrefix}-label`} testID={`${idPrefix}-label`}>
        Se canceló "{session.sessionInstance?.name ?? 'Entrenamiento'}" del {formatDisplayDate(session.date)}
      </Text>
    </Pressable>
  );
}

export function NextTrainingBanner() {
  const router = useRouter();
  const colors = useThemeColors();
  const userId = useAuthStore((s) => s.userId);
  const role = useAuthStore((s) => s.activeRole);
  const setPendingSession = useSessionRuntimeStore((s) => s.setPendingSession);
  const { nextTraining, cancelledSessions, loading, isFetching } = useNextTrainingBanner(role, userId);

  if (!role) return null;

  const calendarHref = role === 'trainer' ? '/administered-calendar' : '/calendar';

  const goToCalendarDay = (date) => {
    router.push({ pathname: calendarHref, params: { date } });
  };

  if (!nextTraining) {
    return (
      <View className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID="next-training-banner-empty" testID="next-training-banner-empty">
        <View className="flex-row items-center gap-2" nativeID="next-training-banner-empty-header" testID="next-training-banner-empty-header">
          <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="next-training-banner-empty-label" testID="next-training-banner-empty-label">
            No tenés entrenamientos programados.
          </Text>
          {(loading || isFetching) && (
            <ActivityIndicator color={colors.primary} nativeID="next-training-banner-empty-loading" size="small" testID="next-training-banner-empty-loading" />
          )}
        </View>
      </View>
    );
  }

  const eligible = role === 'trainer' ? canStartPresencialSession(nextTraining) : canStartAsyncSession(nextTraining);

  const handlePress = () => {
    if (eligible && !isWeb) {
      setPendingSession(nextTraining);
      router.push('/training-session');
      return;
    }
    goToCalendarDay(nextTraining.date);
  };

  return (
    <View className="mb-6" nativeID="next-training-banner-root" testID="next-training-banner-root">
      {cancelledSessions.length > 0 && (
        <View className="mb-2" nativeID="next-training-banner-cancelled-list" testID="next-training-banner-cancelled-list">
          {cancelledSessions.map((session) => (
            <CancelledChip key={session.id} onPress={() => goToCalendarDay(session.date)} session={session} />
          ))}
        </View>
      )}

      <Pressable
        className="rounded-2xl bg-primary p-5 active:opacity-90"
        nativeID="next-training-banner-hero"
        onPress={handlePress}
        testID="next-training-banner-hero"
      >
        <View className="flex-row items-center justify-between" nativeID="next-training-banner-hero-header" testID="next-training-banner-hero-header">
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]/70" nativeID="next-training-banner-hero-date" testID="next-training-banner-hero-date">
            {formatWeekdayLabel(nextTraining.date, { short: true })}, {formatDisplayDate(nextTraining.date)}
          </Text>
          {(loading || isFetching) && <ActivityIndicator color="#111518" nativeID="next-training-banner-hero-loading" size="small" testID="next-training-banner-hero-loading" />}
        </View>

        <Text className="mt-1 text-xl font-bold text-[#111518]" nativeID="next-training-banner-hero-title" testID="next-training-banner-hero-title">
          {nextTraining.sessionInstance?.name ?? 'Entrenamiento'}
        </Text>

        <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1" nativeID="next-training-banner-hero-scope" testID="next-training-banner-hero-scope">
          <View className="flex-row items-center gap-1" nativeID="next-training-banner-hero-team" testID="next-training-banner-hero-team">
            <MaterialCommunityIcons color="#111518" name="shield-account-outline" size={14} />
            <Text className="text-xs font-semibold text-[#111518]" nativeID="next-training-banner-hero-team-label" testID="next-training-banner-hero-team-label">
              {nextTraining.teamName}
            </Text>
          </View>
          <View className="flex-row items-center gap-1" nativeID="next-training-banner-hero-group" testID="next-training-banner-hero-group">
            <MaterialCommunityIcons color="#111518" name="account-multiple-outline" size={14} />
            <Text className="text-xs font-semibold text-[#111518]" nativeID="next-training-banner-hero-group-label" testID="next-training-banner-hero-group-label">
              {nextTraining.groupName}
            </Text>
          </View>
        </View>

        {nextTraining.isPresencial && (
          <View className="mt-2 flex-row items-center gap-1.5" nativeID="next-training-banner-hero-presencial" testID="next-training-banner-hero-presencial">
            <MaterialCommunityIcons color="#111518" name="map-marker-outline" size={14} />
            <Text className="text-xs text-[#111518]" nativeID="next-training-banner-hero-presencial-label" testID="next-training-banner-hero-presencial-label">
              {nextTraining.presencialTimeFrom}–{nextTraining.presencialTimeTo}
              {nextTraining.presencialLocation?.label ? ` · ${nextTraining.presencialLocation.label}` : ''}
            </Text>
          </View>
        )}

        <View className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-[#111518]/10 px-3 py-1.5" nativeID="next-training-banner-hero-cta" testID="next-training-banner-hero-cta">
          <MaterialCommunityIcons color="#111518" name={eligible && !isWeb ? 'play' : 'calendar-month-outline'} size={14} />
          <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID="next-training-banner-hero-cta-label" testID="next-training-banner-hero-cta-label">
            {eligible && !isWeb ? 'Iniciar entrenamiento' : 'Ver en el calendario'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
```

**Decisión de diseño (respuesta a "puede hacerse más moderno"):** toda la
card hero es un único `Pressable` con un único comportamiento — no hay un
botón de play anidado separado de un click-para-detalle como en la grilla
de la pieza 1. Ahí tenía sentido separar ("ver detalle" vs. "empezar ahora")
porque la fila compite con otras filas en una lista; acá el banner ES el
CTA principal del dashboard, así que un solo gesto claro es más simple y
evita el riesgo de gestos anidados (mismo tipo de problema ya documentado
en `CLAUDE.md` para el drag-and-drop, aunque acá no hay gesture-handler de
por medio, el principio de "un Pressable, una acción" aplica igual). La
etiqueta del botón (chip inferior) y su ícono cambian según sea elegible
(`play` + "Iniciar entrenamiento") o no (`calendar-month-outline` + "Ver en
el calendario"), comunicando el resultado del click sin ambigüedad.

## Deep-link al calendario con el modal abierto

`my-calendar-screen.jsx` y `administered-calendar-screen.jsx` agregan:

```jsx
import { useLocalSearchParams } from 'expo-router';
// ...
const { date: deepLinkDate } = useLocalSearchParams();
const appliedDeepLinkRef = useRef(false);

useEffect(() => {
  if (!deepLinkDate || appliedDeepLinkRef.current) return;
  appliedDeepLinkRef.current = true;
  const [year, month] = deepLinkDate.split('-').map(Number);
  setVisibleYear(year);
  setVisibleMonth(month);
  setOpenDate(deepLinkDate);
}, [deepLinkDate]);
```

El guard `appliedDeepLinkRef` asegura que solo se aplique una vez al
montar — si el usuario cierra el modal y sigue navegando el calendario
manualmente, no se reabre solo. Requiere `useRef`/`useEffect` ya importados
de React en ambos archivos (agregar a los imports existentes de
`useMemo, useState` → `useEffect, useMemo, useRef, useState`).

## Ubicación en el home

`components/home/authenticated-home-screen.jsx` pasa de `View` centrado a
`ScrollView` con el saludo arriba (sin el texto "tu panel está en
construcción", ya no aplica del todo) y `<NextTrainingBanner />` debajo:

```jsx
import { ScrollView, Text, View } from 'react-native';
import { useAuthStore } from '../../store/auth-store.js';
import { useUser } from '../../hooks/use-user.js';
import { NextTrainingBanner } from './next-training-banner.jsx';

export function AuthenticatedHomeScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { user } = useUser(userId);
  const firstName = user?.name || '';

  return (
    <ScrollView className="flex-1 bg-paper dark:bg-ink" contentContainerClassName="px-4 py-8" nativeID="authenticated-home-screen-root" testID="authenticated-home-screen-root">
      <Text className="mb-6 text-2xl text-slate-900 dark:text-white" nativeID="authenticated-home-screen-greeting" style={{ fontFamily: 'Orbitron_700Bold' }} testID="authenticated-home-screen-greeting">
        {firstName ? `Hola, ${firstName}` : 'Bienvenido a Paceron'}
      </Text>
      <NextTrainingBanner />
    </ScrollView>
  );
}
```

(El ícono/badge circular que tenía el placeholder anterior se saca — ya no
hace falta un ícono decorativo cuando hay contenido real debajo.)

## Testing

Jest sobre `utils/next-training-banner.js` (`selectNextTraining` — filtra
por `kind`/`presencialOnly`/fecha pasada, ordena ascendente;
`selectCancelledBefore` — filtra por rango `[hoy, beforeDate)`, ordena
ascendente). Sin tests de render (convención del proyecto).

## Explícitamente fuera de alcance de esta spec

Vista semanal, restructura de secciones (piezas 2/3), otros widgets del
home, reanudar sesión en curso, entrenamientos asíncronos del entrenador,
asistencia/QR.
