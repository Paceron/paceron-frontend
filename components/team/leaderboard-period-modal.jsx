import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateField } from '../forms/fields.jsx';
import { toISODate } from '../../utils/date-field-format.js';
import { useThemeColors } from '../../theme/colors.js';

// Selector de período del leaderboard (Gap 32), modal único -- pedido real
// 2026-10-24: el `ResponsiveSelectField` inline + el modal aparte solo para
// el rango personalizado le robaban mucho ancho a las subpestañas de
// métrica (TabBar), en mobile Y en web. Acá en vez de confirmar período
// optimistamente contra el padre (como hacía el `ResponsiveSelectField` de
// antes, que necesitaba un `periodBeforeCustomRef` para poder revertir al
// cancelar), todo el borrador vive LOCAL a este modal -- se siembra una vez
// al abrir, y solo pisa el estado del padre al tocar Aplicar. Cancelar no
// necesita revertir nada, nunca llegó a tocar al padre.
export function LeaderboardPeriodModal({ visible, period, fromDate, toDate, options, onCancel, onApply }) {
  const colors = useThemeColors();
  const [draftPeriod, setDraftPeriod] = useState(period);
  const [draftFrom, setDraftFrom] = useState(fromDate ?? '');
  const [draftTo, setDraftTo] = useState(toDate ?? '');

  useEffect(() => {
    if (visible) {
      setDraftPeriod(period);
      setDraftFrom(fromDate ?? '');
      setDraftTo(toDate ?? '');
    }
  }, [visible, period, fromDate, toDate]);

  const isCustom = draftPeriod === 'custom';
  const fromIso = toISODate(draftFrom);
  const toIso = toISODate(draftTo);
  const customBothFilled = Boolean(fromIso) && Boolean(toIso);
  const customInverted = customBothFilled && fromIso > toIso;
  const canApply = !isCustom || (customBothFilled && !customInverted);

  const handleApply = () => {
    onApply(draftPeriod, isCustom ? draftFrom : '', isCustom ? draftTo : '');
  };

  return (
    <Modal animationType="fade" nativeID="leaderboard-period-modal" onRequestClose={onCancel} testID="leaderboard-period-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="leaderboard-period-modal-backdrop" onPress={onCancel} testID="leaderboard-period-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="leaderboard-period-modal-card" onPress={() => {}} testID="leaderboard-period-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="leaderboard-period-modal-header" testID="leaderboard-period-modal-header">
            <MaterialCommunityIcons color={colors.primary} name="calendar-month-outline" size={20} />
            <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID="leaderboard-period-modal-title" testID="leaderboard-period-modal-title">
              Período
            </Text>
          </View>

          <View className="gap-1.5" nativeID="leaderboard-period-modal-options" testID="leaderboard-period-modal-options">
            {options.map((option) => {
              const selected = option.id === draftPeriod;
              return (
                <Pressable
                  className={`flex-row items-center justify-between rounded-xl px-3 py-2.5 ${selected ? 'bg-primary-tint-subtle dark:bg-primary/10' : 'active:bg-slate-100 dark:active:bg-slate-800'}`}
                  key={option.id}
                  nativeID={`leaderboard-period-modal-option-${option.id}`}
                  onPress={() => setDraftPeriod(option.id)}
                  testID={`leaderboard-period-modal-option-${option.id}`}
                >
                  <Text
                    className={`text-sm ${selected ? 'font-semibold text-primary' : 'font-medium text-slate-700 dark:text-slate-200'}`}
                    nativeID={`leaderboard-period-modal-option-${option.id}-label`}
                    testID={`leaderboard-period-modal-option-${option.id}-label`}
                  >
                    {option.name}
                  </Text>
                  {selected && <MaterialCommunityIcons color={colors.primary} name="check" size={18} />}
                </Pressable>
              );
            })}
          </View>

          {isCustom && (
            <View className="mt-3 gap-3" nativeID="leaderboard-period-modal-custom-fields" testID="leaderboard-period-modal-custom-fields">
              <DateField label="Desde" onChange={setDraftFrom} value={draftFrom} />
              <DateField label="Hasta" onChange={setDraftTo} value={draftTo} />
              {customInverted && (
                <Text className="text-xs text-red-600 dark:text-red-400" nativeID="leaderboard-period-modal-error" testID="leaderboard-period-modal-error">
                  &quot;Desde&quot; tiene que ser anterior o igual a &quot;Hasta&quot;.
                </Text>
              )}
            </View>
          )}

          <View className="mt-4 flex-row gap-3" nativeID="leaderboard-period-modal-actions" testID="leaderboard-period-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="leaderboard-period-modal-cancel-button"
              onPress={onCancel}
              testID="leaderboard-period-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="leaderboard-period-modal-cancel-label" testID="leaderboard-period-modal-cancel-label">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              className={`h-11 flex-1 items-center justify-center rounded-full ${canApply ? 'bg-primary hover:opacity-90 active:opacity-80' : 'bg-slate-300 dark:bg-slate-700'}`}
              disabled={!canApply}
              nativeID="leaderboard-period-modal-apply-button"
              onPress={handleApply}
              testID="leaderboard-period-modal-apply-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="leaderboard-period-modal-apply-label" testID="leaderboard-period-modal-apply-label">
                Aplicar
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
