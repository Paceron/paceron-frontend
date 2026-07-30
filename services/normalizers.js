// Convierte YYYY-MM-DD (input date web) a DD/MM/YYYY. Deja DD/MM/AAAA como esta.
function toBackendDate(value) {
  if (!value) return value;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return value;
}

export function toUserModel(dto) {
  if (!dto) return null;
  return {
    userId: dto.user_id,
    name: dto.name,
    surname: dto.surname,
    email: dto.email,
    dni: dto.dni,
    birthDate: dto.birth_date,
    status: dto.status,
    city: dto.city,
    country: dto.country,
    phone: dto.phone,
    phoneContact: dto.phone_contact,
    province: dto.province,
    street: dto.street,
    number: dto.number,
    bankAlias: dto.bank_alias,
  };
}

export function toRegisterPayload(form) {
  const payload = {
    name: form.firstName,
    surname: form.lastName,
    email: form.email,
    password: form.password,
    dni: form.dni,
    birth_date: toBackendDate(form.birthDate),
  };

  const optional = {
    city: form.city,
    country: form.country,
    phone: form.phone,
    phone_contact: form.phoneContact,
    province: form.province,
    street: form.street,
    number: form.number,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value && String(value).trim()) payload[key] = value;
  }

  return payload;
}

// camelCase form -> UserUpdateRequest (snake_case). Set completo editable
// (sin password ni status, que no se actualizan por PUT).
export function toUpdatePayload(form) {
  return {
    name: form.firstName,
    surname: form.lastName,
    email: form.email,
    dni: form.dni,
    birth_date: toBackendDate(form.birthDate),
    city: form.city ?? '',
    country: form.country ?? '',
    number: form.number ?? '',
    phone: form.phone ?? '',
    phone_contact: form.phoneContact ?? '',
    province: form.province ?? '',
    street: form.street ?? '',
    bank_alias: form.bankAlias ?? '',
  };
}

export function toTeamModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    name: dto.name,
    description: dto.description,
    level: dto.level,
    maxMembers: dto.max_members,
    ownerId: dto.owner_id,
    requirements: dto.requirements,
    status: dto.status,
    country: dto.country,
    province: dto.province,
    city: dto.city,
    street: dto.street,
    number: dto.number,
    showGroupsToRunners: dto.show_groups_to_runners ?? false,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toCreateTeamPayload(form) {
  const payload = {
    name: form.name,
    max_members: form.maxMembers,
    owner_id: form.ownerId,
    create_default_group: true,
  };

  const optional = {
    description: form.description,
    level: form.level,
    requirements: form.requirements,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value && String(value).trim()) payload[key] = value;
  }

  return payload;
}

// UpdateTeamRequest del backend no tiene campo de foto (sin campo en el
// backend todavía, ver docs/BACKEND_API_GAPS.md) — el whitelist de
// `optional` la descarta automáticamente si viene en `form`. Dirección va
// aparte (ver toAddressPayload, es un endpoint distinto). show_groups_to_runners
// se maneja fuera del whitelist genérico porque es boolean — el chequeo
// `String(value).trim()` de abajo está pensado para strings/números, no
// para distinguir `false` de "sin valor".
export function toUpdateTeamPayload(form) {
  const payload = {};
  const optional = {
    name: form.name,
    description: form.description,
    level: form.level,
    max_members: form.maxMembers,
    requirements: form.requirements,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined && value !== null && String(value).trim()) payload[key] = value;
  }

  if (form.showGroupsToRunners !== undefined) payload.show_groups_to_runners = form.showGroupsToRunners;

  return payload;
}

export function toAddressPayload(form) {
  const payload = {};
  const optional = { country: form.country, province: form.province, city: form.city };

  for (const [key, value] of Object.entries(optional)) {
    if (value && String(value).trim()) payload[key] = value;
  }

  return payload;
}

export function toGroupModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    teamId: String(dto.team_id),
    name: dto.name,
    description: dto.description,
    isDefault: dto.is_main ?? false,
    trainingPlanId: null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toCreateGroupPayload(teamId, form) {
  const payload = { team_id: Number(teamId), name: form.name };
  if (form.description && String(form.description).trim()) payload.description = form.description.trim();
  return payload;
}

export function toUpdateGroupPayload(form) {
  const payload = {};
  if (form.name && String(form.name).trim()) payload.name = form.name.trim();
  if (form.description !== undefined) payload.description = form.description ? String(form.description).trim() : null;
  return payload;
}
