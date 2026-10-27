import { PaletteReducedTarget } from './palette-reduced-target.jsx';
import { PaletteWithTarget } from './palette-with-target.jsx';
import { PaletteWithoutTarget } from './palette-without-target.jsx';
import { PALETTE_CASES, describePalette } from '../../utils/dashboard-palette.js';

// Conmutador de los TRES casos de paleta, decidido por la tupla
// `(has_target, axis, target_speed_kph != null)` de la respuesta — no por el
// `kind`. Vive en un componente propio y no dentro de cada pantalla para que la
// decisión tenga UN solo lugar: es la regla que más se rompe si se duplica
// (un `kind` mal clasificado en JSX no falla nunca, y una tupla mal leída muestra
// un gauge de ritmo sobre un ejercicio que no tiene velocidad objetivo).
//
// Se renderiza UNO u otro. El contenedor y los KPIs de arriba quedan fuera de acá,
// en la pantalla, así que conmutar no remonta la pantalla ni pierde el scroll
// (design.md D3).
export function PaletteSwitch({ id = 'dashboard-palette', summary, timeseries, kind, seriesSamples = null, seriesPoints = null, ...rest }) {
  const palette = describePalette(summary, kind);

  if (palette.case === PALETTE_CASES.withoutTarget) {
    // El dot plot grafica pares tiempo/velocidad, no solo velocidades: de ahí
    // el nombre distinto de la prop (ver DashboardScreen).
    return <PaletteWithoutTarget {...rest} id={id} seriesPoints={seriesPoints} summary={summary} timeseries={timeseries} />;
  }

  if (palette.case === PALETTE_CASES.reducedTarget) {
    return <PaletteReducedTarget {...rest} id={id} kind={kind} seriesSamples={seriesSamples} summary={summary} timeseries={timeseries} />;
  }

  return <PaletteWithTarget {...rest} id={id} kind={kind} pacePieces seriesSamples={seriesSamples} summary={summary} timeseries={timeseries} />;
}
