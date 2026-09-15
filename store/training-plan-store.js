import { create } from 'zustand';
import {
  getTrainingPlan as getTrainingPlanService,
  listRunnerPlanAssignments as listRunnerPlanAssignmentsService,
  assignPlanToRunner as assignPlanToRunnerService,
  unassignPlanFromRunner as unassignPlanFromRunnerService,
  listCurrentPlanMarks as listCurrentPlanMarksService,
  markPlanAsCurrent as markPlanAsCurrentService,
  unmarkPlanAsCurrent as unmarkPlanAsCurrentService,
} from '../services/trainingPlans.js';
import { listTeams as listTeamsService } from '../services/teams.js';
import { listGroups as listGroupsService, getGroupUsers as getGroupUsersService } from '../services/groups.js';
import {
  toTrainingPlanModel,
  toRunnerPlanAssignmentModel, toCurrentPlanMarkModel, toTeamModel, toGroupModel,
} from '../services/normalizers.js';

// Arma dayCount días vacíos (todos "rest"), numerados 1..dayCount —
// punto de partida al crear un plan nuevo o al agregar/quitar días en
// el form. Sin día de la semana: el orden es puramente secuencial.
export function buildEmptyPlanDays(dayCount) {
  return Array.from({ length: dayCount }, (_, i) => ({ sequenceNo: i + 1, kind: 'rest', otherName: null, sessionId: null }));
}

