import api from './api.js';
import { USE_MOCKS } from '../config/env.js';
import { mockForgotPassword, mockResetPassword } from './__mocks__/password-mock.js';

// POST /api/v1/auth/forgot-password — siempre responde el mismo mensaje
// genérico (no revela si el email existe). Envía un código OTP de 6 dígitos
// por mail si el email pertenece a un usuario activo.
export async function forgotPassword(email) {
  if (USE_MOCKS) return await mockForgotPassword(email);
  return await api.post('/auth/forgot-password', { email });
}

// POST /api/v1/auth/reset-password — el código vence a los 10 minutos.
export async function resetPassword({ email, code, newPassword, confirmPassword }) {
  if (USE_MOCKS) return await mockResetPassword({ email, code, newPassword, confirmPassword });
  return await api.post('/auth/reset-password', {
    email,
    code,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}
