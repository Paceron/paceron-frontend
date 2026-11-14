import { normalizeForSearch } from './attendance-filter.js';

export function buildParticipantRows({ participantUserIds = [], members = [], progress = [] } = {}) {
  const memberById = new Map((members ?? []).map((member) => [String(member?.userId), member]));
  const progressById = new Map((progress ?? []).map((entry) => [String(entry?.userId), entry]));

  return (participantUserIds ?? []).map((userId) => {
    const id = String(userId);
    const member = memberById.get(id);
    return {
      userId: id,
      name: member?.name ?? 'Corredor',
      photoUrl: member?.photoUrl ?? null,
      progress: progressById.get(id) ?? null,
    };
  });
}

export function sortParticipantsByName(rows = []) {
  return [...(rows ?? [])].sort((a, b) => {
    const byName = String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'es', {
      sensitivity: 'base',
    });
    if (byName !== 0) return byName;
    return String(a?.userId ?? '').localeCompare(String(b?.userId ?? ''));
  });
}

export function filterParticipants(rows = [], query = '') {
  const needle = normalizeForSearch(query).trim();
  if (!needle) return rows;
  return (rows ?? []).filter((row) => normalizeForSearch(row?.name).includes(needle));
}
