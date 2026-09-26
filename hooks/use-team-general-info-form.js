import { useState } from 'react';
import { useAddressCascade } from './use-address-cascade.js';
import { validateMembershipFee } from '../utils/membership-fee-validators.js';

// Estado + validación de los "datos generales" de un equipo (nombre,
// ubicación, descripción, nivel, cupo, cuota mensual, requisitos) —
// compartido por CreateTeamScreen (paso 1 del wizard) y EditTeamScreen
// (pantalla única, sin grupos ni invitaciones). `initial` precarga los campos
// (vacío al crear, el equipo real al editar); `maxAllowed` es el tope de
// integrantes del plan del entrenador y `minimumFee` el piso de la cuota que
// puede cobrar (ambos derivados de su tier, ver hooks/use-team-configuration.js).
export function useTeamGeneralInfoForm({ initial, maxAllowed, minimumFee }) {
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
  // Cuota mensual que paga cada corredor al entrenador. Se guarda como string
  // (es un InputField) y 0 significa equipo gratis — al editar, un equipo con
  // fee 0 muestra el campo vacío en vez de "0", que se leería como un precio.
  const [membershipFee, setMembershipFee] = useState(
    initial?.membershipFee ? String(initial.membershipFee) : '',
  );
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

    const feeError = validateMembershipFee(membershipFee, minimumFee);
    if (feeError) next.membershipFee = feeError;

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
    // Vacío = no se manda el campo (el backend deja el default 0 al crear, y no
    // toca el valor existente al editar). El normalizer se encarga de omitirlo.
    membershipFee: membershipFee.trim() === '' ? undefined : Number(membershipFee),
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
    membershipFee,
    setMembershipFee,
    errors,
    validate,
    getValues,
  };
}
