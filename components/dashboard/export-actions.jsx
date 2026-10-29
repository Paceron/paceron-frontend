import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { notifyError, notifySuccess } from '../../utils/haptics.js';
import { resolveLogoDataUri } from '../../utils/attendance-qr-file.js';
import {
  dashboardExportFileName,
  toCsv,
} from '../../utils/dashboard-export.js';
import { buildDashboardPdfHtml } from '../../utils/dashboard-pdf.js';
// SIN extensión: con `.js` explícito Metro carga la rama nativa también en web
// (no falla, exporta por el camino equivocado). Ver docs de services/dashboard-csv.web.js.
import { saveDashboardCsv } from '../../services/dashboard-csv';
import { saveDashboardPdf } from '../../services/dashboard-pdf';

// Los dos botones de exportación del dashboard.
//
// El CSV se arma acá a partir de las series YA cargadas en memoria. La razón no
// es de rendimiento: en web la descarga tiene que dispararse en el mismo tick
// del `onPress` (un click emitido después de un `await` puede quedar bloqueado
// por el navegador), así que el caller prefetchea las series mientras la
// pantalla se ve y acá no hay ningún fetch.
//
// PDF no depende de las series: es el resumen del período (KPIs + la tabla de
// series si ya están cargadas), así que está disponible aunque no se haya
// elegido un ejercicio. La captura de la pantalla y el logo se resuelven al
// presionar (`onCapture`, `resolveLogoDataUri`) y son best-effort: si alguna
// falla, el documento sale igual sin esa pieza.
//
// A diferencia del resto de los "errores de acción" del repo —que muestran el
// mensaje del backend— acá el mensaje es nuestro: expo-print/expo-sharing y el
// navegador fallan por motivos locales, y el detalle crudo no le sirve a nadie.
export function ExportActions({
  id = 'dashboard-export',
  series = [],
  units = {},
  exerciseName = '',
  from = '',
  to = '',
  pdfModel = null,
  onCapture = null,
  preparing = false,
  seriesFailed = false,
  showCsv = true,
}) {
  const colors = useThemeColors();
  // Mientras se rasteriza la pantalla y se lee el logo (web puede tardar un
  // par de segundos) el botón queda deshabilitado: dos toques abrirían dos
  // diálogos de impresión / dos hojas de compartir.
  const [exportingPdf, setExportingPdf] = useState(false);

  const showError = (title, error) => {
    notifyError();
    Toast.show({
      type: 'error',
      text1: title,
      text2: error?.message ?? 'Volvé a intentarlo.',
    });
  };

  const exportCsv = () => {
    if (!exerciseName) {
      Toast.show({
        type: 'info',
        text1: 'Elegí un ejercicio',
        text2: 'El CSV es el detalle serie por serie: se exporta el ejercicio del catálogo seleccionado.',
      });
      return;
    }
    if (seriesFailed) {
      showError('No se pudieron cargar las series', null);
      return;
    }
    if (preparing) {
      Toast.show({ type: 'info', text1: 'Preparando los datos', text2: 'Las series todavía se están cargando.' });
      return;
    }

    const text = toCsv(series, { units });
    const fileName = dashboardExportFileName({ exerciseName, from, to, extension: 'csv' });

    // Sin `await` antes de esto: en web `saveDashboardCsv` hace el click de
    // descarga sincrónicamente. El try/catch es porque esa rama es sync: un
    // throw de `createObjectURL` (navegador sin soporte) no pasaría por el
    // `.catch` de la promesa.
    let exportResult;
    try {
      exportResult = saveDashboardCsv(text, fileName);
    } catch (error) {
      showError('No se pudo exportar el CSV', error);
      return;
    }

    Promise.resolve(exportResult)
      .then(() => {
        notifySuccess();
        Toast.show({ type: 'success', text1: 'CSV exportado' });
      })
      .catch((error) => showError('No se pudo exportar el CSV', error));
  };

  const exportPdf = async () => {
    if (!pdfModel) {
      Toast.show({ type: 'info', text1: 'Todavía no hay datos', text2: 'Esperá a que termine de cargar el período.' });
      return;
    }
    if (exportingPdf) return;
    setExportingPdf(true);

    // `generatedAt` se sella al presionar, no al renderizar ni al terminar de
    // capturar: una pantalla abierta hace una hora no debe decir que el
    // documento es de esa hora.
    const generatedAt = new Date().toLocaleString('es-AR');

    try {
      // Las dos piezas son OPCIONALES y se resuelven en paralelo. `resolveLogoDataUri`
      // ya devuelve `null` en vez de rechazar (el PDF cae al wordmark de texto);
      // la captura puede fallar de las dos formas (promesa rechazada o throw
      // síncrono, este último en web por `findNodeHandle`), así que va en su
      // propio `async` con try/catch y no como `.catch` de una promesa ya
      // invocada: `onCapture()` se evalúa antes y el throw se escaparía.
      const captureScreenshot = async () => {
        if (!onCapture) return null;
        try {
          return (await onCapture()) ?? null;
        } catch {
          return null;
        }
      };
      const [logoDataUri, capturedScreenshots] = await Promise.all([
        resolveLogoDataUri(),
        captureScreenshot(),
      ]);
      const screenshotDataUris = Array.isArray(capturedScreenshots)
        ? capturedScreenshots
        : capturedScreenshots ? [capturedScreenshots] : [];

      const html = buildDashboardPdfHtml({ ...pdfModel, generatedAt, logoDataUri, screenshotDataUris });
      const fileName = dashboardExportFileName({ exerciseName, from, to, extension: 'pdf' });

      await saveDashboardPdf(html, fileName);
      // En web es el diálogo de impresión (el usuario elige "Guardar como
      // PDF"); en nativo, la hoja de compartir con el archivo ya generado.
      notifySuccess();
      Toast.show({ type: 'success', text1: 'PDF listo' });
    } catch (error) {
      showError('No se pudo generar el PDF', error);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <View
      className="flex-row items-center gap-2"
      nativeID={`${id}-actions`}
      testID={`${id}-actions`}
    >
      {showCsv ? (
        <ExportButton
          disabled={!exerciseName || preparing || seriesFailed}
          icon="file-delimited-outline"
          id={`${id}-csv`}
          label="CSV"
          onPress={exportCsv}
          tint={colors.onSurfaceVariant}
        />
      ) : null}
      <ExportButton
        disabled={exportingPdf}
        icon="file-pdf-box"
        id={`${id}-pdf`}
        label="PDF"
        onPress={exportPdf}
        tint={colors.onSurfaceVariant}
      />
    </View>
  );
}

function ExportButton({ id, icon, label, onPress, tint, disabled = false }) {
  return (
    <Pressable
      accessibilityHint={label === 'CSV'
        ? 'Descarga una planilla con una fila por serie del ejercicio elegido.'
        : 'Genera un PDF con el resumen del período para imprimir o guardar.'}
      accessibilityLabel={`Exportar ${label}`}
      accessibilityRole="button"
      className={`h-8 flex-row items-center gap-1.5 rounded-full border border-slate-300 px-3 active:opacity-70 dark:border-slate-600 ${disabled ? 'opacity-50' : ''}`}
      nativeID={id}
      onPress={onPress}
      testID={id}
    >
      <MaterialCommunityIcons color={tint} name={icon} size={15} />
      <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${id}-label`} testID={`${id}-label`}>
        {label}
      </Text>
    </Pressable>
  );
}
