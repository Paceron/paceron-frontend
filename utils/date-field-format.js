import { computeTodayIso } from './calendar-today.js';

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

// El inverso de toISODate. La API del dashboard habla ISO (`DateLayoutISO` en
// paceron-backend, domains/dashboard/aggregate.go) y se siembra directo en un
// DateField: sin convertir, `date_range.min` muestra "01-09-2026" sobre un
// placeholder 'DD/MM/AAAA' y el picker nativo lee basura.
//
// NO sirve formatDisplayDate (utils/format-date-display.js): esa devuelve
// 'DD-MM-AAAA' con guiones y parseDDMMYYYY (components/forms/fields.jsx) no la
// parsea.
export function fromISODate(value) {
  if (!value) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (dmy) return value;
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
export function formatDateInput(value) {
  const raw = String(value ?? '');
  // Si el usuario escribe los separadores a mano, se respetan los componentes y
  // se completa el día/mes con un cero. Sin esto, "8/11/2026" se convertía en
  // "81/12/026" (el mask tomaba el 8 y el 1 como día de dos dígitos) y el filtro
  // de fechas quedaba con una fecha inválida: `toISODate` devolvía '' y no
  // filtraba nada (bug reportado 2026-11-13).
  let digits;
  if (raw.includes('/')) {
    const [day = '', month = '', year = ''] = raw.split('/');
    const dd = day.replace(/\D/g, '');
    const mm = month.replace(/\D/g, '');
    const yyyy = year.replace(/\D/g, '');
    digits = `${dd ? dd.padStart(2, '0') : ''}${mm ? mm.padStart(2, '0') : ''}${yyyy}`;
  } else {
    digits = raw.replace(/\D/g, '');
  }
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Parse estricto del valor mostrado por el datepicker. `toISODate` valida el
// formato del contrato, pero por sí solo acepta fechas imposibles como 31/02.
export function parseCalendarDate(value) {
  const iso = toISODate(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function formatCalendarDate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

// Valida antes de pedirle al backend un rango que ya se puede rechazar en UI.
// `to` es opcional para el dashboard global, pero obligatorio para A/B.
export function resolveDashboardDateRange({ from, to, requireTo = false, maxDays = 731, today = new Date(), disableFutureLimit = true } = {}) {
  const errors = { from: null, to: null };
  const fromDate = parseCalendarDate(from);
  const hasTo = to !== null && to !== undefined && to !== '';
  const toDate = hasTo ? parseCalendarDate(to) : null;

  if (!from) errors.from = 'Elegí una fecha desde.';
  else if (!fromDate) errors.from = 'Ingresá una fecha válida en DD/MM/AAAA.';
  if (hasTo && !toDate) errors.to = 'Ingresá una fecha válida en DD/MM/AAAA.';
  else if (!hasTo && requireTo) errors.to = 'Elegí una fecha hasta.';

  if (disableFutureLimit && today instanceof Date && Number.isFinite(today.getTime())) {
    const todayOrdinal = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000;
    if (fromDate && Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()) / 86_400_000 > todayOrdinal) {
      errors.from = 'No podés elegir una fecha futura.';
    }
    if (toDate && Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()) / 86_400_000 > todayOrdinal) {
      errors.to = 'No podés elegir una fecha futura.';
    }
  }

  if (fromDate && toDate) {
    const fromMs = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const toMs = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    const spanDays = Math.floor((toMs - fromMs) / 86_400_000);
    if (spanDays < 0) errors.to = 'La fecha hasta no puede ser anterior a la fecha desde.';
    else if (spanDays > maxDays) errors.to = 'El rango no puede superar los 2 años.';
  } else if (fromDate && !hasTo) {
    const fromMs = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const toMs = fromMs;
    if (Math.floor((toMs - fromMs) / 86_400_000) > maxDays) errors.to = 'El rango no puede superar los 2 años.';
  }

  const fromISO = fromDate ? toISODate(from) : '';
  const toISO = toDate ? toISODate(to) : '';
  return {
    valid: !errors.from && !errors.to,
    errors,
    fromISO,
    toISO,
  };
}

// Usa el rango real disponible cuando cabe en el límite del dashboard. Si el
// histórico es más largo, arranca en la ventana más reciente que acepta la API.
//
// `max` sale de `/dashboard/filters` tal cual lo manda el backend -- si
// llega a futuro (visto 2026-11-11, probable desfasaje UTC-vs-huso-local en
// el cálculo del backend), el "hasta" por defecto no puede quedar más
// adelante que el "hoy" de QUIEN USA la app: nadie corrió todavía una
// sesión de mañana. El clamp es puramente defensivo del lado del front —
// no corrige la causa real si es del backend, pero evita que el filtro
// arranque roto sea cual sea esa causa.
export function defaultDashboardDateRange(dateRange, maxDays = 731, today = new Date()) {
  const minISO = toISODate(dateRange?.min);
  const rawMaxISO = toISODate(dateRange?.max);
  const todayISO = computeTodayIso(today);
  const maxISO = rawMaxISO && rawMaxISO > todayISO ? todayISO : rawMaxISO;
  const minDate = parseCalendarDate(minISO);
  const maxDate = parseCalendarDate(maxISO);
  if (!minDate || !maxDate) return { from: '', to: '' };

  const minOrdinal = Date.UTC(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) / 86_400_000;
  const maxOrdinal = Date.UTC(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()) / 86_400_000;
  if (maxOrdinal < minOrdinal) return { from: '', to: '' };
  const startOrdinal = maxOrdinal - minOrdinal > maxDays ? maxOrdinal - maxDays : minOrdinal;
  const startISO = new Date(startOrdinal * 86_400_000).toISOString().slice(0, 10);
  return { from: fromISODate(startISO), to: fromISODate(maxISO) };
}
