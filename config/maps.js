export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
// Nominatim pide identificar la app (User-Agent en nativo, Referer alcanza
// en web) y no pasar de ~1 request/segundo — se cumple de sobra acá,
// son consultas puntuales disparadas por una acción del usuario, no bulk.
export const NOMINATIM_USER_AGENT = 'Paceron/1.0 (+https://paceron-frontend.vercel.app)';
