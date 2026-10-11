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

// Nominatim ya devuelve un objeto `address` desglosado (calle, altura,
// localidad, provincia, país, y datos situacionales como municipio/código
// postal) -- hasta ahora se descartaba todo menos `display_name`. Mapeo
// propio porque el nombre del campo de "localidad" varía según la zona
// (city/town/village/municipality, nunca más de uno presente a la vez).
function toStructuredAddress(address, displayName) {
  if (!address) return { label: displayName ?? null };
  return {
    label: displayName ?? null,
    street: address.road ?? null,
    number: address.house_number ?? null,
    city: address.city ?? address.town ?? address.village ?? address.municipality ?? null,
    province: address.state ?? null,
    country: address.country ?? null,
    extra: address,
  };
}

export async function reverseGeocode(lat, lng) {
  const data = await nominatimFetch(`/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`);
  return toStructuredAddress(data?.address, data?.display_name ?? null);
}

export async function searchAddress(query) {
  const data = await nominatimFetch(`/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`);
  const first = data?.[0];
  if (!first) return null;
  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
    ...toStructuredAddress(first.address, first.display_name),
  };
}
