import { API_BASE_URL } from '../config/env.js';
import { useAuthStore } from '../store/auth-store.js';

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

// Refresh en curso compartido entre requests concurrentes — si varias
// pegan 401 al mismo tiempo, todas esperan este mismo refresh en vez de
// disparar uno cada una.
let refreshPromise = null;

async function request(path, { _isRetry, skipAuthRefresh, ...fetchOptions } = {}) {
  const { token } = useAuthStore.getState();
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    ...fetchOptions,
    headers,
  });

  // skipAuthRefresh: para endpoints donde un 401 significa "credencial de
  // negocio incorrecta" (ej. confirmar contraseña para activar el rol
  // entrenador), no "sesión vencida" — sin esto, el interceptor dispararía
  // un refresh innecesario (que además rota el refresh token real) y, en
  // el peor caso, un logout espurio si ese refresh token ya era inválido
  // por otra razón. El caller que conoce la semántica de su propio 401 lo
  // pasa explícito (ver services/roles.js#activateTrainerRole).
  if (response.status === 401 && !_isRetry && !skipAuthRefresh && useAuthStore.getState().refreshToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = useAuthStore.getState().refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      return await request(path, { ...fetchOptions, _isRetry: true });
    } catch {
      await useAuthStore.getState().logout();
      // sigue abajo y deja que la response 401 original se maneje como
      // cualquier otro error — el caller original ve el fallo, no queda colgado
    }
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // sin cuerpo JSON — se usa el mensaje por defecto
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export default {
  get: async (path) => await request(path, { method: 'GET' }),
  post: async (path, body, options) => await request(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: async (path, body, headers) => await request(path, { method: 'PUT', body: JSON.stringify(body), headers }),
  putForm: async (path, formData) => await request(path, { method: 'PUT', body: formData }),
  patch: async (path, body, options) => await request(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: async (path) => await request(path, { method: 'DELETE' }),
};
