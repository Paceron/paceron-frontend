// No se importa utils/format-date-display.js a propósito: ese archivo trae
// react-native-calendars (para formatWeekdayLabel, que esta función no usa),
// y ese paquete publica ESM sin transformar -- Jest no puede parsear su
// `index.ts` ("Unexpected token 'export'"), rompiendo cualquier test que
// dependa de este archivo aunque sea transitivamente. Mismo transform
// (YYYY-MM-DD -> DD-MM-YYYY) inline, sin esa dependencia.
function toDisplayDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
}

// Pura y testeable a propósito (ver CLAUDE.md "Testing"): hooks/use-streaks.js
// solo compara el `current` anterior contra el nuevo y delega el armado del
// mensaje acá -- toda la lógica de negocio queda cubierta por Jest, nada
// vive sin test dentro del hook.
export function buildStreakBrokenMessage(previousCurrent, nextStreaks) {
  if (previousCurrent == null || previousCurrent <= 0) return null;
  if (nextStreaks.strict.current !== 0) return null;

  const lastFailedDay = [...nextStreaks.days].reverse().find((d) => d.strictStatus === 'failed');

  return {
    text1: 'Racha reiniciada',
    text2: lastFailedDay
      ? `Tu racha de entrenamientos consecutivos se reinició el ${toDisplayDate(lastFailedDay.date)}. ¡A por una nueva!`
      : 'Tu racha de entrenamientos consecutivos se reinició. ¡A por una nueva!',
  };
}
