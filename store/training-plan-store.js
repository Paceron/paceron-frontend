import { create } from 'zustand';
import {
  listTrainingPlans as listTrainingPlansService,
  getTrainingPlan as getTrainingPlanService,
  createTrainingPlan as createTrainingPlanService,
  updateTrainingPlan as updateTrainingPlanService,
  deleteTrainingPlan as deleteTrainingPlanService,
  cloneTrainingPlan as cloneTrainingPlanService,
  listRunnerPlanAssignments as listRunnerPlanAssignmentsService,
  assignPlanToRunner as assignPlanToRunnerService,
  unassignPlanFromRunner as unassignPlanFromRunnerService,
  listCurrentPlanMarks as listCurrentPlanMarksService,
  markPlanAsCurrent as markPlanAsCurrentService,
  unmarkPlanAsCurrent as unmarkPlanAsCurrentService,
} from '../services/trainingPlans.js';
import { getGroupUsers as getGroupUsersService } from '../services/groups.js';
import {
  toTrainingPlanModel, toCreateTrainingPlanPayload, toUpdateTrainingPlanPayload,
  toRunnerPlanAssignmentModel, toCurrentPlanMarkModel,
} from '../services/normalizers.js';
import { useTeamStore } from './team-store.js';

// Caducidades soportadas — pedido explícito del usuario (7 o 14 días, no
// un número libre). Ver decisión en la spec: gobierna cuánto dura vigente
// el ciclo semanal fijo de 7 días, no cuántos días tiene el plan.
export const PLAN_DURATION_OPTIONS = [7, 14];

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo' };

export function dayLabel(dayOfWeek) {
  return DAY_LABELS[dayOfWeek] ?? dayOfWeek;
}

// Arma los 7 días vacíos (todos "rest") en el orden fijo lunes→domingo —
// punto de partida al crear un plan nuevo, para que el formulario siempre
// tenga la estructura completa desde el primer render. Un día
// "training" referencia una sesión del catálogo (sessionId), no la
// construye inline — ver enmienda 2026-08-26 de la spec.
export function buildEmptyPlanDays() {
  return DAY_ORDER.map((dayOfWeek, i) => ({ sequenceNo: i + 1, dayOfWeek, kind: 'rest', otherName: null, sessionId: null }));
}

// activo/vencido — se deriva en el momento de mostrarlo, no se guarda.
// Mismo criterio de semáforo que el resto de la app (SUBSCRIPTION_META,
// TEAM_STATUS_META en team-detail-screen.jsx).
export function getPlanStatus(plan) {
  if (!plan?.createdAt || !plan?.durationDays) return 'activo';
  const expiresAt = new Date(plan.createdAt).getTime() + plan.durationDays * 24 * 60 * 60 * 1000;
  return Date.now() < expiresAt ? 'activo' : 'vencido';
}

