function joinNames(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export function resolveCompetitionWinner({ winnerUserIds = [], members = [] } = {}) {
  const memberById = new Map((members ?? []).map((member) => [String(member?.userId), member]));
  const names = [...new Set((winnerUserIds ?? []).map((id) => String(id)))].map(
    (id) => memberById.get(id)?.name ?? 'Corredor',
  );

  if (names.length === 0) {
    return {
      kind: 'none',
      names: [],
      text: 'Sin ganador: no hubo intentos registrados.',
    };
  }
  if (names.length === 1) return { kind: 'winner', names, text: names[0] };
  return { kind: 'tie', names, text: `Empate: ${joinNames(names)}` };
}
