import { Pressable, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Las 4 acciones menos frecuentes de un día del calendario de grupo --
// compartidas entre CalendarDayMenu (día vacío/descanso, dropdown anclado
// a la celda) y el overflow "..." de GroupDayContentModal (día con
// contenido, modal centrado). Nunca se montan los dos a la vez, así que
// comparten esta lista sin pisarse ids -- cada caller pasa su propio
// `idPrefix`.
export function CalendarDayOverflowActions({ hasContent, closed, isTraining, onClear, onCancel, onSelect, onShift, idPrefix }) {
  return (
    <>
      {hasContent && !closed && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID={`${idPrefix}-clear`}
          onPress={onClear}
          testID={`${idPrefix}-clear`}
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
          <Text className="text-sm text-red-600 dark:text-red-400" nativeID={`${idPrefix}-clear-label`} testID={`${idPrefix}-clear-label`}>
            Vaciar día
          </Text>
        </Pressable>
      )}

      {isTraining && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID={`${idPrefix}-cancel`}
          onPress={onCancel}
          testID={`${idPrefix}-cancel`}
        >
          <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
          <Text className="text-sm text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-cancel-label`} testID={`${idPrefix}-cancel-label`}>
            Cancelar sesión
          </Text>
        </Pressable>
      )}

      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID={`${idPrefix}-select`}
        onPress={onSelect}
        testID={`${idPrefix}-select`}
      >
        <MaterialCommunityIcons color="#64748b" name="checkbox-marked-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-select-label`} testID={`${idPrefix}-select-label`}>
          Seleccionar
        </Text>
      </Pressable>

      <Pressable
        className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
        nativeID={`${idPrefix}-shift`}
        onPress={onShift}
        testID={`${idPrefix}-shift`}
      >
        <MaterialCommunityIcons color="#64748b" name="arrow-right-bold-outline" size={16} />
        <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-shift-label`} testID={`${idPrefix}-shift-label`}>
          Desplazar desde acá
        </Text>
      </Pressable>
    </>
  );
}
