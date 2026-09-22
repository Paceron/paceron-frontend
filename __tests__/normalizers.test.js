import {
  toUserModel, toRegisterPayload, toUpdatePayload, toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload,
  toGroupModel, toCreateGroupPayload, toUpdateGroupPayload, toInvitationModel, toInvitePayload, toTierModel,
  toCreatePreferencePayload, toPreferenceResponseModel, toProcessPaymentPayload, toPaymentModel, toSubscriptionModel,
  toTeamSearchResultModel, toJoinRequestModel, mergeSessionExercises,
  toGroupCalendarDayModel, toAggregatedCalendarDayModel, toCalendarDayPayload, KEEP_CURRENT_SESSION,
  toTrainingPlanModel, toCreateTrainingPlanPayload, toStampPayload, toBulkAssignPayload,
} from '../services/normalizers.js';

describe('toUserModel', () => {
  test('maps snake_case fields to camelCase', () => {
    const dto = {
      user_id: 3, name: 'pepe', surname: 'lota', email: 'pepa@lota.com',
      dni: '33703637', birth_date: '01/01/1988', status: 'active', phone_contact: '111',
    };
    expect(toUserModel(dto)).toEqual(
      expect.objectContaining({
        userId: 3, name: 'pepe', surname: 'lota', email: 'pepa@lota.com',
        dni: '33703637', birthDate: '01/01/1988', status: 'active', phoneContact: '111',
      }),
    );
  });

  test('returns null for falsy dto', () => {
    expect(toUserModel(null)).toBeNull();
    expect(toUserModel(undefined)).toBeNull();
  });

  test('tolerates absent fields (sparse response)', () => {
    const dto = { user_id: 3, name: 'pepe', email: 'a@b.com' };
    const model = toUserModel(dto);
    expect(model.userId).toBe(3);
    expect(model.city).toBeUndefined();
    expect(model.street).toBeUndefined();
  });

  test('mapea photo_url, null si no viene', () => {
    expect(toUserModel({ user_id: 1, photo_url: 'https://x.com/p.jpg?v=123' }).photoUrl).toBe('https://x.com/p.jpg?v=123');
    expect(toUserModel({ user_id: 1 }).photoUrl).toBeNull();
  });

  test('maps default_theme and allow_team_invitations', () => {
    const dto = { user_id: 1, name: 'A', surname: 'B', default_theme: 'light', allow_team_invitations: false };
    const model = toUserModel(dto);
    expect(model.defaultTheme).toBe('light');
    expect(model.allowTeamInvitations).toBe(false);
  });

  test('defaults allowTeamInvitations to true when absent', () => {
    const dto = { user_id: 1, name: 'A', surname: 'B' };
    expect(toUserModel(dto).allowTeamInvitations).toBe(true);
  });
});

describe('toUpdatePayload — default_theme / allow_team_invitations', () => {
  const BASE_FORM = { firstName: 'A', lastName: 'B', dni: '1', birthDate: '01/01/2000', email: 'a@b.com' };

  test('incluye default_theme cuando viene', () => {
    const payload = toUpdatePayload({ ...BASE_FORM, defaultTheme: 'light' });
    expect(payload.default_theme).toBe('light');
  });

  test('omite default_theme si no viene', () => {
    const payload = toUpdatePayload(BASE_FORM);
    expect(payload.default_theme).toBeUndefined();
  });

  test('incluye allow_team_invitations cuando viene (incluso false)', () => {
    const payload = toUpdatePayload({ ...BASE_FORM, allowTeamInvitations: false });
    expect(payload.allow_team_invitations).toBe(false);
  });

  test('omite allow_team_invitations si es undefined', () => {
    const payload = toUpdatePayload(BASE_FORM);
    expect(payload.allow_team_invitations).toBeUndefined();
  });
});

describe('toRegisterPayload', () => {
  const base = {
    firstName: 'pepe', lastName: 'lota', email: 'a@b.com',
    password: 'secret123', dni: '33703637',
  };

  test('maps required fields to snake_case', () => {
    const out = toRegisterPayload({ ...base, birthDate: '01/01/1988' });
    expect(out).toEqual({
      name: 'pepe', surname: 'lota', email: 'a@b.com',
      password: 'secret123', dni: '33703637', birth_date: '01/01/1988',
    });
  });

  test('converts ISO birthDate (web input) to DD/MM/YYYY', () => {
    const out = toRegisterPayload({ ...base, birthDate: '1988-01-01' });
    expect(out.birth_date).toBe('01/01/1988');
  });

  test('includes only non-empty optional fields', () => {
    const out = toRegisterPayload({
      ...base, birthDate: '01/01/1988',
      country: 'AR', province: '', city: '  ', phoneContact: '111',
    });
    expect(out.country).toBe('AR');
    expect(out.phone_contact).toBe('111');
    expect(out).not.toHaveProperty('province');
    expect(out).not.toHaveProperty('city');
  });
});

