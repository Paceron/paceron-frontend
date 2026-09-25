# Grilla de próximos entrenamientos

## Contexto

Primera pieza del sub-proyecto "calendario/entrenamientos" acordado tras cerrar
`feature/live-session-base` (PR #136). Orden completo acordado con el usuario:
(1) esta grilla, (2) restructura de sección corredor ("Entrenamientos"), (3)
restructura de sección entrenador ("Calendario"), (4) banner de home del
corredor, (5) vista semanal (menor prioridad). Esta spec cubre solo la pieza 1.

Va **debajo** del calendario mensual ya existente (`AggregatedMonthView`), en
la misma pantalla scrolleable — no lo reemplaza ni compite con él.

## Alcance

**Sí:**
- Lista de los próximos 5 entrenamientos (no cancelados, no descanso, no
  "otra actividad") de una ventana fija de 90 días desde hoy, respetando el
  mismo filtro de equipo/grupo que ya existe en cada pantalla.
- Botón "Ver todos" que abre un modal con el resto de esa misma ventana.
- Tocar una tarjeta abre el `DayDetailModal` ya existente. Si el
  entrenamiento es elegible para empezar (mismo gating de
  `StartSessionButton`), la tarjeta tiene además un botón de play que
  navega directo a pre-start sin pasar por el modal.
- Un componente compartido para las 2 pantallas (`my-calendar-screen.jsx` /
  `administered-calendar-screen.jsx`).

**No** (fuera de esta spec):
- Vista semanal del calendario.
- Restructura de secciones / rename / pestaña de historial.
- Banner del home.
- Ventana sin límite real con paginación — se anota como mejora futura, no
  se implementa ahora (ver "Mejora futura" más abajo).

## Datos: reusar los hooks existentes con otro rango

`hooks/use-aggregated-calendar.js` ya expone `useMemberCalendar(userId, from,
to)` / `useAdministeredCalendar(userId, from, to)`, cacheados por
`[nombre, userId, from, to]`. No hace falta un hook nuevo — alcanza con
llamar al mismo hook con un rango de 90 días en vez del mes visible. Cada
pantalla ya usa el hook una vez para el calendario mensual; sumar una
segunda llamada (mismo hook, distinto `from`/`to`) es una query aparte en
caché, sin conflicto.

**`utils/upcoming-trainings.js`** (nuevo, puro, testeable con Jest):

```js
import { pad2 } from './calendar-month-range.js';

const UPCOMING_WINDOW_DAYS = 90;

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function upcomingTrainingsRange(now = new Date()) {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + UPCOMING_WINDOW_DAYS);
  return { from: toISODate(now), to: toISODate(to) };
}

export function selectUpcomingTrainings(days, now = new Date()) {
  const todayISO = toISODate(now);
  return days
    .filter((day) => day.kind === 'training' && day.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

- `kind === 'training'` ya excluye `rest`/`other`/`cancelled` — no hace
  falta un chequeo aparte para cancelados.
- `now` inyectable, mismo patrón ya usado en `session-start-window.js` /
  `calendar-day-closed.js` (sin Jest fake timers).
- El rango (`upcomingTrainingsRange`) se calcula una vez por montaje de
  pantalla (`useMemo(() => upcomingTrainingsRange(), [])`) — no hace falta
  recalcularlo en cada render, la ventana de 90 días no necesita esa
  precisión.

**Mejora futura, no implementada ahora:** reemplazar la ventana fija de 90
días por una búsqueda sin límite real (pedir el mes siguiente si no
alcanzaron 5 resultados, hasta un tope de seguridad). Anotar en el código
como comentario corto en `upcoming-trainings.js` apuntando a esta spec.

## Componente: `components/calendar/upcoming-trainings-grid.jsx`

Compartido por ambas pantallas. Props: `trainings` (array ya filtrado por
equipo/grupo por quien lo usa — mismo criterio que hoy filtra
`daysByDate` del calendario mensual), `variant` (`'member'` |
`'administered'`), `loading`.

```jsx
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatDisplayDate, formatWeekdayLabel } from '../../utils/format-date-display.js';
import { StartSessionButton } from './start-session-button.jsx';
import { DayDetailModal } from './day-detail-modal.jsx';

