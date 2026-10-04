// /trainer-session-review depende de `pendingSession` (Zustand, en memoria,
// sin persist) -- un F5 en web reinicia el store y la pantalla mandaba a "/"
// aunque la URL siguiera siendo válida (bug real, 2026-10-05). Estas dos
// funciones son las dos puntas del mismo contrato: `buildTrainerReviewNavParams`
// arma los query params al navegar (siempre, no solo en el fallback -- así la
// URL ya queda resiliente desde el primer render), `pendingSessionFromReviewParams`
// reconstruye un objeto con la misma forma de `pendingSession` a partir de esos
// params más la instancia recién pedida por REST. El caller sigue prefiriendo
// el `pendingSession` del store cuando existe (sin fetch, instantáneo) -- esto
// solo cubre el caso en el que el store está vacío.
export function buildTrainerReviewNavParams(pendingSession) {
  if (!pendingSession) return {};
  const params = {
    sessionInstanceId: pendingSession.sessionInstance?.id != null ? String(pendingSession.sessionInstance.id) : undefined,
    teamId: pendingSession.teamId != null ? String(pendingSession.teamId) : undefined,
    groupId: pendingSession.groupId != null ? String(pendingSession.groupId) : undefined,
    date: pendingSession.date ?? undefined,
    teamName: pendingSession.teamName ?? undefined,
    groupName: pendingSession.groupName ?? undefined,
    sessionName: pendingSession.sessionInstance?.name ?? undefined,
  };
  if (pendingSession.presencialLocation) {
    params.presencialLat = String(pendingSession.presencialLocation.lat);
    params.presencialLng = String(pendingSession.presencialLocation.lng);
    if (pendingSession.presencialLocation.label) params.presencialLabel = pendingSession.presencialLocation.label;
  }
  // expo-router serializa cualquier valor `undefined` como el string literal
  // "undefined" en la URL -- se descartan las claves ausentes en vez de
  // dejarlas pasar.
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}

export function pendingSessionFromReviewParams(params, fetchedSessionInstance) {
  if (!params?.sessionInstanceId) return null;
  return {
    sessionInstance: {
      id: params.sessionInstanceId,
      name: fetchedSessionInstance?.name ?? params.sessionName ?? null,
      exercises: fetchedSessionInstance?.exercises ?? [],
    },
    teamId: params.teamId ?? null,
    groupId: params.groupId ?? null,
    date: params.date ?? null,
    teamName: params.teamName ?? null,
    groupName: params.groupName ?? null,
    presencialLocation: params.presencialLat != null
      ? { lat: Number(params.presencialLat), lng: Number(params.presencialLng), label: params.presencialLabel ?? null }
      : null,
  };
}