describe('toTeamModel', () => {
  test('maps snake_case fields to camelCase and coerces id to string', () => {
    const dto = {
      id: 1, name: 'Corredores del Sur', description: 'desc', level: 'amateur',
      max_members: 20, owner_id: 7, requirements: 'req', status: 'activo',
      country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      show_groups_to_runners: true,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
    };
    expect(toTeamModel(dto)).toEqual({
      id: '1', name: 'Corredores del Sur', description: 'desc', level: 'amateur',
      maxMembers: 20, ownerId: 7, requirements: 'req', status: 'activo',
      country: 'ARG', province: 'BA', city: 'La Plata', street: null, number: null,
      showGroupsToRunners: true, visible: true, isPublic: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
      iconUrl: null,
    });
  });

  test('defaults showGroupsToRunners to false when the backend omits it', () => {
    const dto = { id: 1, name: 'X', max_members: 10, owner_id: 7 };
    expect(toTeamModel(dto).showGroupsToRunners).toBe(false);
  });

  test('returns null for falsy dto', () => {
    expect(toTeamModel(null)).toBeNull();
    expect(toTeamModel(undefined)).toBeNull();
  });

  test('mapea icon_url, null si no viene', () => {
    expect(toTeamModel({ id: 1, icon_url: 'https://x.com/i.jpg?v=123' }).iconUrl).toBe('https://x.com/i.jpg?v=123');
    expect(toTeamModel({ id: 1 }).iconUrl).toBeNull();
  });
});

describe('toCreateTeamPayload', () => {
  test('maps required fields to snake_case', () => {
    const out = toCreateTeamPayload({ name: 'Corredores del Sur', maxMembers: 20, ownerId: 7 });
    expect(out).toEqual({ name: 'Corredores del Sur', max_members: 20, owner_id: 7, create_default_group: true });
  });

  test('includes only non-empty optional fields', () => {
    const out = toCreateTeamPayload({
      name: 'Corredores del Sur', maxMembers: 20, ownerId: 7,
      description: 'desc', level: '', requirements: '  ',
    });
    expect(out.description).toBe('desc');
    expect(out).not.toHaveProperty('level');
    expect(out).not.toHaveProperty('requirements');
  });
});

describe('toUpdateTeamPayload', () => {
  test('includes only non-empty fields known to the backend', () => {
    const out = toUpdateTeamPayload({ name: 'Nuevo nombre', description: 'Nueva descripción', maxMembers: 15 });
    expect(out).toEqual({ name: 'Nuevo nombre', description: 'Nueva descripción', max_members: 15 });
  });

  test('includes showGroupsToRunners as show_groups_to_runners and drops fields the backend does not support (photoUri)', () => {
    const out = toUpdateTeamPayload({ name: 'X', showGroupsToRunners: true, photoUri: 'file://foo.jpg' });
    expect(out).toEqual({ name: 'X', show_groups_to_runners: true });
  });

  test('includes showGroupsToRunners even when explicitly false', () => {
    const out = toUpdateTeamPayload({ name: 'X', showGroupsToRunners: false });
    expect(out).toEqual({ name: 'X', show_groups_to_runners: false });
  });

  test('omits show_groups_to_runners when showGroupsToRunners is not provided', () => {
    const out = toUpdateTeamPayload({ name: 'X' });
    expect(out).not.toHaveProperty('show_groups_to_runners');
  });

  test('includes visible and isPublic when provided', () => {
    const out = toUpdateTeamPayload({ name: 'X', visible: false, isPublic: true });
    expect(out).toEqual({ name: 'X', visible: false, is_public: true });
  });

  test('includes visible/isPublic even when explicitly false', () => {
    const out = toUpdateTeamPayload({ name: 'X', visible: false, isPublic: false });
    expect(out).toEqual({ name: 'X', visible: false, is_public: false });
  });

  test('omits visible/isPublic when not provided', () => {
    const out = toUpdateTeamPayload({ name: 'X' });
    expect(out).not.toHaveProperty('visible');
    expect(out).not.toHaveProperty('is_public');
  });
});