const PREVIEW_COUNT = 5;

function UpcomingTrainingCard({ training, variant, onPress }) {
  const colors = useThemeColors();
  const idPrefix = `upcoming-training-card-${training.id}`;

  return (
    <Pressable
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
      nativeID={idPrefix}
      onPress={onPress}
      testID={idPrefix}
    >
      <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-date`} testID={`${idPrefix}-date`}>
        {formatWeekdayLabel(training.date, { short: true })}, {formatDisplayDate(training.date)}
      </Text>
      <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-0.5" nativeID={`${idPrefix}-scope`} testID={`${idPrefix}-scope`}>
        <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-team`} testID={`${idPrefix}-team`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="shield-account-outline" size={12} />
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-team-label`} testID={`${idPrefix}-team-label`}>
            {training.teamName}
          </Text>
        </View>
        <View className="flex-row items-center gap-1" nativeID={`${idPrefix}-group`} testID={`${idPrefix}-group`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={12} />
          <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-group-label`} testID={`${idPrefix}-group-label`}>
            {training.groupName}
          </Text>
        </View>
      </View>
      <Text className="mt-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${idPrefix}-session-name`} testID={`${idPrefix}-session-name`}>
        {training.sessionInstance?.name ?? 'Entrenamiento'}
      </Text>
      {training.isPresencial && (
        <View className="mt-1 flex-row items-center gap-1.5" nativeID={`${idPrefix}-presencial`} testID={`${idPrefix}-presencial`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="map-marker-outline" size={14} />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-presencial-label`} testID={`${idPrefix}-presencial-label`}>
            {training.presencialTimeFrom}–{training.presencialTimeTo}
            {training.presencialLocation?.label ? ` · ${training.presencialLocation.label}` : ''}
          </Text>
        </View>
      )}
      <StartSessionButton assignment={training} role={variant === 'member' ? 'runner' : 'trainer'} />
    </Pressable>
  );
}

export function UpcomingTrainingsGrid({ trainings, variant }) {
  const [seeAllVisible, setSeeAllVisible] = useState(false);
  const [openTraining, setOpenTraining] = useState(null);

  const previewTrainings = trainings.slice(0, PREVIEW_COUNT);
  const hasMore = trainings.length > PREVIEW_COUNT;

  return (
    <View className="mt-6 gap-2" nativeID="upcoming-trainings-grid-root" testID="upcoming-trainings-grid-root">
      <Text className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID="upcoming-trainings-grid-title" testID="upcoming-trainings-grid-title">
        Próximos entrenamientos
      </Text>

      {previewTrainings.length === 0 && (
        <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID="upcoming-trainings-grid-empty" testID="upcoming-trainings-grid-empty">
          No tenés entrenamientos próximos.
        </Text>
      )}

      <View className="gap-2" nativeID="upcoming-trainings-grid-list" testID="upcoming-trainings-grid-list">
        {previewTrainings.map((training) => (
          <UpcomingTrainingCard key={training.id} onPress={() => setOpenTraining(training)} training={training} variant={variant} />
        ))}
      </View>

      {hasMore && (
        <Pressable
          className="mt-1 h-9 flex-row items-center justify-center gap-1.5 self-start rounded-full border border-slate-200 px-3 active:opacity-70 dark:border-slate-700"
          nativeID="upcoming-trainings-grid-see-all-button"
          onPress={() => setSeeAllVisible(true)}
          testID="upcoming-trainings-grid-see-all-button"
        >
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="dots-horizontal" size={16} />
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID="upcoming-trainings-grid-see-all-button-label" testID="upcoming-trainings-grid-see-all-button-label">
            Ver todos ({trainings.length})
          </Text>
        </Pressable>
      )}

      <Modal
        animationType="fade"
        nativeID="upcoming-trainings-grid-see-all-modal"
        onRequestClose={() => setSeeAllVisible(false)}
        testID="upcoming-trainings-grid-see-all-modal"
        transparent
        visible={seeAllVisible}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          nativeID="upcoming-trainings-grid-see-all-modal-backdrop"
          onPress={() => setSeeAllVisible(false)}
          testID="upcoming-trainings-grid-see-all-modal-backdrop"
        >
          <Pressable
            className="max-h-[80%] w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-surface"
            nativeID="upcoming-trainings-grid-see-all-modal-card"
            onPress={() => {}}
            testID="upcoming-trainings-grid-see-all-modal-card"
          >
            <Text className="mb-3 text-lg font-bold text-slate-900 dark:text-white" nativeID="upcoming-trainings-grid-see-all-modal-title" testID="upcoming-trainings-grid-see-all-modal-title">
              Próximos entrenamientos
            </Text>
            <ScrollView nativeID="upcoming-trainings-grid-see-all-modal-scroll" testID="upcoming-trainings-grid-see-all-modal-scroll">
              <View className="gap-2" nativeID="upcoming-trainings-grid-see-all-modal-list" testID="upcoming-trainings-grid-see-all-modal-list">
                {trainings.map((training) => (
                  <UpcomingTrainingCard key={training.id} onPress={() => { setSeeAllVisible(false); setOpenTraining(training); }} training={training} variant={variant} />
                ))}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <DayDetailModal
        assignments={openTraining ? [openTraining] : []}
        date={openTraining?.date ?? ''}
        onClose={() => setOpenTraining(null)}
        variant={variant}
        visible={Boolean(openTraining)}
      />
    </View>
  );
}
```

(El snippet de arriba omite `const colors = useThemeColors();` dentro de
`UpcomingTrainingsGrid` por brevedad de la spec — el plan de implementación
lo agrega, lo usa el ícono del botón "Ver todos".)

**Decisión explícita:** tocar una tarjeta abre `DayDetailModal` con **solo
ese entrenamiento** (`assignments={[training]}`), no con el resto de
asignaciones que pudiera tener ese mismo día en otro grupo. Es distinto del
click en una celda del calendario mensual (que sí agrupa todas las
asignaciones de ese día) — acá cada tarjeta ya representa una asignación
puntual, agruparlas de nuevo sería inconsistente con "una tarjeta, un
entrenamiento".

## Wiring

En `my-calendar-screen.jsx` y `administered-calendar-screen.jsx`, debajo de
`<AggregatedMonthView .../>`:

```jsx
const { from: upcomingFrom, to: upcomingTo } = useMemo(() => upcomingTrainingsRange(), []);
const { days: upcomingDaysRaw } = useMemberCalendar(userId, upcomingFrom, upcomingTo); // o useAdministeredCalendar
const upcomingTrainings = useMemo(() => selectUpcomingTrainings(upcomingDaysRaw), [upcomingDaysRaw]);
const filteredUpcoming = useMemo(() => {
  let result = upcomingTrainings;
  if (filterTeamId) result = result.filter((t) => t.teamId === filterTeamId);
  if (filterGroupId) result = result.filter((t) => t.groupId === filterGroupId); // solo administered
  return result;
}, [upcomingTrainings, filterTeamId /*, filterGroupId */]);
```

```jsx
<UpcomingTrainingsGrid trainings={filteredUpcoming} variant="member" /> {/* o "administered" */}
```

Mismas variables de filtro (`filterTeamId`, `filterGroupId` en la pantalla
de entrenador) que ya filtran `daysByDate` del calendario mensual — se
reusan tal cual, sin estado nuevo.

## Testing

Jest sobre `utils/upcoming-trainings.js` (`upcomingTrainingsRange` con
`now` inyectado — verificar `from`/`to` exactos; `selectUpcomingTrainings`
— excluye `rest`/`other`/`cancelled`, excluye días pasados, incluye hoy,
ordena ascendente). Sin tests de render (convención del proyecto).

## Explícitamente fuera de alcance de esta spec

Vista semanal, restructura de secciones (rename, pestaña de historial),
banner de home, ventana sin límite real con paginación.
