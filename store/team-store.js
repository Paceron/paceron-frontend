import { create } from 'zustand';
import {
  createTeam as createTeamService,
  getTeam as getTeamService,
  listTeams as listTeamsService,
  updateTeam as updateTeamService,
  updateTeamAddress as updateTeamAddressService,
  deleteTeam as deleteTeamService,
} from '../services/teams.js';
import { listGroups as listGroupsService, createGroup as createGroupService, updateGroup as updateGroupService, deleteGroup as deleteGroupService } from '../services/groups.js';
import { inviteToTeam as inviteToTeamService, listTeamInvitations as listTeamInvitationsService } from '../services/invitations.js';
import { toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload, toGroupModel, toCreateGroupPayload, toUpdateGroupPayload, toInvitationModel } from '../services/normalizers.js';

// Tope de integrantes por tier del entrenador. 'base' es el plan free.
// 'pro'/'premium' hoy no los asigna ningun mock todavia (roles-mock.js
// siempre devuelve 'base'), pero el tope ya queda resuelto para cuando el
// sistema de tiers crezca mas alla de solo base/premium.
export const TEAM_MEMBER_LIMITS = {
  base: 10,
  pro: 50,
  premium: 300,
};

export function getTeamMemberLimit(tier) {
  return TEAM_MEMBER_LIMITS[tier] ?? TEAM_MEMBER_LIMITS.base;
}

// Sin dominio de suscripciones/cobros todavia (ver FUNCTIONAL_PROPOSE.md,
// "Sistema de suscripciones y cobros" sigue siendo un modulo reservado) —
// mismos tres estados que ya prevé esa seccion funcional.
export const SUBSCRIPTION_STATUSES = ['activo', 'vencido', 'en_prueba'];

// Sin dominio de planes de entrenamiento todavia (ver FUNCTIONAL_PROPOSE.md,
// "Planificacion de entrenamientos" sigue siendo un modulo reservado, no
// implementado) — catalogo mock compartido por el wizard de creacion y la
// pantalla de detalle (pestaña Grupos), hasta que exista ese servicio real.
export const TRAINING_PLAN_OPTIONS = [
  { id: 'plan-5k', name: 'Plan 5K' },
  { id: 'plan-10k', name: 'Plan 10K' },
  { id: 'plan-21k', name: 'Plan 21K (medio maratón)' },
  { id: 'plan-42k', name: 'Plan 42K (maratón)' },
];

const RUNNER_FIRST_NAMES = ['Lucía', 'Martín', 'Sofía', 'Nicolás', 'Valentina', 'Tomás', 'Camila', 'Agustín', 'Julieta', 'Franco'];
const RUNNER_LAST_NAMES = ['Fernández', 'Gómez', 'Rodríguez', 'López', 'Díaz', 'Martínez', 'Pérez', 'Sánchez', 'Romero', 'Torres'];
const MOCK_ROSTER_SIZE = 6;
const ACCENTS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
const DAY_MS = 24 * 60 * 60 * 1000;

// Reemplazo manual de tildes (en vez de String.prototype.normalize) para no
// depender de soporte Unicode completo del motor JS en todas las
// plataformas — la lista de nombres/apellidos de arriba es fija y chica.
function slugifyForEmail(value) {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => ACCENTS[ch] ?? ch)
    .join('')
    .replace(/[^a-z]+/g, '');
}

// Sin backend de miembros de equipo conectado todavia (existe
// services/teams.js#getTeamUsers, pero nada lo llama — ver
// docs/BACKEND_API_GAPS.md) — genera un roster de ejemplo determinista
// (mismo teamId + grupos siempre dan el mismo resultado) repartido entre
// los grupos existentes, para que la pantalla de detalle de equipo tenga
// datos con los que probarse de entrada, incluso contra un equipo real del
// backend. joinedAt se escalona por integrante (30 dias de diferencia
// entre uno y el siguiente) para que la antiguedad ("hace X meses en el
// equipo") no sea igual para todos.
function generateMockMembers(teamId, groups) {
  if (groups.length === 0) return [];
  return Array.from({ length: MOCK_ROSTER_SIZE }, (_, i) => {
    const firstName = RUNNER_FIRST_NAMES[i % RUNNER_FIRST_NAMES.length];
    const lastName = RUNNER_LAST_NAMES[(i * 3) % RUNNER_LAST_NAMES.length];
    return {
      id: `${teamId}-runner-${i}`,
      name: `${firstName} ${lastName}`,
      email: `${slugifyForEmail(firstName)}.${slugifyForEmail(lastName)}@mail.com`,
      subscriptionStatus: SUBSCRIPTION_STATUSES[i % SUBSCRIPTION_STATUSES.length],
      groupId: groups[i % groups.length].id,
      joinedAt: new Date(Date.now() - (i + 1) * 30 * DAY_MS).toISOString(),
    };
  });
}

