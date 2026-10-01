import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAttendanceSessions as listAttendanceSessionsService,
  getSessionAttendance as getSessionAttendanceService,
  bulkSaveAttendance as bulkSaveAttendanceService,
  deleteAttendance as deleteAttendanceService,
} from '../services/attendance.js';

// Estado de servidor de la asistencia de un grupo — TanStack Query, no Zustand
// (ver CLAUDE.md). Son 4 lecturas/escrituras y ninguna necesita estado global.
//
// Orden de las query keys: el teamId va en SEGUNDA posición.
//
// `['attendance', teamId, 'sessions', groupId]` y no `['attendance', 'sessions',
// teamId, groupId]`. La invalidación de las mutaciones es por prefijo
// (`['attendance', teamId]`) porque guardar o borrar una asistencia cambia
// tanto el contador de la sesión en el listado como la fila de la grilla, y no
// queremos que el entrenador tenga que recargar (lo pide el spec). El match por
// prefijo de TanStack Query compara elemento a elemento desde el inicio, así que
// el teamId tiene que estar en la misma posición en las dos claves para que una
// sola invalidación alcance a las dos. Es el mismo criterio que
// `['group-calendar', groupId, from, to]` con `['group-calendar', groupId]` en
// use-group-calendar.js.
//
// Exportada porque la pantalla la necesita escrita a mano para el fan-out con
// que resuelve el deep link (un `useQueries` de cantidad variable, que un hook no
// puede resolver). Tener la key en un solo lugar evita el peor outcome posible:
// que el hook cambie su key y el fan-out se quede pegado a la vieja, escribiendo
// en un cache que nadie lee.
export function attendanceSessionsQueryKey(teamId, groupId) {
  return ['attendance', teamId, 'sessions', groupId];
}

// Lista de las sesiones presenciales ya ocurridas del grupo, con cuántas
// asistencias lleva cada una. Es el selector de sesión de la pantalla.
//
// `enabled` con los dos ids: sin equipo no hay a qué pedir el roster, y sin
// grupo no hay sesiones (el endpoint cuelga del grupo).
export function useAttendanceSessions(groupId, teamId) {
  const query = useQuery({
    queryKey: attendanceSessionsQueryKey(teamId, groupId),
    queryFn: () => listAttendanceSessionsService(groupId, teamId).then((dto) => dto.sessions ?? []),
    enabled: Boolean(groupId && teamId),
  });

  // `refetch`/`isRefetching` se exponen para el pull-to-refresh, que tiene que
  // refrescar el listado y la grilla juntos: los `attended_count` del selector de
  // sesión se desactualizan con cada carga masiva o borrado. Mismo contrato que
  // `useSessionAttendance`.
  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

// La grilla de una sesión: roster de la sesión cruzado con el estado de cada
// corredor, más el summary con los contadores.
//
// Ojo con el roster: NO es el de use-team-roster.js. El backend devuelve los
// miembros con membresía activa en la FECHA DE LA SESIÓN, no en la de hoy, así
// que un corredor que se bajasó después igual aparece si estaba en la fecha. Es
// la diferencia entre el roster de la grilla y el del equipo, y por eso esto no
// se puede derivar de otro hook.
// `refetchInterval` es opcional -- sin él, comportamiento de siempre (sin
// polling). La pantalla en vivo del entrenador lo pasa mientras el modal está
// abierto: no existe ningún evento WS para "se leyó un QR de asistencia" (el
// único broadcast server-originado hoy es `update:set_event` de
// workout_feedback, ver docs/REALTIME_WS.md) y sin esto el entrenador no se
// enteraba de una lectura ajena hasta refrescar a mano (bug real, 2026-10-01).
export function useSessionAttendance(sessionInstanceId, teamId, groupId, { refetchInterval } = {}) {
  const query = useQuery({
    queryKey: ['attendance', teamId, 'grid', groupId, sessionInstanceId],
    queryFn: () => getSessionAttendanceService(sessionInstanceId, teamId, groupId),
    enabled: Boolean(sessionInstanceId && teamId && groupId),
    refetchInterval,
  });

  return {
    rows: query.data?.roster ?? [],
    summary: query.data?.summary ?? null,
    session: query.data?.session ?? null,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

// Carga masiva de asistencias.
//
// PATRÓN C (D4): la mutación deja propagar el error en vez de envolverlo en un
// `{ success, error }`. O sea que NO hay try/catch acá adentro y el caller hace
// `try { await saveAttendance(...) } catch (e) { ... }`.
//
// Esto es una diferencia real con el resto de los hooks del repo: los otros 6
// (`use-sessions`, `use-groups`, `use-invitations`, `use-exercises`,
// use-group-calendar`, `use-training-plans`) castean el error a
// `{ success: false, error: error.message }` y obligan al caller a mirar un flag
// para saber si salió bien. Con patrón C, un error de red es un throw normal y
// el caller no puede olvidarse de chequearlo.
//
// También cambia la invalidación: con el otro patrón hay que mirar
// `if (result.success)` antes de invalidar (si no, un fallo marca la cache como
// desactualizada y dispara un refetch inútil). Con patrón C el `onSuccess` solo
// corre cuando la mutación realmente tuvo éxito, así que no hace falta el flag.
export function useSaveAttendance(teamId) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (variables) => bulkSaveAttendanceService(variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', teamId] }),
  });

  return { saveAttendance: mutation.mutateAsync, isSaving: mutation.isPending, error: mutation.error };
}

// Borrado de una asistencia individual. Mismo patrón C y misma invalidación por
// prefijo que la carga masiva: el summary y el attended_count del listado
// también se mueven.
//
// `teamId` se captura por closure y no viaja en las variables de la mutación:
// el service lo necesita para autorizar el borrado contra ese equipo, y dejarlo
// fijo acá evita que el caller pueda mandar el borrar contra otro equipo por
// error.
export function useDeleteAttendance(teamId) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ attendanceId }) => deleteAttendanceService(attendanceId, teamId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance', teamId] }),
  });

  return { deleteAttendance: mutation.mutateAsync, isDeleting: mutation.isPending, error: mutation.error };
}
