export function pad2(value) {
  return String(Math.floor(value)).padStart(2, '0');
}

// MM:SS:CC — minutos, segundos y centésimas (el tick del cronómetro corre a
// ~50 ms; las centésimas son la resolución que el display puede sostener sin
// quemar frames).
export function formatStopwatch(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${pad2(minutes)}:${pad2(seconds)}:${pad2(hundredths)}`;
}

// ISO 8601 UTC de un Date (o de ahora). Sirve para started_at/ended_at.
export function toIsoUtc(date = new Date()) {
  return date.toISOString();
}

// "MM:SS" o "HH:MM:SS" → milisegundos. Devuelve null si el texto no es un
// reloj válido (solo dígitos, separadores ":", horas opcionales). Sirve para
// la edición manual de tiempos en la pantalla de revisión (correr en vivo usa
// centésimas, el editor manual pide minutos:segundos que son más fáciles de
// tipear).
export function parseClockToMs(text) {
  const clean = String(text ?? '').trim();
  if (!clean) return null;
  const parts = clean.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) {
    return Math.floor(parts[0] * 60000 + parts[1] * 1000);
  }
  if (parts.length === 3) {
    return Math.floor(parts[0] * 3600000 + parts[1] * 60000 + parts[2] * 1000);
  }
  return null;
}

// Dígitos → duración formateada con los ':' puestos solos, para el input de
// duración del formulario de revisión. El usuario tipea solo números: "330" →
// "3:30", "0330" → "03:30", "13045" → "1:30:45". Se reformatea desde los
// dígitos cada tecla, así el cursor nunca salta. Distinto de formatClock (que
// formatea un número ya conocido) y de TimeField (que es una hora de reloj).
export function formatDurationInput(digits) {
  const d = String(digits ?? '').replace(/\D/g, '').slice(0, 6);
  if (d.length === 0) return '';
  if (d.length <= 2) return d;
  if (d.length === 3) return `${d[0]}:${d.slice(1)}`;
  if (d.length === 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  if (d.length === 5) return `${d[0]}:${d.slice(1, 3)}:${d.slice(3)}`;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4)}`;
}

// Milisegundos → "MM:SS" (o "H:MM:SS" si pasan 59 minutos) para precargar el
// campo de edición manual. Es formatoStopwatch sin las centésimas — el editor
// no edita sub-segundos (se conservan del valor persistido, no reescritos).
export function formatClock(ms) {
  const safeMs = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}