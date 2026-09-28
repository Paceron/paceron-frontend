import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';

// Los textos de la fila salen del spec, no de una decisión de formato: el
// requirement de la grilla (spec.md:170-193) fija el estado en "asistió" / "no
// confirmó" y dice que una fila con asistencia tiene que distinguir si llegó por
// el QR de la sesión o la cargó el entrenador. `source` solo puede ser 'qr' o
// 'manual' (dominio cerrado en el backend, ver attendance-mock.js:83-86).
const STATUS_META = {
  attended: {
    label: 'asistió',
    icon: 'check-circle-outline',
    bg: 'bg-primary-tint dark:bg-primary/15',
    text: 'text-on-primary-tint dark:text-primary',
  },
  not_confirmed: {
    label: 'no confirmó',
    icon: 'clock-outline',
    bg: 'bg-slate-200 dark:bg-slate-700',
    text: 'text-slate-700 dark:text-slate-200',
  },
};

const SOURCE_LABEL = {
  qr: 'por QR',
  manual: 'cargada por el entrenador',
};

// Una fila de la grilla de asistencia: un corredor del roster de la sesión, con
// el estado de su asistencia, el check para la carga masiva y —solo si ya tiene
// asistencia— la acción de eliminar.
//
// `row` es tal cual la devuelve `GET /attendance/session/:id` (campo `roster`),
// sin normalizar: `attendance_id`, `source` y `registered_at` vienen null en
// grupo cuando la fila no tiene asistencia.
//
// `selected` es CONTROLADO (D5: el `Set` de marcadas vive en la pantalla, así un
// refetch del pull-to-refresh no lo pisa) y por eso la fila no tiene estado
// propio: solo refleja lo que le pasan y reporta con `onToggle` /
// `onRequestDelete`.
//
// `onRequestDelete` NO borra nada: la pantalla abre el `ConfirmDestructiveModal`
// compartido y es la que decide si llama al `useDeleteAttendance` (tarea 6).
export function AttendanceRow({ row, selected, onToggle, onRequestDelete, idPrefix }) {
  const colors = useThemeColors();

  // `user_id` va en todos los ids porque hay varias filas en pantalla y el
  // `idPrefix` solo no las distingue (y `nativeID` es el atributo real del DOM
  // en web, o sea que es por donde se apunta al verificar).
  const rowId = `${idPrefix}-row-${row.user_id}`;

  // La existencia de la asistencia se decide por `attendance_id` y no por
  // `status`: es el que habilita el borrado (`DELETE /attendance/:id` necesita el
  // id) y el que el backend manda en null junto con `source` cuando la fila no
  // tiene nada cargado. Un `!= null` explícito y no un truthy para no descartar
  // un id 0.
  const hasAttendance = row.attendance_id !== null && row.attendance_id !== undefined;
  // `status` es dominio cerrado; cualquier cosa que no sea 'attended' se muestra
  // como lo que el resto de la pantalla cuenta: no confirmado.
  const status = STATUS_META[row.status] ?? STATUS_META.not_confirmed;
  const sourceLabel = SOURCE_LABEL[row.source] ?? null;

  return (
    /* `accessibilityRole="text"` porque la fila NO es accionable: la única
       región interactiva de la fila es el check y el botón de eliminar, y
       declararla como button/link sería mentira. Y deliberadamente SIN
       `accessibilityLabel` en este contenedor: en nativo, un label en un
       ancestro vuelve la fila un único elemento de accesibilidad y se traga los
       dos controles de adentro, que quedan inalcanzables. Los textos de la fila
       se leen sueltos (Text) y el estado va también en el label del check, que es
       donde el entrenador tiene que actuar. */
    <View
      accessibilityRole="text"
      className={`flex-row items-center gap-2.5 rounded-xl border p-3 ${selected ? 'border-primary bg-primary-tint-subtle dark:bg-primary/10' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}
      nativeID={rowId}
      testID={rowId}
    >
      <Pressable
        accessibilityLabel={selected ? `Desmarcar a ${row.name}` : `Marcar a ${row.name} para cargar su asistencia`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        className="rounded-full p-1 active:opacity-70"
        hitSlop={8}
        nativeID={`${rowId}-checkbox`}
        onPress={onToggle}
        testID={`${rowId}-checkbox`}
      >
        <MaterialCommunityIcons
          color={selected ? colors.primary : colors.onSurfaceVariant}
          name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={22}
        />
      </Pressable>

      {/* `flex-1` + `numberOfLines` en los textos y `flex-wrap` en la línea de
          metadatos: es el criterio del repo para un viewport angosto
          (`next-training-banner.jsx:130`, `day-detail-modal.jsx:34`,
          `team-detail-screen.jsx:302`). La procedencia y el estado pasan a la
          línea de abajo cuando no entran, en vez de forzar una línea sola. */}
      <View className="flex-1" nativeID={`${rowId}-info`} testID={`${rowId}-info`}>
        <Text
          className="text-sm font-semibold text-slate-900 dark:text-white"
          nativeID={`${rowId}-name`}
          numberOfLines={1}
          testID={`${rowId}-name`}
        >
          {row.name}
        </Text>
        <Text
          className="text-xs text-slate-500 dark:text-slate-400"
          nativeID={`${rowId}-email`}
          numberOfLines={1}
          testID={`${rowId}-email`}
        >
          {row.email}
        </Text>

        <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1" nativeID={`${rowId}-meta`} testID={`${rowId}-meta`}>
          <View className={`flex-row items-center gap-1 self-start rounded-full px-2 py-0.5 ${status.bg}`} nativeID={`${rowId}-status`} testID={`${rowId}-status`}>
            <MaterialCommunityIcons color={colors.primary} name={status.icon} size={12} />
            <Text className={`text-[11px] font-semibold ${status.text}`} nativeID={`${rowId}-status-label`} testID={`${rowId}-status-label`}>
              {status.label}
            </Text>
          </View>

          {/* Solo si hay asistencia y solo si el backend dijo de dónde vino. Con
              `source` en null (fila sin asistencia, o una fila vieja que el
              backend no pudo resolver la procedencia) no se muestra nada en vez
              de inventar un "origen desconocido" que el entrenador no puede
              verificar. */}
          {hasAttendance && sourceLabel ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${rowId}-source`} testID={`${rowId}-source`}>
              {sourceLabel}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Sin asistencia no hay nada que eliminar: `DELETE /attendance/:id`
          necesita el `attendance_id`, y ofrecer la acción sin él sería un botón
          que no puede funcionar. */}
      {hasAttendance ? (
        <Pressable
          accessibilityLabel={`Eliminar la asistencia de ${row.name}`}
          accessibilityRole="button"
          className="rounded-full p-1.5 active:opacity-70"
          hitSlop={8}
          nativeID={`${rowId}-delete-button`}
          onPress={onRequestDelete}
          testID={`${rowId}-delete-button`}
        >
          <MaterialCommunityIcons color={colors.error} name="trash-can-outline" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}
