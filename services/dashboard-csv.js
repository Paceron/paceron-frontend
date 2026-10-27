// Entrega NATIVA del CSV del dashboard: se escribe el archivo en el cache de la
// app y se abre la hoja de compartir del sistema (guardar en Archivos, mandarlo
// por mail, etc.). La rama web vive en dashboard-csv.web.js.
//
// `expo-file-system@19` NO expone `writeAsStringAsync` en el export raíz: la API
// vieja quedó en `/legacy` y en la raíz hay un shim que solo avisa de la
// migración (`console.warn`). Acá va la API nueva, `new File(...).write(texto)`,
// que en SDK 54 es síncrona.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveDashboardCsv(text, fileName) {
  const name = String(fileName || 'dashboard.csv');
  const file = new File(Paths.cache, name);
  file.write(String(text ?? ''));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite compartir archivos.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    // UTI es lo que usa iOS para decidir con qué abrir el archivo.
    UTI: 'public.comma-separated-values-text',
    dialogTitle: name,
  });

  return { uri: file.uri };
}
