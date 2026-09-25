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