describe('toAddressPayload', () => {
  test('includes only non-empty location fields', () => {
    const out = toAddressPayload({ country: 'ARG', province: 'MZ', city: 'Mendoza Capital' });
    expect(out).toEqual({ country: 'ARG', province: 'MZ', city: 'Mendoza Capital' });
  });

  test('omits empty fields', () => {
    const out = toAddressPayload({ country: 'ARG', province: '', city: '  ' });
    expect(out).toEqual({ country: 'ARG' });
  });
});

describe('toTeamSearchResultModel', () => {
  test('maps search result fields to camelCase and coerces id to string', () => {
    const dto = {
      id: 1, name: 'Corredores del Sur', level: 'amateur',
      max_members: 20, member_count: 12, owner_name: 'Ana Trainer',
      is_public: true, country: 'ARG', province: 'BA', city: 'La Plata',
      icon_url: 'https://x.com/i.jpg',
    };
    expect(toTeamSearchResultModel(dto)).toEqual({
      id: '1', name: 'Corredores del Sur', level: 'amateur',
      maxMembers: 20, memberCount: 12, ownerName: 'Ana Trainer',
      isPublic: true, country: 'ARG', province: 'BA', city: 'La Plata',
      iconUrl: 'https://x.com/i.jpg',
    });
  });

  test('defaults optional fields to null/0 when absent', () => {
    const dto = { id: 2, name: 'Team X', max_members: 15, is_public: false };
    const model = toTeamSearchResultModel(dto);
    expect(model.level).toBeNull();
    expect(model.memberCount).toBe(0);
    expect(model.ownerName).toBeNull();
    expect(model.country).toBeNull();
    expect(model.isPublic).toBe(false);
  });

  test('returns null for falsy dto', () => {
    expect(toTeamSearchResultModel(null)).toBeNull();
    expect(toTeamSearchResultModel(undefined)).toBeNull();
  });
});

describe('toJoinRequestModel', () => {
  test('maps join request fields to camelCase and coerces ids to string', () => {
    const dto = {
      id: 10, team_id: 1, team_name: 'Corredores del Sur',
      runner_id: 5, runner_name: 'Pepe Lota',
      status: 'pending', created_at: '2026-09-01T00:00:00.000Z',
    };
    expect(toJoinRequestModel(dto)).toEqual({
      id: '10', teamId: '1', teamName: 'Corredores del Sur',
      runnerId: 5, runnerName: 'Pepe Lota',
      status: 'pending', createdAt: '2026-09-01T00:00:00.000Z',
    });
  });

  test('defaults teamName/runnerName to null when absent', () => {
    const dto = { id: 11, team_id: 1, runner_id: 5, status: 'pending', created_at: '2026-09-01T00:00:00.000Z' };
    const model = toJoinRequestModel(dto);
    expect(model.teamName).toBeNull();
    expect(model.runnerName).toBeNull();
  });

  test('returns null for falsy dto', () => {
    expect(toJoinRequestModel(null)).toBeNull();
    expect(toJoinRequestModel(undefined)).toBeNull();
  });
});

