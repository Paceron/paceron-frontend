// Entrega WEB del CSV: `Blob` + `<a download>`.
//
// Todo el cuerpo es SÍNCRONO a propósito. Un click de descarga emitido después
// de un `await` puede quedar bloqueado por el navegador (se perdió la activación
// del usuario), así que el caller tiene que llegar acá con el texto ya armado —
// las series se prefetchean mientras la pantalla se ve, no al presionar. Por eso
// la función devuelve una promesa ya resuelta: el call site puede tratarla igual
// que la nativa sin que haya un tick de por medio.
//
// El `import` desde el call site va SIN extensión (`services/dashboard-csv`):
// con `.js` explícito Metro carga esta rama también en nativo.
export function saveDashboardCsv(text, fileName) {
  const name = String(fileName || 'dashboard.csv');
  const blob = new Blob([String(text ?? '')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  link.style.display = 'none';

  // El ancla tiene que estar en el documento para que el click dispare la
  // descarga en todos los navegadores.
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
  }

  // Revocar en el mismo tick cancela la descarga en algunos navegadores: el
  // objeto tiene que sobrevivir a que el navegador lo empiece a leer.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return Promise.resolve({ downloaded: true });
}
