export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';
// Variante minimalista (mismo proveedor, 3 estilos oficiales: liberty/bright/
// positron) para la pantalla en vivo del entrenador -- sin íconos de comercios/
// paradas/cafeterías que compitan visualmente con los marcadores de corredores,
// pero conserva nombres de calles. `location-picker.jsx` sigue con "bright"
// (ahí el detalle del lugar elegido es información útil, no ruido).
export const OPENFREEMAP_MINIMAL_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
// Nominatim pide identificar la app (User-Agent en nativo, Referer alcanza
// en web) y no pasar de ~1 request/segundo — se cumple de sobra acá,
// son consultas puntuales disparadas por una acción del usuario, no bulk.
export const NOMINATIM_USER_AGENT = 'Paceron/1.0 (+https://paceron-frontend.vercel.app)';
