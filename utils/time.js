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