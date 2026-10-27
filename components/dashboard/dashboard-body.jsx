import { View } from 'react-native';
import { PaletteSwitch } from './palette-switch.jsx';

// El cuerpo de la pantalla de rendimiento: la paleta de métricas (KPIs + grilla
// de gráficos) y lo que le pase el llamador. El panel de pestañas agrupa el perfil,
// el ranking y la comparación (sesiones A/B y períodos) en vez de apilarlos.
//
// Antes había dos variantes enteras, una por rol, y la única diferencia real
// entre ellas era qué secciones se agregaban al final: los mismos KPIs, la misma
// evolución, el mismo radar y el mismo cumplimiento. La variante del corredor
// existía casi solo para NO importar `leaderboard-table.jsx` ni
// `comparison-strip.jsx` — ocho líneas de regla escondidas en la forma del árbol
// de componentes. Ahora esa regla es una capacidad explícita
// (`utils/dashboard-capabilities.js`) y el `children` de acá: lo que un rol no
// puede pedir, directamente no se monta (y con eso tampoco se llama su hook).
//
// Lo que se recorta a las series propias de un corredor NO es esto: eso lo hace
// el backend, que scopea por el usuario que pregunta (un miembro de equipo no es
// el dueño, así que no ve series ajenas).
export function DashboardBody({ id, summary, timeseries, kind, granularity, onGranularityChange, seriesSamples = null, seriesPoints = null, captureRef = null, children = null }) {
  return (
    // `mt-2`: aire entre el panel de filtros (que cierra con su `mb-4`) y la
    // primera fila de KPIs. Hace falta sumarlo acá porque el gutter de los KPIs
    // arranca con `-my-1` (el truco de márgenes negativos que cancela el padding
    // de cada celda), así que el margen efectivo entre las dos piezas quedaba en
    // 12 px. No borrar ese `-my-1` pensando que es lo que sobra.
    <View className="mt-2" nativeID={id} testID={id}>
      {/* La captura del PDF sale de acá: la paleta y el panel de insights
          (radar por defecto), que es lo que se reconoce como "el dashboard".
          Queda afuera el panel de filtros/calidad (es UI de la app, no del
          informe). `collapsable={false}` es requisito de
          `react-native-view-shot` en Android. */}
      <View collapsable={false} nativeID={`${id}-capture`} ref={captureRef} testID={`${id}-capture`}>
        <PaletteSwitch
          granularity={granularity}
          id={`${id}-palette`}
          kind={kind}
          onGranularityChange={onGranularityChange}
          seriesPoints={seriesPoints}
          seriesSamples={seriesSamples}
          summary={summary}
          timeseries={timeseries}
        />

        {children}
      </View>
    </View>
  );
}
