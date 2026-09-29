import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Col, Row } from '../forms/fields.jsx';
import { SectionCard } from '../forms/section-card.jsx';
import { SearchablePickerField } from '../forms/searchable-picker-field.jsx';
import { useThemeColors } from '../../theme/colors.js';
import { formatDisplayDate } from '../../utils/format-date-display.js';

// Los tres selectores de la cascada Equipo → Grupo → Sesión.
//
// POR QUÉ NO `components/shared/filter-panel.jsx`, que es lo que sugería el
// task 4.5 (verificado leyendo el componente, tiene 54 líneas):
//
//  1. Su label está hardcodeado a "Filtros" (filter-panel.jsx:14) y no es prop.
//     Acá no hay nada que filtrar: la selección es obligatoria y concreta — sin
//     equipo+grupo+sesión no hay grilla, y "sin selección" no es un estado
//     válido de esta pantalla.
//  2. Los `children` arrancan colapsados (`useState(false)` en :7, el
//     `open &&` en :47). El entrenador no vería los tres selectores hasta tocar
//     un chevron, y sin ellos no hay nada que hacer.
//  3. El botón "Limpiar" (:18-30) depende de `hasActiveFilters` y acá no tiene
//     sentido: "no hay filtro" no es un estado que esta pantalla pueda tener.
//
// Y no se modifica: `administered-calendar-screen.jsx:151` lo usa, y tocarlo
// rompe el calendario. Por eso un panel propio del módulo.
//
// La grilla, el botón de guardar y el guard de descarte (etapas 5-6) NO viven
// acá: este componente solo decide qué se puede elegir y explica por qué algo
// no se puede.
export function AttendanceSelectionPanel({
  idPrefix,
  teamOptions,
  groupOptions,
  sessionOptions,
  teamId,
  groupId,
  sessionInstanceId,
  onSelectTeam,
  onSelectGroup,
  onSelectSession,
  loadingTeams,
  loadingGroups,
  loadingSessions,
  teamsError,
  groupsError,
  sessionsError,
  notice,
  pendingSelectionCount,
}) {
  const colors = useThemeColors();
  const renderSessionMeta = buildSessionMeta(idPrefix);
  const hint = resolveHint({
    loadingTeams,
    teamsError,
    teamOptions,
    teamId,
    loadingGroups,
    groupsError,
    groupOptions,
    groupId,
    loadingSessions,
    sessionsError,
    sessionOptions,
    sessionInstanceId,
  });

  return (
    <SectionCard icon="filter-variant" scope={`${idPrefix}-panel`} title="Selección">
      <Text className="mb-4 text-sm text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-panel-subtitle`} testID={`${idPrefix}-panel-subtitle`}>
        Elegí el equipo, el grupo y la sesión presencial a la que le querés cargar la asistencia.
      </Text>

      {/* Row/Col de components/forms/fields.jsx: los tres son campos
        relacionados, así que en web (>=1024px) quedan en fila y en mobile se
        apilan solos, sin una línea de código por plataforma. Es la regla de
        responsive web del CLAUDE.md, no una preferencia. */}
      <Row>
        <Col>
          <SearchablePickerField
            dense
            idPrefix={`${idPrefix}-team`}
            label="Equipo"
            loading={loadingTeams}
            onChange={onSelectTeam}
            options={teamOptions}
            placeholder="Elegí un equipo"
            value={teamId}
          />
        </Col>
        <Col>
          <SearchablePickerField
            // Se habilita recién cuando hay equipo (spec: "cada uno SHALL
            // habilitarse recién cuando el anterior tenga selección") y también
            // cuando el equipo tiene grupos: un selector habilitado que abre
            // un modal vacío es un selector sin explicación.
            dense
            disabled={!teamId || groupOptions.length === 0}
            emptyMessage="Ningún grupo coincide con lo que escribiste"
            idPrefix={`${idPrefix}-group`}
            label="Grupo"
            loading={Boolean(teamId) && loadingGroups}
            onChange={onSelectGroup}
            options={groupOptions}
            placeholder="Elegí un grupo"
            value={groupId}
          />
        </Col>
        <Col>
          <SearchablePickerField
            dense
            disabled={!groupId || sessionOptions.length === 0}
            emptyMessage="Ninguna sesión coincide con lo que escribiste"
            idPrefix={`${idPrefix}-session`}
            label="Sesión"
            loading={Boolean(groupId) && loadingSessions}
            onChange={onSelectSession}
            options={sessionOptions}
            placeholder="Elegí una sesión"
            renderOptionMeta={renderSessionMeta}
            value={sessionInstanceId}
          />
        </Col>
      </Row>

      {/* Aviso de deep link o de grilla rechazada (tarea 4.7). Va arriba del
        hint porque su origen no es el estado de la cascada: el hint sigue
        explicando qué se puede elegir. `accessibilityRole="alert"` porque es un
        mensaje que aparece por una acción (abrir un link), no por navegación. */}
      {notice ? (
        <View
          accessibilityRole="alert"
          className="mb-3 flex-row gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/20"
          nativeID={`${idPrefix}-notice`}
          testID={`${idPrefix}-notice`}
        >
          <MaterialCommunityIcons color="#f59e0b" name="alert-circle-outline" size={18} />
          <Text className="flex-1 text-sm text-amber-700 dark:text-amber-400" nativeID={`${idPrefix}-notice-text`} testID={`${idPrefix}-notice-text`}>
            {notice}
          </Text>
        </View>
      ) : null}

      {/* Una sola línea de estado, con prioridad de arriba hacia abajo: primero
        los errores (los únicos que necesitan acción), después el motivo por el
        que el paso siguiente de la cascada no se puede elegir. Nunca hay dos a
        la vez, así que hay un solo nativeID y el DOM no ensucia ids. */}
      {hint ? (
        <View className="flex-row items-center gap-2" nativeID={`${idPrefix}-hint`} testID={`${idPrefix}-hint`}>
          <MaterialCommunityIcons color={hint.tone === 'error' ? colors.error : colors.onSurfaceVariant} name={hint.tone === 'error' ? 'alert-outline' : 'information-outline'} size={16} />
          <Text
            className={`flex-1 text-sm ${hint.tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
            nativeID={`${idPrefix}-hint-text`}
            testID={`${idPrefix}-hint-text`}
          >
            {hint.text}
          </Text>
        </View>
      ) : null}

      {/* Las marcas de la grilla son de la sesión anterior: al cambiar la
        selección se pierden. Pedir confirmación es la etapa 5 (tarea 5.9), pero
        avisar antes ya es un comportamiento exigido por el spec ("SHALL
        advertir antes de descartar cambios sin guardar") y es lo que hace que
        el Set sea visible para el usuario y no solo estado interno. */}
      {pendingSelectionCount > 0 ? (
        <View className="mt-3 flex-row items-center gap-2" nativeID={`${idPrefix}-pending-selection`} testID={`${idPrefix}-pending-selection`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="pencil-outline" size={16} />
          <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${idPrefix}-pending-selection-text`} testID={`${idPrefix}-pending-selection-text`}>
            {`Tenés ${pendingSelectionCount} ${pendingSelectionCount === 1 ? 'corredor marcado' : 'corredores marcados'}. Si cambiás de selección, las marcas se pierden.`}
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}

// Fecha + asistentes de la opción de sesión. El spec pide los dos datos, pero
// el conteo solo "cuando exista al menos una": con 0 no se muestra nada en vez
// de un "0 asistentes" al lado de la fecha.
//
// Se declara adentro del componente (y no al módulo) solo para poder usar el
// `idPrefix` de la pantalla en los nativeID de estos nodos: el
// `renderOptionMeta` se ejecuta en el caller, o sea acá, y sus nodos también
// caen en la regla local/require-native-id. No hay costo de identidad porque
// `SearchablePickerField` lo invoca durante el render, sin usarlo de dep de
// ningún memo.
//
// `attended_count` se normaliza igual aunque venga numérico del backend: un
// `undefined > 0` es false, y un string numérico con `>` compararía por NaN.
function buildSessionMeta(idPrefix) {
  return function renderSessionMeta(option) {
    const attended = Number(option.attended_count) || 0;
    const parts = [formatSessionDate(option.date)];
    if (attended > 0) {
      parts.push(`${attended} ${attended === 1 ? 'asistente' : 'asistentes'}`);
    }

    const metaIds = `${idPrefix}-session-option-meta-${optionKey(option.id)}`;
    return (
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={metaIds} testID={metaIds}>
        {parts.join(' · ')}
      </Text>
    );
  };
}

// `date` de la sesión es un ISO **con hora** ("2026-09-24T23:00:00.000Z"), no el
// "YYYY-MM-DD" de los días de calendario, así que formatDisplayDate no se puede
// aplicar directo (haría split('-') sobre el timestamp y devolvería un día con
// la hora pegada). Se recorta a la parte de fecha y se delega en el util, que
// ya sabe el formato de salida DD-MM-YYYY.
//
// Se exporta porque la pantalla la necesita también para la fecha del encabezado
// de sesión: los dos son el mismo dato del mismo endpoint, y duplicar el recorte
// en dos archivos es una forma de que se desincronicen.
export function formatSessionDate(isoDate) {
  if (!isoDate) return '';
  return formatDisplayDate(String(isoDate).slice(0, 10));
}

// El `renderOptionMeta` se ejecuta en el caller (acá), no adentro del
// SearchablePickerField — y sus nodos también caen en la regla
// local/require-native-id. Los ids de sesión son numéricos, pero el slug los
// deja seguros como atributo `id` del DOM en web, igual que el que hace el
// componente para sus propias filas.
function optionKey(id) {
  return String(id ?? '').replace(/[^a-zA-Z0-9]+/g, '-') || 'opcion';
}

// Un único motivo: el que bloquea el paso siguiente de la cascada. El orden es
// "primero lo que necesita una acción, después lo que solo informa".
function resolveHint({
  loadingTeams,
  teamsError,
  teamOptions,
  teamId,
  loadingGroups,
  groupsError,
  groupOptions,
  groupId,
  loadingSessions,
  sessionsError,
  sessionOptions,
  sessionInstanceId,
}) {
  if (teamsError) {
    return { tone: 'error', text: 'No pudimos cargar tus equipos. Revisá la conexión y volvé a intentar.' };
  }
  if (!loadingTeams && teamOptions.length === 0) {
    return { tone: 'neutral', text: 'Todavía no administrás ningún equipo, así que no hay nada que elegir.' };
  }
  if (!teamId) {
    return { tone: 'neutral', text: 'Elegí un equipo para ver sus grupos.' };
  }
  if (groupsError) {
    return { tone: 'error', text: 'No pudimos cargar los grupos de este equipo.' };
  }
  if (!loadingGroups && groupOptions.length === 0) {
    return { tone: 'neutral', text: 'Este equipo no tiene grupos.' };
  }
  if (!groupId) {
    return { tone: 'neutral', text: 'Elegí un grupo para ver sus sesiones presenciales.' };
  }
  if (sessionsError) {
    return { tone: 'error', text: 'No pudimos cargar las sesiones presenciales de este grupo.' };
  }
  if (!loadingSessions && sessionOptions.length === 0) {
    // Texto del spec, escenario "Grupo sin sesiones presenciales". El matiz
    // "presenciales" importa: un grupo con días asincrónicos en el calendario es
    // normal, y un mensaje que dijera solo "no tiene sesiones" sería falso.
    return { tone: 'neutral', text: 'Este grupo no tiene sesiones presenciales para registrar asistencia.' };
  }
  if (!sessionInstanceId) {
    return { tone: 'neutral', text: 'Elegí una sesión para ver la asistencia.' };
  }
  return null;
}
