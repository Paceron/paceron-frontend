// Rama web de la exportación a CSV: descarga directa con un Blob. El texto ya
// trae el BOM UTF-8 (utils/comparison-csv.js), así que Excel respeta las tildes.
export async function shareCsv({ csv, fileName }) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
