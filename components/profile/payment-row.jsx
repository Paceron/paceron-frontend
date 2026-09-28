import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatArs } from '../../utils/currency.js';
import { formatDMY } from '../../utils/datetime-parts.js';
import { paymentStatusMeta } from '../../utils/payment-status.js';
import { paymentMethodLabel, paymentTypeLabel } from '../../utils/payment-method.js';
import { canHaveReceipt, receiptConcept } from '../../utils/receipt-html.js';

const TONE_CLASSES = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// Tabular para que los importes de la tabla queden alineados.
const TABULAR = { fontVariant: ['tabular-nums'] };

function StatusBadge({ status, statusGroup, id }) {
  const meta = paymentStatusMeta(status, statusGroup);
  return (
    <Text className={`self-start overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[meta.tone]}`} nativeID={`${id}-status-badge`} testID={`${id}-status-badge`}>
      {meta.label}
    </Text>
  );
}

// Botón de comprobante. Solo los pagos aprobados tienen comprobante; el resto
// deja el lugar vacío para que las columnas no bailen.
function ReceiptButton({ payment, id, onReceipt, busy, compact = false }) {
  const colors = useThemeColors();
  if (!canHaveReceipt(payment) || !onReceipt) return null;
  return (
    <Pressable
      accessibilityLabel="Descargar comprobante en PDF"
      className="flex-row items-center gap-1 self-start rounded-full border border-slate-200 px-2.5 py-1 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
      disabled={busy}
      nativeID={`${id}-receipt-button`}
      onPress={() => onReceipt(payment)}
      testID={`${id}-receipt-button`}
    >
      {busy ? <ActivityIndicator color={colors.primary} size="small" /> : <MaterialCommunityIcons color={colors.onSurfaceVariant} name="file-pdf-box" size={16} />}
      <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200" nativeID={`${id}-receipt-button-label`} testID={`${id}-receipt-button-label`}>
        {compact ? 'PDF' : 'Comprobante'}
      </Text>
    </Pressable>
  );
}

// Columnas de la tabla en web ancha. Las usa también el encabezado de la lista.
export const RECEIVED_COLUMNS = [
  { key: 'date', label: 'Fecha', flex: 1.1 },
  { key: 'payer', label: 'Corredor', flex: 2 },
  { key: 'team', label: 'Equipo', flex: 1.8 },
  { key: 'status', label: 'Estado', flex: 1.3 },
  { key: 'gross', label: 'Bruto', flex: 1.2, align: 'right' },
  { key: 'net', label: 'Neto', flex: 1.2, align: 'right' },
];

export const HISTORY_COLUMNS = [
  { key: 'date', label: 'Fecha', flex: 1 },
  { key: 'type', label: 'Tipo', flex: 1.3 },
  { key: 'detail', label: 'Detalle', flex: 2.4 },
  { key: 'method', label: 'Método', flex: 1.5 },
  { key: 'status', label: 'Estado', flex: 1.1 },
  { key: 'amount', label: 'Monto', flex: 1.1, align: 'right' },
  { key: 'receipt', label: '', flex: 1.3, align: 'right' },
];

function Cell({ column, id, children }) {
  return (
    <View nativeID={`${id}-${column.key}`} style={{ flex: column.flex, alignItems: column.align === 'right' ? 'flex-end' : 'flex-start' }} testID={`${id}-${column.key}`}>
      {children}
    </View>
  );
}

function CellText({ id, children, strong = false, muted = false }) {
  const tone = muted ? 'text-slate-400 dark:text-slate-500' : strong ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200';
  return (
    <Text className={`text-sm ${tone}`} nativeID={id} numberOfLines={1} style={TABULAR} testID={id}>
      {children}
    </Text>
  );
}

function WideRow({ id, columns, content }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800" nativeID={id} testID={id}>
      {columns.map((column) => (
        <Cell key={column.key} column={column} id={id}>{content[column.key]}</Cell>
      ))}
    </View>
  );
}

