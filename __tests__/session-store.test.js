import { useSessionStore } from '../store/session-store.js';

jest.mock('../services/sessions.js', () => ({
  listSessions: jest.fn(),
  createSession: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
}));

import {
  listSessions as listSessionsService, createSession as createSessionService,
  updateSession as updateSessionService, deleteSession as deleteSessionService,
} from '../services/sessions.js';

const SESSION_DTO = {
  id: 1, owner_id: 7, name: 'Fondo suave', description: 'desc',
  exercises: [
    { exercise_id: 1, role: 'warmup', repeat_count: 1, rest_minutes: 0 },
    { exercise_id: 2, role: 'main', repeat_count: 1, rest_minutes: 0 },
    { exercise_id: 3, role: 'cooldown', repeat_count: 1, rest_minutes: 0 },
  ],
  created_at: '', updated_at: '',
};

beforeEach(() => {
  jest.clearAllMocks();
  useSessionStore.setState({ sessions: [] });
});

describe('session store', () => {
  test('fetchSessions trae y normaliza el catálogo', async () => {
    listSessionsService.mockResolvedValue([SESSION_DTO]);
    const result = await useSessionStore.getState().fetchSessions(7);
    expect(listSessionsService).toHaveBeenCalledWith({ ownerId: 7 });
    expect(result.success).toBe(true);
    const { sessions } = useSessionStore.getState();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('1');
    expect(sessions[0].exercises).toHaveLength(3);
    expect(sessions[0].exercises[0].exerciseId).toBe('1');
    expect(sessions[0].exercises[0].role).toBe('warmup');
    expect(sessions[0].exercises[1].exerciseId).toBe('2');
    expect(sessions[0].exercises[2].exerciseId).toBe('3');
  });

  test('createSession agrega la sesión creada a la lista', async () => {
    createSessionService.mockResolvedValue(SESSION_DTO);
    const result = await useSessionStore.getState().createSession({
      ownerId: 7, name: 'Fondo suave', description: 'desc',
      exercises: [
        { exerciseId: '1', role: 'warmup', repeatCount: 1, restMinutes: 0 },
        { exerciseId: '2', role: 'main', repeatCount: 1, restMinutes: 0 },
        { exerciseId: '3', role: 'cooldown', repeatCount: 1, restMinutes: 0 },
      ],
    });
    expect(result.success).toBe(true);
    expect(useSessionStore.getState().sessions).toContainEqual(result.session);
  });

  test('fetchSessions devuelve error legible si el servicio falla', async () => {
    listSessionsService.mockRejectedValue(new Error('falló'));
    const result = await useSessionStore.getState().fetchSessions(7);
    expect(result).toEqual({ success: false, error: 'falló' });
  });

  test('updateSession reemplaza la sesión editada en la lista', async () => {
    useSessionStore.setState({ sessions: [{ id: '1', name: 'Fondo suave' }] });
    updateSessionService.mockResolvedValue({ ...SESSION_DTO, name: 'Fondo regenerativo' });
    const result = await useSessionStore.getState().updateSession('1', {
      ownerId: 7, name: 'Fondo regenerativo',
      exercises: [
        { exerciseId: '1', role: 'warmup', repeatCount: 1, restMinutes: 0 },
        { exerciseId: '2', role: 'main', repeatCount: 1, restMinutes: 0 },
        { exerciseId: '3', role: 'cooldown', repeatCount: 1, restMinutes: 0 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.session.name).toBe('Fondo regenerativo');
    expect(useSessionStore.getState().sessions).toHaveLength(1);
    expect(useSessionStore.getState().sessions[0].name).toBe('Fondo regenerativo');
  });

  test('deleteSession saca la sesión de la lista', async () => {
    useSessionStore.setState({ sessions: [{ id: '1', name: 'Fondo suave' }] });
    deleteSessionService.mockResolvedValue(undefined);
    const result = await useSessionStore.getState().deleteSession('1');
    expect(result.success).toBe(true);
    expect(useSessionStore.getState().sessions).toEqual([]);
  });
});
