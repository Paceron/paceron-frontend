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

export function toInvitationModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    teamId: String(dto.team_id),
    email: dto.invitee_email,
    inviteeId: dto.invitee_id,
    inviteeName: dto.invitee_name,
    groupId: dto.group_id != null ? String(dto.group_id) : null,
    teamName: dto.team_name ?? null,
    inviterName: dto.inviter_name ?? null,
    status: dto.status,
    expiresAt: dto.expires_at,
    createdAt: dto.created_at,
  };
}

export function toInvitePayload(email, groupId) {
  const payload = { email };
  if (groupId) payload.group_id = Number(groupId);
  return payload;
}

// ---------------------------------------------------------------------
// Planes de entrenamiento — ver
// docs/superpowers/specs/2026-08-26-training-plans-design.md. Los blocks
// (warmup/cooldown/main/set) son la traducción 1:1 del arco exclusivo del
// schema SQL de referencia: `kind` + los atributos que correspondan a ese
// kind nada más, sin FKs nullable (acá no hace falta, no es SQL).
// ---------------------------------------------------------------------

function toWarmcoolBlockModel(dto) {
  if (!dto) return null;
  return { kind: dto.kind, minutes: dto.minutes ?? null };
}

function toWarmcoolBlockPayload(block) {
  if (!block) return null;
  const payload = { kind: block.kind };
  if (block.minutes != null) payload.minutes = block.minutes;
  return payload;
}

function toSetBlockModel(dto) {
  if (!dto) return null;
  return {
    repeatCount: dto.repeat_count,
    restMinutes: dto.rest_minutes,
    kind: dto.kind,
    minutes: dto.minutes ?? null,
    distanceM: dto.distance_m ?? null,
    speedKph: dto.speed_kph ?? null,
  };
}

function toSetBlockPayload(set) {
  if (!set) return null;
  const payload = { repeat_count: set.repeatCount, rest_minutes: set.restMinutes, kind: set.kind };
  if (set.minutes != null) payload.minutes = set.minutes;
  if (set.distanceM != null) payload.distance_m = set.distanceM;
  if (set.speedKph != null) payload.speed_kph = set.speedKph;
  return payload;
}

function toMainBlockModel(dto) {
  if (!dto) return null;
  return {
    kind: dto.kind,
    distanceM: dto.distance_m ?? null,
    minutes: dto.minutes ?? null,
    set: toSetBlockModel(dto.set),
  };
}

function toMainBlockPayload(main) {
  if (!main) return null;
  const payload = { kind: main.kind };
  if (main.distanceM != null) payload.distance_m = main.distanceM;
  if (main.minutes != null) payload.minutes = main.minutes;
  if (main.set) payload.set = toSetBlockPayload(main.set);
  return payload;
}

function toTrainingSessionModel(dto) {
  if (!dto) return null;
  return {
    warmup: toWarmcoolBlockModel(dto.warmup),
    main: toMainBlockModel(dto.main),
    cooldown: toWarmcoolBlockModel(dto.cooldown),
  };
}

function toTrainingSessionPayload(session) {
  if (!session) return null;
  return {
    warmup: toWarmcoolBlockPayload(session.warmup),
    main: toMainBlockPayload(session.main),
    cooldown: toWarmcoolBlockPayload(session.cooldown),
  };
}

function toPlanDayModel(dto) {
  return {
    sequenceNo: dto.sequence_no,
    dayOfWeek: dto.day_of_week,
    kind: dto.kind,
    otherName: dto.other_name ?? null,
    session: toTrainingSessionModel(dto.session),
  };
}

function toPlanDayPayload(day) {
  return {
    sequence_no: day.sequenceNo,
    day_of_week: day.dayOfWeek,
    kind: day.kind,
    other_name: day.kind === 'other' ? day.otherName : null,
    session: day.kind === 'training' ? toTrainingSessionPayload(day.session) : null,
  };
}

export function toTrainingPlanModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    ownerId: dto.owner_id,
    name: dto.name,
    description: dto.description,
    durationDays: dto.duration_days,
    days: (dto.days ?? []).map(toPlanDayModel),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toCreateTrainingPlanPayload(form) {
  return {
    owner_id: form.ownerId,
    name: form.name,
    description: form.description || null,
    duration_days: form.durationDays,
    days: form.days.map(toPlanDayPayload),
  };
}

export function toUpdateTrainingPlanPayload(form) {
  const payload = {};
  if (form.name !== undefined) payload.name = form.name;
  if (form.description !== undefined) payload.description = form.description || null;
  if (form.durationDays !== undefined) payload.duration_days = form.durationDays;
  if (form.days !== undefined) payload.days = form.days.map(toPlanDayPayload);
  return payload;
}

export function toRunnerPlanAssignmentModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    planId: String(dto.plan_id),
    userId: dto.user_id,
    assignedAt: dto.assigned_at,
  };
}
