import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { filterAndSortRows } from '../../utils/attendance-rows.js';
import { AttendanceMetricCards } from './attendance-metric-cards.jsx';
import { AttendanceRow } from './attendance-row.jsx';

// Grilla de asistencia de la sesión elegida: las tres tarjetas de métricas, el
// buscador, el orden, la barra de guardado masivo y las filas.
//
// Es presentacional a propósito — no pide nada, no muta nada del servidor. Las
// marcas y las mutaciones viven en la pantalla; este componente solo decide qué
// se pinta. El filtro y el orden SÍ son estado local, y a propósito: son una
// vista del mismo conjunto, no un recorte de los datos — las marcas viven en un
// `Set` de user_id, así que filtrar la lista no puede perder una marca (D5).
export function AttendanceGrid({
  rows,
  summary,
  isLoading,
  isRefetching,
  error,
  selectedIds,
  onToggle,
  onRequestDelete,
  onSave,
  onRetry,
  isSaving,
  idPrefix,
}) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  const visibleRows = useMemo(() => filterAndSortRows(rows, query, sortOrder), [rows, query, sortOrder]);
  const isFiltering = query.trim() !== '';

  // `isLoading` es el primer fetch de la grilla: NO hay nada que mostrar, así que
  // spinner. Distinto de un grupo sin corredores, que sí es un estado vacío con
  // explicación (tarea 5.7: "isLoading → spinner, no empty state").
  if (isLoading) {
    return (
      <View className="rounded-2xl border border-slate-200 bg-white px-4 py-10 dark:border-slate-700 dark:bg-surface" nativeID={`${idPrefix}-loading`} testID={`${idPrefix}-loading`}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // El error de la grilla puede ser de permisos (403) o de sesión inválida (422)
  // — el backend usa 422 justamente para no confirmar que un id ajeno existe. El
  // mensaje es genérico a propósito: un texto por caso confirmaría al usuario que
  // la sesión existe, que es lo que el 422 evita.
  if (error) {
    return (
      <View className="rounded-2xl border border-red-200 bg-white px-4 py-10 dark:border-red-900/50 dark:bg-surface" nativeID={`${idPrefix}-error`} testID={`${idPrefix}-error`}>
        <MaterialCommunityIcons color="#ef4444" name="alert-circle-outline" size={26} />
        <Text className="mt-2 text-center text-sm font-semibold text-red-700 dark:text-red-400" nativeID={`${idPrefix}-error-title`} testID={`${idPrefix}-error-title`}>
          No pudimos cargar la asistencia
        </Text>
        <Text className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-error-text`} testID={`${idPrefix}-error-text`}>
          Revisá que la sesión siga siendo presencial y que administrés el equipo.
        </Text>
        <Pressable
          accessibilityLabel="Reintentar la carga de asistencia"
          className="mx-auto mt-4 h-11 items-center justify-center rounded-full border border-slate-200 px-6 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
          nativeID={`${idPrefix}-error-retry`}
          onPress={onRetry}
          testID={`${idPrefix}-error-retry`}
        >
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-error-retry-label`} testID={`${idPrefix}-error-retry-label`}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  // Grupo sin corredores: la sesión existe y no tiene a nadie. Es un estado
  // vacío real, no un error, y hay que decirlo — un "0 corredores" sin
  // explicación parece un bug.
  if (rows.length === 0) {
    return (
      <View className="rounded-2xl border border-slate-200 bg-white px-4 py-10 dark:border-slate-700 dark:bg-surface" nativeID={`${idPrefix}-empty`} testID={`${idPrefix}-empty`}>
        <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-empty-text`} testID={`${idPrefix}-empty-text`}>
          Este grupo no tenía corredores en la fecha de la sesión.
        </Text>
      </View>
    );
  }

  const markedCount = selectedIds.size;

  return (
    <View nativeID={`${idPrefix}-root`} testID={`${idPrefix}-root`}>
      <AttendanceMetricCards idPrefix={`${idPrefix}-metrics`} isLoading={false} summary={summary} />

      {/* La barra de guardado solo existe con algo marcado. Con `selectedIds`
          vacío el `headerRight` del patrón de exercises-catalog-tab se sustituye
          por un refetch en curso, para no dejar un botón deshabilitado ocupando
          lugar (tarea 5.4). */}
      {markedCount > 0 ? (
        <View className="mt-3 flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-surface" nativeID={`${idPrefix}-save-bar`} testID={`${idPrefix}-save-bar`}>
          <View className="flex-1" nativeID={`${idPrefix}-save-bar-text-wrapper`} testID={`${idPrefix}-save-bar-text-wrapper`}>
            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-save-bar-count`} testID={`${idPrefix}-save-bar-count`}>
              Confirmar Asistencia de {markedCount} {markedCount === 1 ? 'corredor' : 'corredores'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={`Guardar la asistencia de ${markedCount} ${markedCount === 1 ? 'corredor' : 'corredores'}`}
            className={`h-11 items-center justify-center rounded-full px-6 active:opacity-80 ${isSaving ? 'bg-slate-400' : 'bg-primary'}`}
            disabled={isSaving}
            nativeID={`${idPrefix}-save-button`}
            onPress={onSave}
            testID={`${idPrefix}-save-button`}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID={`${idPrefix}-save-button-label`} testID={`${idPrefix}-save-button-label`}>
                Guardar
              </Text>
            )}
          </Pressable>
        </View>
      ) : isRefetching ? (
        <View className="mt-3 flex-row items-center justify-end gap-2" nativeID={`${idPrefix}-refetching`} testID={`${idPrefix}-refetching`}>
          <ActivityIndicator color={colors.onSurfaceVariant} size="small" />
          <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-refetching-text`} testID={`${idPrefix}-refetching-text`}>
            Actualizando
          </Text>
        </View>
      ) : null}

      {/* Buscador y orden. El contador "N de M" va siempre visible (no solo
          mientras se escribe) porque es el que dice si el filtro está ocultando
          corredores marcados — sin eso, un filtro con 3 de 8 de los cuales 2 marcados
          deja al entrenador guardando sobre una lista que no ve completa. */}
      <View className="mt-3 flex-row items-center gap-2" nativeID={`${idPrefix}-controls`} testID={`${idPrefix}-controls`}>
        <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-controls-title`} testID={`${idPrefix}-controls-title`}>
          Corredores
        </Text>
        <View className="h-11 flex-1 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" nativeID={`${idPrefix}-search-box`} testID={`${idPrefix}-search-box`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="magnify" size={18} />
          <TextInput
            accessibilityLabel={`Filtrar corredores por nombre. Se muestran ${visibleRows.length} de ${rows.length}`}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 text-sm text-slate-900 outline-none dark:text-white"
            nativeID={`${idPrefix}-search-input`}
            onChangeText={setQuery}
            placeholder="Filtrar por nombre"
            placeholderTextColor={colors.onSurfaceVariant}
            returnKeyType="search"
            testID={`${idPrefix}-search-input`}
            value={query}
          />
          {isFiltering ? (
            <Pressable
              accessibilityLabel="Limpiar el filtro"
              nativeID={`${idPrefix}-search-clear`}
              onPress={() => setQuery('')}
              testID={`${idPrefix}-search-clear`}
            >
              <MaterialCommunityIcons color={colors.onSurfaceVariant} name="close-circle" size={16} />
            </Pressable>
          ) : null}
        </View>

        {/* Ícono + texto, y el texto dice el estado ACTUAL ("A–Z" = está de A a
            Z ahora), no una etiqueta del botón ("Ordenar"), que no diría en qué
            orden está la lista. Con un ícono solo no seCommunicaba el estado:
            el mismo ícono para los dos casos hacía imposible saber si estabas
            mirando la lista al derecho o al revés.

            Los nombres de ícono están verificados contra el glyphmap de
            MaterialCommunityIcons de la versión instalada: `sort-alpha-*` NO
            existe (renderiza el glyph de fallback, un "?"), y el nombre correcto
            es `sort-alphabetical-*`. */}
        <Pressable
          accessibilityLabel={sortOrder === 'asc'
            ? 'Orden actual: de la A a la Z. Tocar para ordenar de la Z a la A'
            : 'Orden actual: de la Z a la A. Tocar para ordenar de la A a la Z'}
          className="h-11 flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 active:opacity-70 hover:bg-slate-100 dark:border-slate-700 dark:bg-white dark:hover:bg-slate-800"
          nativeID={`${idPrefix}-sort-toggle`}
          onPress={() => setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))}
          testID={`${idPrefix}-sort-toggle`}
        >
          <MaterialCommunityIcons
            color={colors.onSurfaceVariant}
            name={sortOrder === 'asc' ? 'sort-alphabetical-ascending' : 'sort-alphabetical-descending'}
            size={18}
          />
          <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-sort-label`} testID={`${idPrefix}-sort-label`}>
            {sortOrder === 'asc' ? 'A–Z' : 'Z–A'}
          </Text>
        </Pressable>
      </View>

      <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-rows-count`} testID={`${idPrefix}-rows-count`}>
        {isFiltering
          ? `${visibleRows.length} de ${rows.length} ${rows.length === 1 ? 'corredor' : 'corredores'}`
          : `${rows.length} ${rows.length === 1 ? 'corredor' : 'corredores'}`}
      </Text>

      {visibleRows.length === 0 ? (
        <Text className="py-8 text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-no-matches`} testID={`${idPrefix}-no-matches`}>
          Ningún corredor coincide con «{query.trim()}».
        </Text>
      ) : (
        <View className="mt-3 gap-2" nativeID={`${idPrefix}-rows`} testID={`${idPrefix}-rows`}>
          {visibleRows.map((row) => (
            <AttendanceRow
              idPrefix={`${idPrefix}-row`}
              key={row.user_id}
              onRequestDelete={() => onRequestDelete(row)}
              onToggle={() => onToggle(row.user_id)}
              row={row}
              selected={selectedIds.has(String(row.user_id))}
            />
          ))}
        </View>
      )}
    </View>
  );
}
