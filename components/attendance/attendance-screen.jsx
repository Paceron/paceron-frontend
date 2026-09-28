import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isMobile, isWeb } from '../../utils/platform.js';
import { isSameId } from '../../utils/id-match.js';
import { useThemeColors } from '../../theme/colors.js';
import { useAuthStore } from '../../store/auth-store.js';
import { selectAdministeredTeams } from '../../store/team-store.js';
import { useTeams } from '../../hooks/use-teams.js';
import { useGroups } from '../../hooks/use-groups.js';
import { usePermissions } from '../../hooks/use-user.js';
import { useAttendanceSessions, attendanceSessionsQueryKey, useSaveAttendance, useDeleteAttendance, useSessionAttendance } from '../../hooks/use-attendance.js';
import { usePullToRefresh } from '../../hooks/use-pull-to-refresh.js';
import { useFormDirty } from '../../hooks/use-form-dirty.js';
import { useUnsavedChangesGuard } from '../../hooks/use-unsaved-changes-guard.js';
import { listAttendanceSessions } from '../../services/attendance.js';
import { notifyError, notifySuccess, notifyWarning } from '../../utils/haptics.js';
import { ConfirmDestructiveModal } from '../shared/confirm-destructive-modal.jsx';
import { DiscardChangesModal } from '../shared/discard-changes-modal.jsx';
import { AttendanceGrid } from './attendance-grid.jsx';
import { AttendanceQrModal } from './attendance-qr-modal.jsx';
import { RequireAuth } from '../guards/require-auth.jsx';

import { AttendanceSelectionPanel, formatSessionDate } from './attendance-selection-panel.jsx';

const ID_PREFIX = 'attendance-screen';

// Los dos avisos de una sesión que el link o el backend no habilitan (tarea
// 4.7). La redacción es del front y no `error.message` del backend, por dos
// razones: el spec pide explícitamente que el caso de permisos "no revele
// información de la sesión", y el texto del backend no promete no cambiar.
const NO_PERMISSION_NOTICE = 'No tenés permisos sobre esa sesión.';
// El backend responde 422 —y no 404— tanto para "la sesión no existe" como para
// "la sesión es de otro equipo": su spec dice que no quiere confirmar la
// existencia de un id ajeno. O sea que la distinción que pide el spec del front
// entre esos dos casos NO es observable desde el cliente, así que el mensaje no
// puede afirmar una de las dos cosas: nombra las dos y deja el selector
// disponible, que es la parte accionable del escenario.
const UNAVAILABLE_SESSION_NOTICE =
  'La sesión indicada no existe o no corresponde a este equipo. Elegí otra desde el selector.';

export function AttendanceScreen() {
  return (
    <RequireAuth>
      <AttendanceScreenContent />
    </RequireAuth>
  );
}

function AttendanceScreenContent() {
  const userId = useAuthStore((s) => s.userId);
  const activeRole = useAuthStore((s) => s.activeRole);
  const { roles } = usePermissions(userId);

  // Mismo criterio que `canManageTeam` (team-detail-screen.jsx:521) y
  // `canManage` (group-calendar-screen.jsx:142): `activeRole` dice solo qué se
  // está mirando ahora, `hasTrainerRole` que el rol exista de verdad. Los dos
  // juntos, porque un `activeRole === 'trainer'` con el perfil dado de baja
  // dejaría ver la pantalla completa.
  const hasTrainerRole = roles.some((role) => role.name === 'entrenador');
  const canManageAttendance = hasTrainerRole && activeRole === 'trainer';

  if (!canManageAttendance) return <TrainerOnlyNotice hasTrainerRole={hasTrainerRole} />;

  return <AttendanceCascade />;
}

