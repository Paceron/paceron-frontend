import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Panel del menú contextual de un día del calendario — ver
// docs/superpowers/specs/2026-09-21-calendar-day-menu-design.md §2 para
// la tabla de qué ítem se muestra cuándo. Sin estado propio: el caller
// (group-calendar-screen.jsx) decide qué mostrar y qué pasa al tocar
// cada ítem, esto solo dibuja el panel. El AnimatedDropdown que lo
// posiciona y le da el backdrop-para-cerrar vive en el caller, no acá.
export function CalendarDayMenu({ hasContent, closed, isTraining, onAssignOrEdit, onClear, onCancel, onSelect }) {
  return (
    <View
      className="w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-surface-2"
      nativeID="calendar-day-menu-panel"
      testID="calendar-day-menu-panel"
    >
      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="calendar-day-menu-assign-or-edit"
        onPress={onAssignOrEdit}
        testID="calendar-day-menu-assign-or-edit"
      >
        <MaterialCommunityIcons color="#64748b" name="pencil-outline" size={16} />
        <Text
          className="text-sm text-slate-700 dark:text-slate-200"
          nativeID="calendar-day-menu-assign-or-edit-label"
          testID="calendar-day-menu-assign-or-edit-label"
        >
          {hasContent ? 'Editar' : 'Asignar'}
        </Text>
      </Pressable>

      {hasContent && !closed && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="calendar-day-menu-clear"
          onPress={onClear}
          testID="calendar-day-menu-clear"
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
          <Text className="text-sm text-red-600 dark:text-red-400" nativeID="calendar-day-menu-clear-label" testID="calendar-day-menu-clear-label">
            Vaciar día
          </Text>
        </Pressable>
      )}

      {isTraining && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="calendar-day-menu-cancel"
          onPress={onCancel}
          testID="calendar-day-menu-cancel"
        >
          <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
          <Text className="text-sm text-amber-700 dark:text-amber-400" nativeID="calendar-day-menu-cancel-label" testID="calendar-day-menu-cancel-label">
            Cancelar sesión
          </Text>
        </Pressable>
      )}

      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID="calendar-day-menu-select"
        onPress={onSelect}
        testID="calendar-day-menu-select"
      >
        <MaterialCommunityIcons color="#64748b" name="checkbox-marked-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="calendar-day-menu-select-label" testID="calendar-day-menu-select-label">
          Seleccionar
        </Text>
      </Pressable>
    </View>
  );
}
