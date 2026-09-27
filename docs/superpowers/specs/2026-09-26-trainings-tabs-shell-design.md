# Shell de tabs "Entrenamientos" + filtro colapsable

## Contexto

Primera pieza del sub-proyecto de historial de entrenamientos (orden
acordado: 1 este shell, 2 historial corredor, 3 historial entrenador, 4
vista semanal —ya pendiente de antes—, 5 registro de sesiones presenciales
—subproyecto grande aparte—, super chiches diferidos indefinidamente). Esta
pieza es puramente estructural: renombra las 2 secciones de calendario a
"Entrenamientos", agrega pestañas Calendario/Historial, y mejora el
filtrado existente — sin construir todavía el contenido real del
historial (piezas 2/3).

## Alcance

**Sí:**
- `components/calendar/my-calendar-screen.jsx` y
  `administered-calendar-screen.jsx` pasan a mostrar 2 pestañas
  ("Calendario"/"Historial", Calendario por default), mismo estilo visual
  que `edit-profile-screen.jsx`.
- Ambas secciones se renombran a "Entrenamientos" (título de pantalla +
  label del nav en `routes/catalog.js`).
- Pestaña Historial: stub ("Próximamente"), sin datos reales todavía.
- Filtro de equipo/grupo pasa de siempre-visible a colapsable (ícono de
  embudo, togglea, botón "Limpiar filtros" cuando hay algo activo, loading
  en el ícono mientras el mes carga).
- 2 componentes compartidos nuevos: `SectionTabBar` y `FilterPanel` —
  reusables a futuro (el propio usuario mencionó el filtro de búsqueda de
  equipos como candidato).

**No** (fuera de esta spec):
- Contenido real de historial (piezas 2/3).
- Migrar el `TabBar` interno de `edit-profile-screen.jsx` a usar el nuevo
  `SectionTabBar` compartido — mismo lenguaje visual, pero tocar ese
  archivo no aporta a esta pieza (refactor no relacionado).
- Vista semanal, registro de sesiones presenciales, super chiches.

## `components/shared/section-tab-bar.jsx` (nuevo)

Generalización del `TabBar` de `edit-profile-screen.jsx` (mismo look:
`bg-primary-tint-subtle`/`text-primary` cuando está activa), parametrizado
en vez de hardcodear las 2 pestañas de esa pantalla:

