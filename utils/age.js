import { toISODate } from './date-field-format.js';

// Edad en años a partir de una fecha de nacimiento ('DD/MM/YYYY' o
// 'YYYY-MM-DD', mismo criterio que validateBirthDate/toISODate -- no
// reinventa el parseo). null si falta o es inválida.
export function calculateAge(birthDate, now = new Date()) {
  const iso = toISODate(birthDate);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  if (Number.isNaN(birth.getTime())) return null;

  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear = now.getMonth() > birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;

  return age;
}
