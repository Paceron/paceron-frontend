import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors } from '../../theme/colors.js';
import { formatArs } from '../../utils/currency.js';
import { formatDueDate, overdueLabel } from '../../utils/payments-summary.js';
import { formatTierName } from '../../utils/tier-name.js';
import { dueCardVariant, dueTone } from '../../utils/payment-due.js';
import { SectionCard } from '../forms/section-card.jsx';
import { SkeletonBlock } from '../shared/skeleton.jsx';

const TABULAR = { fontVariant: ['tabular-nums'] };

// Vencida en rojo, por vencer en ámbar, el resto neutro.
const ROW_TONE = {
  overdue: {
    box: 'border-rose-200 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/5',
    due: 'font-semibold text-rose-700 dark:text-rose-300',
    icon: '#e11d48',
  },
  soon: {
    box: 'border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/5',
    due: 'font-semibold text-amber-700 dark:text-amber-400',
    icon: '#d97706',
  },
  normal: {
    box: 'border-slate-100 dark:border-slate-800',
    due: 'text-slate-500 dark:text-slate-400',
    icon: null,
  },
};

// "Próximos vencimientos" de la pestaña Pagos, para cualquier rol: la próxima
// cuota sin pagar de cada equipo que paga el usuario y de cada tier (GET
// /payments/upcoming, ordenadas por vencimiento). Sin nada que pagar, la
// tarjeta no se muestra.
//
// Con `onPay`, cada fila suma un botón "Pagar" (el Home la reusa con solo las
// cuotas por vencer o vencidas; ver utils/payment-due.js). `scope` separa los
// ids cuando la tarjeta vive en otra pantalla.
//
// La tarjeta y cada fila se tiñen según el vencimiento (utils/payment-due.js):
// roja con alguna vencida, ámbar con alguna que vence en los próximos
// HOME_DUE_WINDOW_DAYS días; las cuotas más lejanas quedan neutras.
export function PaymentsUpcomingCard({ items, loading, failed, onRetry, onPay, title = 'Próximos vencimientos', scope = 'payments-upcoming' }) {
  const colors = useThemeColors();
  if (loading) {
    return <SkeletonBlock className="mb-5" height={120} nativeID="payments-upcoming-skeleton" rounded="rounded-2xl" testID="payments-upcoming-skeleton" />;
  }
  if (failed) {
    return (
      <View className="mb-5 flex-row items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 dark:bg-rose-900/20" nativeID="payments-upcoming-error" testID="payments-upcoming-error">
        <Text className="flex-1 text-sm text-rose-700 dark:text-rose-300" nativeID="payments-upcoming-error-text" testID="payments-upcoming-error-text">
          No pudimos cargar tus próximos vencimientos.
        </Text>
        <Pressable className="rounded-full bg-rose-100 px-3 py-1.5 hover:opacity-90 active:opacity-80 dark:bg-rose-900/40" nativeID="payments-upcoming-retry" onPress={onRetry} testID="payments-upcoming-retry">
          <Text className="text-xs font-semibold text-rose-700 dark:text-rose-300" nativeID="payments-upcoming-retry-label" testID="payments-upcoming-retry-label">Reintentar</Text>
        </Pressable>
      </View>
    );
  }
  if (!items?.length) return null;
  const now = new Date();
  const cardVariant = dueCardVariant(items, now);

  return (
    <SectionCard icon="calendar-alert" scope={`${scope}-card`} title={title} variant={cardVariant}>
      <View className="gap-2" nativeID={`${scope}-list`} testID={`${scope}-list`}>
        {items.map((item) => {
          const id = `${scope}-${item.key}`;
          const late = overdueLabel(item);
          const tone = dueTone(item, now);
          const dueText = (
            <Text className={`text-xs ${ROW_TONE[tone].due}`} nativeID={`${id}-due`} numberOfLines={1} testID={`${id}-due`}>
              {late ? `${late} · ${formatDueDate(item.dueDate)}` : `vence ${formatDueDate(item.dueDate)}`}
            </Text>
          );
          return (
            <View
              // El borde cambia de color entre al día y vencida, pero solo con
              // clases de color: nada de sombras ni pseudo-estados condicionales
              // (quirk de NativeWind en CLAUDE.md).
              className={`flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${ROW_TONE[tone].box}`}
              key={item.key}
              nativeID={id}
              testID={id}
            >
              <MaterialCommunityIcons
                color={ROW_TONE[tone].icon ?? colors.onSurfaceVariant}
                name={item.type === 'subscription' ? 'star-circle-outline' : 'account-group-outline'}
                size={22}
              />
              <View className="min-w-0 flex-1" nativeID={`${id}-main`} testID={`${id}-main`}>
                <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-title`} numberOfLines={1} testID={`${id}-title`}>
                  {item.type === 'subscription' ? formatTierName(item.title, 'Tier') : item.title || 'Equipo'}
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400" nativeID={`${id}-subtitle`} numberOfLines={1} testID={`${id}-subtitle`}>
                  {[item.subtitle, `cuota ${item.installmentNumber}`].filter(Boolean).join(' · ')}
                </Text>
                {/* Con "Pagar", el vencimiento baja a esta columna: al costado
                    quedan el monto y el botón, que ocupan poco, y el nombre
                    no se corta en una pantalla angosta. */}
                {onPay ? dueText : null}
              </View>
              <View className={`items-end ${onPay ? 'gap-1.5' : ''}`} nativeID={`${id}-side`} testID={`${id}-side`}>
                <Text className="text-sm font-semibold text-slate-900 dark:text-white" nativeID={`${id}-amount`} style={TABULAR} testID={`${id}-amount`}>
                  {formatArs(item.amount)}
                </Text>
                {onPay ? (
                  <Pressable
                    accessibilityLabel={`Pagar la cuota ${item.installmentNumber} de ${item.type === 'subscription' ? formatTierName(item.title, 'tu tier') : item.title || 'tu equipo'}`}
                    accessibilityRole="button"
                    className="h-8 flex-row items-center justify-center rounded-full bg-primary px-3.5 hover:opacity-90 active:opacity-80"
                    nativeID={`${id}-pay`}
                    onPress={() => onPay(item)}
                    testID={`${id}-pay`}
                  >
                    <Text className="text-xs font-semibold uppercase tracking-wide text-[#111518]" nativeID={`${id}-pay-label`} testID={`${id}-pay-label`}>
                      Pagar
                    </Text>
                  </Pressable>
                ) : dueText}
              </View>
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}
