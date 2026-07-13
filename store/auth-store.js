import { create } from 'zustand';
import { login as loginService, register as registerService, getUser as getUserService } from '../services/auth.js';
import { updateUser as updateUserService, changeStatus as changeStatusService } from '../services/user.js';
import { toUserModel } from '../services/normalizers.js';
import { getItem, setItem, removeItem } from '../services/storage.js';

const STORAGE_KEY = 'paceron.auth';

async function persist(session) {
  try {
    await setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // persistencia best-effort — no romper el login si storage falla
  }
}

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  expiresAt: null,
  hydrated: false,
  activeRole: 'runner',
  trainerActivated: false,
  // Dato puro de UI (no persiste, no dispara nada por sí solo): { role }
  // cuando switchRole() acaba de cambiar el rol activo, null en reposo. El
  // componente que lo consume decide qué hacer (animar, navegar).
  roleSwitchAnimating: null,

  hydrate: async () => {
    try {
      const raw = await getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          user: data.user ?? null,
          token: data.token ?? null,
          refreshToken: data.refreshToken ?? null,
          expiresAt: data.expiresAt ?? null,
          activeRole: data.activeRole ?? 'runner',
          trainerActivated: data.trainerActivated ?? false,
        });
      }
    } catch {
      // sesión corrupta — se ignora y se arranca sin sesión
    }
    set({ hydrated: true });
  },

  login: async (email, password) => {
    try {
      const result = await loginService(email, password);
      const token = result?.authorization?.access_token;
      const user = toUserModel(result?.user);
      if (token && user) {
        const auth = result.authorization;
        const expiresAt = auth.expires_in ? Date.now() + auth.expires_in * 1000 : null;
        const session = { user, token, refreshToken: auth.refresh_token ?? null, expiresAt };
        set(session);
        const { activeRole, trainerActivated } = get();
        await persist({ ...session, activeRole, trainerActivated });
        return { success: true };
      }
      return { success: false, error: 'Credenciales incorrectas.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  register: async (payload) => {
    try {
      await registerService(payload);
      return await get().login(payload.email, payload.password);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Refresca los datos del usuario desde el backend. Best-effort: si falla
  // (ej. CORS en web, offline), conserva el user actual sin romper.
  refreshUser: async () => {
    const { user, token, refreshToken, expiresAt, activeRole, trainerActivated } = get();
    if (!user?.userId) return;
    try {
      const fresh = toUserModel(await getUserService({ id: user.userId }));
      if (fresh) {
        set({ user: fresh });
        await persist({ user: fresh, token, refreshToken, expiresAt, activeRole, trainerActivated });
      }
    } catch {
      // best-effort — se mantiene el user actual
    }
  },

  // Actualiza datos del usuario (PUT). currentPassword solo si cambió el email.
  updateUser: async (id, payload, currentPassword) => {
    try {
      const updated = toUserModel(await updateUserService(id, payload, currentPassword));
      if (updated) {
        const { token, refreshToken, expiresAt, activeRole, trainerActivated } = get();
        set({ user: updated });
        await persist({ user: updated, token, refreshToken, expiresAt, activeRole, trainerActivated });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Baja lógica: PATCH status a 'inactive' y cierra sesión.
  deactivateAccount: async () => {
    const { user } = get();
    if (!user?.userId) return { success: false, error: 'No hay sesión activa.' };
    try {
      await changeStatusService(user.userId, 'inactive');
      await get().logout();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Local-only por ahora: el backend no tiene roles todavía. Estructurado
  // para que reemplazar esto por datos reales del backend no cambie la
  // interfaz que consumen los componentes.
  activateTrainerProfile: async () => {
    set({ trainerActivated: true });
    const { user, token, refreshToken, expiresAt, activeRole } = get();
    await persist({ user, token, refreshToken, expiresAt, activeRole, trainerActivated: true });
  },

  switchRole: async () => {
    const { trainerActivated, activeRole, user, token, refreshToken, expiresAt } = get();
    if (!trainerActivated) return;
    const nextRole = activeRole === 'runner' ? 'trainer' : 'runner';
    set({ activeRole: nextRole, roleSwitchAnimating: { role: nextRole } });
    await persist({ user, token, refreshToken, expiresAt, activeRole: nextRole, trainerActivated });
  },

  clearRoleSwitchAnimation: () => set({ roleSwitchAnimating: null }),

  logout: async () => {
    set({ user: null, token: null, refreshToken: null, expiresAt: null, activeRole: 'runner', trainerActivated: false });
    await removeItem(STORAGE_KEY);
  },
}));
