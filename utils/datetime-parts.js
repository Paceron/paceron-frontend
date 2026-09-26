// Composición de fecha + hora para el editor de feedback de la pantalla de
// revisión. Puro a propósito (sin React ni Date nativo de plataforma) para que
// las reglas se puedan testear con Jest: la pantalla usa DateField (DD/MM/AAAA)
// y TimeField (HH:mm) por separado, y acá se juntan a un Date local.

const pad2 = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DDTHH:MM" (o ISO completo) → { date: 'DD/MM/AAAA', time: 'HH:mm' }.
// Es el path inverso de composeDateTime: precarga los dos campos separados
// desde lo que vino persistido. Un iso inválido o ausente → ambos vacíos.
export function splitDateTime(iso) {
  if (!iso) return { date: '', time: '' };
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' };
  return { date: formatDMY(parsed), time: formatHm(parsed) };
}

export function formatDMY(date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatHm(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// DD/MM/AAAA + HH:mm → Date en hora local. La hora es opcional: si viene
// vacía se asume 00:00 (elegir solo la fecha es un caso válido — el usuario
// puede no saber los minutos exactos). Devuelve null si la fecha no matchea el
// patrón o si la hora está fuera de rango, para que el caller muestre error
// en vez de guardar una fecha corrupta.
export function composeDateTime(dateText, timeText) {
  const dm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dateText ?? '').trim());
  if (!dm) return null;
  const day = Number(dm[1]);
  const month = Number(dm[2]);
  const year = Number(dm[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let hours = 0;
  let minutes = 0;
  const trimmedTime = String(timeText ?? '').trim();
  if (trimmedTime) {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(trimmedTime);
    if (!tm) return null;
    hours = Number(tm[1]);
    minutes = Number(tm[2]);
    if (hours > 23 || minutes > 59) return null;
  }

  const composed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(composed.getTime())) return null;
  return composed;
}

// Regla de auto-completado direccional del editor: cuando se toca el INICIO y
// el FIN está vacío, el FIN se copia del inicio. Tocar el FIN no hace nada
// (nunca pisa el inicio), y tocar el inicio con el fin ya cargado no hace nada
// (no pisa lo que el usuario eligió a mano).
//
// Devuelve el valor a espejar al fin, o null si no hay nada que hacer. Se
// separa del componente para poder testear la regla sin renderizar nada.
export function mirrorEndIfEmpty({ startChanged, nextStartValue, currentEndValue }) {
  if (!startChanged) return null;
  const endIsEmpty = currentEndValue == null || String(currentEndValue).trim() === '';
  if (!endIsEmpty) return null;
  return nextStartValue;
}

// Duración derivada de las fechas de inicio/fin. Se usa SOLO mientras el
// campo duración está vacío: si el usuario ya escribió un valor, ese manda
// (puede ser un tiempo corregido a mano que no coincide con lahora exacta).
//
// Requiere fecha Y hora en ambos extremos a propósito: composeDateTime
// asume 00:00 si falta la hora, y con solo fechas "24/09 → 25/09" daría 24h en
// vez de la duración real. Con la hora cargada, el cálculo es el correcto.
//
// Devuelve los milisegundos, o null si no corresponde calcular (campo con
// texto, falta una parte, o el fin no es posterior al inicio).
export function deriveDurationMs({ durationText, startedDate, startedTime, endedDate, endedTime }) {
  if (String(durationText ?? '').trim() !== '') return null;
  if (!String(startedTime ?? '').trim() || !String(endedTime ?? '').trim()) return null;
  const start = composeDateTime(startedDate, startedTime);
  const end = composeDateTime(endedDate, endedTime);
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (!(ms > 0)) return null;
  return ms;
}

