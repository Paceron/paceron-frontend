// Color/label/ícono de los marcadores de inicio/fin de una ruta --
// centralizado acá porque hasta ahora estaba duplicado idéntico en 4
// archivos (live-trajectory-map.jsx/.web.jsx, route-map-preview.jsx/
// .web.jsx). `iconCodepoint` es el mismo glyph que `icon` pero como
// codepoint numérico -- lo necesita el lado web, que arma el marcador
// con un nodo DOM crudo (no puede usar <MaterialCommunityIcons/>, un
// componente RN) y escribe el glyph directo como texto del font
// 'material-community' (ver utils/distance.js y el spec de esta rama
// para la verificación de que ese font-family y esos codepoints son
// reales, no copiados de memoria).
export const ROUTE_MARKER_META = {
  start: { color: '#16a34a', label: 'Punto de inicio', icon: 'flag-outline', iconCodepoint: 0xf023d },
  end: { color: '#f97316', label: 'Punto de llegada', icon: 'flag-checkered', iconCodepoint: 0xf023c },
};
