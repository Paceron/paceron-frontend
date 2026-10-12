import { resolveCountryCode, resolveProvinceCode } from '../data/locations.js';

// Convierte el `value` que entrega LocationPicker (lat/lng + nombres de
// Nominatim, ver services/geocoding.js) al shape que los forms de
// registro/perfil/equipo ya mandaban antes de esto: country/province como
// CÓDIGO interno de data/locations.js, city/street/number tal cual (esos
// nunca fueron códigos). Decisión Gap 29 punto 2 (docs/BACKEND_API_GAPS.md):
// el backend no valida el código, pero el buscador de equipos sí filtra por
// él -- mandar el nombre crudo rompería ese filtro para las filas nuevas.
export function toAddressFormFields(value) {
  if (!value) {
    return { country: '', province: '', city: '', street: '', number: '', lat: null, lng: null };
  }
  const country = resolveCountryCode(value.country);
  const province = resolveProvinceCode(country, value.province);
  return {
    country,
    province,
    city: value.city ?? '',
    street: value.street ?? '',
    number: value.number ?? '',
    lat: value.lat,
    lng: value.lng,
  };
}
