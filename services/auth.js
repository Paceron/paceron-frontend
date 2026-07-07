import api from './api.js';

// Verifica si un email ya esta registrado en el sistema.
// Backend: GET /api/auth/check-email?email=<email>
export async function checkEmailExists(email) {
  const result = await api.get(`/auth/check-email?email=${encodeURIComponent(email)}`);
  return result?.exists ?? false;
}

// Verifica credenciales y retorna el usuario y token.
// Backend: POST /api/auth/login
export async function login(email, password) {
  return await api.post('/auth/login', { email, password });
}

// Solicita recuperacion de contrasena por email.
// Backend: POST /api/auth/forgot-password
export async function requestPasswordReset(email) {
  return await api.post('/auth/forgot-password', { email });
}

// Registra un nuevo usuario en el sistema.
// Backend: POST /api/auth/register
export async function register(userData) {
  return await api.post('/auth/register', userData);
}
