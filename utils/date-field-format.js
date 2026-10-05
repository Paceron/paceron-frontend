// Hasta 2026-10-04, DateField (components/forms/fields.jsx) devolvía un
// formato de fecha distinto según plataforma: 'YYYY-MM-DD' en web (era un
// <input type="date"> nativo del navegador, que exige ISO en su `value`),
// 'DD/MM/YYYY' en mobile nativo. Esta función normaliza a ISO para los
// callers que lo necesitan (el backend del calendario — start_date del
// endpoint stamp — y utils/calendar-day-closed.js/build-stamp-draft.js).
// DateField ahora emite SIEMPRE 'DD/MM/YYYY' (ver formatDateInput más abajo)
// — la rama ISO queda como red de seguridad para cualquier otro origen que
// todavía la produzca, no porque DateField la genere.
export function toISODate(value) {
  if (!value) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return value;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return '';
}

// Formatea dígitos crudos en 'DD/MM/AAAA' a medida que se escriben, insertando
// las barras solas — mismo criterio que formatDurationInput (utils/time.js):
// el usuario nunca escribe '/', así que el cursor no salta.
//
// Reemplaza el <input type="date"> nativo del navegador en el campo de fecha
// web (DateField): ese control exige el VALOR en ISO por spec de HTML, pero
// el FORMATO VISUAL con el que lo muestra (y el orden día/mes del teclado al
// tipear) lo decide el navegador/SO según su configuración regional — no hay
// forma de forzarlo por CSS/HTML. En un navegador con locale en inglés
// (en-US), eso se ve como mm/dd/aaaa sin que nuestro código pueda evitarlo.
// Un input de texto enmascarado por nosotros no tiene ese problema: el
// formato es 100% nuestro, en cualquier navegador/SO, igual que ya se mostró
// correcto en mobile nativo (que arma su propia Pressable + Text, nunca
// delega el render del valor al picker del sistema).
export function formatDateInput(digits) {
  const d = String(digits ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
