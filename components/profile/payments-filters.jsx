import { View } from 'react-native';
import { STATUS_FILTER_OPTIONS } from '../../utils/payment-status.js';
import { ResponsiveSelectField } from '../forms/responsive-select-field.jsx';

// Filtros de la lista de cobros. Los equipos salen del resumen (by_team), así
// solo se ofrecen los que tuvieron movimientos en la ventana. El valor '' es
// "todos": lo pone el placeholder del select, que además trae su botón de limpiar.
export function PaymentsFilters({ teams, teamId, status, onChangeTeam, onChangeStatus, isWide }) {
  const teamOptions = teams.map((t) => ({ id: t.teamId, name: t.teamName || 'Equipo eliminado' }));

  return (
    <View className={isWide ? 'flex-row gap-4' : ''} nativeID="payments-filters" testID="payments-filters">
      <View nativeID="payments-filters-team" style={isWide ? { flex: 1 } : undefined} testID="payments-filters-team">
        <ResponsiveSelectField dense label="Equipo" onChange={onChangeTeam} options={teamOptions} placeholder="Todos los equipos" value={teamId} />
      </View>
      <View nativeID="payments-filters-status" style={isWide ? { flex: 1 } : undefined} testID="payments-filters-status">
        <ResponsiveSelectField dense label="Estado" onChange={onChangeStatus} options={STATUS_FILTER_OPTIONS} placeholder="Todos los estados" value={status} />
      </View>
    </View>
  );
}
