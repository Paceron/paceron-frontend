import { create } from 'zustand';
import { login as loginService, register as registerService, getUser as getUserService } from '../services/auth.js';
import { updateUser as updateUserService, changeStatus as changeStatusService } from '../services/user.js';
import { assignRole as assignRoleService, removeRole as removeRoleService, getPermissions as getPermissionsService } from '../services/roles.js';
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
  // Roles reales del usuario, desde /auth/permissions. activeRole (cuál
  // se muestra ahora) sigue local-only — el backend no tiene ese concepto,
  // solo trackea qué roles tiene asignados (un conjunto, no una selección).
  roles: [],
  rolesLoaded: false,
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
          user: data.user ?? null,
          token: data.token ?? null,
          refreshToken: data.refreshToken ?? null,
          expiresAt: data.expiresAt ?? null,
          activeRole: data.activeRole ?? 'runner',
          // Sesiones viejas (pre-roles-de-backend) no tienen esta clave —
          // se normaliza a [] en vez de romper. rolesLoaded queda false
          // hasta que el fetchPermissions() de abajo resuelva.
          roles: Array.isArray(data.roles) ? data.roles : [],
        });
      }
    } catch {
      // sesión corrupta — se ignora y se arranca sin sesión
    }
    set({ hydrated: true });
    const { user, token } = get();
    if (user?.userId && token) await get().fetchPermissions();
  },

  login: async (email, password) => {
    try {
      const result = await loginService(email, password);
      const token = result?.access_token;
      const user = toUserModel(result?.user);
      if (token && user) {
        const expiresAt = result.expires_in ? Date.now() + result.expires_in * 1000 : null;
        const session = { user, token, refreshToken: result.refresh_token ?? null, expiresAt };
        set(session);
        const { activeRole } = get();
        await persist({ ...session, activeRole, roles: [] });
        await get().fetchPermissions();
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
        const { user } = get();
        await assignRoleService(user.userId, 'corredor').catch((e) => console.warn('corredor auto-assign failed', e));
        await get().fetchPermissions();
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Refresca los datos del usuario desde el backend. Best-effort: si falla
  // (ej. CORS en web, offline), conserva el user actual sin romper.
  refreshUser: async () => {
    const { user, token, refreshToken, expiresAt, activeRole, roles } = get();
    if (!user?.userId) return;
    try {
      const fresh = toUserModel(await getUserService({ id: user.userId }));
      if (fresh) {
        set({ user: fresh });
        await persist({ user: fresh, token, refreshToken, expiresAt, activeRole, roles });
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
        const { token, refreshToken, expiresAt, activeRole, roles } = get();
        set({ user: updated });
        await persist({ user: updated, token, refreshToken, expiresAt, activeRole, roles });
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

  // Pide a /auth/permissions los roles reales del usuario. Se llama tras
  // login/hydrate/activar rol — nunca se confía solo en la copia
  // persistida (existe solo para evitar un parpadeo mientras esto corre).
  fetchPermissions: async () => {
    const { user } = get();
    if (!user?.userId) return;
    try {
      const data = await getPermissionsService(user.userId);
      const roles = data?.roles ?? [];
      // activeRole es local-only y puede quedar desincronizado de los roles
      // reales — ej. una sesión vieja persistida (localStorage/secure-store)
      // con activeRole:'trainer' de cuando el usuario sí tenía el rol, y
      // después se lo sacaron desde otra sesión o se reseteó el mock. Sin
      // este chequeo, la UI podía mostrar el tag "Entrenador"
      // (RoleBadge usa activeRole tal cual) mientras el resto de la app
      // (gates por roles.some(...)) correctamente lo trataba como corredor
      // — el síntoma exacto: tag de entrenador visible pero el botón
      // "Activar perfil de entrenador" también, porque roles no lo tenía.
      const { activeRole: currentActiveRole } = get();
      const hasTrainerRole = roles.some((r) => r.name === 'entrenador');
      const activeRole = currentActiveRole === 'trainer' && !hasTrainerRole ? 'runner' : currentActiveRole;
      set({ roles, rolesLoaded: true, activeRole });
      const { token, refreshToken, expiresAt } = get();
      await persist({ user, token, refreshToken, expiresAt, activeRole, roles });
    } catch {
      // best-effort — se mantiene roles anterior si falla
    }
  },

  // Asigna el rol entrenador (tier base) y guarda el alias. Verificado
  // 2026-07-19 contra el backend real: PUT /users/{id} es parcial (un PUT
  // con solo {bank_alias} no tocó el resto del perfil) — no hace falta
  // reenviar el perfil completo.
  activateTrainerRole: async (bankAlias) => {
    const { user } = get();
    if (!user?.userId) return { success: false, error: 'No hay sesión activa.' };
    try {
      await assignRoleService(user.userId, 'entrenador');
      const updateResult = await get().updateUser(user.userId, { bank_alias: bankAlias });
      if (!updateResult.success) return updateResult;
      await get().fetchPermissions();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Da de baja el rol entrenador. bank_alias NO se toca a propósito — se
  // mantiene guardado por si el usuario reactiva el perfil más adelante
  // (ver activate-trainer-screen.jsx, que lo pre-completa en ese caso).
  deactivateTrainerRole: async () => {
    const { user, activeRole } = get();
    if (!user?.userId) return { success: false, error: 'No hay sesión activa.' };
    try {
      await removeRoleService(user.userId, 'entrenador');
      if (activeRole === 'trainer') {
        const { token, refreshToken, expiresAt, roles } = get();
        set({ activeRole: 'runner' });
        await persist({ user, token, refreshToken, expiresAt, activeRole: 'runner', roles });
      }
      await get().fetchPermissions();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  switchRole: async () => {
    const { activeRole, roles, user, token, refreshToken, expiresAt } = get();
    if (!roles.some((r) => r.name === 'entrenador')) return;
    const nextRole = activeRole === 'runner' ? 'trainer' : 'runner';
    set({ activeRole: nextRole, roleSwitchAnimating: { from: activeRole, to: nextRole } });
    await persist({ user, token, refreshToken, expiresAt, activeRole: nextRole, roles });
  },

  clearRoleSwitchAnimation: () => set({ roleSwitchAnimating: null }),

  logout: async () => {
    set({
      user: null,
      token: null,
      refreshToken: null,
      expiresAt: null,
      activeRole: 'runner',
      roles: [],
      rolesLoaded: false,
    });
    await removeItem(STORAGE_KEY);
  },
}));
