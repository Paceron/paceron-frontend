import {
  toUserModel, toRegisterPayload, toTeamModel, toCreateTeamPayload, toUpdateTeamPayload, toAddressPayload,
  toGroupModel, toCreateGroupPayload, toUpdateGroupPayload, toInvitationModel, toInvitePayload, toTierModel,
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
      showGroupsToRunners: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
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

describe('toGroupModel', () => {
  test('maps snake_case fields to camelCase, coerces ids to string, is_main to isDefault', () => {
    const dto = {
      id: 5, team_id: 1, name: 'General', description: null, is_main: true,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    };
    expect(toGroupModel(dto)).toEqual({
      id: '5', teamId: '1', name: 'General', description: null, isDefault: true, trainingPlanId: null,
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
