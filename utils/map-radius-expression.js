// Expresión de interpolación por zoom para que un line-width en PÍXELES
// aproxime un radio real en METROS a lo largo de toda la trayectoria --
// pedido real, 2026-10-16: "un mini sombreado o halo alrededor de la
// trayectoria dibujada según el radio de aceptación". El style spec de
// MapLibre no tiene una unidad métrica nativa para line-width (sí existe
// para circle-radius con trucos similares, pero acá hace falta a lo largo
// de TODA la línea, no un círculo en un punto) -- se interpola el ancho en
// píxeles en varios niveles de zoom de referencia usando la conversión
// estándar metros/píxel de Web Mercator (depende de la latitud: más cerca
// del ecuador, más metros representa cada píxel al mismo zoom). Usa la
// latitud promedio de la ruta como aproximación -- es un halo visual
// indicativo, no una medición exacta (la curvatura real variaría
// levemente en una ruta muy larga, aceptable para esto).
const EARTH_CIRCUMFERENCE_METERS = 40_075_016.686;
const REFERENCE_ZOOM_STOPS = [8, 12, 16, 20];

export function metersPerPixelAtZoom(zoom, latitudeDeg) {
  return (EARTH_CIRCUMFERENCE_METERS * Math.cos((latitudeDeg * Math.PI) / 180)) / 2 ** (zoom + 8);
}

// Devuelve una expresión de estilo MapLibre (['interpolate', ...]) que da
// el ancho de línea en px para que el DIÁMETRO visual (2x el radio) sea
// correcto en cada nivel de zoom de referencia.
export function buildRadiusHaloWidthExpression(radiusMeters, latitudeDeg) {
  const diameterMeters = Math.max(0, Number(radiusMeters) || 0) * 2;
  const expression = ['interpolate', ['exponential', 2], ['zoom']];
  REFERENCE_ZOOM_STOPS.forEach((zoom) => {
    expression.push(zoom, diameterMeters / metersPerPixelAtZoom(zoom, latitudeDeg));
  });
  return expression;
}
