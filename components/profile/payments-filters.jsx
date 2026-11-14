import { View } from 'react-native';
import { STATUS_FILTER_OPTIONS } from '../../utils/payment-status.js';
import { PAYMENT_TYPE_FILTER_OPTIONS } from '../../utils/payment-method.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';
import { CalendarDateField } from '../forms/calendar-date-field.jsx';

// Filtros de la lista de cobros. Los equipos salen del resumen (by_team) y los
// corredores de `payers` (ambos del historial completo), así se ofrecen solo
// opciones que existen. El valor '' es "todos": lo pone el placeholder del
// select, que además trae su botón de limpiar.
//
// Las fechas se manejan en DD/MM/AAAA (el formato de CalendarDateField) y la
// pantalla las convierte a ISO antes de pedirlas. "Desde" y "Hasta" son
// inclusivos; si solo se completa uno, se filtra por ese extremo.
export function PaymentsFilters({
  teams,
  teamId,
  status,
  payerId,
  payers = [],
  dateFrom,
  dateTo,
  onChangeTeam,
  onChangeStatus,
  onChangePayer,
  onChangeDateFrom,
  onChangeDateTo,
  isWide,
}) {
  const teamOptions = teams.map((t) => ({ id: t.teamId, name: t.teamName || 'Equipo eliminado' }));
  const payerOptions = payers.map((p) => ({ id: p.id, name: p.fullName || p.email || 'Corredor' }));
  const fieldStyle = isWide ? { flex: 1, minWidth: 150 } : undefined;

  return (
    <View className={`gap-4 rounded-xl bg-slate-200/50 p-5 pb-0 pt-5 dark:bg-slate-800/60 ${isWide ? 'flex-row flex-wrap' : ''}`} nativeID="payments-filters" testID="payments-filters">
      <View nativeID="payments-filters-team" style={fieldStyle} testID="payments-filters-team">
        <ResponsiveSelectField dense label="Equipo" onChange={onChangeTeam} options={teamOptions} placeholder="Todos los equipos" value={teamId} />
      </View>
      <View nativeID="payments-filters-payer" style={fieldStyle} testID="payments-filters-payer">
        <ResponsiveSelectField dense label="Corredor" onChange={onChangePayer} options={payerOptions} placeholder="Todos los corredores" value={payerId} />
      </View>
      <View nativeID="payments-filters-status" style={fieldStyle} testID="payments-filters-status">
        <ResponsiveSelectField dense label="Estado" onChange={onChangeStatus} options={STATUS_FILTER_OPTIONS} placeholder="Todos los estados" value={status} />
      </View>
      <View nativeID="payments-filters-date-from" style={fieldStyle} testID="payments-filters-date-from">
        <CalendarDateField
          dense
          hideErrorRow
          idPrefix="payments-filters-date-from"
          label="Desde"
          maximumDate={dateTo || undefined}
          onChange={onChangeDateFrom}
          value={dateFrom}
        />
      </View>
      <View nativeID="payments-filters-date-to" style={fieldStyle} testID="payments-filters-date-to">
        <CalendarDateField
          dense
          hideErrorRow
          idPrefix="payments-filters-date-to"
          label="Hasta"
          minimumDate={dateFrom || undefined}
          onChange={onChangeDateTo}
          value={dateTo}
        />
      </View>
    </View>
  );
}

// Filtros del historial propio: tipo (suscripción / pago a entrenador) y estado.
export function PaymentsHistoryFilters({ type, status, onChangeType, onChangeStatus, isWide }) {
  return (
    <View className={isWide ? 'flex-row gap-4 bg-slate-200/50 dark:bg-slate-800/60 p-5 pb-0 rounded-xl mt-1 mb-4' : 'gap-4 bg-slate-200/50 dark:bg-slate-800/60 p-5 pb-0 rounded-xl mt-1 mb-4'} nativeID="payments-history-filters" testID="payments-history-filters">
      <View nativeID="payments-history-filters-type" style={isWide ? { flex: 1 } : undefined} testID="payments-history-filters-type">
        <ResponsiveSelectField dense label="Tipo" onChange={onChangeType} options={PAYMENT_TYPE_FILTER_OPTIONS} placeholder="Todos los tipos" value={type} />
      </View>
      <View nativeID="payments-history-filters-status" style={isWide ? { flex: 1 } : undefined} testID="payments-history-filters-status">
        <ResponsiveSelectField dense label="Estado del pago" onChange={onChangeStatus} options={STATUS_FILTER_OPTIONS} placeholder="Todos los estados" value={status} />
      </View>
    </View>
  );
}
