// Valida un DNI: requerido, 6-10 dígitos (permite puntos/guiones que se limpian).
// Devuelve null si es válido, o un mensaje de error.
export function validateDNI(value) {
  if (!value || !value.trim()) return 'El DNI es requerido.';
  const clean = value.trim().replace(/[.-]/g, '');
  if (!/^\d{6,10}$/.test(clean)) return 'El DNI debe tener entre 6 y 10 dígitos.';
  return null;
}
