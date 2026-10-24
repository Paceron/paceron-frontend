// Entrega NATIVA del PDF del dashboard: `expo-print` renderiza el HTML a un
// archivo en el cache y `expo-sharing` lo ofrece (guardar en Archivos, mail,
// etc.). La rama web vive en dashboard-pdf.web.js: ahí `expo-print` imprime la
// app entera, no el documento.
//
// Mismo patrón que services/receipt.js a propósito: es el stack que la app ya
// usa para generar un PDF en el cliente.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function saveDashboardPdf(html, fileName) {
  const name = String(fileName || 'dashboard.pdf');
  const htmlText = String(html ?? '').trim();
  if (!htmlText) throw new Error('No hay documento para imprimir');

  const { uri } = await Print.printToFileAsync({ html: htmlText });
  if (!uri) {
    // Resolvió sin error pero sin archivo: fallar acá es mejor que devolver
    // éxito sobre un documento que no existe.
    throw new Error('expo-print no devolvió el archivo del documento');
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite compartir archivos.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: name,
  });

  return { uri };
}