// Días enteros que le quedan de vigencia a un plan — mismo cálculo que
// getPlanStatus, pero como cantidad en vez de semáforo. 0 (no negativo)
// si ya venció. Para "Mis planes", fila de abajo del corredor.
export function getPlanDaysRemaining(plan) {
  if (!plan?.createdAt || !plan?.durationDays) return 0;
  const expiresAt = new Date(plan.createdAt).getTime() + plan.durationDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

// Hoy, como uno de los 7 dayOfWeek del dominio — getDay() de JS es
// 0=domingo..6=sábado, DAY_ORDER acá arriba arranca en lunes.
export function getTodayDayOfWeek() {
  const jsDay = new Date().getDay();
  return DAY_ORDER[(jsDay + 6) % 7];
}

export const useTrainingPlanStore = create((set, get) => ({
  // Planes propios del entrenador (Planes de entrenamiento).
  plans: [],
  // Planes que ve el corredor (Mis planes) — individual + por grupo.
  myPlans: [],
  // Hasta 2 ids de myPlans marcados como "actual" — ver
  // docs/superpowers/specs/2026-09-03-my-plans-today-session-design.md.
  myCurrentPlanIds: [],

  // GET /training-plans?owner_id= — biblioteca del entrenador.
  fetchPlans: async (ownerId) => {
    try {
      const dtos = await listTrainingPlansService({ ownerId });
      set({ plans: dtos.map(toTrainingPlanModel) });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Trae un plan puntual — para deep-link directo a /training-plans/{id}
  // o /plans/{id} sin haber pasado antes por la lista.
  fetchPlan: async (planId) => {
    try {
      const dto = await getTrainingPlanService(planId);
      const model = toTrainingPlanModel(dto);
      set((state) => {
        const inPlans = state.plans.some((p) => p.id === model.id);
        const inMyPlans = state.myPlans.some((p) => p.id === model.id);
        return {
          plans: inPlans ? state.plans.map((p) => (p.id === model.id ? model : p)) : [...state.plans, model],
          myPlans: inMyPlans ? state.myPlans.map((p) => (p.id === model.id ? model : p)) : state.myPlans,
        };
      });
      return { success: true, plan: model };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  createPlan: async (form) => {
    try {
      const created = await createTrainingPlanService(toCreateTrainingPlanPayload(form));
      const plan = toTrainingPlanModel(created);
      set((state) => ({ plans: [...state.plans, plan] }));
      return { success: true, plan };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  updatePlan: async (planId, form) => {
    try {
      const updated = await updateTrainingPlanService(planId, toUpdateTrainingPlanPayload(form));
      const plan = toTrainingPlanModel(updated);
      set((state) => ({ plans: state.plans.map((p) => (p.id === planId ? plan : p)) }));
      return { success: true, plan };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Borra el plan y, del lado del cliente, limpia cualquier grupo que lo
  // tuviera asignado (trainingPlanId es local-only, ver
  // store/team-store.js#setGroupTrainingPlan — sin este paso quedaría un
  // id colgando apuntando a un plan que ya no existe). Las asignaciones
  // individuales las limpia el mock solo (mockDeleteTrainingPlan).
  deletePlan: async (planId) => {
    try {
      await deleteTrainingPlanService(planId);
      set((state) => ({
        plans: state.plans.filter((p) => p.id !== planId),
        myPlans: state.myPlans.filter((p) => p.id !== planId),
      }));
      const teamStore = useTeamStore.getState();
      teamStore.teams.forEach((team) => {
        team.groups.forEach((group) => {
          if (group.trainingPlanId === planId) teamStore.setGroupTrainingPlan(team.id, group.id, null);
        });
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  clonePlan: async (planId) => {
    try {
      const cloned = await cloneTrainingPlanService(planId);
      const plan = toTrainingPlanModel(cloned);
      set((state) => ({ plans: [...state.plans, plan] }));
      return { success: true, plan };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Asignar a grupo no pega a ningún servicio propio — reusa
  // group.trainingPlanId (ver store/team-store.js). Queda acá como
  // wrapper fino para que la pantalla de asignar no tenga que conocer dos
  // stores distintos según el tipo de destino.
  assignToGroup: (teamId, groupId, planId) => {
    useTeamStore.getState().setGroupTrainingPlan(teamId, groupId, planId);
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
  fetchMyPlans: async (userId) => {
    try {
      const teamStore = useTeamStore.getState();
      if (teamStore.teams.length === 0) await teamStore.fetchTeams();
      await teamStore.fetchMyMemberTeams(userId);

      const memberTeamIds = new Set(useTeamStore.getState().myMemberTeams.map((t) => t.id));
      for (const teamId of memberTeamIds) {
        await teamStore.fetchGroups(teamId, userId);
      }

      const individualDtos = await listRunnerPlanAssignmentsService({ userId });
      const individualPlanIds = individualDtos.map((dto) => toRunnerPlanAssignmentModel(dto).planId);

      const groupPlanIds = [];
      for (const team of useTeamStore.getState().teams) {
        if (!memberTeamIds.has(team.id)) continue;
        for (const group of team.groups) {
          if (!group.trainingPlanId) continue;
          const groupUserDtos = await getGroupUsersService(group.id);
          const isMember = groupUserDtos.some((u) => u.user_id === Number(userId));
          if (isMember) groupPlanIds.push(group.trainingPlanId);
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
