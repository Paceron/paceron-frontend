// Rama web del comprobante. expo-print en web ignora el HTML que se le pasa y
// llama a window.print() sobre la ventana actual (se imprimiría toda la app).
// Acá el comprobante se carga en un iframe oculto y se imprime solo ese
// documento: el diálogo del navegador ofrece "Guardar como PDF". No hace falta
// ninguna ventana emergente, así que no lo frena el bloqueador del navegador.
export async function shareReceiptPdf({ html }) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((resolve) => setTimeout(resolve, 50));
  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  // El diálogo de impresión bloquea hasta que se cierra; después se limpia.
  setTimeout(() => iframe.remove(), 1000);
}
