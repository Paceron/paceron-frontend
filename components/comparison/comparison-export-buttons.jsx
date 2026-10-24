import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useThemeColors } from '../../theme/colors.js';
import { notifyError, notifySuccess } from '../../utils/haptics.js';
// Sin extensión a propósito: hay split .js / .web.js y Metro solo resuelve por
// plataforma cuando el specifier no la trae (quirk en CLAUDE.md).
import { shareReceiptPdf } from '../../services/receipt';
import { shareCsv } from '../../services/csv-export';

// Botones "CSV" y "PDF" de la comparación. Reciben funciones que arman el
// contenido recién al tocar (no se arma un PDF que nadie pidió). El PDF sale
// por el mismo camino que los comprobantes de pago (services/receipt).
export function ComparisonExportButtons({ buildCsv, buildPdfHtml, fileBaseName, disabled = false, idPrefix }) {
  const colors = useThemeColors();
  const [busy, setBusy] = useState(null); // 'csv' | 'pdf' | null

  const run = async (kind) => {
    if (busy || disabled) return;
    setBusy(kind);
    try {
      if (kind === 'csv') {
        await shareCsv({ csv: buildCsv(), fileName: `${fileBaseName}.csv` });
      } else {
        await shareReceiptPdf({ html: buildPdfHtml(), fileName: `${fileBaseName}.pdf` });
      }
      notifySuccess();
    } catch (error) {
      notifyError();
      Toast.show({ type: 'error', text1: kind === 'csv' ? 'No pudimos exportar el CSV' : 'No pudimos generar el PDF', text2: error?.message });
    } finally {
      setBusy(null);
    }
  };

  const button = (kind, icon, label) => (
    <Pressable
      accessibilityLabel={`Exportar a ${label}`}
      accessibilityState={{ disabled: disabled || Boolean(busy) }}
      className="h-10 flex-row items-center justify-center gap-1.5 rounded-full border border-slate-200 px-4 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
      disabled={disabled || Boolean(busy)}
      nativeID={`${idPrefix}-${kind}`}
      onPress={() => run(kind)}
      style={{ opacity: disabled ? 0.4 : 1 }}
      testID={`${idPrefix}-${kind}`}
    >
      {busy === kind ? <ActivityIndicator color={colors.primary} size="small" /> : <MaterialCommunityIcons color={colors.onSurfaceVariant} name={icon} size={18} />}
      <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${idPrefix}-${kind}-label`} testID={`${idPrefix}-${kind}-label`}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View className="flex-row flex-wrap items-center gap-2" nativeID={idPrefix} testID={idPrefix}>
      {button('csv', 'file-delimited-outline', 'CSV')}
      {button('pdf', 'file-pdf-box', 'PDF')}
    </View>
  );
}
