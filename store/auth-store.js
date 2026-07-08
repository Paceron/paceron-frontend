import { create } from 'zustand';
import { login as loginService, register as registerService } from '../services/auth.js';
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
        await persist(session);
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

  logout: async () => {
    set({ user: null, token: null, refreshToken: null, expiresAt: null });
    await removeItem(STORAGE_KEY);
  },
}));
