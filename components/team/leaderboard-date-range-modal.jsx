import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateField } from '../forms/fields.jsx';
import { toISODate } from '../../utils/date-field-format.js';

// Rango personalizado del leaderboard (Gap 32) -- modal chico solo para
// Desde/Hasta, vuelto a este alcance acotado 2026-10-24 (se había probado
// un modal único período+rango, pero el usuario prefirió volver al select
// plano de período con este modal aparte solo para el caso 'custom').
// Estado local sembrado una vez por apertura (mismo patrón de
// reset-on-reopen que create-competition-modal.jsx, pero gateado solo por
// `visible` -- este modal no tiene concepto de "resetKey" porque no hay
// distintos registros que editar, uno por vez).
export function LeaderboardDateRangeModal({ visible, initialFrom, initialTo, onCancel, onConfirm }) {
  const [fromDate, setFromDate] = useState(initialFrom ?? '');
  const [toDate, setToDate] = useState(initialTo ?? '');

  useEffect(() => {
    if (visible) {
      setFromDate(initialFrom ?? '');
      setToDate(initialTo ?? '');
    }
  }, [visible, initialFrom, initialTo]);

  const fromIso = toISODate(fromDate);
  const toIso = toISODate(toDate);
  const bothFilled = Boolean(fromIso) && Boolean(toIso);
  const rangeInverted = bothFilled && fromIso > toIso;
  const canApply = bothFilled && !rangeInverted;

  return (
    <Modal animationType="fade" nativeID="leaderboard-date-range-modal" onRequestClose={onCancel} testID="leaderboard-date-range-modal" transparent visible={visible}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-4" nativeID="leaderboard-date-range-modal-backdrop" onPress={onCancel} testID="leaderboard-date-range-modal-backdrop">
        <Pressable className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-surface" nativeID="leaderboard-date-range-modal-card" onPress={() => {}} testID="leaderboard-date-range-modal-card">
          <View className="mb-4 flex-row items-center gap-2" nativeID="leaderboard-date-range-modal-header" testID="leaderboard-date-range-modal-header">
            <MaterialCommunityIcons name="calendar-range" size={20} />
            <Text className="text-base font-bold text-slate-900 dark:text-white" nativeID="leaderboard-date-range-modal-title" testID="leaderboard-date-range-modal-title">
              Rango personalizado
            </Text>
          </View>

          <View className="gap-3" nativeID="leaderboard-date-range-modal-fields" testID="leaderboard-date-range-modal-fields">
            <DateField label="Desde" onChange={setFromDate} value={fromDate} />
            <DateField label="Hasta" onChange={setToDate} value={toDate} />
          </View>

          {rangeInverted && (
            <Text className="mb-2 text-xs text-red-600 dark:text-red-400" nativeID="leaderboard-date-range-modal-error" testID="leaderboard-date-range-modal-error">
              &quot;Desde&quot; tiene que ser anterior o igual a &quot;Hasta&quot;.
            </Text>
          )}

          <View className="mt-2 flex-row gap-3" nativeID="leaderboard-date-range-modal-actions" testID="leaderboard-date-range-modal-actions">
            <Pressable
              className="h-11 flex-1 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-100 active:opacity-70 dark:border-slate-700 dark:hover:bg-slate-800"
              nativeID="leaderboard-date-range-modal-cancel-button"
              onPress={onCancel}
              testID="leaderboard-date-range-modal-cancel-button"
            >
              <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" nativeID="leaderboard-date-range-modal-cancel-label" testID="leaderboard-date-range-modal-cancel-label">
                Cancelar
              </Text>
            </Pressable>
            <Pressable
              className={`h-11 flex-1 items-center justify-center rounded-full ${canApply ? 'bg-primary hover:opacity-90 active:opacity-80' : 'bg-slate-300 dark:bg-slate-700'}`}
              disabled={!canApply}
              nativeID="leaderboard-date-range-modal-apply-button"
              onPress={() => onConfirm(fromDate, toDate)}
              testID="leaderboard-date-range-modal-apply-button"
            >
              <Text className="text-sm font-semibold uppercase tracking-wide text-white" nativeID="leaderboard-date-range-modal-apply-label" testID="leaderboard-date-range-modal-apply-label">
                Aplicar
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
