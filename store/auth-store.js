import { create } from 'zustand';
import { login as loginService, register as registerService } from '../services/auth.js';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,

  login: async (email, password) => {
    try {
      const result = await loginService(email, password);
      if (result.token && result.user) {
        set({ user: result.user, token: result.token });
        return { success: true };
      }
      return { success: false, error: result.error || 'Credenciales incorrectas.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  register: async (userData) => {
    try {
      const result = await registerService(userData);
      if (result.token && result.user) {
        set({ user: result.user, token: result.token });
        return { success: true };
      }
      return { success: false, error: result.error || 'Error al crear la cuenta.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  logout: () => set({ user: null, token: null }),

  clearUser: () => set({ user: null, token: null }),
}));
