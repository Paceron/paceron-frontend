import { create } from 'zustand';
import { login as loginService, register as registerService, logout as logoutService, refresh as refreshService } from '../services/auth.js';
import { assignRole as assignRoleService } from '../services/roles.js';
import { toUserModel } from '../services/normalizers.js';
import { getItem, setItem, removeItem } from '../services/storage.js';
import { seedDefaultTheme } from '../providers/theme-provider.jsx';
import { queryClient } from '../lib/query-client.js';

const STORAGE_KEY = 'paceron.auth';

// Solo sesión persiste — el perfil (user/roles) se re-pide del backend en
// cada arranque vía hooks/use-user.js, nunca se escribe acá (ver
// docs/superpowers/specs/2026-09-09-auth-store-tanstack-query-migration-design.md,
// sección Persistencia).
async function persist(session) {
  try {
    await setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // persistencia best-effort — no romper el login si storage falla
  }
}

export const useAuthStore = create((set, get) => ({
  token: null,
  refreshToken: null,
  expiresAt: null,
  hydrated: false,
  activeRole: 'runner',
  // Id liviano de sesión — hooks/use-user.js lo usa para
  // useUser(userId)/usePermissions(userId) sin depender del propio cache
  // de Query para saber a quién pedirle.
  userId: null,
  // Dato puro de UI (no persiste, no dispara nada por sí solo): { role }
  // cuando switchRole() acaba de cambiar el rol activo, null en reposo. El
  // componente que lo consume decide qué hacer (animar, navegar según la
  // ruta actual).
  roleSwitchAnimating: null,

  hydrate: async () => {
    try {
      const raw = await getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          token: data.token ?? null,
          refreshToken: data.refreshToken ?? null,
          expiresAt: data.expiresAt ?? null,
          activeRole: data.activeRole ?? 'runner',
          // Fallback a data.user?.userId: sesiones persistidas por el
          // store pre-migración (todo usuario ya logueado hoy en
          // producción) tienen el user_id anidado en `user`, no en la
          // raíz — sin este fallback, esas sesiones pierden el login en
          // el primer hydrate() tras el deploy de esta rama.
          userId: data.userId ?? data.user?.userId ?? null,
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
      const token = result?.access_token;
      const user = toUserModel(result?.user);
      if (token && user) {
        const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
        const { activeRole } = get();
        const session = { token, refreshToken: result.refresh_token ?? null, expiresAt, userId: user.userId, activeRole };
        set(session);
        seedDefaultTheme(user.defaultTheme);
        // Siembra el cache de perfil con el user que ya vino en la
        // respuesta del login — evita un round-trip extra a getUser
        // apenas loguea (hooks/use-user.js#useUser lee de acá).
        queryClient.setQueryData(['user', user.userId], user);
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
      const result = await get().login(payload.email, payload.password);
      if (result.success) {
        // Verificado 2026-07-19 contra el backend real: NO asigna
        // "corredor" automáticamente al registrarse (permissions devolvía
        // roles: [] para un usuario recién creado) — fallback best-effort,
        // logueado si falla en vez de tragarse el error en silencio.
        const { userId } = get();
        await assignRoleService(userId, 'corredor').catch((e) => console.warn('corredor auto-assign failed', e));
        queryClient.invalidateQueries({ queryKey: ['permissions', userId] });
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  switchRole: async () => {
    // roles ya no vive acá — el gate de "¿tiene rol entrenador?" que
    // antes se resolvía inline con get().roles ahora lo hace el caller
    // (role-switch-toggle.jsx, que ya usa usePermissions() y no llama a
    // switchRole() si no corresponde mostrar el toggle).
    const { activeRole, token, refreshToken, expiresAt, userId } = get();
    const nextRole = activeRole === 'runner' ? 'trainer' : 'runner';
    set({ activeRole: nextRole, roleSwitchAnimating: { from: activeRole, to: nextRole } });
    await persist({ token, refreshToken, expiresAt, userId, activeRole: nextRole });
  },

  clearRoleSwitchAnimation: () => set({ roleSwitchAnimating: null }),

  // Corrección reactiva disparada por hooks/use-user.js#useRoleReconciliation
  // cuando activeRole quedó en 'trainer' pero los roles reales no incluyen
  // 'entrenador' — reemplaza la corrección que antes vivía inline en
  // fetchPermissions().
  resetActiveRoleIfInvalid: () => {
    const { token, refreshToken, expiresAt, userId } = get();
    set({ activeRole: 'runner' });
    persist({ token, refreshToken, expiresAt, userId, activeRole: 'runner' });
  },

  logout: async () => {
    const { refreshToken } = get();
    try {
      if (refreshToken) await logoutService(refreshToken);
    } catch {
      // best-effort — igual que persist(), el logout local sigue aunque
      // esto falle (sin red, refresh token ya vencido, etc.)
    }
    set({
      token: null,
      refreshToken: null,
      expiresAt: null,
      activeRole: 'runner',
      userId: null,
    });
    await removeItem(STORAGE_KEY);
    // Limpia perfil/permisos (y cualquier otro dominio en cache) — evita
    // que el próximo login muestre por un instante datos del usuario
    // anterior. Consolida acá el caso manual (botón "Cerrar sesión", 3
    // shells) y el caso automático (401 con refresh vencido,
    // services/api.js) en un solo lugar.
    queryClient.clear();
  },

  // Rota el refresh token (POST /auth/refresh) y persiste el par nuevo.
  // Usado por services/api.js cuando una request pega 401 — ver ahí el
  // interceptor que llama a esto antes de reintentar.
  refreshSession: async () => {
    const { refreshToken, activeRole, userId } = get();
    if (!refreshToken) throw new Error('No hay refresh token disponible.');
    const result = await refreshService(refreshToken);
    const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
    set({ token: result.access_token, refreshToken: result.refresh_token, expiresAt });
    await persist({ token: result.access_token, refreshToken: result.refresh_token, expiresAt, activeRole, userId });
    return result.access_token;
  },
}));
