import { Text, View } from 'react-native';
import { formatArs } from '../../utils/currency.js';
import { formatDueDate } from '../../utils/payments-summary.js';
import { SectionCard } from '../forms/section-card.jsx';

const TABULAR = { fontVariant: ['tabular-nums'] };

// "Por cobrar este mes": las cuotas esperadas sin pagar, en dos columnas. "A
// vencer" va desde hoy hasta fin de mes; "Vencidos" es todo lo que ya venció sin
// pagar, también de meses anteriores (una cuota de octubre sin pagar se sigue
// debiendo en noviembre). Vencido es pasar el vencimiento, sin días de gracia.
// Lo calcula el backend (change cobros-pendientes-y-vencimientos): las cuotas
// de meses no pagados no existen como filas. `amountMode` elige bruto o neto
// del total; cada cuota se muestra por su monto.
export function PaymentsDueCard({ dueThisMonth, overdue, amountMode = 'gross', isWide }) {
  if (!dueThisMonth?.count && !overdue?.count) return null;
  return (
    <SectionCard icon="calendar-clock" scope="payments-due-card" title="Por cobrar este mes">
      <View className={isWide ? 'flex-row gap-6' : 'gap-5'} nativeID="payments-due-card-columns" testID="payments-due-card-columns">
        <DueColumn amountMode={amountMode} block={overdue} empty="No hay cuotas vencidas." id="payments-due-card-overdue" title="Vencidos" tone="overdue" />
        <DueColumn amountMode={amountMode} block={dueThisMonth} empty="No hay cuotas por vencer este mes." id="payments-due-card-upcoming" title="A vencer" tone="upcoming" />
      </View>
    </SectionCard>
  );
}

function DueColumn({ block, title, tone, empty, amountMode, id }) {
  const total = amountMode === 'net' ? block?.netAmount : block?.amount;
  const overdue = tone === 'overdue';
  return (
    <View className="flex-1" nativeID={id} testID={id}>
      <View className="mb-2 flex-row items-baseline justify-between gap-3" nativeID={`${id}-header`} testID={`${id}-header`}>
        <Text className={`text-sm font-semibold ${overdue ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`} nativeID={`${id}-title`} testID={`${id}-title`}>
          {title}
          {block?.count ? ` · ${block.count} ${block.count === 1 ? 'cuota' : 'cuotas'}` : ''}
        </Text>
        <Text className="text-base font-semibold text-slate-900 dark:text-white" nativeID={`${id}-total`} style={TABULAR} testID={`${id}-total`}>
          {formatArs(total ?? 0)}
        </Text>
      </View>
      {!block?.items?.length ? (
        <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-empty`} testID={`${id}-empty`}>{empty}</Text>
      ) : (
        <View className="gap-2" nativeID={`${id}-items`} testID={`${id}-items`}>
          {block.items.map((item) => (
            <View
              className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"
              key={item.key}
              nativeID={`${id}-item-${item.key}`}
              testID={`${id}-item-${item.key}`}
            >
              <View className="flex-1" nativeID={`${id}-item-${item.key}-main`} testID={`${id}-item-${item.key}-main`}>
                <Text className="text-sm font-medium text-slate-800 dark:text-slate-100" nativeID={`${id}-item-${item.key}-payer`} numberOfLines={1} testID={`${id}-item-${item.key}-payer`}>
                  {item.payerName || 'Corredor'}
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-item-${item.key}-meta`} numberOfLines={1} testID={`${id}-item-${item.key}-meta`}>
                  {`${item.teamName || 'Equipo'} · cuota ${item.installmentNumber}`}
                </Text>
              </View>
              <View className="items-end" nativeID={`${id}-item-${item.key}-side`} testID={`${id}-item-${item.key}-side`}>
                <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-item-${item.key}-amount`} style={TABULAR} testID={`${id}-item-${item.key}-amount`}>
                  {formatArs(item.amount)}
                </Text>
                <Text className={`text-xs ${overdue ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`} nativeID={`${id}-item-${item.key}-due`} testID={`${id}-item-${item.key}-due`}>
                  {`${overdue ? 'venció' : 'vence'} ${formatDueDate(item.dueDate)}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
