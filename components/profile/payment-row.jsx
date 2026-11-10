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
// Cobros es una tabla en todos los anchos: en angosto (web de celular y nativo)
// el equipo baja como segunda línea del corredor para que entren las columnas
// sin scroll horizontal, y el estado mantiene su columna (se filtra por él).
// "Monto" es el NETO, lo que le queda al entrenador; el header lleva un "i" que
// explica la cuenta (`hint`).
const RECEIVED_AMOUNT_COLUMN = {
  key: 'amount',
  label: 'Monto',
  align: 'right',
  hint: {
    title: 'Monto neto',
    description: 'Corresponde a lo que recibís por cada cuota: el importe abonado por el corredor (monto bruto) menos la comisión de Paceron, calculada como un porcentaje del monto bruto.\n\nMonto neto = monto bruto − comisión de Paceron.\n\nEste monto no contempla impuestos, retenciones ni comisiones de procesamiento de pagos que puedan aplicarse posteriormente.',
  },
};

export const RECEIVED_COLUMNS = [
  { key: 'date', label: 'Fecha', flex: 1.1 },
  { key: 'payer', label: 'Corredor', flex: 2 },
  { key: 'team', label: 'Equipo', flex: 1.8 },
  { key: 'status', label: 'Estado', flex: 1.3 },
  { ...RECEIVED_AMOUNT_COLUMN, flex: 1.3 },
];

export const RECEIVED_COLUMNS_NARROW = [
  { key: 'date', label: 'Fecha', flex: 1.15 },
  { key: 'payer', label: 'Corredor', flex: 1.7 },
  { key: 'status', label: 'Estado', flex: 1.35 },
  { ...RECEIVED_AMOUNT_COLUMN, flex: 1.4 },
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

// Pagos en angosto: también tabla. Tipo y método bajan como segunda línea del
// detalle, y el botón del comprobante va debajo del monto.
export const HISTORY_COLUMNS_NARROW = [
  { key: 'date', label: 'Fecha', flex: 1.15 },
  { key: 'detail', label: 'Detalle', flex: 1.9 },
  { key: 'status', label: 'Estado', flex: 1.3 },
  { key: 'amount', label: 'Monto', flex: 1.3, align: 'right' },
];

function Cell({ column, id, children }) {
  return (
    <View nativeID={`${id}-${column.key}`} style={{ flex: column.flex, alignItems: column.align === 'right' ? 'flex-end' : 'flex-start' }} testID={`${id}-${column.key}`}>
      {children}
    </View>
  );
}

function CellText({ id, children, strong = false, muted = false, compact = false, lines = 1 }) {
  const tone = muted ? 'text-slate-400 dark:text-slate-500' : strong ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200';
  return (
    <Text className={`${compact ? 'text-xs' : 'text-sm'} ${tone}`} nativeID={id} numberOfLines={lines} style={TABULAR} testID={id}>
      {children}
    </Text>
  );
}

function WideRow({ id, columns, content, compact = false }) {
  return (
    <View className={`flex-row items-center border-b border-slate-100 dark:border-slate-800 ${compact ? 'gap-2 px-3 py-2.5' : 'gap-3 px-4 py-3'}`} nativeID={id} testID={id}>
      {columns.map((column) => (
        <Cell key={column.key} column={column} id={id}>{content[column.key]}</Cell>
      ))}
    </View>
  );
}

// El neto lo calcula el backend; si no vino, "—" y no un monto inventado.
function NetAmount({ payment, id, compact = false }) {
  if (payment.netAmount === null) return <CellText compact={compact} id={`${id}-amount-text`} muted>—</CellText>;
  return <CellText compact={compact} id={`${id}-amount-text`} strong>{formatArs(payment.netAmount, { decimals: 2 })}</CellText>;
}

function ReceivedRow({ payment, isWide, id, date }) {
  const payer = payment.payer?.fullName || 'Corredor';
  const team = payment.team?.name || 'Equipo eliminado';
  const status = <StatusBadge id={id} status={payment.status} statusGroup={payment.statusGroup} />;
  if (isWide) {
    return (
      <WideRow
        columns={RECEIVED_COLUMNS}
        content={{
          date: <CellText id={`${id}-date-text`}>{date}</CellText>,
          payer: <CellText id={`${id}-payer-text`} strong>{payer}</CellText>,
          team: <CellText id={`${id}-team-text`}>{team}</CellText>,
          status,
          amount: <NetAmount id={id} payment={payment} />,
        }}
        id={id}
      />
    );
  }
  return (
    <WideRow
      columns={RECEIVED_COLUMNS_NARROW}
      compact
      content={{
        date: <CellText compact id={`${id}-date-text`}>{date}</CellText>,
        payer: (
          <View className="w-full" nativeID={`${id}-payer`} testID={`${id}-payer`}>
            <CellText compact id={`${id}-payer-text`} strong>{payer}</CellText>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-team-text`} numberOfLines={1} testID={`${id}-team-text`}>{team}</Text>
          </View>
        ),
        status,
        amount: <NetAmount compact id={id} payment={payment} />,
      }}
      id={id}
    />
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
          detail: <CellText id={`${id}-detail-text`} lines={2} strong>{detail}</CellText>,
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
    <WideRow
      columns={HISTORY_COLUMNS_NARROW}
      compact
      content={{
        date: <CellText compact id={`${id}-date-text`}>{date}</CellText>,
        detail: (
          <View className="w-full" nativeID={`${id}-detail`} testID={`${id}-detail`}>
            <CellText compact id={`${id}-detail-text`} lines={4} strong>{detail}</CellText>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400" nativeID={`${id}-subtitle`} numberOfLines={2} testID={`${id}-subtitle`}>
              {`${paymentTypeLabel(payment.type)} · ${method}`}
            </Text>
          </View>
        ),
        status: <StatusBadge id={id} status={payment.status} statusGroup={payment.statusGroup} />,
        amount: (
          <View className="items-end gap-1.5" nativeID={`${id}-amount`} testID={`${id}-amount`}>
            <CellText compact id={`${id}-amount-text`} strong>{formatArs(payment.amount)}</CellText>
            <ReceiptButton busy={busy} compact id={id} onReceipt={onReceipt} payment={payment} />
          </View>
        ),
      }}
      id={id}
    />
  );
}

export function PaymentRow({ variant, payment, isWide, onReceipt, receiptBusy }) {
  const id = `payment-row-${payment.id}`;
  const date = formatDMY(new Date(payment.createdAt));
  if (variant === 'received') return <ReceivedRow date={date} id={id} isWide={isWide} payment={payment} />;
  return <HistoryRow busy={receiptBusy} date={date} id={id} isWide={isWide} onReceipt={onReceipt} payment={payment} />;
}