function ReceivedRow({ payment, isWide, id, date }) {
  if (isWide) {
    return (
      <WideRow
        columns={RECEIVED_COLUMNS}
        content={{
          date: <CellText id={`${id}-date-text`}>{date}</CellText>,
          payer: <CellText id={`${id}-payer-text`} strong>{payment.payer?.fullName || 'Corredor'}</CellText>,
          team: <CellText id={`${id}-team-text`}>{payment.team?.name || 'Equipo eliminado'}</CellText>,
          status: <StatusBadge id={id} status={payment.status} statusGroup={payment.statusGroup} />,
          gross: <CellText id={`${id}-gross-text`} strong>{formatArs(payment.grossAmount)}</CellText>,
          net: payment.netAmount === null
            ? <CellText id={`${id}-net-text`} muted>—</CellText>
            : <CellText id={`${id}-net-text`}>{formatArs(payment.netAmount, { decimals: 2 })}</CellText>,
        }}
        id={id}
      />
    );
  }
  return (
    <View className="gap-1.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800" nativeID={id} testID={id}>
      <View className="flex-row items-baseline justify-between gap-3" nativeID={`${id}-top`} testID={`${id}-top`}>
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-title`} numberOfLines={1} testID={`${id}-title`}>{payment.payer?.fullName || 'Corredor'}</Text>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-amount`} style={TABULAR} testID={`${id}-amount`}>{formatArs(payment.grossAmount)}</Text>
      </View>
      <View className="flex-row items-center justify-between gap-3" nativeID={`${id}-bottom`} testID={`${id}-bottom`}>
        <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-subtitle`} numberOfLines={1} testID={`${id}-subtitle`}>{`${payment.team?.name || 'Equipo eliminado'} · ${date}`}</Text>
        <StatusBadge id={id} status={payment.status} statusGroup={payment.statusGroup} />
      </View>
      {payment.netAmount !== null ? (
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-net`} style={TABULAR} testID={`${id}-net`}>
          {`Neto ${formatArs(payment.netAmount, { decimals: 2 })}`}
        </Text>
      ) : null}
    </View>
  );
}

function HistoryRow({ payment, isWide, id, date, onReceipt, busy }) {
  const detail = receiptConcept(payment);
  const method = paymentMethodLabel(payment.paymentMethodId);
  if (isWide) {
    return (
      <WideRow
        columns={HISTORY_COLUMNS}
        content={{
          date: <CellText id={`${id}-date-text`}>{date}</CellText>,
          type: <CellText id={`${id}-type-text`}>{paymentTypeLabel(payment.type)}</CellText>,
          detail: <CellText id={`${id}-detail-text`} strong>{detail}</CellText>,
          method: <CellText id={`${id}-method-text`}>{method}</CellText>,
          status: <StatusBadge id={id} status={payment.status} statusGroup={payment.statusGroup} />,
          amount: <CellText id={`${id}-amount-text`} strong>{formatArs(payment.amount)}</CellText>,
          receipt: <ReceiptButton busy={busy} id={id} onReceipt={onReceipt} payment={payment} />,
        }}
        id={id}
      />
    );
  }
  return (
    <View className="gap-1.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800" nativeID={id} testID={id}>
      <View className="flex-row items-baseline justify-between gap-3" nativeID={`${id}-top`} testID={`${id}-top`}>
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-title`} numberOfLines={2} testID={`${id}-title`}>{detail}</Text>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-amount`} style={TABULAR} testID={`${id}-amount`}>{formatArs(payment.amount)}</Text>
      </View>
      <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-subtitle`} numberOfLines={1} testID={`${id}-subtitle`}>
        {`${paymentTypeLabel(payment.type)} · ${method} · ${date}`}
      </Text>
      <View className="flex-row items-center justify-between gap-3" nativeID={`${id}-bottom`} testID={`${id}-bottom`}>
        <StatusBadge id={id} status={payment.status} statusGroup={payment.statusGroup} />
        <ReceiptButton busy={busy} compact id={id} onReceipt={onReceipt} payment={payment} />
      </View>
    </View>
  );
}

export function PaymentRow({ variant, payment, isWide, onReceipt, receiptBusy }) {
  const id = `payment-row-${payment.id}`;
  const date = formatDMY(new Date(payment.createdAt));
  if (variant === 'received') return <ReceivedRow date={date} id={id} isWide={isWide} payment={payment} />;
  return <HistoryRow busy={receiptBusy} date={date} id={id} isWide={isWide} onReceipt={onReceipt} payment={payment} />;
}
