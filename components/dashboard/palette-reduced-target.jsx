import { PaletteWithTarget } from './palette-with-target.jsx';

// Paleta A REDUCIDO —el tercer caso de la tupla `(has_target, axis,
// target_speed_kph != null)`. Entra acá con objetivo cargado pero SIN velocidad
// objetivo: eje `distance` (100/200 m y preferencias 1000/2000) y `elongacion`
// sin objetivo de velocidad.
//
// El número principal pasa a ser la distancia (o el tiempo, si el eje es
// temporal) y desaparecen el gauge de ritmo y la velocidad esperada: con
// `target_speed_kph: null` no hay velocidad que derivar de la distancia sola, y
// dibujarla sería inventar un objetivo que el backend no cargó.
//
// NO es un contenedor nuevo con estructura duplicada: envuelve a A completo y le
// apaga las piezas de ritmo con `pacePieces={false}`. Cumplimiento, delta,
// evolución y reparto de bandas son el MISMO subtree en los dos casos, y
// duplicarlos es la vía directa a que se desincronicen (design.md D3).
//
// Aplica a 2 de los 12 ejercicios del seed (Velocidad Máxima 100 y 200 m) y a
// `elongacion` cuando `target_speed_kph` viene `null`. No desmonta los KPIs ni
// pierde scroll: el contenedor estable es el de la pantalla, y acá solo cambia la
// región de gráficos.
export function PaletteReducedTarget({ id, summary, timeseries, kind, ...rest }) {
  return (
    <PaletteWithTarget
      {...rest}
      id={id}
      kind={kind}
      pacePieces={false}
      summary={summary}
      timeseries={timeseries}
    />
  );
}
