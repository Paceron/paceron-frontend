import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Rama nativa de la exportación a CSV: escribe el texto en el cache de la app
// y abre la hoja de compartir del sistema (guardar en archivos, mandar por mail,
// etc.). La rama web vive en csv-export.web.js (descarga con un Blob). Se
// importa SIN extensión para que Metro elija la variante por plataforma.
// expo-file-system@19: la API es la de clases (`File`, `Paths`), no
// readAsStringAsync/writeAsStringAsync (ver Quirks en CLAUDE.md).
export async function shareCsv({ csv, fileName }) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite compartir archivos.');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: fileName });
}
