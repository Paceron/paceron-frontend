import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockLogin, mockRegister } from './__mocks__/auth-mock.js';

// POST /api/v1/auth/login → { user, authorization }
export async function login(email, password) {
  if (USE_MOCKS) return await mockLogin(email, password);
  return await api.post('/auth/login', { email, password });
}

// POST /api/v1/auth/register → RegisterResponse (sin token). 409 si email duplicado.
export async function register(payload) {
  if (USE_MOCKS) return await mockRegister(payload);
  return await api.post('/auth/register', payload);
}
