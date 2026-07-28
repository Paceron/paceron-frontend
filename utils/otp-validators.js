export function validateOtpCode(code) {
  if (!code) return 'El código es requerido.';
  if (!/^\d{6}$/.test(code)) return 'El código debe tener 6 dígitos.';
  return null;
}
