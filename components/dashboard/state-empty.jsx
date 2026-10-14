import { DashboardState, StateAction } from './state-shell.jsx';

// Estado vacío: hay scope pero ninguna serie en el período. El CTA amplía el
// rango de fechas, que es la causa más común —el equipo entrena pero el período
// elegido no lo cubre— y por eso el texto explica qué revisar en vez de quedarse
// en "no hay datos".
export function StateEmpty({ id = 'dashboard-state-empty', onWidenRange, canWidenRange = true }) {
  return (
    <DashboardState
      icon="chart-box-outline"
      id={id}
      message="El equipo todavía no tiene series registradas en el período elegido. Probá ampliando el rango de fechas."
      title="No hay estadísticas disponibles aún"
      tone="info"
    >
      {canWidenRange && onWidenRange ? (
        <StateAction
          icon="calendar-range"
          id={`${id}-widen-range`}
          label="Ampliar el rango de fechas"
          onPress={onWidenRange}
          primary
        />
      ) : null}
    </DashboardState>
  );
}
