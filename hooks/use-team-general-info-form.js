import { useState } from 'react';
import { useAddressCascade } from './use-address-cascade.js';

// Estado + validación de los "datos generales" de un equipo (nombre,
// ubicación, descripción, nivel, cupo, requisitos) — compartido por
// CreateTeamScreen (paso 1 del wizard) y EditTeamScreen (pantalla única,
// sin grupos ni invitaciones). `initial` precarga los campos (vacío al
// crear, el equipo real al editar); `maxAllowed` es el tope de
// integrantes del plan del entrenador.
export function useTeamGeneralInfoForm({ initial, maxAllowed }) {
  const [name, setName] = useState(initial?.name ?? '');
  const {
    country,
    province,
    city,
    provinceOptions,
    cityOptions,
    countryOptions,
    handleCountryChange,
    handleProvinceChange,
    handleCityChange,
  } = useAddressCascade({ country: initial?.country, province: initial?.province, city: initial?.city });
  const [description, setDescription] = useState(initial?.description ?? '');
  const [level, setLevel] = useState(initial?.level ?? '');
  const [maxMembers, setMaxMembers] = useState(initial?.maxMembers != null ? String(initial.maxMembers) : '');
  const [requirements, setRequirements] = useState(initial?.requirements ?? '');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Ingresá un nombre para el equipo.';
    if (!level) next.level = 'Elegí un nivel.';

    const parsedMax = Number(maxMembers);
    if (!maxMembers.trim() || !Number.isInteger(parsedMax) || parsedMax < 1) {
      next.maxMembers = 'Ingresá una cantidad válida.';
    } else if (parsedMax > maxAllowed) {
      next.maxMembers = `Tu plan permite hasta ${maxAllowed} integrantes.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const getValues = () => ({
    name: name.trim(),
    country,
    province,
    city,
    description: description.trim(),
    level,
    maxMembers: Number(maxMembers),
    requirements: requirements.trim(),
  });

  return {
    name,
    setName,
    country,
    province,
    city,
    provinceOptions,
    cityOptions,
    countryOptions,
    handleCountryChange,
    handleProvinceChange,
    handleCityChange,
    description,
    setDescription,
    level,
    setLevel,
    maxMembers,
    setMaxMembers,
    requirements,
    setRequirements,
    errors,
    validate,
    getValues,
  };
}
