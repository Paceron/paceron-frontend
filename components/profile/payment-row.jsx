import { Text, View } from 'react-native';
import { formatARS } from '../../utils/currency.js';
import { formatDMY } from '../../utils/datetime-parts.js';
import { paymentStatusMeta } from '../../utils/payment-status.js';

const TONE_CLASSES = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// Mismo formato que el resto de los montos: tabular para que los importes de
// la tabla queden alineados.
const TABULAR = { fontVariant: ['tabular-nums'] };

function StatusBadge({ status, statusGroup, id }) {
  const meta = paymentStatusMeta(status, statusGroup);
  return (
    <Text className={`self-start overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[meta.tone]}`} nativeID={`${id}-status`} testID={`${id}-status`}>
      {meta.label}
    </Text>
  );
}

function formatTierName(name) {
  return (name ?? '').replace(/_(corredor|entrenador)$/i, '') || 'Suscripción';
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

export const MINE_COLUMNS = [
  { key: 'date', label: 'Fecha', flex: 1.1 },
  { key: 'tier', label: 'Plan', flex: 2 },
  { key: 'installment', label: 'Cuota', flex: 1.2 },
  { key: 'status', label: 'Estado', flex: 1.3 },
  { key: 'amount', label: 'Monto', flex: 1.2, align: 'right' },
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

export function PaymentRow({ variant, payment, isWide }) {
  const id = `payment-row-${payment.id}`;
  const date = formatDMY(new Date(payment.createdAt));
  const isReceived = variant === 'received';

  if (isWide) {
    const columns = isReceived ? RECEIVED_COLUMNS : MINE_COLUMNS;
    const content = {
      date: <CellText id={`${id}-date-text`}>{date}</CellText>,
      payer: <CellText id={`${id}-payer-text`} strong>{payment.payer?.fullName || 'Corredor'}</CellText>,
      team: <CellText id={`${id}-team-text`}>{payment.team?.name || 'Equipo eliminado'}</CellText>,
      status: <StatusBadge id={id} status={payment.status} statusGroup={payment.statusGroup} />,
      gross: <CellText id={`${id}-gross-text`} strong>{formatARS(payment.grossAmount)}</CellText>,
      net: payment.netAmount === null
        ? <CellText id={`${id}-net-text`} muted>—</CellText>
        : <CellText id={`${id}-net-text`}>{formatARS(payment.netAmount, { decimals: 2 })}</CellText>,
      tier: <CellText id={`${id}-tier-text`} strong>{formatTierName(payment.tier?.name)}</CellText>,
      installment: <CellText id={`${id}-installment-text`}>{`Cuota #${payment.installmentNumber}`}</CellText>,
      amount: <CellText id={`${id}-amount-text`} strong>{formatARS(payment.amount)}</CellText>,
    };
    return (
      <View className="flex-row items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800" nativeID={id} testID={id}>
        {columns.map((column) => (
          <Cell key={column.key} column={column} id={id}>{content[column.key]}</Cell>
        ))}
      </View>
    );
  }

  const title = isReceived ? payment.payer?.fullName || 'Corredor' : formatTierName(payment.tier?.name);
  const subtitle = isReceived ? `${payment.team?.name || 'Equipo eliminado'} · ${date}` : `Cuota #${payment.installmentNumber} · ${date}`;
  const amount = isReceived ? payment.grossAmount : payment.amount;

  return (
    <View className="gap-1.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800" nativeID={id} testID={id}>
      <View className="flex-row items-baseline justify-between gap-3" nativeID={`${id}-top`} testID={`${id}-top`}>
        <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-title`} numberOfLines={1} testID={`${id}-title`}>{title}</Text>
        <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-amount`} style={TABULAR} testID={`${id}-amount`}>{formatARS(amount)}</Text>
      </View>
      <View className="flex-row items-center justify-between gap-3" nativeID={`${id}-bottom`} testID={`${id}-bottom`}>
        <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-subtitle`} numberOfLines={1} testID={`${id}-subtitle`}>{subtitle}</Text>
        <StatusBadge id={id} status={payment.status} statusGroup={payment.statusGroup} />
      </View>
      {isReceived && payment.netAmount !== null ? (
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-net`} style={TABULAR} testID={`${id}-net`}>
          {`Neto ${formatARS(payment.netAmount, { decimals: 2 })}`}
        </Text>
      ) : null}
    </View>
  );
}