describe('toGroupModel', () => {
  test('maps snake_case fields to camelCase, coerces ids to string, is_main to isDefault', () => {
    const dto = {
      id: 5, team_id: 1, name: 'General', description: null, is_main: true,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    };
    expect(toGroupModel(dto)).toEqual({
      id: '5', teamId: '1', name: 'General', description: null, isDefault: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  test('defaults isDefault to false when is_main is omitted', () => {
    const dto = { id: 6, team_id: 1, name: 'Avanzados' };
    expect(toGroupModel(dto).isDefault).toBe(false);
  });

  test('returns null for falsy dto', () => {
    expect(toGroupModel(null)).toBeNull();
    expect(toGroupModel(undefined)).toBeNull();
  });
});

describe('toCreateGroupPayload', () => {
  test('maps team_id and name, includes description only if present', () => {
    expect(toCreateGroupPayload('3', { name: 'Avanzados' })).toEqual({ team_id: 3, name: 'Avanzados' });
    expect(toCreateGroupPayload('3', { name: 'Avanzados', description: 'Ritmo alto' }))
      .toEqual({ team_id: 3, name: 'Avanzados', description: 'Ritmo alto' });
  });

  test('omits description when blank', () => {
    expect(toCreateGroupPayload('3', { name: 'Avanzados', description: '  ' })).toEqual({ team_id: 3, name: 'Avanzados' });
  });
});

describe('toUpdateGroupPayload', () => {
  test('includes only provided fields', () => {
    expect(toUpdateGroupPayload({ name: 'Nuevo nombre' })).toEqual({ name: 'Nuevo nombre' });
    expect(toUpdateGroupPayload({ name: 'Nuevo nombre', description: 'Nueva desc' }))
      .toEqual({ name: 'Nuevo nombre', description: 'Nueva desc' });
  });

  test('allows clearing description to null', () => {
    expect(toUpdateGroupPayload({ name: 'X', description: null })).toEqual({ name: 'X', description: null });
  });

  test('omits name when blank', () => {
    expect(toUpdateGroupPayload({ name: '  ', description: 'Y' })).toEqual({ description: 'Y' });
  });
});

describe('toInvitationModel', () => {
  test('maps snake_case fields to camelCase and coerces ids to string', () => {
    const dto = {
      id: 10, team_id: 1, invitee_email: 'a@b.com', invitee_id: 5, invitee_name: 'Pepe Lota',
      group_id: 3, team_name: 'Corredores del Sur', inviter_id: 7, inviter_name: 'Ana Trainer',
      status: 'pending', expires_at: '2026-08-01T00:00:00.000Z', created_at: '2026-07-31T00:00:00.000Z',
    };
    expect(toInvitationModel(dto)).toEqual({
      id: '10', teamId: '1', email: 'a@b.com', inviteeId: 5, inviteeName: 'Pepe Lota',
      groupId: '3', teamName: 'Corredores del Sur', inviterName: 'Ana Trainer',
      status: 'pending', expiresAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-07-31T00:00:00.000Z',
    });
  });

  test('defaults groupId/teamName to null when the backend omits them', () => {
    const dto = { id: 10, team_id: 1, invitee_email: 'a@b.com', status: 'pending' };
    const model = toInvitationModel(dto);
    expect(model.groupId).toBeNull();
    expect(model.teamName).toBeNull();
    expect(model.inviterName).toBeNull();
  });

  test('returns null for falsy dto', () => {
    expect(toInvitationModel(null)).toBeNull();
    expect(toInvitationModel(undefined)).toBeNull();
  });
});

describe('toInvitePayload', () => {
  test('includes group_id when groupId is provided', () => {
    expect(toInvitePayload('a@b.com', '3')).toEqual({ email: 'a@b.com', group_id: 3 });
  });

  test('omits group_id when groupId is falsy', () => {
    expect(toInvitePayload('a@b.com', '')).toEqual({ email: 'a@b.com' });
    expect(toInvitePayload('a@b.com', null)).toEqual({ email: 'a@b.com' });
    expect(toInvitePayload('a@b.com', undefined)).toEqual({ email: 'a@b.com' });
  });
});

describe('toTierModel', () => {
  test('maps snake_case fields to camelCase', () => {
    const dto = {
      id: 2, name: 'premium', description: 'Beneficios premium', payment_required: true,
      role_id: 1, role_name: 'corredor', tier_amount: 4999,
    };
    expect(toTierModel(dto)).toEqual({
      id: '2', name: 'premium', description: 'Beneficios premium', paymentRequired: true,
      roleId: 1, roleName: 'corredor', tierAmount: 4999,
    });
  });

  test('defaults tierAmount to 0 and description to null when absent', () => {
    const dto = { id: 1, name: 'base', payment_required: false, role_id: 1, role_name: 'corredor' };
    const model = toTierModel(dto);
    expect(model.tierAmount).toBe(0);
    expect(model.description).toBeNull();
  });

  test('returns null for falsy dto', () => {
    expect(toTierModel(null)).toBeNull();
    expect(toTierModel(undefined)).toBeNull();
  });
});

describe('toCreatePreferencePayload', () => {
  test('mapea items a snake_case, omite description si no viene', () => {
    const form = { concept: 'order', items: [{ title: 'Item', quantity: 2, unitPrice: 500 }] };
    expect(toCreatePreferencePayload(form)).toEqual({
      concept: 'order',
      items: [{ title: 'Item', quantity: 2, unit_price: 500 }],
    });
  });

  test('incluye description cuando viene', () => {
    const form = { concept: 'order', description: 'Compra de prueba', items: [{ title: 'Item', quantity: 1, unitPrice: 100 }] };
    expect(toCreatePreferencePayload(form).description).toBe('Compra de prueba');
  });

  test('incluye installment_id cuando viene', () => {
    const form = { concept: 'subscription', items: [{ title: 'Cuota', quantity: 1, unitPrice: 1500 }], installmentId: 501 };
    expect(toCreatePreferencePayload(form).installment_id).toBe(501);
  });

  test('omite installment_id si no viene', () => {
    const form = { concept: 'order', items: [{ title: 'Item', quantity: 1, unitPrice: 100 }] };
    expect(toCreatePreferencePayload(form).installment_id).toBeUndefined();
  });
});

describe('toPreferenceResponseModel', () => {
  test('mapea preference_id/public_key a camelCase', () => {
    expect(toPreferenceResponseModel({ preference_id: 'pref-1', public_key: 'PUB-KEY' })).toEqual({
      preferenceId: 'pref-1', publicKey: 'PUB-KEY',
    });
  });

  test('returns null for falsy dto', () => {
    expect(toPreferenceResponseModel(null)).toBeNull();
  });
});

describe('toProcessPaymentPayload', () => {
  test('mapea a snake_case, incluye preference_id cuando viene', () => {
    const form = {
      token: 'tok', transactionAmount: 1000, paymentMethodId: 'visa', installments: 1, payerEmail: 'a@b.com', preferenceId: 'pref-1',
    };
    expect(toProcessPaymentPayload(form)).toEqual({
      token: 'tok', transaction_amount: 1000, payment_method_id: 'visa', installments: 1, payer_email: 'a@b.com', preference_id: 'pref-1',
    });
  });

  test('omite preference_id si no viene', () => {
    const form = { token: 'tok', transactionAmount: 1000, paymentMethodId: 'visa', installments: 1, payerEmail: 'a@b.com' };
    expect(toProcessPaymentPayload(form).preference_id).toBeUndefined();
  });

  test('incluye installment_id cuando viene', () => {
    const form = { token: 'tok', transactionAmount: 1500, paymentMethodId: 'master', installments: 1, payerEmail: 'a@b.com', installmentId: 501 };
    expect(toProcessPaymentPayload(form).installment_id).toBe(501);
  });

  test('omite installment_id si no viene', () => {
    const form = { token: 'tok', transactionAmount: 1000, paymentMethodId: 'visa', installments: 1, payerEmail: 'a@b.com' };
    expect(toProcessPaymentPayload(form).installment_id).toBeUndefined();
  });
});

describe('toPaymentModel', () => {
  test('maps snake_case fields to camelCase', () => {
    const dto = {
      id: 1, amount: 1000, concept: 'order', created_at: '2026-09-02T00:00:00.000Z', currency_id: 'ARS',
      description: 'desc', external_reference: 'ext-1', installments: 1, payer_email: 'a@b.com',
      payment_id: 'mp-1', payment_method_id: 'visa', preference_id: 'pref-1', status: 'approved', status_detail: 'accredited',
    };
    expect(toPaymentModel(dto)).toEqual({
      id: '1', amount: 1000, concept: 'order', createdAt: '2026-09-02T00:00:00.000Z', currencyId: 'ARS',
      description: 'desc', externalReference: 'ext-1', installments: 1, payerEmail: 'a@b.com',
      paymentId: 'mp-1', paymentMethodId: 'visa', preferenceId: 'pref-1', status: 'approved', statusDetail: 'accredited',
    });
  });

  test('returns null for falsy dto', () => {
    expect(toPaymentModel(null)).toBeNull();
  });
});

describe('toSubscriptionModel', () => {
  test('maps a first_payment_pending subscription to camelCase', () => {
    const dto = {
      subscription_id: 77, subscription_status: 'first_payment_pending',
      installment_id: 501, installment_number: 1, installment_amount: 1500,
      next_due_date: null, blocked_date: null, paid_installments: 0,
      tier: { id: 11, name: 'premium', hierarchy: 2, payment_required: true },
      role: { id: 3, name: 'corredor' },
      mercadopago: { public_key: 'APP_USR-test' },
    };
    expect(toSubscriptionModel(dto)).toEqual({
      subscriptionId: 77, subscriptionStatus: 'first_payment_pending',
      installmentId: 501, installmentNumber: 1, installmentAmount: 1500,
      nextDueDate: null, blockedDate: null, paidInstallments: 0,
      tier: { id: 11, name: 'premium', hierarchy: 2, paymentRequired: true },
      role: { id: 3, name: 'corredor' },
      mercadopago: { publicKey: 'APP_USR-test' },
    });
  });

  test('maps a free-tier subscription (no installment fields) — tier/role only', () => {
    const dto = { tier: { id: 10, name: 'base', hierarchy: 1, payment_required: false }, role: { id: 3, name: 'corredor' } };
    const model = toSubscriptionModel(dto);
    expect(model.subscriptionId).toBeNull();
    expect(model.subscriptionStatus).toBeNull();
    expect(model.installmentId).toBeNull();
    expect(model.paidInstallments).toBe(0);
    expect(model.tier).toEqual({ id: 10, name: 'base', hierarchy: 1, paymentRequired: false });
  });

  test('tier and role default to null when absent', () => {
    const model = toSubscriptionModel({});
    expect(model.tier).toBeNull();
    expect(model.role).toBeNull();
    expect(model.mercadopago).toBeNull();
  });

  test('returns null for falsy dto', () => {
    expect(toSubscriptionModel(null)).toBeNull();
    expect(toSubscriptionModel(undefined)).toBeNull();
  });
});

describe('mergeSessionExercises', () => {
  const session = {
    exercises: [
      { exerciseId: '1', role: 'warmup', repeatCount: 1, restMinutes: 0 },
      { exerciseId: '2', role: 'main', repeatCount: 3, restMinutes: 2 },
    ],
  };

  test('agrega los ids nuevos al final, con rol "main" y defaults', () => {
    const result = mergeSessionExercises(session, ['5', '6']);
    expect(result).toEqual([
      { exerciseId: '1', role: 'warmup', repeatCount: 1, restMinutes: 0 },
      { exerciseId: '2', role: 'main', repeatCount: 3, restMinutes: 2 },
      { exerciseId: '5', role: 'main', repeatCount: 1, restMinutes: 0 },
      { exerciseId: '6', role: 'main', repeatCount: 1, restMinutes: 0 },
    ]);
  });

  test('no muta el array de ejercicios original de la sesión', () => {
    const before = JSON.stringify(session.exercises);
    mergeSessionExercises(session, ['9']);
    expect(JSON.stringify(session.exercises)).toBe(before);
  });

  test('con lista vacía de ids nuevos, devuelve los existentes sin cambios', () => {
    expect(mergeSessionExercises(session, [])).toEqual(session.exercises);
  });
});

describe('toGroupCalendarDayModel', () => {
  test('mapea un día de descanso', () => {
    const dto = { id: 1, group_id: 5, date: '2026-10-05', kind: 'rest', is_presencial: false };
    expect(toGroupCalendarDayModel(dto)).toEqual({
      id: '1', groupId: '5', date: '2026-10-05', kind: 'rest',
      otherName: null, sessionInstance: null, cancelledReason: null,
      isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null,
      presencialLocation: null, sourcePlanId: null,
    });
  });

  test('mapea un día presencial con sesión instanciada y ubicación', () => {
    const dto = {
      id: 2, group_id: 5, date: '2026-10-06', kind: 'training',
      session_instance: {
        id: 123, name: 'Fartlek 5K', description: null,
        exercises: [{ id: 456, name: 'Trote', role: 'warmup', repeat_count: 1, rest_minutes: 0 }],
      },
      is_presencial: true, presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: -34.6, lng: -58.4, label: 'Plaza' }, source_plan_id: 3,
    };
    const model = toGroupCalendarDayModel(dto);
    expect(model.sessionInstance).toEqual({
      id: '123', name: 'Fartlek 5K', description: null, sourceSessionId: null,
      exercises: [{ id: '456', name: 'Trote', role: 'warmup', repeatCount: 1, restMinutes: 0, sourceExerciseId: null }],
    });
    expect(model.presencialTimeFrom).toBe('08:00');
    expect(model.presencialTimeTo).toBe('09:30');
    expect(model.presencialLocation).toEqual({ lat: -34.6, lng: -58.4, label: 'Plaza' });
    expect(model.sourcePlanId).toBe('3');
  });

  test('mapea session_id/exercise_id de origen cuando el backend los trae (Gap 7)', () => {
    const dto = {
      id: 2, group_id: 5, date: '2026-10-06', kind: 'training',
      session_instance: {
        id: 123, name: 'Fartlek 5K', description: null, session_id: 9,
        exercises: [{ id: 456, name: 'Trote', role: 'warmup', repeat_count: 1, rest_minutes: 0, exercise_id: 4 }],
      },
      is_presencial: false,
    };
    const model = toGroupCalendarDayModel(dto);
    expect(model.sessionInstance.sourceSessionId).toBe('9');
    expect(model.sessionInstance.exercises[0].sourceExerciseId).toBe('4');
  });

  test('session_instance null (día sin sesión, ej. rest/other)', () => {
    const dto = { id: 3, group_id: 5, date: '2026-10-07', kind: 'other', other_name: 'Elongación', session_instance: null, is_presencial: false };
    expect(toGroupCalendarDayModel(dto).sessionInstance).toBeNull();
  });

  test('returns null for falsy dto', () => {
    expect(toGroupCalendarDayModel(null)).toBeNull();
  });
});

describe('toAggregatedCalendarDayModel', () => {
  test('suma group_name/team_id/team_name y mapea presencial_collision', () => {
    const dto = {
      id: 5, group_id: 7, date: '2026-10-05', kind: 'training', other_name: null,
      session_instance: null, cancelled_reason: null, is_presencial: true,
      presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: -34.6, lng: -58.4, label: 'Plaza' },
      source_plan_id: null,
      group_name: 'Elite AM', team_id: 3, team_name: 'Runners Norte',
      presencial_collision: {
        type: 'same_team',
        conflicts: [{ group_id: 9, group_name: 'Elite PM', team_id: 3, team_name: 'Runners Norte', date: '2026-10-05', presencial_time_from: '08:30', presencial_time_to: '10:00' }],
      },
    };
    const model = toAggregatedCalendarDayModel(dto);
    expect(model.groupId).toBe('7');
    expect(model.groupName).toBe('Elite AM');
    expect(model.teamId).toBe('3');
    expect(model.teamName).toBe('Runners Norte');
    expect(model.presencialCollision).toEqual({
      type: 'same_team',
      conflicts: [{ group_id: 9, group_name: 'Elite PM', team_id: 3, team_name: 'Runners Norte', date: '2026-10-05', presencial_time_from: '08:30', presencial_time_to: '10:00' }],
    });
  });

  test('presencialCollision es null si el día no colisiona', () => {
    const dto = {
      id: 5, group_id: 7, date: '2026-10-05', kind: 'rest', other_name: null,
      session_instance: null, cancelled_reason: null, is_presencial: false,
      presencial_time_from: null, presencial_time_to: null, presencial_location: null,
      source_plan_id: null, group_name: 'Elite AM', team_id: 3, team_name: 'Runners Norte',
    };
    const model = toAggregatedCalendarDayModel(dto);
    expect(model.presencialCollision).toBeNull();
  });
});

describe('toCalendarDayPayload', () => {
  test('día de descanso solo manda kind', () => {
    expect(toCalendarDayPayload({ kind: 'rest' })).toEqual({ kind: 'rest' });
  });

  test('otra actividad manda other_name', () => {
    expect(toCalendarDayPayload({ kind: 'other', otherName: 'Elongación' })).toEqual({
      kind: 'other', other_name: 'Elongación',
    });
  });

  test('entrenamiento no presencial manda session_id e is_presencial false, sin horarios/ubicación', () => {
    const payload = toCalendarDayPayload({ kind: 'training', sessionId: '9', isPresencial: false });
    expect(payload).toEqual({ kind: 'training', session_id: 9, is_presencial: false });
  });

  test('entrenamiento presencial manda horarios y ubicación', () => {
    const payload = toCalendarDayPayload({
      kind: 'training', sessionId: '9', isPresencial: true,
      presencialTimeFrom: '08:00', presencialTimeTo: '09:30',
      presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' },
    });
    expect(payload).toEqual({
      kind: 'training', session_id: 9, is_presencial: true,
      presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: -34.6, lng: -58.4, label: 'Plaza' },
    });
  });

  test('entrenamiento con KEEP_CURRENT_SESSION no manda session_id (Gap 7 — conserva la instancia actual)', () => {
    const payload = toCalendarDayPayload({ kind: 'training', sessionId: KEEP_CURRENT_SESSION, isPresencial: false });
    expect(payload).toEqual({ kind: 'training', is_presencial: false });
  });

  test('cancelado manda solo cancelled_reason, sin session_id (el backend lo preserva)', () => {
    expect(toCalendarDayPayload({ kind: 'cancelled', cancelledReason: 'Lluvia' })).toEqual({
      kind: 'cancelled', cancelled_reason: 'Lluvia',
    });
  });
});

describe('toTrainingPlanModel — PlanDay presencial', () => {
  test('mapea default_presencial/default_time_from/default_time_to/default_location a isPresencial/presencialTimeFrom/presencialTimeTo/presencialLocation', () => {
    const dto = {
      id: 1, owner_id: 7, name: 'Plan', description: '', created_at: 'x', updated_at: 'x',
      days: [
        { sequence_no: 1, kind: 'training', other_name: null, session_id: 9, default_presencial: true, default_time_from: '08:00', default_time_to: '09:30', default_location: { lat: -34.6, lng: -58.4, label: 'Plaza' } },
        { sequence_no: 2, kind: 'rest', other_name: null, session_id: null, default_presencial: false, default_time_from: null, default_time_to: null, default_location: null },
      ],
    };
    const model = toTrainingPlanModel(dto);
    expect(model.days[0]).toMatchObject({ isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:30', presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' } });
    expect(model.days[1]).toMatchObject({ isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null, presencialLocation: null });
  });

  test('un PlanDay sin default_presencial (planes viejos, campo nunca seteado) mapea isPresencial false', () => {
    const dto = {
      id: 1, owner_id: 7, name: 'Plan', description: '', created_at: 'x', updated_at: 'x',
      days: [{ sequence_no: 1, kind: 'rest', other_name: null, session_id: null }],
    };
    expect(toTrainingPlanModel(dto).days[0]).toMatchObject({ isPresencial: false, presencialTimeFrom: null, presencialTimeTo: null, presencialLocation: null });
  });
});

