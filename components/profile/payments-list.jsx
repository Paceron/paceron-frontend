import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/colors.js';
import { SkeletonBlock } from '../shared/skeleton.jsx';
import { InfoHint } from '../dashboard/info-hint.jsx';
import { HISTORY_COLUMNS, PaymentRow, RECEIVED_COLUMNS, RECEIVED_COLUMNS_NARROW } from './payment-row.jsx';

const EMPTY_TEXT = {
  received: 'No hay cobros para mostrar con estos filtros.',
  history: 'Todavía no hay pagos para mostrar.',
};

// Lista paginada de pagos. En web ancha es una tabla con encabezado. En web
// angosta y nativo, Pagos usa una fila de dos líneas por pago y Cobros sigue
// siendo tabla, con menos columnas (ver RECEIVED_COLUMNS_NARROW).
export function PaymentsList({ variant, items, hasMore, loadMore, loading, loadingMore, failed, onRetry, isWide, onReceipt, receiptBusyId }) {
  const colors = useThemeColors();
  const scope = `payments-list-${variant}`;

  if (loading) {
    return (
      <View className="gap-2" nativeID={`${scope}-loading`} testID={`${scope}-loading`}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} height={56} nativeID={`${scope}-skeleton-${i}`} rounded="rounded-xl" testID={`${scope}-skeleton-${i}`} />
        ))}
      </View>
    );
  }

  if (failed) {
    return (
      <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 dark:bg-rose-900/20" nativeID={`${scope}-error`} testID={`${scope}-error`}>
        <Text className="flex-1 text-sm text-rose-700 dark:text-rose-300" nativeID={`${scope}-error-text`} testID={`${scope}-error-text`}>
          No pudimos cargar la lista.
        </Text>
        <Pressable className="rounded-full bg-rose-100 px-3 py-1.5 hover:opacity-90 active:opacity-80 dark:bg-rose-900/40" nativeID={`${scope}-retry`} onPress={onRetry} testID={`${scope}-retry`}>
          <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300" nativeID={`${scope}-retry-label`} testID={`${scope}-retry-label`}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!items.length) {
    return (
      <Text className="py-4 text-sm text-slate-500 dark:text-slate-400" nativeID={`${scope}-empty`} testID={`${scope}-empty`}>
        {EMPTY_TEXT[variant]}
      </Text>
    );
  }

  const received = variant === 'received';
  const columns = received ? (isWide ? RECEIVED_COLUMNS : RECEIVED_COLUMNS_NARROW) : HISTORY_COLUMNS;
  const showHeader = isWide || received;
  const compact = !isWide;

  return (
    <View nativeID={scope} testID={scope}>
      <View className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-surface-2" nativeID={`${scope}-card`} testID={`${scope}-card`}>
        {showHeader ? (
          <View className={`flex-row border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 ${compact ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-2.5'}`} nativeID={`${scope}-header`} testID={`${scope}-header`}>
            {columns.map((column) => (
              <View key={column.key} className={`flex-row items-center gap-1 ${column.align === 'right' ? 'justify-end' : 'justify-start'}`} nativeID={`${scope}-header-${column.key}`} style={{ flex: column.flex }} testID={`${scope}-header-${column.key}`}>
                <Text className={`font-semibold uppercase text-slate-500 dark:text-slate-400 ${compact ? 'text-[10px]' : 'text-[11px] tracking-wide'}`} nativeID={`${scope}-header-${column.key}-label`} testID={`${scope}-header-${column.key}-label`}>
                  {column.label}
                </Text>
                {column.hint ? (
                  <InfoHint description={column.hint.description} id={`${scope}-header-${column.key}-hint`} openOnPress title={column.hint.title} />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {items.map((payment) => (
          <PaymentRow key={payment.id} isWide={isWide} onReceipt={onReceipt} payment={payment} receiptBusy={receiptBusyId === payment.id} variant={variant} />
        ))}
      </View>

      {hasMore ? (
        <Pressable
          className="mt-3 h-10 flex-row items-center justify-center gap-2 self-center rounded-full border border-slate-200 px-5 hover:bg-slate-100 active:opacity-80 dark:border-slate-700 dark:hover:bg-slate-800"
          disabled={loadingMore}
          nativeID={`${scope}-load-more`}
          onPress={loadMore}
          testID={`${scope}-load-more`}
        >
          {loadingMore ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID={`${scope}-load-more-label`} testID={`${scope}-load-more-label`}>
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
