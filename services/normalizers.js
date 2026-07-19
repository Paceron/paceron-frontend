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
