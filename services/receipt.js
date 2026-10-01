import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Rama nativa: genera el PDF con expo-print y abre la hoja de compartir del
// sistema (guardar en archivos, mandarlo por mail, etc.). La rama web vive en
// receipt.web.js: en web expo-print ignora el HTML e imprime la ventana entera.
export async function shareReceiptPdf({ html, fileName }) {
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite compartir archivos.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
}
