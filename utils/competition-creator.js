export function resolveCompetitionCreatorName({ competition, members = [], ownerId = null, ownerName = null } = {}) {
  const creatorId = competition?.createdByUserId;
  if (creatorId == null || creatorId === 'undefined' || creatorId === 'null') return null;

  const role = competition?.createdByRole;
  if (ownerId != null && String(ownerId) === String(creatorId)) {
    return ownerName?.trim() || (role === 'runner' ? 'Corredor' : 'Entrenador');
  }

  const member = members.find((item) => String(item.userId) === String(creatorId));
  if (member?.name) return member.name;

  if (role === 'trainer') return 'Entrenador';
  if (role === 'runner') return 'Corredor';
  return 'Integrante del equipo';
}