// Completa un equipo real (ya normalizado por toTeamModel — camelCase, id
// como string) con los datos que el backend todavia no soporta directo en
// GET/POST /teams: foto (ver docs/BACKEND_API_GAPS.md). showGroupsToRunners
// ya viene resuelto en `team` por toTeamModel — el backend lo soporta desde
// 2026-07-29, solo queda el fallback a false para equipos recien creados
// que todavia no pasaron por un GET/PUT con ese campo en la respuesta.
// Grupos, miembros e invitaciones arrancan vacios — ya no se arma un grupo
// default sintetico aca: los grupos reales llegan por un fetch aparte
// (fetchGroups) o, para un equipo recien creado, por el flujo de creacion
// (Task 4); las invitaciones llegan por fetchInvitations, ya como accion
// separada de la creacion del equipo (Etapa 3). `extra.groups` solo existe
// recien creado el equipo (viene del wizard) — un equipo traido por
// fetchTeams/fetchTeam no tiene ese contexto, asi que arranca sin grupos.
function decorateTeam(team, extra = {}) {
  return {
    ...team,
    status: team.status ?? 'activo',
    photoUri: extra.photoUri ?? null,
    showGroupsToRunners: team.showGroupsToRunners ?? false,
    groups: extra.groups ?? [],
    members: extra.members ?? [],
    invitations: extra.invitations ?? [],
  };
}

// Equipos que el usuario administra (owner_id === userId) — el backend no
// tiene todavia un endpoint "mis equipos" (docs/BACKEND_API_GAPS.md), asi
// que se resuelve del lado del cliente filtrando GET /teams completo. No
// incluye equipos donde el usuario participa como corredor (ese caso no se
// puede resolver de ningun modo hoy, ver el mismo gap).
export function selectAdministeredTeams(teams, userId) {
  if (!userId) return [];
  return teams.filter((team) => team.ownerId === userId);
}

