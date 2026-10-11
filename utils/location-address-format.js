// Formatea el resultado estructurado de reverseGeocode/searchAddress
// (services/geocoding.js) para mostrar algo legible en vez del
// `display_name` opaco de Nominatim -- calle+altura en una línea,
// localidad/provincia/país en la otra. Puro y testeable a propósito
// (sin tocar el picker en sí, que no se puede testear con Jest).

// Campos de Nominatim que no entran en las dos líneas principales pero son
// datos situacionales útiles para el detalle (municipio, partido, código
// postal, barrio) -- varían según la zona, por eso una lista fija de
// candidatos conocidos en vez de iterar el objeto entero (`country_code`,
// por ejemplo, es ruido para el usuario).
const DETAIL_FIELDS = [
  { key: 'neighbourhood', label: 'Barrio' },
  { key: 'suburb', label: 'Barrio' },
  { key: 'city_district', label: 'Comuna/distrito' },
  { key: 'municipality', label: 'Municipio' },
  { key: 'county', label: 'Partido/condado' },
  { key: 'state_district', label: 'Departamento' },
  { key: 'postcode', label: 'Código postal' },
];

export function formatAddressLines(value) {
  if (!value) return { primary: '', secondary: '' };
  const streetLine = [value.street, value.number].filter(Boolean).join(' ');
  const regionLine = [value.city, value.province, value.country].filter(Boolean).join(', ');

  if (streetLine || regionLine) {
    return {
      primary: streetLine || regionLine,
      secondary: streetLine ? regionLine : '',
    };
  }

  // Sin desglose estructurado (ej. label editado a mano, o Nominatim no
  // devolvió `address` para ese punto) -- cae al label crudo o a las
  // coordenadas, igual que antes de esta mejora.
  const fallback = value.label || (Number.isFinite(value.lat) && Number.isFinite(value.lng)
    ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
    : '');
  return { primary: fallback, secondary: '' };
}

export function getAddressDetailRows(value) {
  if (!value?.extra) return [];
  return DETAIL_FIELDS
    .map(({ key, label }) => ({ label, value: value.extra[key] }))
    .filter((row) => Boolean(row.value));
}