// La cascada vive en un componente aparte, y no detrás de un `if` dentro del
// mismo, por una razón concreta: los hooks. Con el rol equivocado la pantalla
// no tiene que disparar NADA (ni useTeams, ni useGroups, ni la grilla) — el
// spec pide "un aviso en lugar de una lista vacía", y una lista vacía con
// requests de por medio es peor que una lista vacía. Un componente que no se
// monta no pide nada.
function AttendanceCascade() {
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const userId = useAuthStore((s) => s.userId);

  // Los tres ids de la cascada. Cada uno se setea SIEMPRE desde el id de la
  // opción elegida, así que conviven number (de una lista del backend) y string
  // (de un query param) — de ahí que toda comparación pase por `isSameId` y no
  // por `===` (utils/id-match.js).
  const [teamId, setTeamId] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [sessionInstanceId, setSessionInstanceId] = useState(null);
  // D5: el Set de filas marcadas es estado local, no del cache de Query — un
  // refetch no lo toca y el pull-to-refresh de la etapa 5 no tiene ningún caso
  // especial que resolver. Todavía no lo dibuja nadie (la grilla es la etapa 5),
  // pero se limpia en cada transición de la cascada: son ids de corredores de
  // otra grilla y no significan nada en la nueva.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [notice, setNotice] = useState(null);
  // `true` entre que se aplica el link y que se resuelve (o se descarta) el
  // grupo de esa sesión. Mientras lo esté, la preselección automática de grupo
  // NO corre: el grupo lo decide la resolución del link, no el primer grupo.
  const [resolvingLink, setResolvingLink] = useState(false);
  const linkAppliedRef = useRef(false);

  const deepLinkTeamId = readParam(params.team_id);
  const deepLinkSessionId = readParam(params.session_instance_id);

  // ── Datos de los tres selectores (tarea 4.4) ───────────────────────────
  // `useTeams()` trae TODOS los equipos del sistema y `selectAdministeredTeams`
  // filtra a los que el usuario administra. El `userId` se usa tal como sale del
  // auth store (número del backend) porque el selector compara con `===` contra
  // `team.ownerId`, también numérico: castearlo a string acá devolvería una
  // lista vacía sin ningún error visible.
  const { teams, loading: loadingTeams, error: teamsError } = useTeams();
  const teamOptions = useMemo(
    () => selectAdministeredTeams(teams, userId).map((team) => ({ id: team.id, name: team.name })),
    [teams, userId],
  );

  const { groups, loading: loadingGroups, error: groupsError } = useGroups(teamId, userId);
  const groupOptions = useMemo(() => groups.map((group) => ({ id: group.id, name: group.name })), [groups]);

  const {
    sessions,
    isLoading: loadingSessions,
    isRefetching: sessionsRefetching,
    refetch: refetchSessions,
    error: sessionsError,
  } = useAttendanceSessions(groupId, teamId);
  const sessionOptions = useMemo(
    () => sessions.map((session) => ({
      id: session.session_instance_id,
      name: session.name,
      date: session.date,
      attended_count: session.attended_count,
    })),
    [sessions],
  );

  // ── Deep link: aplicación (tarea 4.2) ───────────────────────────────────
  //
  // Se aplica UNA vez, y recién cuando el listado de equipos resolvió: sin él no
  // hay forma de saber si el `team_id` del link es del entrenador, y adivinar
  // produce el mensaje de permisos sobre un error de red o sobre un listado
  // todavía vacío. Aplicarlo antes y corregir después haría parpadear los tres
  // selectores.
  useEffect(() => {
    if (linkAppliedRef.current) return;
    if (loadingTeams) return;
    // Un fallo del listado NO habilita el link: sin la lista no se puede
    // decidir nada, y el hint de error del panel ya explica la situación.
    if (teamsError) return;

    linkAppliedRef.current = true;
    if (!deepLinkTeamId) return;

    const team = teamOptions.find((option) => isSameId(option.id, deepLinkTeamId));
    if (!team) {
      // Sin equipos administrados no es un caso de permisos sino de "no tenés
      // nada que gestionar", y el hint del panel ya lo dice: anunciar
      // permisos acá sería mentir sobre algo que el usuario nunca vio.
      if (teamOptions.length > 0) setNotice(NO_PERMISSION_NOTICE);
      return;
    }

    setTeamId(team.id);
    if (!deepLinkSessionId) return;

    setSessionInstanceId(deepLinkSessionId);
    setResolvingLink(true);
  }, [loadingTeams, teamsError, teamOptions, deepLinkTeamId, deepLinkSessionId]);

  // ── Deep link: en qué grupo del equipo está esa sesión ──────────────────
  //
  // El link trae `team_id` y `session_instance_id`, pero la grilla
  // (`GET /attendance/session/{id}?team_id=&group_id=`) exige el `group_id`
  // también: sin él el backend responde 400 antes de validar nada. El link no
  // alcanza para pedir la grilla, hay que descubrir en qué grupo del equipo está
  // la sesión.
  //
  // Se resuelve con un fan-out del listado de sesiones presenciales de cada
  // grupo del equipo, usando la MISMA query key que `useAttendanceSessions`:
  // cuando la cascada termine de seleccionar ese grupo, la consulta ya está en
  // el cache y no se repite.
  //
  // Por qué un fan-out y no un link que traiga el `group_id`: `GET
  // /attendance/session/:id` exige `team_id` Y `group_id` (400 sin cualquiera de
  // los dos), pero el link del spec solo trae `team_id` + `session_instance_id`.
  // Agregar `group_id` a la URL sería el camino más directo — y no requiere
  // cambio de backend, porque el endpoint ya lo acepta — pero cambiaría el
  // contrato del link para todos los que lo generen, y hoy el spec define el link
  // con esos dos params. Con el fan-out el escenario del spec funciona tal como
  // está escrito, sin tocar ningún otro repo. El costo son N requests en paralelo
  // (N = grupos del equipo) y solo al entrar por link; las que coinciden con el
  // grupo final quedan en cache y la cascada las reusa.
  //
  // La key sale de `attendanceSessionsQueryKey` y no está escrita acá a mano: el
  // fan-out necesita `useQueries` porque la cantidad de grupos es variable y un
  // hook no se puede llamar en un loop, pero la key tiene que ser EXACTAMENTE la
  // del hook — si divergen, el fan-out escribe en un cache que la cascada nunca
  // lee y se pierde todo el ahorro.
  const linkScanQueries = useQueries({
    queries: resolvingLink && teamId
      ? groupOptions.map((group) => ({
          queryKey: attendanceSessionsQueryKey(teamId, group.id),
          queryFn: () => listAttendanceSessions(group.id, teamId).then((dto) => dto.sessions ?? []),
          enabled: true,
        }))
      : [],
  });

  const linkGroupId = useMemo(() => {
    for (let index = 0; index < linkScanQueries.length; index += 1) {
      const groupSessions = linkScanQueries[index].data ?? [];
      if (groupSessions.some((session) => isSameId(session.session_instance_id, deepLinkSessionId))) {
        return groupOptions[index]?.id ?? null;
      }
    }
    return null;
  }, [linkScanQueries, groupOptions, deepLinkSessionId]);

  // "Terminó de buscar" = ya se conocen los grupos del equipo y todas las
  // consultas del fan-out terminaron (con éxito o con error). `isFetched` y
  // no `isLoading` a propósito: en v5 una query deshabilitada tiene
  // isLoading === false, así que un fan-out que todavía no arrancó se vería
  // "terminado" y el link se declararía inexistente sin haber buscado nada.
  const linkScanDone = Boolean(
    resolvingLink
    && teamId
    && !loadingGroups
    && groupOptions.length > 0
    && linkScanQueries.length === groupOptions.length
    && linkScanQueries.every((query) => query.isFetched),
  );

  // Un 403/404 en el fan-out es información más precisa que "no la encontré": el
  // backend no lo deja ni pedir el listado de un grupo de otro equipo, así que
  // acá ya sabemos que el problema es de permisos y no de la sesión.
  const linkScanForbidden = linkScanQueries.some(
    (query) => query.error?.status === 403 || query.error?.status === 404,
  );

  useEffect(() => {
    if (!linkScanDone) return;

    if (linkGroupId) {
      setGroupId(linkGroupId);
    } else if (linkScanForbidden) {
      setNotice(NO_PERMISSION_NOTICE);
    } else {
      // No está en ninguno de los grupos del equipo: o no existe, o es de otro
      // equipo, y el backend no deja distinguirlos (ver la constante de arriba).
      // Con `groupId` en null, la preselección automática de abajo entra y
      // deja elegido el primer grupo del equipo, que es lo que hace falta para
      // que el selector de sesión vuelva a estar disponible.
      //
      // `sessionInstanceId` NO se limpia acá, a propósito: el trigger del
      // selector muestra el id crudo cuando hay valor y no hay opción que lo
      // nombre (así lo define searchable-picker-field.jsx:74-86, y es lo que
      // hace que "esa sesión no existe" se lea junto al id que no resolvió y no
      // como un selector vacío al lado de un error). El costo es que la grilla
      // se pide una vez con ese id y el grupo recién preseleccionado, y vuelve
      // a responder 422 — que es el mismo aviso que ya se está mostrando.
      setNotice(UNAVAILABLE_SESSION_NOTICE);
    }

    setResolvingLink(false);
  }, [linkScanDone, linkGroupId, linkScanForbidden]);

  // ── Deep link: qué dice el backend de esa selección ─────────────────────
  //
  // La grilla se pide solo con los tres ids resueltos, así que este error es el
  // veredicto del backend sobre el link. 403/404 → el usuario no administra ese
  // equipo; el resto (422 por no presencial / cancelada / de otro grupo) es la
  // sesión no disponible. El mensaje del backend no se muestra: el front tiene
  // su propia redacción para no filtrar nada de la sesión.
  const {
    rows,
    summary,
    isLoading: gridLoading,
    isRefetching: gridRefetching,
    error: gridError,
    refetch: refetchGrid,
  } = useSessionAttendance(sessionInstanceId, teamId, groupId);

  useEffect(() => {
    if (!gridError) return;
    // Sin rama de "se limpió": este aviso no se limpia solo cuando el error
    // desaparece, y no debe hacerlo. El deep link no encontrado también escribe
    // `notice` con la grilla sin error, así que un `else setNotice(null)` acá
    // borraría ese aviso. Lo que sí limpia el aviso es el usuario moviendo la
    // cascada (`takeOverCascade`), que es el único camino por el que puede
    // quedar obsoleto.
    setNotice(gridError.status === 403 || gridError.status === 404 ? NO_PERMISSION_NOTICE : UNAVAILABLE_SESSION_NOTICE);
  }, [gridError]);

  // ── Transiciones de la cascada (tarea 4.3) ─────────────────────────────
  //
  // Las reglas del spec, en un solo lugar y no repartidas en tres handlers que
  // se pisan entre sí: cambiar equipo limpia grupo y sesión, cambiar grupo
  // limpia sesión, y en los dos casos se vuelve a preseleccionar el grupo.
  const clearSelection = useCallback(() => {
    setSelectedIds((current) => (current.size === 0 ? current : new Set()));
  }, []);

  // ── Guard de cambios sin guardar (tarea 5.9) ────────────────────────────
  //
  // El guard tiene DOS gatillos y por eso el estado vive acá y no en el hook:
  //
  // 1. La salida de la pantalla (back nativo, gesto, botón de header), que lo
  //    intercepta `usePreventRemove` por su cuenta.
  // 2. Cambiar equipo/grupo/sesión **con marcas sin guardar**. Eso NO es una
  //    navegación: la pantalla sigue montada. Y acá está el motivo de no usar
  //    `guardedClose` del hook para ese caso — su flag interno `bypassing` se
  //    pone en `true` al confirmar y **nunca vuelve a `false`** (miralo: solo
  //    `confirmDiscard` y `bypassGuard` lo setean, los dos a `true`). Para una
  //    navegación da igual porque la pantalla se desmonta; para un cambio de
  //    cascada dejaría el guard apagado para siempre, y la segunda confirmación
  //    no aparecería nunca. O sea: usarlo acá sería un bug silencioso que
  //    degrada a "nunca más preguntamos" sin error visible.
  //
  // Por eso el descarte de la cascada es un estado local (`pendingCascadeChange`)
  // con su propio handler, y el modal de abajo es UNO solo que atiende las dos
  // fuentes. `isDirty` sale de `useFormDirty(selectedIds.size > 0)`: el baseline
  // se toma en el primer render, cuando no hay nada marcado, así que guardar bien
  // (que vacía el Set) devuelve el valor al baseline y el guard se limpia solo —
  // no hace falta `bypassGuard` (D10).
  const isDirty = useFormDirty(selectedIds.size > 0);
  const { confirmVisible, confirmDiscard, cancelDiscard } = useUnsavedChangesGuard(isDirty);
  const [pendingCascadeChange, setPendingCascadeChange] = useState(null);

  const discardVisible = confirmVisible || pendingCascadeChange !== null;

  const handleDiscardConfirm = () => {
    if (pendingCascadeChange) {
      const action = pendingCascadeChange;
      setPendingCascadeChange(null);
      action();
      return;
    }
    confirmDiscard();
  };

  const handleDiscardCancel = () => {
    setPendingCascadeChange(null);
    cancelDiscard();
  };

  // Todo cambio de cascada pasa por acá: si hay marcas sin guardar, se pregunta
  // antes; si no, se aplica directo.
  const runCascadeChange = useCallback((action) => {
    if (selectedIds.size > 0) {
      setPendingCascadeChange(action);
      return;
    }
    action();
  }, [selectedIds.size]);

  // El usuario tomó el control de la cascada. Además de limpiar lo que quedó
  // del link, cancela la resolución del grupo: el fan-out puede seguir en
  // vuelo, pero `queries` pasa a `[]` y su resultado se ignora. Sin esto, elegir
  // a mano mientras se resolvía el link podía ser sobreescrito un instante
  // después por el grupo que encontrara el fan-out.
  const takeOverCascade = useCallback(() => {
    clearSelection();
    setNotice(null);
    setResolvingLink(false);
  }, [clearSelection]);

  // Cambiar equipo limpia grupo y sesión. El grupo se pone en null sí o sí
  // (spec), aunque la preselección de más abajo lo vuelva a escribir apenas
  // lleguen los grupos del equipo nuevo: dejarlo con el id del equipo anterior
  // sería pedir la grilla de una sesión con un grupo que no es de ese equipo.
  const handleSelectTeam = (nextTeamId) => {
    if (isSameId(nextTeamId, teamId)) return;
    runCascadeChange(() => {
      takeOverCascade();
      setTeamId(nextTeamId);
      setGroupId(null);
      setSessionInstanceId(null);
    });
  };

  // Cambiar grupo limpia la sesión. No vuelve a preseleccionar nada: el grupo
  // ya está elegido, y el efecto de preselección no corre porque `groupId` no
  // está vacío.
  const handleSelectGroup = (nextGroupId) => {
    if (isSameId(nextGroupId, groupId)) return;
    runCascadeChange(() => {
      takeOverCascade();
      setGroupId(nextGroupId);
      setSessionInstanceId(null);
    });
  };

  const handleSelectSession = (nextSessionInstanceId) => {
    if (isSameId(nextSessionInstanceId, sessionInstanceId)) return;
    runCascadeChange(() => {
      takeOverCascade();
      setSessionInstanceId(nextSessionInstanceId);
    });
  };

  // ── Marcas y guardado masivo (tareas 5.4-5.6) ───────────────────────────
  //
  // El Set guarda el `user_id` **stringificado**: las filas llegan del backend
  // con `user_id` numérico, pero el deep link y el `?team_id` trayacen strings, y
  // un Set con `42` y `'42'` dos entradas contaría dos marcas para el mismo
  // corredor. Stringificar al insertar y al leer lo hace consistente.
  const toggleRow = useCallback((userId) => {
    const key = String(userId);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const { saveAttendance, isSaving } = useSaveAttendance(teamId);

  // Patrón C (D4): la mutación deja propagar el error y el try/catch vive acá, en
  // el caller. Por eso el mensaje puede ser el `error.message` real del backend y
  // por eso se puede distinguir un 403 de un 422 mirando `error.status`
  // (services/api.js lo deja en el error).
  const handleSave = async () => {
    if (selectedIds.size === 0) return;
    try {
      const result = await saveAttendance({
        teamId,
        trainingSessionId: sessionInstanceId,
        userIds: [...selectedIds],
      });
      // Solo se limpian las marcas si el guardado fue exitoso (tarea 5.6). Si
      // falla, el Set intacto es lo que permite reintentar sin volver a marcar.
      clearSelection();
      notifySuccess();
      Toast.show({
        type: 'success',
        text1: `Asistencia guardada`,
        text2: `${result?.created ?? 0} nueva${(result?.created ?? 0) === 1 ? '' : 's'}, ${result?.updated ?? 0} actualizada${(result?.updated ?? 0) === 1 ? '' : 's'}`,
      });
    } catch (error) {
      notifyError();
      // 403 = no administrás el equipo; 422 = la sesión ya no es presencial (o
      // alguno de los corredores no era miembro en la fecha). Son dos causas que
      // el entrenador puede resolver distinto, así que no se genéralizan. Cualquier
      // otro status cae al mensaje del backend.
      if (error.status === 403) {
        Toast.show({ type: 'error', text1: 'No administrás ese equipo', text2: 'Pedile a otro entrenador del equipo que cargue la asistencia.' });
      } else if (error.status === 422) {
        Toast.show({ type: 'error', text1: 'No se pudo guardar', text2: 'La sesión dejó de ser presencial o algún corredor no era del grupo en esa fecha.' });
      } else {
        Toast.show({ type: 'error', text1: 'No se pudo guardar la asistencia', text2: error.message });
      }
    }
  };

  // Pull-to-refresh (D11). Refresca la grilla y el listado de sesiones (los
  // contadores del selector se desactualizan con cada carga). NO toca
  // `selectedIds`: las marcas son del entrenador, no del servidor, y un refetch
  // no puede borrarle lo que llevaba marcado (tarea 5.8).
  const { refreshing, onRefresh } = usePullToRefresh(useCallback(async () => {
    await Promise.all([refetchGrid(), refetchSessions()]);
  }, [refetchGrid, refetchSessions]));

  // ── Borrado individual (tareas 6.1-6.4) ──────────────────────────────────
  //
  // Vive acá y no en la fila porque el `ConfirmDestructiveModal` compartido no
  // dispara el haptics por sí mismo (D12): el `notifyWarning` lo hace el caller
  // en su propio `useEffect` de apertura, así que el shell no decide cuándo
  // vibrar. Y la fila no puede, porque no sabe si el modal se está abriendo o
  // relanzándose.
  const [pendingDelete, setPendingDelete] = useState(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const { deleteAttendance, isDeleting } = useDeleteAttendance(teamId);

  useEffect(() => {
    if (pendingDelete) notifyWarning();
  }, [pendingDelete]);

  const handleRequestDelete = useCallback((row) => {
    setPendingDelete(row);
  }, []);

  const handleCancelDelete = useCallback(() => {
    if (isDeleting) return;
    setPendingDelete(null);
  }, [isDeleting]);

  const handleConfirmDelete = async () => {
    if (!pendingDelete || isDeleting) return;
    try {
      await deleteAttendance(pendingDelete.attendance_id);
      setPendingDelete(null);
      notifySuccess();
      Toast.show({ type: 'success', text1: 'Asistencia eliminada' });
    } catch (error) {
      notifyError();
      // La fila NO cambia y las métricas no se tocan: la invalidación solo corre
      // en el `onSuccess` del hook, así que un fallo deja la grilla como estaba
      // (tarea 6.3). Las marcas de otras filas tampoco se tocan (6.4).
      Toast.show({ type: 'error', text1: 'No se pudo eliminar', text2: error.message });
    }
  };


  //
  // Se saltea mientras `resolvingLink`: si no, preseleccionaría el primer grupo
  // apenas cargaran los grupos y la resolución del link tendría que pelear con
  // ese valor.
  useEffect(() => {
    if (!teamId || resolvingLink) return;
    if (groupId) return;
    if (loadingGroups || groupsError) return;
    if (groupOptions.length === 0) return;
    setGroupId(groupOptions[0].id);
  }, [teamId, resolvingLink, groupId, loadingGroups, groupsError, groupOptions]);

  const selectedTeam = teamOptions.find((option) => isSameId(option.id, teamId)) ?? null;
  const selectedGroup = groupOptions.find((option) => isSameId(option.id, groupId)) ?? null;
  const selectedSession = sessionOptions.find((option) => isSameId(option.id, sessionInstanceId)) ?? null;

  return (
    <View className="flex-1" nativeID={`${ID_PREFIX}-root`} testID={`${ID_PREFIX}-root`}>
      <ScrollView
        className="flex-1 bg-paper dark:bg-ink"
        contentContainerClassName="px-4 py-8"
        nativeID={`${ID_PREFIX}-scroll`}
        // Pull-to-refresh solo en nativo (tarea 5.8, D11): el mismo ternario
        // textual que usa el resto de pantallas. En web el gesture no existe y
        // un `RefreshControl` de RNW no aporta nada.
        refreshControl={isMobile ? (
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        ) : undefined}
        showsVerticalScrollIndicator={false}
        testID={`${ID_PREFIX}-scroll`}
      >
        <View className={`w-full self-center ${isWeb ? 'max-w-4xl' : ''}`} nativeID={`${ID_PREFIX}-container`} testID={`${ID_PREFIX}-container`}>
          <ScreenHeader />

          <AttendanceSelectionPanel
            groupId={groupId}
            groupOptions={groupOptions}
            groupsError={groupsError}
            idPrefix={`${ID_PREFIX}-selection`}
            loadingGroups={loadingGroups}
            loadingSessions={loadingSessions}
            loadingTeams={loadingTeams}
            notice={notice}
            onSelectGroup={handleSelectGroup}
            onSelectSession={handleSelectSession}
            onSelectTeam={handleSelectTeam}
            pendingSelectionCount={selectedIds.size}
            sessionInstanceId={sessionInstanceId}
            sessionOptions={sessionOptions}
            sessionsError={sessionsError}
            teamId={teamId}
            teamOptions={teamOptions}
            teamsError={teamsError}
          />

          {/* Encabezado de la sesión elegida + la costura donde entra la grilla.
            El encabezado es de esta etapa y no de la 5: el escenario de deep
            link del spec pide "el nombre del equipo y de la sesión en el
            encabezado", y es lo que hace visible que el link se resolvió. */}
          {selectedSession ? (
            <View className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface" nativeID={`${ID_PREFIX}-session-card`} testID={`${ID_PREFIX}-session-card`}>
              <View className="flex-row items-start" nativeID={`${ID_PREFIX}-session-card-header`} testID={`${ID_PREFIX}-session-card-header`}>
                <View className="flex-1" nativeID={`${ID_PREFIX}-session-card-texts`} testID={`${ID_PREFIX}-session-card-texts`}>
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" nativeID={`${ID_PREFIX}-session-context`} testID={`${ID_PREFIX}-session-context`}>
                    {[selectedTeam?.name, selectedGroup?.name].filter(Boolean).join(' · ')}
                  </Text>
                  <Text className="mt-1 text-lg font-bold text-slate-900 dark:text-white" nativeID={`${ID_PREFIX}-session-title`} testID={`${ID_PREFIX}-session-title`}>
                    {selectedSession.name}
                  </Text>
                  <Text className="text-sm text-slate-500 dark:text-slate-400" nativeID={`${ID_PREFIX}-session-date`} testID={`${ID_PREFIX}-session-date`}>
                    {formatSessionDate(selectedSession.date)}
                  </Text>
                </View>
                {/* El QR va acá y no dentro de la grilla a propósito: el
                    escenario del spec es "el QR sigue disponible con cambios sin
                    guardar", así que el botón no se deshabilita nunca por tener
                    marcas, ni por no haber asistencias todavía — el QR es de la
                    sesión, no de las asistencias.

                    Verde `primary` (#8cc63e) a propósito: es el mismo que pintan
                    los íconos de las dos tarjetas de arriba (`StatTile` usa
                    `colors.primary`), así que el botón se lee como parte de las
                    métricas y no como algo ajeno pegado en la card. El verde
                    profundo `on-primary-tint` (#3c6b12) se probó y quedaba
                    demasiado al lado de los íconos claros.

                    Sin borde ni fondo de superficie por lo mismo: un botón
                   Outline sobre blanco se lee como deshabilitado, que es
                    justamente lo que este botón nunca está. "Código QR" entero
                    y no la sigla "QR", que sola no decía qué botón era.

                    Texto casi negro (`#111518`, el `onPrimary` del repo) sobre el
                    verde, e ícono BLANCO: el ícono claro sobre fondo claro es el
                    único elemento que destaca del botón y marca dónde está la
                    acción. */}
                <Pressable
                  accessibilityLabel={`Generar el código QR de la sesión ${selectedSession.name}`}
                  className="h-10 flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-4 active:opacity-80"
                  nativeID={`${ID_PREFIX}-qr-button`}
                  onPress={() => setQrModalVisible(true)}
                  testID={`${ID_PREFIX}-qr-button`}
                >
                  <MaterialCommunityIcons color="#ffffff" name="qrcode" size={16} />
                  <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${ID_PREFIX}-qr-button-label`} testID={`${ID_PREFIX}-qr-button-label`}>
                    Código QR
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Sin sesión no se muestran las tarjetas de métricas (spec, escenario
               "Sin sesión seleccionada"), así que lo que corresponde es el
               mensaje pidiendo la selección completa, no un placeholder de grilla. */
            <View className="rounded-2xl border border-slate-200 bg-white px-4 py-10 dark:border-slate-700 dark:bg-surface" nativeID={`${ID_PREFIX}-no-session`} testID={`${ID_PREFIX}-no-session`}>
              <Text className="text-center text-sm text-slate-500 dark:text-slate-400" nativeID={`${ID_PREFIX}-no-session-text`} testID={`${ID_PREFIX}-no-session-text`}>
                Elegí equipo, grupo y sesión para ver la asistencia.
              </Text>
            </View>
          )}

          {/* La grilla solo existe con los tres ids resueltos. El `isLoading` de
              la grilla se distingue del "sin sesión": sin sesión no hay nada que
              pedir todavía, así que el mensaje de arriba va solo. */}
          {selectedSession ? (
            <AttendanceGrid
              error={gridError}
              idPrefix={`${ID_PREFIX}-grid`}
              isLoading={gridLoading}
              isRefetching={gridRefetching || sessionsRefetching}
              isSaving={isSaving}
              onRequestDelete={handleRequestDelete}
              onRetry={refetchGrid}
              onSave={handleSave}
              onToggle={toggleRow}
              rows={rows}
              selectedIds={selectedIds}
              summary={summary}
            />
          ) : null}

          <DiscardChangesModal
            onCancel={handleDiscardCancel}
            onConfirm={handleDiscardConfirm}
            visible={discardVisible}
          />

          {/* La descripción NOMBRA corredor y fecha (tarea 6.2): "eliminar la
              asistencia" sin decir de quién es deja al entrenador adivinando en
              una grilla de ocho filas. */}
          <ConfirmDestructiveModal
            confirmLabel="Eliminar"
            description={pendingDelete
              ? `Vas a eliminar la asistencia de ${pendingDelete.name} a la sesión del ${formatSessionDate(selectedSession?.date)}. Esta acción no se puede deshacer.`
              : ''}
            idPrefix={`${ID_PREFIX}-delete-attendance`}
            loading={isDeleting}
            onCancel={handleCancelDelete}
            onConfirm={handleConfirmDelete}
            title="Eliminar asistencia"
            visible={Boolean(pendingDelete)}
          />

          <AttendanceQrModal
            formatDate={formatSessionDate}
            onClose={() => setQrModalVisible(false)}
            session={selectedSession}
            sessionInstanceId={sessionInstanceId}
            teamId={teamId}
            teamName={selectedTeam?.name}
            visible={qrModalVisible}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ScreenHeader() {
  const router = useRouter();
  const colors = useThemeColors();

  // La pantalla es alcanzable por URL directa, así que `router.back()` a secas
  // puede no tener a dónde volver. Mismo criterio que
  // auth-card-shell.jsx:37-43.
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View className="mb-6 flex-row items-center gap-2" nativeID={`${ID_PREFIX}-header`} testID={`${ID_PREFIX}-header`}>
      <Pressable
        accessibilityLabel="Volver"
        className="flex-row items-center gap-1.5 py-1 pr-1 hover:opacity-70 active:opacity-70"
        nativeID={`${ID_PREFIX}-back-button`}
        onPress={handleBack}
        testID={`${ID_PREFIX}-back-button`}
      >
        <MaterialCommunityIcons color={colors.onSurfaceVariant} name="arrow-left" size={18} />
      </Pressable>
      <Text className="text-xl text-slate-900 dark:text-white" nativeID={`${ID_PREFIX}-title`} style={{ fontFamily: 'Orbitron_700Bold' }} testID={`${ID_PREFIX}-title`}>
        Asistencia
      </Text>
    </View>
  );
}

// Aviso de rol (tarea 4.8). Sin grilla, sin selector y sin botón de QR, como
// pide el escenario "El QR no está disponible para un corredor".
function TrainerOnlyNotice({ hasTrainerRole }) {
  const colors = useThemeColors();

  return (
    <View className="flex-1 bg-paper px-4 py-8 dark:bg-ink" nativeID={`${ID_PREFIX}-trainer-only-root`} testID={`${ID_PREFIX}-trainer-only-root`}>
      <View className={`w-full self-center ${isWeb ? 'max-w-4xl' : ''}`} nativeID={`${ID_PREFIX}-trainer-only-container`} testID={`${ID_PREFIX}-trainer-only-container`}>
        <ScreenHeader />

        <View className="rounded-2xl border border-slate-200 bg-white px-6 py-10 dark:border-slate-700 dark:bg-surface" nativeID={`${ID_PREFIX}-trainer-only-card`} testID={`${ID_PREFIX}-trainer-only-card`}>
          <MaterialCommunityIcons color={colors.onSurfaceVariant} name="whistle-outline" size={28} />
          <Text className="mt-3 text-base font-bold text-slate-900 dark:text-white" nativeID={`${ID_PREFIX}-trainer-only-title`} testID={`${ID_PREFIX}-trainer-only-title`}>
            La gestión de asistencia es exclusiva del entrenador
          </Text>
          {/* El segundo renglón distingue los dos motivos reales, que necesitan
              acciones distintas: o el usuario tiene el rol y está mirando la app
              como corredor (cambiar de perfil), o no lo tiene (pedirlo). Decir
              siempre "cambiá al perfil" sería un consejo imposible de seguir. */}
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400" nativeID={`${ID_PREFIX}-trainer-only-hint`} testID={`${ID_PREFIX}-trainer-only-hint`}>
            {hasTrainerRole
              ? 'Estás viendo la app como corredor. Cambiá al perfil de entrenador para gestionar la asistencia.'
              : 'Necesitás un perfil de entrenador para gestionar la asistencia de tus grupos.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// `useLocalSearchParams` devuelve string | string[] | undefined (un query param
// repetido llega como array) y `?team_id=` vacío llega como ''. Los tres casos
// se normalizan a null, que es el "no vino" del resto de la pantalla.
function readParam(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === null || raw === undefined) return null;
  const id = String(raw).trim();
  return id === '' ? null : id;
}
