import { Pressable, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const MENU_CLASS = 'flex-row items-center gap-2 px-3 py-2 hover:bg-slate-100 active:opacity-70 dark:hover:bg-slate-800';
// Pill: mismo lenguaje visual que Editar/Estampar en GroupDayContentModal
// (icono+texto centrado, borde redondeado) -- a diferencia de MENU_CLASS
// (fila de dropdown, texto a la izquierda). Sin ancho propio -- el caller
// decide 2 columnas (desktop, `w-[48%]`) o 1 sola apilada (mobile/web
// angosta, `w-full`, texto largo como "Desplazar desde acá" no entraba en
// 48% de un modal angosto, 2026-11-11) vía `pillWidthClass`.
const PILL_BASE_CLASS = 'h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 px-2 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800';
const PILL_TEXT_CLASS = 'text-xs font-semibold uppercase tracking-wide';

// Las 4 acciones menos frecuentes de un día del calendario de grupo --
// compartidas entre CalendarDayMenu (día vacío/descanso, dropdown anclado
// a la celda, variant 'menu') y GroupDayContentModal (día con contenido,
// modal centrado, variant 'pill' -- 2026-11-11, reemplaza el overflow
// "..." que antes las escondía: ahora se muestran todas siempre). Nunca
// se montan los dos variants a la vez, así que comparten ids sin
// pisarse -- cada caller pasa su propio `idPrefix`.
export function CalendarDayOverflowActions({ hasContent, closed, isTraining, onClear, onCancel, onSelect, onShift, idPrefix, variant = 'menu', pillWidthClass = 'w-[48%]' }) {
  const isPill = variant === 'pill';
  const rowClass = isPill ? `${pillWidthClass} ${PILL_BASE_CLASS}` : MENU_CLASS;
  const textClass = isPill ? PILL_TEXT_CLASS : 'text-sm';

  return (
    <>
      {hasContent && !closed && (
        <Pressable
          className={rowClass}
          nativeID={`${idPrefix}-clear`}
          onPress={onClear}
          testID={`${idPrefix}-clear`}
        >
          <MaterialCommunityIcons color="#ef4444" name="trash-can-outline" size={16} />
          <Text className={`${textClass} text-red-600 dark:text-red-400`} nativeID={`${idPrefix}-clear-label`} numberOfLines={isPill ? 1 : undefined} testID={`${idPrefix}-clear-label`}>
            Vaciar día
          </Text>
        </Pressable>
      )}

      {isTraining && (
        <Pressable
          className={rowClass}
          nativeID={`${idPrefix}-cancel`}
          onPress={onCancel}
          testID={`${idPrefix}-cancel`}
        >
          <MaterialCommunityIcons color="#d97706" name="calendar-remove-outline" size={16} />
          <Text className={`${textClass} text-amber-700 dark:text-amber-400`} nativeID={`${idPrefix}-cancel-label`} numberOfLines={isPill ? 1 : undefined} testID={`${idPrefix}-cancel-label`}>
            Cancelar sesión
          </Text>
        </Pressable>
      )}

      <Pressable
        className={rowClass}
        nativeID={`${idPrefix}-select`}
        onPress={onSelect}
        testID={`${idPrefix}-select`}
      >
        <MaterialCommunityIcons color="#64748b" name="checkbox-marked-outline" size={16} />
        <Text className={`${textClass} text-slate-700 dark:text-slate-200`} nativeID={`${idPrefix}-select-label`} numberOfLines={isPill ? 1 : undefined} testID={`${idPrefix}-select-label`}>
          Seleccionar
        </Text>
      </Pressable>

      <Pressable
        className={rowClass}
        nativeID={`${idPrefix}-shift`}
        onPress={onShift}
        testID={`${idPrefix}-shift`}
      >
        <MaterialCommunityIcons color="#64748b" name="arrow-right-bold-outline" size={16} />
        <Text className={`${textClass} text-slate-700 dark:text-slate-200`} nativeID={`${idPrefix}-shift-label`} numberOfLines={isPill ? 1 : undefined} testID={`${idPrefix}-shift-label`}>
          Desplazar desde acá
        </Text>
      </Pressable>
    </>
  );
}
