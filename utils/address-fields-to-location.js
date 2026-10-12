import { getCountryName, getProvinceName } from '../data/locations.js';

// Inverso de utils/location-to-address-fields.js -- a partir de los campos
// ya guardados (country/province como CÓDIGO interno, lat/lng si existen)
// arma el `value` que espera LocationPicker (nombres legibles, no códigos).
// Sin lat/lng (fila vieja, sin backfill -- ver Gap 29 en
// docs/BACKEND_API_GAPS.md) no hay punto real que mostrar en el mapa:
// devuelve null a propósito en vez de inventar coordenadas, el caller
// muestra la dirección guardada como texto informativo aparte
// (ver formatLegacyAddressLabel) y deja el picker vacío para elegir un
// punto preciso recién cuando el usuario lo toque.
export function toLocationPickerValue({ lat, lng, country, province, city, street, number }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat, lng,
    label: null,
    street: street || null,
    number: number || null,
    city: city || null,
    province: country ? getProvinceName(country, province) : (province || null),
    country: country ? getCountryName(country) : null,
  };
}

export function hasLegacyAddressWithoutCoordinates({ lat, lng, country, province, city }) {
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const hasAddress = Boolean(country || province || city);
  return hasAddress && !hasCoordinates;
}

export function formatLegacyAddressLabel({ country, province, city }) {
  const provinceName = country ? getProvinceName(country, province) : province;
  const countryName = country ? getCountryName(country) : null;
  return [city, provinceName, countryName].filter(Boolean).join(', ');
}
