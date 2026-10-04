// Mismo problema que pending-session-nav.js, para /training-session-review
// (useSessionReviewStore#reviewSlot en vez de pendingSession). Más simple
// que ese caso: session-review-screen.jsx#ReviewFlow YA sabe pedir
// sessionInstance por REST cuando no vino en el slot
// (`useSessionInstance(sessionInstanceId, !slot.sessionInstance)`), así que
// `reviewSlotFromNavParams` no necesita fetch propio -- alcanza con
// reconstruir el slot con `sessionInstance: null` y dejar que la pantalla
// lo complete sola.
export function buildReviewSlotNavParams(reviewSlot) {
  if (!reviewSlot) return {};
  const sessionInstanceId = reviewSlot.sessionInstanceId ?? reviewSlot.sessionInstance?.id;
  const params = {
    sessionInstanceId: sessionInstanceId != null ? String(sessionInstanceId) : undefined,
    date: reviewSlot.date ?? undefined,
    sessionName: reviewSlot.sessionName ?? reviewSlot.sessionInstance?.name ?? undefined,
    role: reviewSlot.role ?? undefined,
    athleteUserId: reviewSlot.athleteUserId != null ? String(reviewSlot.athleteUserId) : undefined,
    mode: reviewSlot.mode ?? undefined,
    completionStatus: reviewSlot.completionStatus ?? undefined,
    teamId: reviewSlot.teamId != null ? String(reviewSlot.teamId) : undefined,
    teamName: reviewSlot.teamName ?? undefined,
    groupName: reviewSlot.groupName ?? undefined,
  };
  // expo-router serializa `undefined` como el string literal "undefined" en
  // la URL -- se descartan las claves ausentes en vez de dejarlas pasar.
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}

export function reviewSlotFromNavParams(params) {
  if (!params?.sessionInstanceId) return null;
  return {
    sessionInstanceId: params.sessionInstanceId,
    sessionInstance: null,
    date: params.date ?? null,
    sessionName: params.sessionName ?? null,
    role: params.role ?? 'runner',
    athleteUserId: params.athleteUserId ?? null,
    mode: params.mode ?? 'manual',
    completionStatus: params.completionStatus ?? null,
    teamId: params.teamId ?? null,
    teamName: params.teamName ?? null,
    groupName: params.groupName ?? null,
  };
}