// CRUD del catálogo de planes (list/get/create/update/delete/clone) vive
// en hooks/use-training-plans.js (TanStack Query, ver CLAUDE.md) — este
// store quedó solo con lo que NO es catálogo puro: asignación (vieja,
// mockeada, ver comentario de groupTrainingPlanIds) y "plan actual".
export const useTrainingPlanStore = create((set, get) => ({
  // Planes que ve el corredor (Mis planes) — individual + por grupo.
  myPlans: [],
  // Hasta 2 ids de myPlans marcados como "actual" — ver
  // docs/superpowers/specs/2026-09-03-my-plans-today-session-design.md.
  myCurrentPlanIds: [],

  // Asignación de plan a grupo — 100% local (sin campo en el backend, ver
  // docs/BACKEND_API_GAPS.md gap 4). Vivía en store/team-store.js hasta la
  // migración de equipos/grupos a TanStack Query (2026-09-09) — ese store
  // ya no tiene ningún array de grupos donde escribir esto, así que pasa a
  // vivir acá (es, de última, estado del dominio de planes, no de
  // equipos). Mapa groupId -> planId, no un campo dentro de un objeto
  // grupo — este store no tiene copia propia de los grupos reales.
  groupTrainingPlanIds: {},

  // Limpieza local tras borrar un plan (hooks/use-training-plans.js#useTrainingPlanMutations
  // llama a esto en el onSuccess de deletePlan) — el plan en sí ya lo
  // borró el service real, esto solo saca referencias que quedarían
  // colgando en estado 100% local de este store: cualquier grupo que lo
  // tuviera asignado en groupTrainingPlanIds, y su entrada en myPlans si
  // el corredor lo tenía asignado.
  cleanupAfterPlanDeleted: (planId) => {
    set((state) => {
      const groupTrainingPlanIds = { ...state.groupTrainingPlanIds };
      for (const [groupId, assignedPlanId] of Object.entries(groupTrainingPlanIds)) {
        if (assignedPlanId === planId) delete groupTrainingPlanIds[groupId];
      }
      return {
        myPlans: state.myPlans.filter((p) => p.id !== planId),
        groupTrainingPlanIds,
      };
    });
  },

  // Asignar a grupo no pega a ningún servicio propio — escribe en
  // groupTrainingPlanIds (100% local, ver comentario de arriba). teamId no
  // hace falta para la escritura en sí (el mapa es por groupId), se
  // mantiene en la firma para no romper el call site de la pantalla de
  // asignar.
  assignToGroup: (teamId, groupId, planId) => {
    set((state) => ({ groupTrainingPlanIds: { ...state.groupTrainingPlanIds, [groupId]: planId } }));
    return { success: true };
  },

  assignToRunner: async (planId, userId) => {
    try {
      await assignPlanToRunnerService(planId, userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  unassignFromRunner: async (userId) => {
    try {
      await unassignPlanFromRunnerService(userId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // "Mis planes" del corredor: junta su asignación individual (si tiene)
  // con el plan de cualquier grupo del que sea miembro real, en
  // cualquiera de los equipos donde participa como corredor (no los que
  // administra). Ver la spec para el detalle de por qué esto es una
  // composición client-side (trainingPlanId no tiene campo real en el
  // backend, así que no hay forma de resolverlo con un solo fetch).
  // Trae equipos/grupos directo de los servicios (no vía
  // hooks/use-teams.js#useMyMemberTeams/hooks/use-groups.js#useGroups —
  // son hooks de React, este es un action de Zustand fuera de un
  // componente) — mismo GET /teams?member_id=/GET /groups que usan esos
  // hooks, solo que llamado imperativamente acá.
  fetchMyPlans: async (userId) => {
    try {
      const teamDtos = await listTeamsService({ memberId: userId });
      // Mismo criterio que hooks/use-teams.js#useMyMemberTeams: el backend
      // agrega al dueño como team_user de su propio equipo, así que
      // ?member_id= también devuelve los equipos que administra.
      const memberTeams = teamDtos.map((dto) => toTeamModel(dto)).filter((team) => team.ownerId !== Number(userId));

      const individualDtos = await listRunnerPlanAssignmentsService({ userId });
      const individualPlanIds = individualDtos.map((dto) => toRunnerPlanAssignmentModel(dto).planId);

      const groupTrainingPlanIds = get().groupTrainingPlanIds;
      const groupPlanIds = [];
      for (const team of memberTeams) {
        const groupDtos = await listGroupsService(team.id, userId);
        for (const dto of groupDtos) {
          const group = toGroupModel(dto);
          const assignedPlanId = groupTrainingPlanIds[group.id];
          if (!assignedPlanId) continue;
          const groupUserDtos = await getGroupUsersService(group.id);
          const isMember = groupUserDtos.some((u) => u.user_id === Number(userId));
          if (isMember) groupPlanIds.push(assignedPlanId);
        }
      }

      const uniquePlanIds = [...new Set([...individualPlanIds, ...groupPlanIds])];
      const plans = await Promise.all(uniquePlanIds.map(async (planId) => toTrainingPlanModel(await getTrainingPlanService(planId))));

      // Filtra contra uniquePlanIds — un plan marcado como actual que ya
      // no está asignado (desasignado del lado del entrenador) no debería
      // seguir apareciendo en el hero.
      const markDtos = await listCurrentPlanMarksService({ userId });
      const currentPlanIds = markDtos
        .map((dto) => toCurrentPlanMarkModel(dto).planId)
        .filter((planId) => uniquePlanIds.includes(planId));

      set({ myPlans: plans, myCurrentPlanIds: currentPlanIds });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Marcar/desmarcar un plan como "actual" — preferencia del corredor,
  // no una asignación nueva (ver spec). El tope de 2 lo hace cumplir el
  // servicio (mockMarkPlanAsCurrent tira si ya hay 2), acá solo se
  // propaga el error para que la UI lo muestre.
  markCurrentPlan: async (userId, planId) => {
    try {
      await markPlanAsCurrentService(userId, planId);
      set((state) => (state.myCurrentPlanIds.includes(planId) ? state : { myCurrentPlanIds: [...state.myCurrentPlanIds, planId] }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  unmarkCurrentPlan: async (userId, planId) => {
    try {
      await unmarkPlanAsCurrentService(userId, planId);
      set((state) => ({ myCurrentPlanIds: state.myCurrentPlanIds.filter((id) => id !== planId) }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
