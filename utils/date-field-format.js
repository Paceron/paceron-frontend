// DateField (components/forms/fields.jsx) devuelve un formato de fecha
// distinto según plataforma: 'YYYY-MM-DD' en web (input type="date"
// nativo del navegador), 'DD/MM/YYYY' en mobile nativo (mismo criterio
// que utils/date-validators.js#validateBirthDate, que ya acepta ambos).
// Esta función normaliza siempre a ISO, que es lo que espera el backend
// del calendario (start_date del endpoint stamp) y lo que usan las
// funciones de utils/calendar-day-closed.js y utils/build-stamp-draft.js.
export function toISODate(value) {
  if (!value) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return value;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return '';
}
