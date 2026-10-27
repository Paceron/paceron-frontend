// Tono de las cuatro bandas de cumplimiento, en un solo lugar: el mismo verde
// pinta la porción del anillo, el punto de la leyenda y el del tooltip, y tenerlo
// repartido es la forma de que un gráfico y su leyenda dejen de coincidir apenas
// alguien ajuste un tono.
//
// `met` es el verde de marca (colors.primary), y `unknown` el gris de "sin dato":
// los cuatro tonos NO son intercambiables entre sí, cada uno tiene un significado
// fijo del contrato.
export const BAND_COLORS = {
  met: '#8cc63e',
  near: '#f59e0b',
  missed: '#ba1a1a',
  unknown: '#8b949e',
};

// Mismo tono como clase de NativeWind, para los puntos de la leyenda (que son
// `View`, no SVG). Las dos tablas se mantienen al lado a propósito: si se
// diferencian, la leyenda miente respecto del gráfico.
export const BAND_DOT_CLASSES = {
  met: 'bg-[#8cc63e]',
  near: 'bg-[#f59e0b]',
  missed: 'bg-[#ba1a1a]',
  unknown: 'bg-slate-400',
};

export function bandColor(band) {
  return BAND_COLORS[band] ?? BAND_COLORS.unknown;
}