describe('toCreateTrainingPlanPayload — PlanDay presencial', () => {
  test('un día training presencial manda default_presencial true + horarios + ubicación', () => {
    const form = {
      ownerId: 7, name: 'Plan', description: '',
      days: [{ sequenceNo: 1, kind: 'training', otherName: null, sessionId: '9', isPresencial: true, presencialTimeFrom: '08:00', presencialTimeTo: '09:30', presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' } }],
    };
    expect(toCreateTrainingPlanPayload(form).days[0]).toMatchObject({
      default_presencial: true, default_time_from: '08:00', default_time_to: '09:30',
      default_location: { lat: -34.6, lng: -58.4, label: 'Plaza' },
    });
  });

  test('un día no presencial manda default_presencial false, horarios y ubicación null', () => {
    const form = {
      ownerId: 7, name: 'Plan', description: '',
      days: [{ sequenceNo: 1, kind: 'rest', otherName: null, sessionId: null, isPresencial: false, presencialTimeFrom: '', presencialTimeTo: '', presencialLocation: null }],
    };
    expect(toCreateTrainingPlanPayload(form).days[0]).toMatchObject({
      default_presencial: false, default_time_from: null, default_time_to: null, default_location: null,
    });
  });
});

describe('toStampPayload', () => {
  test('arma el body de POST stamp', () => {
    expect(toStampPayload({ planId: '5', startDate: '2026-03-10', force: false })).toEqual({
      plan_id: 5, start_date: '2026-03-10', force: false, exclude_dates: [],
    });
  });

  test('force default a false si no se pasa', () => {
    expect(toStampPayload({ planId: '5', startDate: '2026-03-10' })).toEqual({
      plan_id: 5, start_date: '2026-03-10', force: false, exclude_dates: [],
    });
  });

  test('incluye exclude_dates cuando se pasa (Gap 8)', () => {
    expect(toStampPayload({ planId: '5', startDate: '2026-03-10', force: true, excludeDates: ['2026-03-12'] })).toEqual({
      plan_id: 5, start_date: '2026-03-10', force: true, exclude_dates: ['2026-03-12'],
    });
  });
});

describe('toBulkAssignPayload', () => {
  test('arma el body de bulk-assign: dates + el mismo shape que toCalendarDayPayload', () => {
    const payload = toBulkAssignPayload({
      dates: ['2026-10-05', '2026-10-06'],
      day: { kind: 'rest' },
    });
    expect(payload).toEqual({ dates: ['2026-10-05', '2026-10-06'], kind: 'rest' });
  });

  test('con un día de entrenamiento presencial, incluye horario y ubicación', () => {
    const payload = toBulkAssignPayload({
      dates: ['2026-10-05'],
      day: {
        kind: 'training', sessionId: '9', isPresencial: true,
        presencialTimeFrom: '08:00', presencialTimeTo: '09:30',
        presencialLocation: { lat: -34.6, lng: -58.4, label: 'Plaza' },
      },
    });
    expect(payload).toEqual({
      dates: ['2026-10-05'], kind: 'training', session_id: 9, is_presencial: true,
      presencial_time_from: '08:00', presencial_time_to: '09:30',
      presencial_location: { lat: -34.6, lng: -58.4, label: 'Plaza' },
    });
  });
});