```jsx
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function SectionTabBar({ tabs, active, onChange, idPrefix }) {
  const colors = useThemeColors();

  return (
    <View className="mb-6 flex-row gap-2" nativeID={`${idPrefix}-tab-bar`} testID={`${idPrefix}-tab-bar`}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 ${
              isActive ? 'bg-primary-tint-subtle dark:bg-primary/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            key={tab.id}
            nativeID={`${idPrefix}-tab-${tab.id}`}
            onPress={() => onChange(tab.id)}
            testID={`${idPrefix}-tab-${tab.id}`}
          >
            <MaterialCommunityIcons color={isActive ? colors.primary : colors.onSurfaceVariant} name={tab.icon} size={16} />
            <Text
              className={`text-sm ${isActive ? 'font-semibold text-primary' : 'font-medium text-slate-700 dark:text-slate-200'}`}
              nativeID={`${idPrefix}-tab-${tab.id}-label`}
              testID={`${idPrefix}-tab-${tab.id}-label`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

## `components/shared/filter-panel.jsx` (nuevo)

```jsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function FilterPanel({ hasActiveFilters, loading, onClear, children, idPrefix }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <View className="mb-4" nativeID={`${idPrefix}-root`} testID={`${idPrefix}-root`}>
      <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-header`} testID={`${idPrefix}-header`}>
        <Pressable
          className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-70 ${
            open ? 'border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'border-slate-200 dark:border-slate-700'
          }`}
          nativeID={`${idPrefix}-toggle`}
          onPress={() => setOpen((v) => !v)}
          testID={`${idPrefix}-toggle`}
        >
          {loading ? (
            <ActivityIndicator color={colors.onSurfaceVariant} nativeID={`${idPrefix}-toggle-loading`} size="small" testID={`${idPrefix}-toggle-loading`} />
          ) : (
            <MaterialCommunityIcons color={open ? colors.primary : colors.onSurfaceVariant} name="filter-variant" size={16} />
          )}
          <Text className={`text-xs font-semibold ${open ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`} nativeID={`${idPrefix}-toggle-label`} testID={`${idPrefix}-toggle-label`}>
            Filtros
          </Text>
        </Pressable>

        {hasActiveFilters && (
          <Pressable
            className="flex-row items-center gap-1 rounded-full px-2 py-1.5 active:opacity-70"
            nativeID={`${idPrefix}-clear`}
            onPress={onClear}
            testID={`${idPrefix}-clear`}
          >
            <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle-outline" size={14} />
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-clear-label`} testID={`${idPrefix}-clear-label`}>
              Limpiar filtros
            </Text>
          </Pressable>
        )}
      </View>

      {open && (
        <View className="mt-3 gap-2" nativeID={`${idPrefix}-content`} testID={`${idPrefix}-content`}>
          {children}
        </View>
      )}
    </View>
  );
}
```

- `open` es estado interno del componente — no se resetea ni se toca al
  cambiar un valor de filtro (los `ResponsiveSelectField` pasados como
  `children` viven en el padre, con su propio `onChange`; togglear el
  panel y elegir un valor son dos acciones independientes).
- `hasActiveFilters`/`onClear` los calcula/provee cada pantalla (dueña del
  estado real de filtros) — el componente no sabe qué es "un filtro", solo
  muestra/oculta y ofrece el botón de limpiar.

## `components/calendar/trainings-history-tab.jsx` (nuevo, stub)

```jsx
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

export function TrainingsHistoryTab() {
  const colors = useThemeColors();

  return (
    <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-surface" nativeID="trainings-history-tab-root" testID="trainings-history-tab-root">
      <MaterialCommunityIcons color={colors.onSurfaceVariant} name="history" size={32} />
      <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400" nativeID="trainings-history-tab-placeholder" testID="trainings-history-tab-placeholder">
        Próximamente vas a poder ver acá el historial de entrenamientos realizados.
      </Text>
    </View>
  );
}
```

## Wiring en `my-calendar-screen.jsx` / `administered-calendar-screen.jsx`

Ambas pantallas:
- `const [activeTab, setActiveTab] = useState('calendario');`
- El efecto de deep-link (`appliedDeepLinkRef`) agrega `setActiveTab('calendario');` — un link desde el banner del home siempre debe caer en la pestaña que va a mostrar el modal, aunque el historial fuera la última vista.
- Título de pantalla: "Mi calendario" → "Entrenamientos" (corredor), "Calendario" → "Entrenamientos" (entrenador).
- `<SectionTabBar idPrefix="my-calendar-screen" tabs={TRAININGS_TABS} active={activeTab} onChange={setActiveTab} />` justo debajo del header, antes del filtro. `TRAININGS_TABS` es un array local en cada archivo (2 objetos, no amerita extraerlo a un módulo compartido):

```js
const TRAININGS_TABS = [
  { id: 'calendario', label: 'Calendario', icon: 'calendar-month-outline' },
  { id: 'historial', label: 'Historial', icon: 'history' },
];
```

- Todo el bloque actual (filtro + `AggregatedMonthView` + `UpcomingTrainingsGrid`) queda envuelto en `{activeTab === 'calendario' && (...)}`; se agrega `{activeTab === 'historial' && <TrainingsHistoryTab />}` como alternativa. El `DayDetailModal` sigue montado siempre (no depende de la pestaña) — solo se abre por acción explícita (click en día o deep-link), no por cambio de pestaña.
- El bloque de filtro actual (`View` con los `ResponsiveSelectField`) se reemplaza por `FilterPanel` envolviendo el mismo contenido:

```jsx
{teamOptions.length > 0 && (
  <FilterPanel hasActiveFilters={Boolean(filterTeamId)} idPrefix="my-calendar-screen-filter" loading={loading} onClear={() => setFilterTeamId('')}>
    <View className={stackFilter ? 'w-full' : 'w-full max-w-xs'} nativeID="my-calendar-screen-filter-team-wrapper" testID="my-calendar-screen-filter-team-wrapper">
      <ResponsiveSelectField dense hideErrorRow label="Equipo" onChange={setFilterTeamId} options={teamOptions.map((t) => ({ id: t.teamId, name: t.teamName }))} placeholder="Todos los equipos" value={filterTeamId} />
    </View>
    {selectedTeam && (
      <View className="flex-row items-center gap-1" nativeID="my-calendar-screen-filter-group-label-wrapper" testID="my-calendar-screen-filter-group-label-wrapper">
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="account-multiple-outline" size={16} />
        <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="my-calendar-screen-filter-group-label" testID="my-calendar-screen-filter-group-label">
          Grupo: {selectedTeam.groupName}
        </Text>
      </View>
    )}
  </FilterPanel>
)}
```

En `administered-calendar-screen.jsx` el mismo cambio, con
`hasActiveFilters={Boolean(filterTeamId || filterGroupId)}` y
`onClear={() => { setFilterTeamId(''); setFilterGroupId(''); }}` (reusa
`handleTeamChange` sin cambios para el select de equipo).

## `routes/catalog.js`

`myCalendarRoute.label`: `'Mi calendario'` → `'Entrenamientos'`.
`administeredCalendarRoute.label`: `'Calendario'` → `'Entrenamientos'`.
Sin colisión en el nav — cada ruta se filtra por `role` (`getRoutesByRole`),
nunca aparecen las dos a la vez.

## Testing

Sin lógica pura nueva que amerite Jest (todo es composición de JSX +
estado local trivial `useState`) — convención del proyecto de no testear
render de componentes. Verificación manual: togglear filtros, confirmar
que "Limpiar filtros" solo aparece con algo activo, cambiar de pestaña,
confirmar que un deep-link desde el home banner cae en "Calendario".

## Explícitamente fuera de alcance de esta spec

Contenido real del historial (piezas 2/3), migrar el tab bar de
`edit-profile-screen.jsx`, vista semanal, registro de sesiones
presenciales, super chiches.
