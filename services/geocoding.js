import { NOMINATIM_BASE_URL, NOMINATIM_USER_AGENT } from '../config/maps.js';
import { isWeb } from '../utils/platform.js';

async function nominatimFetch(path) {
  const response = await fetch(`${NOMINATIM_BASE_URL}${path}`, {
    // En web, los navegadores bloquean sobreescribir el header User-Agent
    // (el Referer que mandan solo ya identifica el origen) — en nativo sí
    // se puede setear, así que se manda explícito.
    headers: isWeb ? undefined : { 'User-Agent': NOMINATIM_USER_AGENT },
  });
  if (!response.ok) throw new Error(`Nominatim respondió ${response.status}`);
  return response.json();
}

export async function reverseGeocode(lat, lng) {
  const data = await nominatimFetch(`/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
  return data?.display_name ?? null;
}

export async function searchAddress(query) {
  const data = await nominatimFetch(`/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`);
  const first = data?.[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name };
}
