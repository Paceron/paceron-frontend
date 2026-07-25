// Validacion de contrasenas alineada con NIST SP 800-63B (2017) y OWASP ASVS 4.0
// Requisitos minimos: 8 caracteres, mayuscula, minuscula, numero, caracter especial, no comun

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty', 'qwerty123', 'qwertyuiop', 'abc123', 'abc1234', 'letmein',
  'monkey', 'dragon', 'master', 'sunshine', 'princess', 'welcome',
  'shadow', 'superman', 'michael', 'football', 'baseball', 'iloveyou',
  'trustno1', 'hello123', 'pass123', 'admin', 'login', 'user',
  'test', 'guest', 'root', 'toor', 'pass', 'admin123', 'administrator',
  'paceron', 'paceron123', 'paceron2024', 'running', 'correr',
  'entrenador', 'entrenador123', 'runner123', 'sport123',
]);

export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_REQUIREMENTS = [
  {
    id: 'minLength',
    label: 'Al menos 8 caracteres',
    test: (p) => p.length >= 8,
  },
  {
    id: 'hasUppercase',
    label: 'Una letra mayúscula (A–Z)',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'hasLowercase',
    label: 'Una letra minúscula (a–z)',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'hasNumber',
    label: 'Un número (0–9)',
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: 'hasSpecial',
    label: 'Un carácter especial (!@#$%...)',
    test: (p) => /[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?`~]/.test(p),
  },
  {
    id: 'notCommon',
    label: 'No es una contraseña conocida',
    test: (p) => !COMMON_PASSWORDS.has(p.toLowerCase()),
  },
];

export function checkPasswordRequirements(password) {
  return Object.fromEntries(
    PASSWORD_REQUIREMENTS.map((req) => [req.id, req.test(password)])
  );
}

export function isPasswordValid(password) {
  if (!password || password.length > PASSWORD_MAX_LENGTH) return false;
  return PASSWORD_REQUIREMENTS.every((req) => req.test(password));
}

export function getPasswordStrengthScore(password) {
  if (!password) return 0;
  return PASSWORD_REQUIREMENTS.filter((req) => req.test(password)).length;
}

export function getPasswordStrengthMeta(score) {
  if (score <= 4) return { label: 'Débil', color: '#ef4444' };
  if (score === 5) return { label: 'Insuficiente', color: '#f97316' };
  return { label: 'Muy fuerte', color: '#16a34a' };
}
