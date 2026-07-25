// Valida fecha de nacimiento. Acepta DD/MM/YYYY (input mobile) y YYYY-MM-DD (input date web).
// Devuelve null si es valida, o un mensaje de error.
export function validateBirthDate(value) {
  if (!value) return 'La fecha de nacimiento es requerida.';
  const trimmed = value.trim();

  let day, month, year;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else {
    return 'Formato inválido. Usá DD/MM/AAAA.';
  }

  if (month < 1 || month > 12) return 'El mes no es válido.';
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return 'El día no es válido para ese mes.';

  const date = new Date(year, month - 1, day);
  const now = new Date();
  if (date >= now) return 'La fecha debe ser en el pasado.';
  if (year < 1900) return 'Revisá el año ingresado.';

  return null;
}
