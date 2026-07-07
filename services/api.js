import { API_BASE_URL } from '../config/env.js';
import { useAuthStore } from '../store/auth-store.js';

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

async function request(path, options = {}) {
  const { token } = useAuthStore.getState();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    headers,
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export default {
  get: async (path) => await request(path, { method: 'GET' }),
  post: async (path, body) => await request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: async (path, body) => await request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: async (path, body) => await request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: async (path) => await request(path, { method: 'DELETE' }),
};
