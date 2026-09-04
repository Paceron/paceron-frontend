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
    photoUrl: dto.photo_url ?? null,
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
    iconUrl: dto.icon_url ?? null,
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
// Ejercicios y sesiones — catálogo reusable del entrenador (enmienda
// 2026-08-26 de docs/superpowers/specs/2026-08-26-training-plans-design.md).
// Un ejercicio es un tipo hoja del schema SQL de referencia (walking/
// jogging/elongation/cruising/running) + sus atributos; una sesión arma
// los 3 bloques fijos (warmup/main/cooldown) REFERENCIANDO ejercicios ya
// creados, no construyéndolos de cero — un plan a su vez referencia una
// sesión por cada día de entrenamiento (ver toPlanDayModel/Payload).
// ---------------------------------------------------------------------

export function toExerciseModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    ownerId: dto.owner_id,
    name: dto.name,
    kind: dto.kind,
    minutes: dto.minutes ?? null,
    distanceM: dto.distance_m ?? null,
    speedKph: dto.speed_kph ?? null,
    muscleGroup: dto.muscle_group ?? null,
    videoUrl: dto.video_url ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toCreateExercisePayload(form) {
  const payload = { owner_id: form.ownerId, name: form.name, kind: form.kind };
  if (form.minutes != null) payload.minutes = form.minutes;
  if (form.distanceM != null) payload.distance_m = form.distanceM;
  if (form.speedKph != null) payload.speed_kph = form.speedKph;
  if (form.muscleGroup != null) payload.muscle_group = form.muscleGroup;
  return payload;
}

export function toSessionModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    ownerId: dto.owner_id,
    name: dto.name,
    description: dto.description,
    warmupExerciseId: String(dto.warmup_exercise_id),
    mainExerciseId: String(dto.main_exercise_id),
    mainRepeatCount: dto.main_repeat_count ?? 1,
    mainRestMinutes: dto.main_rest_minutes ?? 0,
    cooldownExerciseId: String(dto.cooldown_exercise_id),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toCreateSessionPayload(form) {
  return {
    owner_id: form.ownerId,
    name: form.name,
    description: form.description || null,
    warmup_exercise_id: Number(form.warmupExerciseId),
    main_exercise_id: Number(form.mainExerciseId),
    main_repeat_count: form.mainRepeatCount ?? 1,
    main_rest_minutes: form.mainRestMinutes ?? 0,
    cooldown_exercise_id: Number(form.cooldownExerciseId),
  };
}

function toPlanDayModel(dto) {
  return {
    sequenceNo: dto.sequence_no,
    dayOfWeek: dto.day_of_week,
    kind: dto.kind,
    otherName: dto.other_name ?? null,
    sessionId: dto.session_id != null ? String(dto.session_id) : null,
  };
}

function toPlanDayPayload(day) {
  return {
    sequence_no: day.sequenceNo,
    day_of_week: day.dayOfWeek,
    kind: day.kind,
    other_name: day.kind === 'other' ? day.otherName : null,
    session_id: day.kind === 'training' && day.sessionId ? Number(day.sessionId) : null,
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

// ---------------------------------------------------------------------
// Tiers — catálogo real GET /api/v1/tiers (ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md).
// ---------------------------------------------------------------------

export function toTierModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    name: dto.name,
    description: dto.description ?? null,
    paymentRequired: Boolean(dto.payment_required),
    roleId: dto.role_id,
    roleName: dto.role_name,
    tierAmount: dto.tier_amount ?? 0,
  };
}

// ---------------------------------------------------------------------
// Pagos — Fase 0 (checkout genérico, sin split). Ver
// docs/superpowers/specs/2026-09-02-payments-fase0-frontend-design.md.
// ---------------------------------------------------------------------

export function toCreatePreferencePayload(form) {
  const payload = {
    concept: form.concept,
    items: form.items.map((item) => ({ title: item.title, quantity: item.quantity, unit_price: item.unitPrice })),
  };
  if (form.description) payload.description = form.description;
  return payload;
}

export function toPreferenceResponseModel(dto) {
  if (!dto) return null;
  return { preferenceId: dto.preference_id, publicKey: dto.public_key };
}

export function toProcessPaymentPayload(form) {
  const payload = {
    token: form.token,
    transaction_amount: form.transactionAmount,
    payment_method_id: form.paymentMethodId,
    installments: form.installments,
    payer_email: form.payerEmail,
  };
  if (form.preferenceId) payload.preference_id = form.preferenceId;
  return payload;
}

export function toPaymentModel(dto) {
  if (!dto) return null;
  return {
    id: String(dto.id),
    amount: dto.amount,
    concept: dto.concept,
    createdAt: dto.created_at,
    currencyId: dto.currency_id,
    description: dto.description,
    externalReference: dto.external_reference,
    installments: dto.installments,
    payerEmail: dto.payer_email,
    paymentId: dto.payment_id,
    paymentMethodId: dto.payment_method_id,
    preferenceId: dto.preference_id,
    status: dto.status,
    statusDetail: dto.status_detail,
  };
}