export const useTeamStore = create((set, get) => ({
  teams: [],
  selectedTeamId: null,

  selectTeam: (teamId) => set({ selectedTeamId: teamId }),

  // Trae todos los equipos del sistema (GET /teams, sin filtro — el filtro
  // de "mis equipos" vive en selectAdministeredTeams). Un equipo ya
  // presente en el store (ej. recien creado en esta sesion) conserva sus
  // campos local-only (grupos, roster, invitaciones, showGroupsToRunners,
  // foto) en vez de perderlos — solo un equipo nuevo para el store arranca
  // decorado desde cero.
  fetchTeams: async () => {
    try {
      const dtos = await listTeamsService();
      set((state) => ({
        teams: dtos.map((dto) => {
          const model = toTeamModel(dto);
          const existing = state.teams.find((t) => t.id === model.id);
          return existing ? { ...existing, ...model } : decorateTeam(model);
        }),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Trae un equipo puntual (GET /teams/{id}) — para cuando se entra por
  // deep-link a un equipo que todavia no esta en `teams` (ej. recargar la
  // pagina de detalle/edicion directo por URL).
  fetchTeam: async (teamId) => {
    try {
      const dto = await getTeamService(teamId);
      const model = toTeamModel(dto);
      set((state) => {
        const existing = state.teams.find((t) => t.id === teamId);
        const team = existing ? { ...existing, ...model } : decorateTeam(model);
        const alreadyListed = state.teams.some((t) => t.id === teamId);
        return {
          teams: alreadyListed ? state.teams.map((t) => (t.id === teamId ? team : t)) : [...state.teams, team],
        };
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Trae los grupos reales de un equipo (GET /groups) y regenera el
  // roster mock a partir de ellos — separado de fetchTeam/fetchTeams
  // porque un equipo puede estar en `teams` sin sus grupos todavia
  // cargados (ya no vienen sincrónicos, ver decorateTeam). Preserva
  // trainingPlanId elegido localmente para un grupo que ya estaba en
  // memoria (catálogo mock, sin campo en el backend — ver
  // docs/BACKEND_API_GAPS.md gap 4).
  fetchGroups: async (teamId, userId) => {
    try {
      const dtos = await listGroupsService(teamId, userId);
      const existingTeam = get().teams.find((t) => t.id === teamId);
      const groups = dtos.map((dto) => {
        const model = toGroupModel(dto);
        const existingGroup = existingTeam?.groups.find((g) => g.id === model.id);
        return existingGroup ? { ...model, trainingPlanId: existingGroup.trainingPlanId } : model;
      });
      const members = generateMockMembers(teamId, groups);
      set((state) => ({
        teams: state.teams.map((t) => (t.id === teamId ? { ...t, groups, members } : t)),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Crea el equipo contra el backend real (POST /teams, con
  // create_default_group: true — el backend arma su grupo principal como
  // side-effect) y lo selecciona. Si el payload trae algun campo de
  // ubicacion, encadena inmediatamente PUT /teams/{id}/address — si esa
  // segunda llamada falla, el resultado sigue siendo exito (el equipo ya
  // existe) con `addressWarning: true`. Despues crea contra el backend
  // cada grupo extra armado en el wizard (payload.groups, ademas del
  // default que ya vino con el equipo) — una falla individual no revierte
  // la creacion del equipo, solo deja `groupsWarning: true`. Termina
  // pidiendo el listado real de grupos (GET /groups, que ya incluye el
  // default mas los extra que hayan tenido exito). Las invitaciones ya no
  // se orquestan aca — se mandan aparte con sendInvite despues de crear el
  // equipo (Etapa 3), asi que no hace falta remapear ids de grupo draft a
  // reales. La foto (payload.photoUri) sigue sin campo en el backend (ver
  // docs/BACKEND_API_GAPS.md) — se guarda solo del lado del cliente.
  createTeam: async (payload) => {
    try {
      const created = await createTeamService(toCreateTeamPayload(payload));
      const teamId = String(created.id);
      let team = decorateTeam(toTeamModel(created), { photoUri: payload.photoUri });
      set((state) => ({ teams: [...state.teams, team], selectedTeamId: team.id }));

      const hasAddress = Boolean(payload.country || payload.province || payload.city);
      let addressWarning;
      if (hasAddress) {
        try {
          await updateTeamAddressService(teamId, toAddressPayload(payload));
          team = { ...team, country: payload.country || null, province: payload.province || null, city: payload.city || null };
          set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? team : t)) }));
        } catch {
          addressWarning = true;
        }
      }

      const draftGroups = payload.groups ?? [];
      let groupsWarning;
      for (const draft of draftGroups) {
        try {
          await createGroupService(toCreateGroupPayload(teamId, draft));
        } catch {
          groupsWarning = true;
        }
      }

      const groupDtos = await listGroupsService(teamId, get().teams.find((t) => t.id === teamId)?.ownerId ?? payload.ownerId);
      const groups = groupDtos.map((dto) => {
        const model = toGroupModel(dto);
        const draft = draftGroups.find((d) => d.name === model.name);
        return draft ? { ...model, trainingPlanId: draft.trainingPlanId ?? null } : model;
      });

      const members = generateMockMembers(teamId, groups);
      team = { ...team, groups, members };
      set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? team : t)) }));

      return { success: true, team, ...(addressWarning ? { addressWarning } : {}), ...(groupsWarning ? { groupsWarning } : {}) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Edita los "datos generales" de un equipo ya existente (PUT
  // /teams/{id}, parcial) — grupos, miembros, invitaciones y status no se
  // tocan desde acá. `updates` puede traer country/province/city
  // (secuenciados aparte, ver abajo) y photoUri (interactivo del lado del
  // cliente, sin campo en el backend — ver docs/BACKEND_API_GAPS.md): se
  // conserva en el equipo resultante vía `clientOnlyAndGeneralUpdates`,
  // pero toUpdateTeamPayload lo descarta antes de mandarlo al PUT general.
  // showGroupsToRunners SÍ tiene campo real en el backend desde
  // 2026-07-29 — se manda en el payload y el valor final sale de la
  // respuesta (generalModel), no del echo local. country/province/city se
  // excluyen del merge inicial a propósito — si el PUT de dirección de
  // abajo falla, no queremos mostrar como "guardado" un valor que en
  // realidad no se persistió.
  updateTeam: async (teamId, updates) => {
    const team = get().teams.find((t) => t.id === teamId);
    if (!team) return { success: false, error: 'Equipo no encontrado.' };

    const { country: _country, province: _province, city: _city, ...clientOnlyAndGeneralUpdates } = updates;

    try {
      const updated = await updateTeamService(teamId, toUpdateTeamPayload(updates));
      const generalModel = toTeamModel(updated);
      let merged = {
        ...team,
        ...clientOnlyAndGeneralUpdates,
        name: generalModel.name,
        description: generalModel.description,
        level: generalModel.level,
        maxMembers: generalModel.maxMembers,
        requirements: generalModel.requirements,
        showGroupsToRunners: generalModel.showGroupsToRunners,
        status: generalModel.status,
        updatedAt: generalModel.updatedAt,
      };
      set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? merged : t)) }));

      const hasAddress = Boolean(updates.country || updates.province || updates.city);
      if (!hasAddress) return { success: true, team: merged };

      try {
        await updateTeamAddressService(teamId, toAddressPayload(updates));
        merged = { ...merged, country: updates.country || null, province: updates.province || null, city: updates.city || null };
        set((state) => ({ teams: state.teams.map((t) => (t.id === teamId ? merged : t)) }));
        return { success: true, team: merged };
      } catch {
        return { success: true, team: merged, addressWarning: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Elimina el equipo (DELETE /teams/{id}?user_id=) y lo saca del store.
  // userId es quien pide el borrado — el backend valida que sea el dueño,
  // acá no se duplica ese chequeo (la pantalla ya solo muestra el botón a
  // quien administra el equipo).
  deleteTeam: async (teamId, userId) => {
    try {
      await deleteTeamService(teamId, userId);
      set((state) => ({
        teams: state.teams.filter((t) => t.id !== teamId),
        selectedTeamId: state.selectedTeamId === teamId ? null : state.selectedTeamId,
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Crea un grupo nuevo en un equipo ya existente (POST /groups) — a
  // diferencia de los grupos armados en el wizard de creación, este no
  // pasa por un estado "draft", pega directo al backend.
  createGroupInTeam: async (teamId, form) => {
    try {
      const created = await createGroupService(toCreateGroupPayload(teamId, form));
      const group = toGroupModel(created);
      set((state) => ({
        teams: state.teams.map((t) => (t.id === teamId ? { ...t, groups: [...t.groups, group] } : t)),
      }));
      return { success: true, group };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Edita nombre/descripción de un grupo real (PUT /groups/{id}).
  // trainingPlanId sigue siendo local-only (sin campo en el backend, ver
  // docs/BACKEND_API_GAPS.md gap 4) — se conserva del grupo ya en memoria,
  // no lo toca esta acción.
  updateGroupReal: async (teamId, groupId, form) => {
    try {
      const updated = await updateGroupService(groupId, toUpdateGroupPayload(form));
      const model = toGroupModel(updated);
      set((state) => ({
        teams: state.teams.map((t) => {
          if (t.id !== teamId) return t;
          return {
            ...t,
            groups: t.groups.map((g) => (g.id === groupId ? { ...model, trainingPlanId: g.trainingPlanId } : g)),
          };
        }),
      }));
      const team = get().teams.find((t) => t.id === teamId);
      return { success: true, group: team.groups.find((g) => g.id === groupId) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Borra un grupo real (DELETE /groups/{id}) — la UI no ofrece esta
  // acción para el grupo principal (isDefault), no hace falta chequearlo
  // acá de nuevo.
  deleteGroupReal: async (teamId, groupId) => {
    try {
      await deleteGroupService(groupId);
      set((state) => ({
        teams: state.teams.map((t) => (t.id === teamId ? { ...t, groups: t.groups.filter((g) => g.id !== groupId) } : t)),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Trae las invitaciones pendientes reales de un equipo (GET
  // /teams/{id}/invitations) — mismo patrón que fetchGroups.
  fetchInvitations: async (teamId) => {
    try {
      const dtos = await listTeamInvitationsService(teamId);
      const invitations = dtos.map((dto) => toInvitationModel(dto));
      set((state) => ({
        teams: state.teams.map((t) => (t.id === teamId ? { ...t, invitations } : t)),
      }));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Manda una invitación real (POST /teams/{id}/invite, solo email — ver
  // docs/BACKEND_API_GAPS.md gap 9) y re-trae el listado para reflejarla.
  // La respuesta del POST no trae el id de la invitación creada, no hay
  // nada que insertar localmente sin el refetch.
  sendInvite: async (teamId, email) => {
    try {
      await inviteToTeamService(teamId, email);
      await get().fetchInvitations(teamId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
