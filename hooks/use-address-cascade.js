import { useState } from 'react';
import { COUNTRIES, PROVINCES, CITIES } from '../data/locations.js';

// COUNTRIES usa `code` (ISO-3); los field components esperan `id`. Adaptamos y
// mostramos "ISO · Nombre". El value seleccionado es el código ISO (clave de PROVINCES).
export const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ id: c.code, name: `${c.code} · ${c.name}` }));

// Encapsula el estado y la lógica de la cascada de dirección (país → provincia →
// localidad → calle/altura) con gating. Acepta valores iniciales para pre-cargar (edit).
export function useAddressCascade(initial = {}) {
  const [country, setCountry] = useState(initial.country ?? '');
  const [province, setProvince] = useState(initial.province ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [street, setStreet] = useState(initial.street ?? '');
  const [number, setNumber] = useState(initial.number ?? '');
  const [provinceOptions, setProvinceOptions] = useState(
    initial.country ? PROVINCES[initial.country] || [] : [],
  );
  const [cityOptions, setCityOptions] = useState(
    initial.country && initial.province ? CITIES[`${initial.country}-${initial.province}`] || [] : [],
  );

  const clearAddressLines = () => {
    setStreet('');
    setNumber('');
  };

  const handleCountryChange = (code) => {
    setCountry(code);
    setProvince('');
    setCity('');
    clearAddressLines();
    setProvinceOptions(code ? PROVINCES[code] || [] : []);
    setCityOptions([]);
  };

  const handleProvinceChange = (id) => {
    setProvince(id);
    setCity('');
    clearAddressLines();
    setCityOptions(id && country ? CITIES[`${country}-${id}`] || [] : []);
  };

  const handleCityChange = (val) => {
    setCity(val);
    if (!val) clearAddressLines();
  };

  return {
    country,
    province,
    city,
    street,
    number,
    setStreet,
    setNumber,
    provinceOptions,
    cityOptions,
    countryOptions: COUNTRY_OPTIONS,
    handleCountryChange,
    handleProvinceChange,
    handleCityChange,
  };
}
