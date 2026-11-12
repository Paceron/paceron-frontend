import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CalendarDayOverflowActions } from './calendar-day-overflow-actions.jsx';

// Panel del menú contextual de un día del calendario — ver
// docs/superpowers/specs/2026-09-21-calendar-day-menu-design.md §2 para
// la tabla de qué ítem se muestra cuándo. Sin estado propio: el caller
// (group-calendar-screen.jsx) decide qué mostrar y qué pasa al tocar
// cada ítem, esto solo dibuja el panel. El AnimatedDropdown que lo
// posiciona y le da el backdrop-para-cerrar vive en el caller, no acá.
//
// Vaciar/Cancelar/Seleccionar/Desplazar viven en CalendarDayOverflowActions
// (compartido con el overflow "..." de GroupDayContentModal, 2026-11-10) --
// por eso Estampar quedó al final en vez de entre Seleccionar y Desplazar
// como antes: reorder deliberado para agrupar las 4 filas compartidas.
export function CalendarDayMenu({ hasContent, closed, isTraining, onAssignOrEdit, onClear, onCancel, onSelect, onStamp, onShift }) {
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

      <CalendarDayOverflowActions closed={closed} hasContent={hasContent} idPrefix="calendar-day-menu" isTraining={isTraining} onCancel={onCancel} onClear={onClear} onSelect={onSelect} onShift={onShift} />

      {!closed && (
        <Pressable
          className="flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800"
          nativeID="calendar-day-menu-stamp"
          onPress={onStamp}
          testID="calendar-day-menu-stamp"
        >
          <MaterialCommunityIcons color="#64748b" name="stamper" size={16} />
          <Text className="text-sm text-slate-700 dark:text-slate-200" nativeID="calendar-day-menu-stamp-label" testID="calendar-day-menu-stamp-label">
            Estampar plan
          </Text>
        </Pressable>
      )}
    </View>
  );
}
